// TAB JAIL — Options Page Script

document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('hud-enabled-toggle');
    const status = document.getElementById('hud-status');

    function setUI(enabled) {
        toggle.checked = enabled;
        status.textContent = enabled ? 'ON' : 'OFF';
        status.style.color = enabled ? '#00ff00' : '#ff003c';
    }

    // Load
    chrome.storage.local.get(['hudEnabled'], (data) => {
        setUI(data.hudEnabled === true);
    });

    // User toggles
    toggle.addEventListener('change', () => {
        const enabled = toggle.checked;
        chrome.storage.local.set({ hudEnabled: enabled });
        setUI(enabled);
    });
    
    function timeAgo(timestamp) {
        if (!timestamp) return "Unknown";
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 2) return "Just now";
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ago`;
    }

    function updateDashboard(data) {
        if (data.score !== undefined) {
            document.getElementById('opt-score').textContent = data.score;
        }
        document.getElementById('opt-current-website').textContent = data.currentWebsite || 'Detecting...';
        document.getElementById('opt-current-category').textContent = (data.currentCategory || 'UNKNOWN').toUpperCase();
        document.getElementById('opt-current-activity').textContent = (data.activityState || 'UNKNOWN').toUpperCase();
        document.getElementById('opt-last-activity').textContent = timeAgo(data.lastActivityTime);

        const statePanel = document.getElementById('opt-system-state-panel');
        const stateMessage = document.getElementById('opt-system-state-message');
        const stateTimer = document.getElementById('opt-system-state-timer');
        
        if (data.score === 0) {
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
    }

    setInterval(() => {
        chrome.storage.local.get(['lastActivityTime', 'score', 'breakEndTime'], (data) => {
            document.getElementById('opt-last-activity').textContent = timeAgo(data.lastActivityTime);
            updateDashboard(data); // also updates timer
        });
    }, 1000);

    // External changes (toolbar icon, background updates)
    chrome.storage.onChanged.addListener((changes, ns) => {
        if (ns === 'local') {
            if (changes.hudEnabled) {
                setUI(changes.hudEnabled.newValue === true);
            }
            chrome.storage.local.get(['score', 'currentWebsite', 'currentCategory', 'activityState', 'lastActivityTime', 'breakEndTime'], (data) => {
                updateDashboard(data);
            });
        }
    });
    
    // Initial fetch for dashboard
    chrome.storage.local.get(['score', 'currentWebsite', 'currentCategory', 'activityState', 'lastActivityTime', 'breakEndTime'], (data) => {
        updateDashboard(data);
    });
});
