// TAB JAIL Content Script - Activity Tracker

let inactivityTimer = null;
let countdownInterval = null;
let countdownValue = 10;
let overlayElement = null;
let isActive = true;

// Throttle configuration
let lastMouseMoveTime = 0;
const MOUSE_THROTTLE_MS = 500;

function createOverlay() {
    // Only attempt to create if document.body exists and we haven't already
    if (overlayElement || !document.body) return;

    overlayElement = document.createElement('div');
    overlayElement.id = 'tab-jail-overlay';
    
    const style = document.createElement('style');
    style.textContent = `
        #tab-jail-overlay {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 250px;
            background-color: #0d0d0d;
            border: 2px solid #ff003c;
            box-shadow: 0 0 15px rgba(255, 0, 60, 0.4);
            color: #00ff00;
            font-family: 'Courier New', Courier, monospace;
            padding: 15px;
            text-align: center;
            z-index: 2147483647; /* Ensure it stays on top */
            pointer-events: none; /* Make it non-blocking so users can click through if needed */
            display: none;
            box-sizing: border-box;
        }
        #tab-jail-overlay h1 {
            margin: 0 0 10px 0;
            font-size: 16px;
            color: #ff003c;
            text-transform: uppercase;
            border-bottom: 1px dashed #ff003c;
            padding-bottom: 5px;
        }
        #tab-jail-overlay .warning {
            font-size: 12px;
            margin-bottom: 10px;
            color: #fff;
        }
        #tab-jail-overlay .countdown {
            font-size: 32px;
            font-weight: bold;
            color: #ff003c;
            margin: 10px 0;
            animation: tab-jail-pulse 1s infinite;
        }
        #tab-jail-overlay .instruction {
            font-size: 10px;
            opacity: 0.8;
            color: #00ff00;
        }
        @keyframes tab-jail-pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
    `;
    
    document.head.appendChild(style);
    
    overlayElement.innerHTML = `
        <h1>TAB JAIL</h1>
        <div class="warning">INACTIVITY DETECTED</div>
        <div class="countdown" id="tab-jail-countdown">10</div>
        <div class="instruction">Move your mouse to reset.</div>
    `;
    
    document.body.appendChild(overlayElement);
}

function showCountdown() {
    if (!overlayElement) createOverlay();
    if (overlayElement) {
        overlayElement.style.display = 'block';
        console.log("TAB JAIL COUNTDOWN: STARTED");
    }
}

function hideCountdown() {
    if (overlayElement && overlayElement.style.display !== 'none') {
        overlayElement.style.display = 'none';
        console.log("TAB JAIL COUNTDOWN: RESET");
    }
}

function updateCountdownDisplay(val) {
    if (!overlayElement) return;
    const countEl = overlayElement.querySelector('#tab-jail-countdown');
    if (countEl) countEl.textContent = val;
}

function notifyBackground(activityState) {
    try {
        console.log("TAB JAIL ACTIVITY EVENT SENT");
        // Send a lightweight activity update to the background worker
        chrome.runtime.sendMessage({
            type: "USER_ACTIVITY",
            isActive: activityState,
            timestamp: Date.now()
        });
    } catch (e) {
        // Handle cases where the extension was reloaded or connection is broken gracefully
    }
}

function startInactivityTimer() {
    clearTimeout(inactivityTimer);
    clearInterval(countdownInterval);
    
    // Set 10-second inactivity period
    inactivityTimer = setTimeout(() => {
        if (isActive) {
            isActive = false;
            console.log("TAB JAIL ACTIVITY: INACTIVE");
            notifyBackground(false);
        }
        
        countdownValue = 10;
        showCountdown();
        updateCountdownDisplay(countdownValue);
        
        // Start visible countdown UI
        countdownInterval = setInterval(() => {
            countdownValue--;
            if (countdownValue >= 1) {
                updateCountdownDisplay(countdownValue);
            } else {
                updateCountdownDisplay(0);
                clearInterval(countdownInterval);
                // Ends at 0; no penalty logic applied in this phase
            }
        }, 1000);
    }, 10000);
}

function handleActivity(e) {
    // Throttle mousemove events to save CPU usage
    if (e && e.type === 'mousemove') {
        const now = Date.now();
        if (now - lastMouseMoveTime < MOUSE_THROTTLE_MS) {
            return;
        }
        lastMouseMoveTime = now;
    }

    if (!isActive) {
        isActive = true;
        console.log("TAB JAIL ACTIVITY: ACTIVE");
        notifyBackground(true);
    } else {
        notifyBackground(true);
    }
    
    hideCountdown();
    startInactivityTimer();
}

function init() {
    console.log("TAB JAIL ACTIVITY TRACKER INITIALIZED");
    createOverlay();
    
    // Listen for physical interaction without logging content/keys
    ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach(eventType => {
        window.addEventListener(eventType, handleActivity, { passive: true });
    });
    
    notifyBackground(true);
    startInactivityTimer();
    console.log("TAB JAIL content script active");
}

// Safely initialize to handle various loading states
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
