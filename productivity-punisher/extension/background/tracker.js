const Tracker = {
  activeDomain: null,
  sessionStartTime: null,
  sessionTabId: null,
  activeTabId: null,

  async init() {
    // Listen to tab changes
    chrome.tabs.onActivated.addListener(this.onTabActivated.bind(this));
    chrome.tabs.onUpdated.addListener(this.onTabUpdated.bind(this));
    chrome.windows.onFocusChanged.addListener(this.onWindowFocusChanged.bind(this));
    
    // Periodically check in case of idle or missed events
    setInterval(() => this.processCurrentSession(), 5000);

    // Initial check
    await this.checkActiveTab();
  },

  async onTabActivated(activeInfo) {
    this.activeTabId = activeInfo.tabId;
    await this.checkActiveTab();
  },

  async onTabUpdated(tabId, changeInfo, tab) {
    if (this.activeTabId === tabId && changeInfo.url) {
      await this.checkActiveTab(tab);
    }
  },

  async onWindowFocusChanged(windowId) {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      // Browser lost focus
      await this.endSession();
    } else {
      await this.checkActiveTab();
    }
  },

  async checkActiveTab(prefetchedTab = null) {
    // If punishment is active, don't do regular tracking
    const isPunishment = await self.Punishment.checkPunishmentState();
    if (isPunishment) return;

    let tab = prefetchedTab;
    if (!tab) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        tab = tabs[0];
        this.activeTabId = tab.id;
      }
    }

    if (tab && tab.url && tab.url.startsWith('http')) {
      const url = new URL(tab.url);
      let domain = url.hostname.replace(/^www\./, '');
      
      if (domain !== this.activeDomain || this.activeTabId !== this.sessionTabId) {
        await this.endSession();
        this.startSession(domain);
      }
    } else {
      await this.endSession();
    }
  },

  startSession(domain) {
    this.activeDomain = domain;
    this.sessionStartTime = Date.now();
    this.sessionTabId = this.activeTabId;
  },

  async endSession() {
    if (this.activeDomain && this.sessionStartTime) {
      await this.processCurrentSession();
      this.activeDomain = null;
      this.sessionStartTime = null;
      this.sessionTabId = null;
    }
  },

  async processCurrentSession() {
    if (!this.activeDomain || !this.sessionStartTime) return;
    
    const isPunishment = await self.Punishment.checkPunishmentState();
    if (isPunishment) {
      this.activeDomain = null;
      this.sessionStartTime = null;
      return;
    }

    const now = Date.now();
    const elapsed = now - this.sessionStartTime;
    const completedIntervals = Math.floor(elapsed / self.CONFIG.SCORING_INTERVAL);

    if (completedIntervals > 0) {
      const state = await self.Scoring.getState();
      const classification = self.Scoring.classifyDomain(this.activeDomain, state);
      
      await self.Scoring.addPoints(this.activeDomain, classification, completedIntervals, this.sessionTabId);
      
      // Advance session start time so we don't double count
      this.sessionStartTime += completedIntervals * self.CONFIG.SCORING_INTERVAL;
    }
  }
};

self.Tracker = Tracker;
