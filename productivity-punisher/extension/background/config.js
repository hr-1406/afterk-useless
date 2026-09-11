const DEMO_MODE = false; // If true, use demo durations and scoring intervals

const CONFIG = {
  SCORING_INTERVAL: DEMO_MODE ? 1000 : 20000, // 1 sec for demo, 20 secs for prod
  INITIAL_SCORE: 20,
  PUNISHMENT_DURATION: DEMO_MODE ? 30000 : 300000, // 30 secs for demo, 5 mins for prod
  PUNISHMENT_VIDEOS: [
    "dQw4w9WgXcQ",
    "3wVvwd4oI1Y",
    "kClwJxgmrgk",
    "3h7hIvXv-cM",
    "DmsTiMdkzsU"
  ],
  POINTS: {
    PRODUCTIVE: -10,
    UNPRODUCTIVE: 5,
    NEUTRAL: 0
  },
  DEFAULT_PRODUCTIVE: [
    'chatgpt.com',
    'openai.com',
    'gemini.google.com',
    'wikipedia.org',
    'github.com',
    'stackoverflow.com',
    'docs.google.com',
    'notion.so'
  ],
  DEFAULT_UNPRODUCTIVE: [
    'instagram.com',
    'netflix.com',
    'youtube.com',
    'reddit.com',
    'twitch.tv',
    'facebook.com'
  ]
};

// Expose to global scope for importScripts
self.CONFIG = CONFIG;
