// =============================================================
// TAB JAIL — Persistent HUD (Content Script)
// =============================================================
// Injects a Shadow DOM panel into the webpage.
// Visibility is controlled by `hudEnabled` in chrome.storage.local.
// The toolbar icon toggles hudEnabled; this script reacts to it.
//
// Completely independent from:
//   - scoring rules
//   - activity tracker
//   - website classifier
//   - inactivity countdown
//
// This is purely a visualization layer.

(function () {
    "use strict";

    let shadowRoot = null;
    let hostElement = null;
    let notificationTimer = null;

    // --- Helpers ---

    function timeAgo(ts) {
        if (!ts) return "Unknown";
        const s = Math.floor((Date.now() - ts) / 1000);
        if (s < 2) return "Just now";
        if (s < 60) return s + "s ago";
        return Math.floor(s / 60) + "m ago";
    }

    // --- Build the HUD ---

    function buildHUD() {
        // Prevent duplicates
        if (document.getElementById('tab-jail-panel-host')) return;

        hostElement = document.createElement('div');
        hostElement.id = 'tab-jail-panel-host';
        hostElement.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483647;display:none;';
        document.documentElement.appendChild(hostElement);

        shadowRoot = hostElement.attachShadow({ mode: 'closed' });

        // Load CSS inside shadow DOM
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('content/tab-jail-hud.css');
        shadowRoot.appendChild(link);

        // Build DOM
        const wrapper = document.createElement('div');
        wrapper.id = 'tab-jail-hud-container';
        wrapper.innerHTML = `
            <div id="hud-notification"></div>
            <div id="tab-jail-hud">
                <div id="tab-jail-break-banner" style="display:none; background: #00ff00; color: #000; padding: 10px; text-align: center; font-weight: bold; font-family: monospace; border-bottom: 2px solid #000;">
                    100/100 — YOU EARNED A BREAK<br>
                    <span id="tab-jail-break-time">05:00</span>
                </div>
                <div id="tab-jail-hud-header">
                    <h2>🔒 TAB JAIL</h2>
                    <div id="tab-jail-hud-controls">
                        <button class="hud-btn" id="hud-btn-min">_</button>
                        <button class="hud-btn" id="hud-btn-close">×</button>
                    </div>
                </div>
                <div class="hud-block">
                    <span class="hud-label">SCORE</span>
                    <div class="hud-score-row">
                        <span class="hud-score-main" id="hud-score">50</span>
                        <span class="hud-score-max">/ 100</span>
                    </div>
                    <div class="hud-progress-bg">
                        <div class="hud-progress-fill" id="hud-progress" style="width:50%"></div>
                    </div>
                </div>
                <div class="hud-block">
                    <span class="hud-label">WEBSITE</span>
                    <span class="hud-value" id="hud-site">Detecting...</span>
                </div>
                <div class="hud-block">
                    <span class="hud-label">CATEGORY</span>
                    <span class="hud-value" id="hud-category">⚪ UNKNOWN</span>
                </div>
                <div class="hud-block">
                    <span class="hud-label">ACTIVITY</span>
                    <span class="hud-value" id="hud-activity">⚪ UNKNOWN</span>
                </div>
                <div class="hud-block">
                    <span class="hud-label">LAST ACTIVITY</span>
                    <span class="hud-value" id="hud-last-activity">Unknown</span>
                </div>
            </div>
            <button id="tab-jail-hud-minimized">🔒 TAB JAIL</button>
        `;
        shadowRoot.appendChild(wrapper);

        // --- Controls ---
        const hudPanel = shadowRoot.getElementById('tab-jail-hud');
        const minBtn = shadowRoot.getElementById('tab-jail-hud-minimized');

        shadowRoot.getElementById('hud-btn-min').addEventListener('click', () => {
            hudPanel.style.display = 'none';
            minBtn.style.display = 'block';
        });

        shadowRoot.getElementById('hud-btn-close').addEventListener('click', () => {
            // Close = turn off persistent overlay globally
            chrome.storage.local.set({ hudEnabled: false });
        });

        minBtn.addEventListener('click', () => {
            hudPanel.style.display = 'flex';
            minBtn.style.display = 'none';
        });

        // --- Initial data load ---
        chrome.storage.local.get(
            ['score', 'currentWebsite', 'currentCategory', 'activityState', 'lastActivityTime', 'hudEnabled', 'breakEndTime'],
            (data) => {
                hostElement.style.display = data.hudEnabled === true ? 'block' : 'none';
                renderData(data);
            }
        );

        // --- React to storage changes ---
        chrome.storage.onChanged.addListener((changes, ns) => {
            if (ns !== 'local') return;

            // Toggle visibility
            if (changes.hudEnabled) {
                hostElement.style.display = changes.hudEnabled.newValue === true ? 'block' : 'none';
            }

            // Re-render data fields
            chrome.storage.local.get(
                ['score', 'currentWebsite', 'currentCategory', 'activityState', 'lastActivityTime', 'breakEndTime'],
                renderData
            );
        });

        // --- Score notifications from the service worker ---
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.type === "SCORE_CHANGED") {
                showNotification(msg);
            }
        });

        // --- Tick "last activity" and break timer every second ---
        setInterval(() => {
            chrome.storage.local.get(['lastActivityTime', 'breakEndTime'], (d) => {
                if (!shadowRoot) return;
                const el = shadowRoot.getElementById('hud-last-activity');
                if (el) el.textContent = timeAgo(d.lastActivityTime);
                
                if (d.breakEndTime && Date.now() < d.breakEndTime) {
                    const remaining = Math.ceil((d.breakEndTime - Date.now()) / 1000);
                    const min = Math.floor(remaining / 60);
                    const sec = remaining % 60;
                    const breakTimeEl = shadowRoot.getElementById('tab-jail-break-time');
                    if (breakTimeEl) breakTimeEl.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
                }
            });
        }, 1000);
    }

    // --- Render data into the HUD ---

    function renderData(data) {
        if (!shadowRoot) return;

        // Score
        const score = data.score !== undefined ? data.score : 50;
        const scoreEl = shadowRoot.getElementById('hud-score');
        const progEl = shadowRoot.getElementById('hud-progress');
        if (scoreEl) scoreEl.textContent = score;
        if (progEl) {
            progEl.style.width = score + '%';
            progEl.style.backgroundColor = score < 30 ? '#ff003c' : score < 70 ? '#ffaa00' : '#00ff00';
        }

        // Website
        const siteEl = shadowRoot.getElementById('hud-site');
        if (siteEl) siteEl.textContent = data.currentWebsite || "Unknown";

        // Category
        const catEl = shadowRoot.getElementById('hud-category');
        if (catEl) {
            const cat = (data.currentCategory || "unknown").toUpperCase();
            const icon = cat === 'PRODUCTIVE' ? '🟢' : cat === 'DISTRACTING' ? '🔴' : '⚪';
            catEl.textContent = icon + ' ' + cat;
            catEl.className = 'hud-value hud-color-' + (data.currentCategory || 'unknown');
        }

        // Activity
        const actEl = shadowRoot.getElementById('hud-activity');
        if (actEl) {
            const act = (data.activityState || "unknown").toUpperCase();
            const icon = act === 'ACTIVE' ? '🟢' : act === 'INACTIVE' ? '🔴' : '⚪';
            actEl.textContent = icon + ' ' + act;
            actEl.className = 'hud-value hud-color-' + (data.activityState || 'unknown');
        }

        // Last activity
        const lastEl = shadowRoot.getElementById('hud-last-activity');
        if (lastEl) lastEl.textContent = timeAgo(data.lastActivityTime);
        
        // Break Banner
        const breakBanner = shadowRoot.getElementById('tab-jail-break-banner');
        if (breakBanner) {
            if (data.breakEndTime && Date.now() < data.breakEndTime) {
                breakBanner.style.display = 'block';
            } else {
                breakBanner.style.display = 'none';
            }
        }
    }

    // --- Score change notification banner ---

    function showNotification(msg) {
        if (!shadowRoot) return;
        const banner = shadowRoot.getElementById('hud-notification');
        if (!banner) return;

        let text, type;
        if (msg.amount > 0) {
            text = '+' + msg.amount + ' PRODUCTIVITY BONUS';
            type = 'bonus';
        } else if (msg.reason === 'distraction_penalty') {
            text = msg.amount + ' DIGITAL BETRAYAL';
            type = 'penalty';
        } else if (msg.reason === 'inactivity_penalty') {
            text = msg.amount + ' INACTIVITY PENALTY';
            type = 'penalty';
        } else {
            text = msg.amount + ' POINTS';
            type = 'penalty';
        }

        banner.textContent = text;
        banner.className = type === 'bonus' ? 'show' : 'show penalty';

        clearTimeout(notificationTimer);
        notificationTimer = setTimeout(() => {
            banner.className = '';
        }, 3000);
    }

    // --- Initialize ---

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildHUD);
    } else {
        buildHUD();
    }
})();
