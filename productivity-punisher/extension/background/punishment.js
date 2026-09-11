const Punishment = {
  async triggerPunishment() {
    // Pick a random video
    const videos = self.CONFIG.PUNISHMENT_VIDEOS;
    const videoId = videos[Math.floor(Math.random() * videos.length)];

    await chrome.storage.local.set({
      punishmentActive: true,
      accumulatedQualifyingTime: 0,
      currentPunishmentVideo: videoId
    });
    
    // Attempt to trigger jumpscare on the active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      try {
        await chrome.tabs.sendMessage(tabs[0].id, { type: 'TRIGGER_JUMPSCARE' });
        // Give jumpscare time to play before redirect
        setTimeout(() => {
          this.enforcePunishment(tabs[0].id, videoId);
        }, 1500);
      } catch (e) {
        // If content script fails or isn't injected, immediately enforce
        this.enforcePunishment(tabs[0].id, videoId);
      }
    } else {
      this.enforcePunishment(null, videoId);
    }
  },

  async enforcePunishment(tabId, videoId) {
    const punishmentUrl = `https://www.youtube.com/watch?v=${videoId}`;
    if (tabId) {
      await chrome.tabs.update(tabId, { url: punishmentUrl });
    } else {
      await chrome.tabs.create({ url: punishmentUrl });
    }
  },

  async monitorNavigation(details) {
    const data = await chrome.storage.local.get(['punishmentActive', 'currentPunishmentVideo']);
    if (!data.punishmentActive) return;

    const dashboardUrl = chrome.runtime.getURL('dashboard/index.html');
    const requiredVideoStr = `v=${data.currentPunishmentVideo}`;
    
    // Allow navigation to the dashboard or to any of the allowed YouTube videos
    if (details.frameId === 0) {
      const isDashboard = details.url.includes(dashboardUrl);
      
      let isAllowedVideo = false;
      let matchedVid = null;
      if (details.url.includes('youtube.com/watch')) {
        for (const vid of self.CONFIG.PUNISHMENT_VIDEOS) {
          if (details.url.includes(`v=${vid}`)) {
            isAllowedVideo = true;
            matchedVid = vid;
            break;
          }
        }
      }
      
      if (!isDashboard && !isAllowedVideo) {
        // Redirect back to the last valid punishment video they were on
        chrome.tabs.update(details.tabId, { url: `https://www.youtube.com/watch?v=${data.currentPunishmentVideo}` });
      } else if (matchedVid && matchedVid !== data.currentPunishmentVideo) {
        // Update their current punishment video so we redirect them back here if they stray
        chrome.storage.local.set({ currentPunishmentVideo: matchedVid });
      }
    }
  }
};

self.Punishment = Punishment;

// Listen to all navigations in main frame
chrome.webNavigation.onCommitted.addListener((details) => {
  Punishment.monitorNavigation(details);
});
