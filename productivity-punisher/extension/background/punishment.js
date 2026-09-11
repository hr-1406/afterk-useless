const Punishment = {
  async triggerPunishment() {
    await chrome.storage.local.set({
      punishmentActive: true,
      punishmentStartTime: Date.now()
    });
    
    // Attempt to trigger jumpscare on the active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      try {
        await chrome.tabs.sendMessage(tabs[0].id, { type: 'TRIGGER_JUMPSCARE' });
        // Give jumpscare time to play before redirect
        setTimeout(() => {
          this.enforcePunishment(tabs[0].id);
        }, 1500);
      } catch (e) {
        // If content script fails or isn't injected, immediately enforce
        this.enforcePunishment(tabs[0].id);
      }
    }
  },

  async enforcePunishment(tabId) {
    const punishmentUrl = chrome.runtime.getURL('dashboard/index.html#/punishment');
    if (tabId) {
      await chrome.tabs.update(tabId, { url: punishmentUrl });
    } else {
      await chrome.tabs.create({ url: punishmentUrl });
    }
  },

  async checkPunishmentState() {
    const data = await chrome.storage.local.get(['punishmentActive', 'punishmentStartTime']);
    if (!data.punishmentActive) return false;

    const elapsed = Date.now() - data.punishmentStartTime;
    if (elapsed >= self.CONFIG.PUNISHMENT_DURATION) {
      // Punishment over
      await chrome.storage.local.set({ punishmentActive: false });
      return false;
    }
    return true;
  },

  async monitorNavigation(details) {
    // If punishment is active, prevent leaving the punishment URL
    const isPunishmentActive = await this.checkPunishmentState();
    if (!isPunishmentActive) return;

    const punishmentPage = chrome.runtime.getURL('dashboard/index.html');
    if (details.frameId === 0 && !details.url.includes(punishmentPage)) {
      // Redirect back to punishment
      chrome.tabs.update(details.tabId, { url: punishmentPage + '#/punishment' });
    }
  }
};

self.Punishment = Punishment;

// Listen to all navigations in main frame
chrome.webNavigation.onCommitted.addListener((details) => {
  Punishment.monitorNavigation(details);
});
