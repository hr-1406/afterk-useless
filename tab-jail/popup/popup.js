// Popup script for TAB JAIL.
// Handles interactions within the popup UI, such as opening the options page.

let notificationTimeout = null;

function showNotification(text, type) {
    const banner = document.getElementById('notification-banner');
    banner.textContent = text;
    banner.className = 'notification-banner show ' + (type === 'bonus' ? 'notification-bonus' : 'notification-penalty');
    
    clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(() => {
        banner.classList.remove('show');
    }, 3000);
}

// Listen for score change events broadcasted by background score-engine
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "SCORE_CHANGED") {
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
        showNotification(text, type);
    }
});

function timeAgo(timestamp) {
    if (!timestamp) return "Unknown";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 2) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
}

function updateUI(data) {
    const websiteEl = document.getElementById('current-website');
    const categoryEl = document.getElementById('current-category');
    const activityEl = document.getElementById('current-activity');
    const lastActivityEl = document.getElementById('last-activity');

    // Score display
    const scoreVal = data.score !== undefined ? data.score : 50;
    document.getElementById('score').textContent = scoreVal;
    
    const progressBar = document.getElementById('score-progress');
    progressBar.style.width = scoreVal + '%';
    
    if (scoreVal < 30) {
        progressBar.style.backgroundColor = '#ff003c'; // Red danger
    } else if (scoreVal < 70) {
        progressBar.style.backgroundColor = '#ffaa00'; // Orange warning
    } else {
        progressBar.style.backgroundColor = '#00ff00'; // Green good
    }
    
    // System State (Break/Punishment)
    const statePanel = document.getElementById('system-state-panel');
    const stateMessage = document.getElementById('system-state-message');
    const stateTimer = document.getElementById('system-state-timer');
    
    if (scoreVal === 0) {
        statePanel.style.display = 'block';
        statePanel.style.borderColor = '#ff003c';
        stateMessage.style.color = '#ff003c';
        stateMessage.textContent = 'PUNISHMENT ACTIVE (TETRIS)';
        stateTimer.textContent = 'Clear 3 lines to escape.';
    } else if (data.breakEndTime && data.breakEndTime > Date.now()) {
        statePanel.style.display = 'block';
        statePanel.style.borderColor = '#ffaa00';
        stateMessage.style.color = '#ffaa00';
        stateMessage.textContent = 'ON BREAK';
        const remaining = Math.ceil((data.breakEndTime - Date.now()) / 1000);
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        stateTimer.textContent = `Time remaining: ${m}:${s.toString().padStart(2, '0')}`;
    } else {
        statePanel.style.display = 'none';
    }

    // Website display
    websiteEl.textContent = data.currentWebsite || "Detecting...";
    
    // Category display
    let formattedCategory = (data.currentCategory || "unknown").toUpperCase();
    categoryEl.textContent = formattedCategory;
    categoryEl.className = 'value site-category'; // Reset classes
    if (formattedCategory === 'PRODUCTIVE') {
        categoryEl.classList.add('category-productive');
    } else if (formattedCategory === 'DISTRACTING') {
        categoryEl.classList.add('category-distracting');
    } else {
        categoryEl.classList.add('category-unknown');
    }

    // Activity state display
    let activityState = (data.activityState || "unknown").toUpperCase();
    activityEl.textContent = activityState;
    activityEl.className = 'value'; // Reset classes
    if (activityState === 'ACTIVE') {
        activityEl.classList.add('activity-active');
    } else if (activityState === 'INACTIVE') {
        activityEl.classList.add('activity-inactive');
    }

    // Last activity time
    lastActivityEl.textContent = timeAgo(data.lastActivityTime);
}

document.addEventListener('DOMContentLoaded', () => {
    const settingsBtn = document.getElementById('settings-btn');
    
    settingsBtn.addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options/options.html'));
        }
    });

    // Load initial data including score
    chrome.storage.local.get(['score', 'currentWebsite', 'currentCategory', 'activityState', 'lastActivityTime', 'breakEndTime'], (data) => {
        updateUI(data);
    });

    // Listen for changes in storage
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            chrome.storage.local.get(['score', 'currentWebsite', 'currentCategory', 'activityState', 'lastActivityTime', 'breakEndTime'], (data) => {
                updateUI(data);
            });
        }
    });

    // Continuously update the relative timestamp and break timer
    setInterval(() => {
        chrome.storage.local.get(['lastActivityTime', 'score', 'breakEndTime'], (data) => {
            const lastActivityEl = document.getElementById('last-activity');
            if (lastActivityEl) {
                lastActivityEl.textContent = timeAgo(data.lastActivityTime);
            }
            
            // Also update break timer if visible
            const statePanel = document.getElementById('system-state-panel');
            if (statePanel.style.display === 'block' && data.breakEndTime && data.breakEndTime > Date.now()) {
                const remaining = Math.ceil((data.breakEndTime - Date.now()) / 1000);
                const m = Math.floor(remaining / 60);
                const s = remaining % 60;
                document.getElementById('system-state-timer').textContent = `Time remaining: ${m}:${s.toString().padStart(2, '0')}`;
            } else if (data.score > 0 && (!data.breakEndTime || data.breakEndTime <= Date.now())) {
                statePanel.style.display = 'none';
            }
        });
    }, 1000);
});
