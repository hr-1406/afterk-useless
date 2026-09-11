// Dashboard Application Logic

let currentState = {};
let punishmentInterval = null;

// Routing logic
function handleRouting() {
  const hash = window.location.hash || '#/';
  const routeMap = {
    '#/': 'view-dashboard',
    '#/history': 'view-history',
    '#/settings': 'view-settings',
    '#/punishment': 'view-punishment'
  };
  
  const viewId = routeMap[hash] || 'view-dashboard';
  
  // Update active view
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');

  // Update active nav link
  document.querySelectorAll('.nav-links a').forEach(el => {
    if (el.getAttribute('href') === hash) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // If we are in punishment but punishment is not active, redirect back
  if (viewId === 'view-punishment' && currentState.punishmentActive === false) {
    window.location.hash = '#/';
  }
}

window.addEventListener('hashchange', handleRouting);

// Data Binding
async function fetchState() {
  const data = await chrome.storage.local.get(null);
  currentState = data;
  renderDashboard();
  renderSettings();
  renderHistory();
  checkPunishment();
}

function renderDashboard() {
  if (currentState.score !== undefined) {
    document.getElementById('dashScore').textContent = currentState.score;
  }
  
  // Calculate stats from history
  const history = currentState.activityHistory || [];
  let earned = 0;
  let lost = 0;
  let prodSessions = 0;
  let unprodSessions = 0;

  // Since it's 'Today's Statistics', ideally we'd filter by date, 
  // but for hackathon demo we'll just sum the history array.
  history.forEach(item => {
    if (item.pointsChange > 0) {
      earned += item.pointsChange;
      unprodSessions++;
    } else if (item.pointsChange < 0) {
      lost += Math.abs(item.pointsChange);
      prodSessions++;
    }
  });

  document.getElementById('statEarned').textContent = earned;
  document.getElementById('statLost').textContent = lost;
  document.getElementById('statProdSessions').textContent = prodSessions;
  document.getElementById('statUnprodSessions').textContent = unprodSessions;

  // Ask background for current live tracking state
  chrome.runtime.sendMessage({ type: 'GET_CURRENT_INFO' }, (response) => {
    if (response && response.domain) {
      document.getElementById('dashWebsite').textContent = response.domain;
      
      const badge = document.getElementById('dashClassification');
      badge.textContent = response.classification;
      badge.className = 'badge';
      if (response.classification === 'Productive') badge.classList.add('text-danger'); // bad
      else if (response.classification === 'Unproductive') badge.classList.add('text-success'); // good for score

      document.getElementById('dashTracking').textContent = 'ACTIVE';
      document.getElementById('dashTracking').className = 'value status-active';
    } else {
      document.getElementById('dashWebsite').textContent = 'Browser Page';
      document.getElementById('dashClassification').textContent = 'Neutral';
      document.getElementById('dashTracking').textContent = 'PAUSED';
      document.getElementById('dashTracking').className = 'value text-secondary';
    }
  });
}

function renderHistory() {
  const history = currentState.activityHistory || [];
  const tbody = document.getElementById('historyTableBody');
  tbody.innerHTML = '';
  
  history.forEach(item => {
    const tr = document.createElement('tr');
    
    const time = new Date(item.timestamp).toLocaleTimeString();
    
    const pointsSpan = document.createElement('span');
    pointsSpan.textContent = (item.pointsChange > 0 ? '+' : '') + item.pointsChange;
    pointsSpan.className = item.pointsChange > 0 ? 'text-success' : (item.pointsChange < 0 ? 'text-danger' : '');

    tr.innerHTML = `
      <td>${time}</td>
      <td>${item.domain}</td>
      <td>${item.duration}s</td>
      <td></td>
    `;
    tr.children[3].appendChild(pointsSpan);
    tbody.appendChild(tr);
  });
}

function renderSettings() {
  const renderList = (id, items, storageKey) => {
    const ul = document.getElementById(id);
    ul.innerHTML = '';
    (items || []).forEach(domain => {
      const li = document.createElement('li');
      li.textContent = domain;
      const btn = document.createElement('button');
      btn.className = 'btn-remove';
      btn.textContent = 'Remove';
      btn.onclick = () => removeDomain(storageKey, domain);
      li.appendChild(btn);
      ul.appendChild(li);
    });
  };

  renderList('listProductive', currentState.customProductive, 'customProductive');
  renderList('listUnproductive', currentState.customUnproductive, 'customUnproductive');
}

// Settings Actions
async function addDomain(storageKey, inputId) {
  const input = document.getElementById(inputId);
  let domain = input.value.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  
  if (!domain) return;

  const currentList = currentState[storageKey] || [];
  if (!currentList.includes(domain)) {
    currentList.push(domain);
    await chrome.storage.local.set({ [storageKey]: currentList });
  }
  input.value = '';
}

async function removeDomain(storageKey, domain) {
  const currentList = currentState[storageKey] || [];
  const updatedList = currentList.filter(d => d !== domain);
  await chrome.storage.local.set({ [storageKey]: updatedList });
}

document.getElementById('btnAddProductive').onclick = () => addDomain('customProductive', 'inputProductive');
document.getElementById('btnAddUnproductive').onclick = () => addDomain('customUnproductive', 'inputUnproductive');

document.getElementById('btnResetAll').onclick = async () => {
  if (confirm('Are you sure you want to completely reset all scores, history, and custom settings?')) {
    await chrome.storage.local.clear();
    alert('Data reset successfully. Restarting tracking.');
    window.location.reload();
  }
};

// Punishment Logic
function checkPunishment() {
  if (currentState.punishmentActive) {
    if (window.location.hash !== '#/punishment') {
      window.location.hash = '#/punishment';
    }
    document.body.classList.add('punishment-mode');
    
    // Set iframe if not set
    const iframe = document.getElementById('gameIframe');
    if (!iframe.src) {
      // Hardcode the fallback or fetch from config
      // Fetching from background config via messaging is cleaner, but hardcoding the same constant is fine here
      iframe.src = 'https://scratch.mit.edu/projects/105500895/fullscreen/';
    }

    startPunishmentTimer();
  } else {
    document.body.classList.remove('punishment-mode');
    if (punishmentInterval) {
      clearInterval(punishmentInterval);
      punishmentInterval = null;
    }
    if (window.location.hash === '#/punishment') {
      window.location.hash = '#/';
    }
  }
}

function startPunishmentTimer() {
  if (punishmentInterval) clearInterval(punishmentInterval);
  
  const duration = 600000; // 10 minutes

  punishmentInterval = setInterval(async () => {
    // Re-fetch to ensure we have latest timestamp in case of multiple windows
    const data = await chrome.storage.local.get(['punishmentActive', 'punishmentStartTime']);
    if (!data.punishmentActive) {
      clearInterval(punishmentInterval);
      return;
    }

    const elapsed = Date.now() - data.punishmentStartTime;
    const remaining = Math.max(0, duration - elapsed);

    if (remaining <= 0) {
      clearInterval(punishmentInterval);
      // Wait for background script to clear it, or clear it ourselves
      await chrome.storage.local.set({ punishmentActive: false });
      alert('PUNISHMENT COMPLETE. You may return to your dashboard.');
    } else {
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      document.getElementById('punishmentCountdown').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }, 1000);
}

// Initialization
fetchState();
handleRouting();

// Listen for storage changes to sync UI in real-time
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    Object.keys(changes).forEach(key => {
      currentState[key] = changes[key].newValue;
    });
    renderDashboard();
    renderSettings();
    renderHistory();
    checkPunishment();
  }
});

// Periodically update active tracking text on dashboard
setInterval(renderDashboard, 1000);
