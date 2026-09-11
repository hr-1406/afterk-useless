// TAB JAIL HUD
let isMinimized = false;
let notificationTimer = null;

function timeAgo(timestamp) {
    if (!timestamp) return "Unknown";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 2) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
}

let shadowRoot = null;

function initHUD() {
    if (document.getElementById('tab-jail-panel-host')) return;

    const host = document.createElement('div');
    host.id = 'tab-jail-panel-host';
    host.style.position = 'fixed';
    host.style.top = '20px';
    host.style.right = '20px';
    host.style.zIndex = '2147483647';
    host.style.display = 'none'; // Start hidden
    host.style.pointerEvents = 'none'; // Will be overridden in shadow DOM wrapper

    document.documentElement.appendChild(host);
    shadowRoot = host.attachShadow({mode: 'closed'});

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('content/tab-jail-hud.css');
    shadowRoot.appendChild(link);

    const container = document.createElement('div');
    container.id = 'tab-jail-hud-container';
    
    container.innerHTML = `
        <div id="hud-notification"></div>
        <div id="tab-jail-hud">
            <div id="tab-jail-hud-header">
                <h2>🔒 TAB JAIL</h2>
                <div id="tab-jail-hud-controls">
                    <button class="hud-btn" id="hud-btn-min">_</button>
                    <button class="hud-btn" id="hud-btn-close">x</button>
                </div>
            </div>

            <div class="hud-block">
                <span class="hud-label">SCORE</span>
                <div class="hud-score-row">
                    <span class="hud-score-main" id="hud-score">50</span>
                    <span class="hud-score-max">/ 100</span>
                </div>
                <div class="hud-progress-bg">
                    <div class="hud-progress-fill" id="hud-progress" style="width: 50%;"></div>
                </div>
            </div>

            <div class="hud-block">
                <span class="hud-label">SITE</span>
                <span class="hud-value" id="hud-site">Detecting...</span>
                <span class="hud-value hud-color-unknown" id="hud-category">🟢 UNKNOWN</span>
            </div>

            <div class="hud-block">
                <span class="hud-label">ACTIVITY</span>
                <span class="hud-value hud-color-unknown" id="hud-activity">🟢 UNKNOWN</span>
            </div>

            <div class="hud-block">
                <span class="hud-label">LAST ACTIVITY</span>
                <span class="hud-value" id="hud-last-activity">Unknown</span>
            </div>
        </div>
        <button id="tab-jail-hud-minimized">🔒 TAB JAIL</button>
    `;

    shadowRoot.appendChild(container);

    const hud = shadowRoot.getElementById('tab-jail-hud');
    const minBtn = shadowRoot.getElementById('tab-jail-hud-minimized');

    shadowRoot.getElementById('hud-btn-min').addEventListener('click', () => {
        hud.style.display = 'none';
        minBtn.style.display = 'block';
    });

    shadowRoot.getElementById('hud-btn-close').addEventListener('click', () => {
        host.style.display = 'none';
    });

    minBtn.addEventListener('click', () => {
        hud.style.display = 'flex';
        minBtn.style.display = 'none';
    });

    // Read initial state
    chrome.storage.local.get(['score', 'currentWebsite', 'currentCategory', 'activityState', 'lastActivityTime'], updateHUD);

    // Listen to changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            chrome.storage.local.get(['score', 'currentWebsite', 'currentCategory', 'activityState', 'lastActivityTime'], updateHUD);
        }
    });

    // Listen for messages from the service worker
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === "SCORE_CHANGED") {
            showHudNotification(message);
        } else if (message.type === "TOGGLE_TAB_JAIL_PANEL") {
            if (host.style.display === 'none') {
                host.style.display = 'block';
            } else {
                host.style.display = 'none';
            }
        }
    });

    // Update relative time
    setInterval(() => {
        chrome.storage.local.get(['lastActivityTime'], (data) => {
            if (!shadowRoot) return;
            const el = shadowRoot.getElementById('hud-last-activity');
            if (el) el.textContent = timeAgo(data.lastActivityTime);
        });
    }, 1000);
}

function showHudNotification(message) {
    if (!shadowRoot) return;
    const banner = shadowRoot.getElementById('hud-notification');
    if (!banner) return;
    
    let text = "";
    let type = "penalty";
    if (message.amount > 0) {
        text = `+${message.amount} PRODUCTIVITY BONUS`;
        type = "bonus";
    } else if (message.reason === "distraction_penalty") {
        text = `${message.amount} DIGITAL BETRAYAL`;
    } else if (message.reason === "inactivity_penalty") {
        text = `${message.amount} INACTIVITY PENALTY`;
    } else {
        text = `${message.amount} POINTS`;
    }
    
    banner.textContent = text;
    banner.className = type === 'bonus' ? 'show' : 'show penalty';
    
    clearTimeout(notificationTimer);
    notificationTimer = setTimeout(() => {
        banner.className = banner.className.replace('show', '').trim();
    }, 3000);
}

function updateHUD(data) {
    if (!shadowRoot) return;
    const scoreVal = data.score !== undefined ? data.score : 50;
    const scoreEl = shadowRoot.getElementById('hud-score');
    const progEl = shadowRoot.getElementById('hud-progress');
    
    if (scoreEl) scoreEl.textContent = scoreVal;
    if (progEl) {
        progEl.style.width = scoreVal + '%';
        if (scoreVal < 30) progEl.style.backgroundColor = '#ff003c';
        else if (scoreVal < 70) progEl.style.backgroundColor = '#ffaa00';
        else progEl.style.backgroundColor = '#00ff00';
    }

    const siteEl = shadowRoot.getElementById('hud-site');
    if (siteEl) siteEl.textContent = data.currentWebsite || "Unknown";

    const catEl = shadowRoot.getElementById('hud-category');
    if (catEl) {
        const cat = (data.currentCategory || "unknown").toUpperCase();
        if (cat === 'PRODUCTIVE') {
            catEl.innerHTML = '🟢 ' + cat;
            catEl.className = 'hud-value hud-color-productive';
        } else if (cat === 'DISTRACTING') {
            catEl.innerHTML = '🔴 ' + cat;
            catEl.className = 'hud-value hud-color-distracting';
        } else {
            catEl.innerHTML = '⚪ ' + cat;
            catEl.className = 'hud-value hud-color-unknown';
        }
    }

    const actEl = shadowRoot.getElementById('hud-activity');
    if (actEl) {
        const act = (data.activityState || "unknown").toUpperCase();
        if (act === 'ACTIVE') {
            actEl.innerHTML = '🟢 ' + act;
            actEl.className = 'hud-value hud-color-active';
        } else if (act === 'INACTIVE') {
            actEl.innerHTML = '🔴 ' + act;
            actEl.className = 'hud-value hud-color-inactive';
        } else {
            actEl.innerHTML = '⚪ ' + act;
            actEl.className = 'hud-value hud-color-unknown';
        }
    }

    const lastEl = shadowRoot.getElementById('hud-last-activity');
    if (lastEl) {
        lastEl.textContent = timeAgo(data.lastActivityTime);
    }
}

// Safely initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHUD);
} else {
    initHUD();
}
