const Tracker = {
  activeDomain: null,
  activeUrl: null,
  sessionStartTime: null,
  activeTabId: null,

  async init() {
    // Listen to tab changes
    chrome.tabs.onActivated.addListener(this.onTabActivated.bind(this));
    chrome.tabs.onUpdated.addListener(this.onTabUpdated.bind(this));
    chrome.windows.onFocusChanged.addListener(this.onWindowFocusChanged.bind(this));
    
    // Periodically check in case of idle or missed events
    setInterval(() => this.processCurrentSession(), 2000); // Check every 2s for more responsive punishment timer

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
      
      if (domain !== this.activeDomain || tab.url !== this.activeUrl) {
        await this.endSession();
        this.startSession(domain, tab.url);
      }
    } else {
      await this.endSession();
    }
  },

  startSession(domain, url) {
    this.activeDomain = domain;
    this.activeUrl = url;
    this.sessionStartTime = Date.now();
  },

  async endSession() {
    if (this.activeUrl && this.sessionStartTime) {
      await this.processCurrentSession();
      this.activeDomain = null;
      this.activeUrl = null;
      this.sessionStartTime = null;
    }
  },

  async processCurrentSession() {
    if (!this.activeUrl || !this.sessionStartTime) return;
    
    // Detect if user is active before scoring
    const idleState = await new Promise(resolve => {
      chrome.idle.queryState(15, resolve);
    });
    
    if (idleState === 'idle' || idleState === 'locked') {
      // User is not active, do not accrue points or qualifying time.
      // Advance sessionStartTime so we don't count the idle time when they return.
      this.sessionStartTime = Date.now();
      return;
    }

    const now = Date.now();
    const elapsed = now - this.sessionStartTime;

    const data = await chrome.storage.local.get(['punishmentActive', 'currentPunishmentVideo', 'accumulatedQualifyingTime']);
    
    if (data.punishmentActive) {
      // Check if they are on any of the allowed videos
      let isYouTubeVideo = false;
      if (this.activeUrl.includes('youtube.com/watch')) {
        for (const vid of self.CONFIG.PUNISHMENT_VIDEOS) {
          if (this.activeUrl.includes(`v=${vid}`)) {
            isYouTubeVideo = true;
            break;
          }
        }
      }
      
      if (isYouTubeVideo) {
        const newAccumulated = (data.accumulatedQualifyingTime || 0) + elapsed;
        
        if (newAccumulated >= self.CONFIG.PUNISHMENT_DURATION) {
          // Punishment over
          await chrome.storage.local.set({ 
            punishmentActive: false,
            score: self.CONFIG.INITIAL_SCORE,
            accumulatedQualifyingTime: self.CONFIG.PUNISHMENT_DURATION
          });
          // Notify user natively
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            title: 'Productivity Punisher',
            message: 'Punishment Complete! You may return to work.',
            priority: 2
          });
          // Redirect them to dashboard
          if (this.activeTabId) {
             const dashboardUrl = chrome.runtime.getURL('dashboard/index.html');
             chrome.tabs.update(this.activeTabId, { url: dashboardUrl });
          }
        } else {
          await chrome.storage.local.set({ accumulatedQualifyingTime: newAccumulated });
        }
      }
      
      // Reset session start time to now so we don't double count
      this.sessionStartTime = now;
      return;
    }

    // Normal tracking
    const completedIntervals = Math.floor(elapsed / self.CONFIG.SCORING_INTERVAL);

    if (completedIntervals > 0) {
      const state = await self.Scoring.getState();
      const classification = self.Scoring.classifyDomain(this.activeDomain, state);
      
      await self.Scoring.addPoints(this.activeDomain, classification, completedIntervals);
      
      // Advance session start time so we don't double count
      this.sessionStartTime += completedIntervals * self.CONFIG.SCORING_INTERVAL;
    }
  }
};

self.Tracker = Tracker;

