importScripts(
  'config.js',
  'scoring.js',
  'punishment.js',
  'tracker.js'
);

// Initialize Tracker
self.Tracker.init();

// Expose static config to storage for dashboard UI
chrome.storage.local.set({ configPunishmentDuration: self.CONFIG.PUNISHMENT_DURATION });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CURRENT_INFO') {
    (async () => {
      const state = await self.Scoring.getState();
      const domain = self.Tracker.activeDomain;
      const classification = domain ? self.Scoring.classifyDomain(domain, state) : 'Neutral';
      sendResponse({ domain, classification });
    })();
    return true; // async response
  }
});
