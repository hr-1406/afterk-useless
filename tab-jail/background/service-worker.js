// =============================================================
// TAB JAIL — Background Service Worker
// =============================================================
// Orchestrates: website classification, activity state, scoring,
// and the toolbar toggle for the persistent HUD.

importScripts('website-classifier.js', 'score-engine.js');

console.log("TAB JAIL service worker started");

// --- State ---
let activeTabId = null;
let currentWebsite = "Unknown";
let currentCategory = "unknown";
let isCurrentlyActive = false;

// Scoring timers
let productiveActiveSince = null;
let productiveAccumulatedMs = 0;
let inactivityStartedAt = null;

// Restore timer state after service worker restart
chrome.storage.local.get(
    ['productiveAccumulatedMs', 'productiveActiveSince', 'inactivityStartedAt', 'currentCategory', 'currentWebsite'],
    (data) => {
        if (data.productiveAccumulatedMs) productiveAccumulatedMs = data.productiveAccumulatedMs;
        if (data.productiveActiveSince) productiveActiveSince = data.productiveActiveSince;
        if (data.inactivityStartedAt) inactivityStartedAt = data.inactivityStartedAt;
        if (data.currentCategory) currentCategory = data.currentCategory;
        if (data.currentWebsite) currentWebsite = data.currentWebsite;
    }
);

// Debug: 10s for testing productive bonus. Change to 60000 for production.
const PRODUCTIVE_INTERVAL_MS = 10000;

// =============================================================
// Score Timer Processing
// =============================================================
async function processScoreTimers() {
    await scoreEngine.checkBreakState();
    const now = Date.now();

    if (currentCategory === 'productive') {
        // Productive bonus: +2 per interval of active time
        if (isCurrentlyActive && productiveActiveSince) {
            productiveAccumulatedMs += (now - productiveActiveSince);
            productiveActiveSince = now;

            while (productiveAccumulatedMs >= PRODUCTIVE_INTERVAL_MS) {
                productiveAccumulatedMs -= PRODUCTIVE_INTERVAL_MS;
                await scoreEngine.addPoints(2, "productive_minute");
            }
        }

        // Inactivity penalty: -1 per 30s inactive on productive site
        if (!isCurrentlyActive && inactivityStartedAt) {
            while ((now - inactivityStartedAt) >= 30000) {
                inactivityStartedAt += 30000;
                await scoreEngine.removePoints(1, "inactivity_penalty");
            }
        }
    }

    // Persist timer state in case service worker suspends
    await chrome.storage.local.set({
        productiveActiveSince,
        productiveAccumulatedMs,
        inactivityStartedAt
    });
}

// Tick every second while the service worker is alive
setInterval(processScoreTimers, 1000);

// =============================================================
// Activity State
// =============================================================
async function updateActivityState(active, timestamp) {
    await processScoreTimers();
    const now = timestamp || Date.now();

    if (active && !isCurrentlyActive) {
        // Became active
        if (currentCategory === 'productive') {
            productiveActiveSince = now;
            inactivityStartedAt = null;
        }
    } else if (!active && isCurrentlyActive) {
        // Became inactive
        if (currentCategory === 'productive') {
            productiveActiveSince = null;
            inactivityStartedAt = now;
        }
    }

    isCurrentlyActive = active;
    await chrome.storage.local.set({
        activityState: active ? "active" : "inactive",
        lastActivityTime: now
    });
}

// =============================================================
// Tab / Navigation Handling
// =============================================================
async function handleTabUpdate(tabId, isTabSwitch) {
    try {
        const tab = await chrome.tabs.get(tabId);
        if (!tab.url) return;

        await processScoreTimers();

        const newCategory = classifyWebsite(tab.url);
        let newWebsite = "Unknown";

        try {
            newWebsite = new URL(tab.url).hostname;
        } catch (e) {
            newWebsite = tab.url;
        }

        if (/^(chrome|brave|edge|about):/.test(tab.url)) {
            newWebsite = "System Page";
        }

        console.log(`TAB JAIL: ${newWebsite} → ${newCategory}`);

        // Distraction penalty on entry
        if (newCategory === 'distracting' && (isTabSwitch || currentCategory !== 'distracting')) {
            await scoreEngine.removePoints(5, "distraction_penalty");
        }

        currentCategory = newCategory;
        currentWebsite = newWebsite;
        activeTabId = tabId;

        await chrome.storage.local.set({
            currentWebsite,
            currentCategory
        });
        
        if (newCategory === 'productive') {
            chrome.tabs.sendMessage(tabId, { type: "START_EYE_TRACKING" }).catch(()=>{});
        } else {
            chrome.tabs.sendMessage(tabId, { type: "STOP_EYE_TRACKING" }).catch(()=>{});
        }

        // Reset timers for new context
        productiveActiveSince = null;
        inactivityStartedAt = null;
        isCurrentlyActive = false;
        await updateActivityState(true, Date.now());

    } catch (error) {
        console.error("TAB JAIL tab update error:", error);
    }
}

// Tab switched
chrome.tabs.onActivated.addListener((info) => {
    handleTabUpdate(info.tabId, true);
});

// Tab navigated / loaded
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url || changeInfo.status === 'complete') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id === tabId) {
                handleTabUpdate(tabId, false);
            }
        });
    }
});

// =============================================================
// Activity Messages from Content Scripts
// =============================================================
chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === "USER_ACTIVITY" && sender.tab && sender.tab.id) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id === sender.tab.id) {
                activeTabId = sender.tab.id;
                updateActivityState(message.isActive, message.timestamp).catch((err) => {
                    console.error("TAB JAIL activity error:", err);
                });
            }
        });
    } else if (message.type === "PUNISHMENT_COMPLETE") {
        scoreEngine.addPoints(50, "punishment_escaped").catch(console.error);
    }
});

// =============================================================
// Toolbar Icon → Toggle Standalone Popup Window
// =============================================================
let popupWindowId = null;

chrome.action.onClicked.addListener(async () => {
    try {
        // If the window is already open, focus it
        if (popupWindowId !== null) {
            try {
                await chrome.windows.update(popupWindowId, { focused: true });
                return;
            } catch (e) {
                // Window was closed manually by the user
                popupWindowId = null;
            }
        }

        // Open a new standalone popup window
        const win = await chrome.windows.create({
            url: "popup/popup.html",
            type: "popup",
            width: 320,
            height: 450,
            focused: true
        });
        popupWindowId = win.id;
    } catch (err) {
        console.error("TAB JAIL popup creation error:", err);
    }
});

