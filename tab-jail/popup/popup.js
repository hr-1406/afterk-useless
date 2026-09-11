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
    chrome.storage.local.get(['score', 'currentWebsite', 'currentCategory', 'activityState', 'lastActivityTime'], (data) => {
        updateUI(data);
    });

    // Listen for changes in storage
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            chrome.storage.local.get(['score', 'currentWebsite', 'currentCategory', 'activityState', 'lastActivityTime'], (data) => {
                updateUI(data);
            });
        }
    });

    // Continuously update the relative timestamp
    setInterval(() => {
        chrome.storage.local.get(['lastActivityTime'], (data) => {
            const lastActivityEl = document.getElementById('last-activity');
            if (lastActivityEl) {
                lastActivityEl.textContent = timeAgo(data.lastActivityTime);
            }
        });
    }, 1000);
});
