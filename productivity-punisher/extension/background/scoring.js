const Scoring = {
  async getState() {
    const data = await chrome.storage.local.get([
      'score',
      'punishmentActive',
      'punishmentStartTime',
      'customProductive',
      'customUnproductive',
      'activityHistory'
    ]);
    return {
      score: data.score !== undefined ? data.score : self.CONFIG.INITIAL_SCORE,
      punishmentActive: data.punishmentActive || false,
      punishmentStartTime: data.punishmentStartTime || 0,
      customProductive: data.customProductive || [],
      customUnproductive: data.customUnproductive || [],
      activityHistory: data.activityHistory || []
    };
  },

  async updateState(updates) {
    await chrome.storage.local.set(updates);
  },

  classifyDomain(domain, state) {
    if (!domain) return 'Neutral';
    const d = domain.toLowerCase();

    // Check custom overrides first
    if (state.customProductive.some(cd => d.includes(cd))) return 'Productive';
    if (state.customUnproductive.some(cd => d.includes(cd))) return 'Unproductive';

    // Check defaults
    if (self.CONFIG.DEFAULT_PRODUCTIVE.some(cd => d.includes(cd))) return 'Productive';
    if (self.CONFIG.DEFAULT_UNPRODUCTIVE.some(cd => d.includes(cd))) return 'Unproductive';

    return 'Neutral';
  },

  async addPoints(domain, classification, completedIntervals) {
    if (completedIntervals <= 0) return;

    let pointsChange = 0;
    if (classification === 'Productive') {
      pointsChange = self.CONFIG.POINTS.PRODUCTIVE * completedIntervals;
    } else if (classification === 'Unproductive') {
      pointsChange = self.CONFIG.POINTS.UNPRODUCTIVE * completedIntervals;
    }

    const state = await this.getState();
    const newScore = state.score + pointsChange;

    const historyEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      timestamp: Date.now(),
      domain: domain,
      classification: classification,
      duration: completedIntervals * (self.CONFIG.SCORING_INTERVAL / 1000),
      pointsChange: pointsChange,
      scoreAfter: newScore
    };

    // Keep history bounded to last 100 items
    const newHistory = [historyEntry, ...state.activityHistory].slice(0, 100);

    const updates = {
      score: newScore,
      activityHistory: newHistory
    };

    await this.updateState(updates);

    if (pointsChange !== 0) {
      this.notifyTab(domain, pointsChange, classification, historyEntry.duration, newScore);
    }

    if (newScore <= 0 && !state.punishmentActive) {
      await self.Punishment.triggerPunishment();
    }
  },

  notifyTab(domain, pointsChange, classification, durationSeconds, totalScore) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'POINT_UPDATE',
          payload: { pointsChange, domain, classification, durationSeconds, totalScore }
        }).catch(() => {
          // Ignore errors if content script not loaded (e.g., restricted pages)
        });
      }
    });
  }
};

self.Scoring = Scoring;
