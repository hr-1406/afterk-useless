document.getElementById('btnDashboard').addEventListener('click', () => {
  const dashboardUrl = chrome.runtime.getURL('dashboard/index.html');
  chrome.tabs.create({ url: dashboardUrl });
});

async function updatePopup() {
  const data = await chrome.storage.local.get(['score', 'punishmentActive']);
  
  if (data.score !== undefined) {
    const scoreEl = document.getElementById('scoreValue');
    scoreEl.textContent = data.score;
    if (data.score <= 0) {
      scoreEl.style.color = 'var(--danger)';
    } else if (data.score < 10) {
      scoreEl.style.color = 'var(--warning)';
    } else {
      scoreEl.style.color = 'var(--text)';
    }
  }

  chrome.runtime.sendMessage({ type: 'GET_CURRENT_INFO' }, (response) => {
    if (response) {
      document.getElementById('currentWebsite').textContent = response.domain || 'Browser Page';
      document.getElementById('classification').textContent = response.classification;
      
      const statusEl = document.getElementById('trackingStatus');
      if (response.domain) {
        statusEl.textContent = 'ACTIVE';
        statusEl.style.color = 'var(--success)';
      } else {
        statusEl.textContent = 'PAUSED';
        statusEl.style.color = 'var(--muted)';
      }
    }
  });
}

// Initial update and periodic refresh
updatePopup();
setInterval(updatePopup, 1000);
