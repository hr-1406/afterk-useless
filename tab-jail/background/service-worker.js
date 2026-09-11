import { classifyWebsite } from './website-classifier.js';
import * as scoreEngine from './score-engine.js';

console.log("TAB JAIL background service worker active");

// Track active tab globally to ensure we only apply updates from the focused context
let activeTabId = null;
let currentWebsite = "Unknown";
let currentCategory = "unknown";
let isCurrentlyActive = false;

// Timers for scoring
let productiveActiveSince = null;
let productiveAccumulatedMs = 0;
let inactivityStartedAt = null;

// Initialize state from storage in case the service worker was restarted
chrome.storage.local.get(['productiveAccumulatedMs', 'productiveActiveSince', 'inactivityStartedAt', 'currentCategory', 'currentWebsite'], (data) => {
    if (data.productiveAccumulatedMs) productiveAccumulatedMs = data.productiveAccumulatedMs;
    if (data.productiveActiveSince) productiveActiveSince = data.productiveActiveSince;
    if (data.inactivityStartedAt) inactivityStartedAt = data.inactivityStartedAt;
    if (data.currentCategory) currentCategory = data.currentCategory;
    if (data.currentWebsite) currentWebsite = data.currentWebsite;
});

// For debugging ONLY: 10 seconds for testing. Restore to 60000 for production.
const DEBUG_PRODUCTIVE_INTERVAL = 10000; 

async function processScoreTimers() {
    const now = Date.now();
    
    if (currentCategory === 'productive') {
        // Process productive time
        if (isCurrentlyActive && productiveActiveSince) {
            productiveAccumulatedMs += (now - productiveActiveSince);
            productiveActiveSince = now; // roll forward
            
            while (productiveAccumulatedMs >= DEBUG_PRODUCTIVE_INTERVAL) {
                productiveAccumulatedMs -= DEBUG_PRODUCTIVE_INTERVAL;
                await scoreEngine.addPoints(2, "productive_minute");
            }
        }
        
        // Process inactivity penalty
        if (!isCurrentlyActive && inactivityStartedAt) {
            while ((now - inactivityStartedAt) >= 30000) { // 30 seconds = -1 point
                inactivityStartedAt += 30000; // roll forward safely
                await scoreEngine.removePoints(1, "inactivity_penalty");
            }
        }
    }
    
    // Save timer state in case of suspend
    await chrome.storage.local.set({
        productiveActiveSince,
        productiveAccumulatedMs,
        inactivityStartedAt
    });
}

// Tick every second to process timers reliably while SW is awake
setInterval(processScoreTimers, 1000);

async function updateActivityState(isActive, timestamp) {
    // First, process any pending time before state changes to guarantee accuracy
    await processScoreTimers();
    
    const now = timestamp || Date.now();
    
    if (isActive && !isCurrentlyActive) {
        // Transition from inactive to active
        if (currentCategory === 'productive') {
            productiveActiveSince = now;
            inactivityStartedAt = null;
        }
    } else if (!isActive && isCurrentlyActive) {
        // Transition from active to inactive
        if (currentCategory === 'productive') {
            productiveActiveSince = null;
            inactivityStartedAt = now;
        }
    }
    
    isCurrentlyActive = isActive;
    
    await chrome.storage.local.set({
        activityState: isActive ? "active" : "inactive",
        lastActivityTime: now
    });
}

async function handleTabUpdate(tabId, isTabSwitch) {
    try {
        const tab = await chrome.tabs.get(tabId);
        if (!tab.url) return;

        // Process previous state before switching away
        await processScoreTimers();

        const newCategory = classifyWebsite(tab.url);
        let newWebsite = "Unknown";
        
        try {
            const urlObj = new URL(tab.url);
            newWebsite = urlObj.hostname;
        } catch(e) {
            newWebsite = tab.url;
        }

        if (newWebsite.startsWith("chrome://") || newWebsite.startsWith("brave://") || newWebsite.startsWith("about:")) {
             newWebsite = "System Page";
        }

        console.log(`TAB JAIL WEBSITE\nURL: ${tab.url}\nCATEGORY: ${newCategory}`);

        // Trigger distraction penalty ONLY on entry/switch
        if (newCategory === 'distracting') {
            if (isTabSwitch || currentCategory !== 'distracting') {
                await scoreEngine.removePoints(5, "distraction_penalty");
            }
        }
        
        currentCategory = newCategory;
        currentWebsite = newWebsite;
        activeTabId = tabId;

        await chrome.storage.local.set({
            currentWebsite: currentWebsite,
            currentCategory: currentCategory
        });

        // Tab switch implies active interaction in the new tab; reset state
        const now = Date.now();
        productiveActiveSince = null; 
        inactivityStartedAt = null;
        isCurrentlyActive = false; // Set false so updateActivityState detects transition
        
        await updateActivityState(true, now);
        
    } catch (error) {
        console.error("TAB JAIL Error getting tab info:", error);
    }
}

// Detect when active tab changes
chrome.tabs.onActivated.addListener((activeInfo) => {
    handleTabUpdate(activeInfo.tabId, true);
});

// Detect when tab navigates or updates (within the same tab)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === 'complete') {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0] && tabs[0].id === tabId) {
                // Same tab ID means this is navigation, not a tab switch
                handleTabUpdate(tabId, false);
            }
        });
    }
});

// Listen for activity from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "USER_ACTIVITY") {
        console.log(`TAB JAIL ACTIVITY EVENT RECEIVED [Tab ${sender.tab?.id}, TS ${message.timestamp}]`);
        
        if (sender.tab && sender.tab.id) {
            // Strictly query the currently active tab to guard against suspended state and orphan tabs
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (tabs[0] && tabs[0].id === sender.tab.id) {
                    activeTabId = sender.tab.id;
                    updateActivityState(message.isActive, message.timestamp).catch(err => {
                        console.error("TAB JAIL Error in updateActivityState:", err);
                    });
                }
            });
        }
    }
});

// Listen for toolbar icon clicks
chrome.action.onClicked.addListener((tab) => {
    if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_TAB_JAIL_PANEL" }).catch(err => {
            console.error("TAB JAIL: Could not send toggle message. Content script might not be loaded.", err);
        });
    }
});
