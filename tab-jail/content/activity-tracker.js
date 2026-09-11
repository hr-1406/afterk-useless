// =============================================================
// TAB JAIL — Activity Tracker (Content Script)
// =============================================================
// Detects user interaction (mouse, keyboard, scroll, touch).
// Sends lightweight activity events to the service worker.
// Shows a 10-second inactivity countdown overlay.
//
// PRIVACY: Never records actual keystrokes, passwords, typed text,
// page content, mouse coordinates, or browsing history.

let inactivityTimer = null;
let countdownInterval = null;
let countdownValue = 10;
let overlayElement = null;
let isActive = true;
let lastMouseMoveTime = 0;
const MOUSE_THROTTLE_MS = 500;

// --- Inactivity Countdown Overlay ---

function createOverlay() {
    if (overlayElement || !document.body) return;

    overlayElement = document.createElement('div');
    overlayElement.id = 'tab-jail-overlay';
    
    eyeLostOverlay = document.createElement('div');
    eyeLostOverlay.id = 'tab-jail-eye-overlay';

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
            z-index: 2147483646;
            pointer-events: none;
            display: none;
            box-sizing: border-box;
        }
        #tab-jail-eye-overlay {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #000;
            border: 2px solid #ff003c;
            color: #ff003c;
            font-family: 'Courier New', Courier, monospace;
            padding: 20px;
            font-size: 24px;
            font-weight: bold;
            z-index: 2147483647;
            pointer-events: none;
            display: none;
            box-shadow: 0 0 20px #ff003c;
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
    
    eyeLostOverlay.innerHTML = `HEY. YOUR EYES LEFT THE BUILD.`;
    document.body.appendChild(eyeLostOverlay);
}

function showCountdown() {
    if (!overlayElement) createOverlay();
    if (overlayElement) overlayElement.style.display = 'block';
}

function hideCountdown() {
    if (overlayElement && overlayElement.style.display !== 'none') {
        overlayElement.style.display = 'none';
    }
}

function updateCountdownDisplay(val) {
    if (!overlayElement) return;
    const el = overlayElement.querySelector('#tab-jail-countdown');
    if (el) el.textContent = val;
}

// --- Communication ---

function notifyBackground(activityState) {
    try {
        chrome.runtime.sendMessage({
            type: "USER_ACTIVITY",
            isActive: activityState,
            timestamp: Date.now()
        });
    } catch (e) {
        // Extension may have been reloaded — ignore
    }
}

// --- Timers ---

function startInactivityTimer() {
    clearTimeout(inactivityTimer);
    clearInterval(countdownInterval);

    inactivityTimer = setTimeout(() => {
        let attention = "unknown";
        if (window.tabJailEyeTracking) {
            attention = window.tabJailEyeTracking.getAttentionState();
        }
        
        if (attention === true) {
            // User is looking, count as active!
            isActive = true;
            notifyBackground(true);
            startInactivityTimer();
            return;
        }
        
        if (attention === false) {
            // Eyes left, 5-second grace period
            eyeLostOverlay.style.display = 'block';
            setTimeout(() => {
                eyeLostOverlay.style.display = 'none';
                if (window.tabJailEyeTracking && window.tabJailEyeTracking.getAttentionState() === false) {
                    triggerInactivity();
                } else if (window.tabJailEyeTracking && window.tabJailEyeTracking.getAttentionState() === true) {
                    isActive = true;
                    notifyBackground(true);
                    startInactivityTimer();
                } else {
                    triggerInactivity();
                }
            }, 5000);
            return;
        }

        // Unknown or unavailable
        triggerInactivity();
        
    }, 10000);
}

function triggerInactivity() {
    if (isActive) {
        isActive = false;
        notifyBackground(false);
    }

    countdownValue = 10;
    showCountdown();
    updateCountdownDisplay(countdownValue);

    countdownInterval = setInterval(() => {
        countdownValue--;
        updateCountdownDisplay(Math.max(0, countdownValue));
        if (countdownValue <= 0) clearInterval(countdownInterval);
    }, 1000);
}

// --- Event Handling ---

function handleActivity(e) {
    if (e && e.type === 'mousemove') {
        const now = Date.now();
        if (now - lastMouseMoveTime < MOUSE_THROTTLE_MS) return;
        lastMouseMoveTime = now;
    }

    if (!isActive) {
        isActive = true;
        notifyBackground(true);
    } else {
        notifyBackground(true);
    }

    hideCountdown();
    if (eyeLostOverlay) eyeLostOverlay.style.display = 'none';
    startInactivityTimer();
}

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "START_EYE_TRACKING") {
        if (window.tabJailEyeTracking) window.tabJailEyeTracking.startEyeTracking();
    } else if (msg.type === "STOP_EYE_TRACKING") {
        if (window.tabJailEyeTracking) window.tabJailEyeTracking.stopEyeTracking();
    }
});

// --- Init ---

function init() {
    console.log("TAB JAIL activity tracker initialized");
    createOverlay();

    ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
        window.addEventListener(evt, handleActivity, { passive: true });
    });

    notifyBackground(true);
    startInactivityTimer();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
