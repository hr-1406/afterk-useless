const CONFIG = {
  SCORING_INTERVAL: 10000, // 10 seconds in ms
  INITIAL_SCORE: 20,
  PUNISHMENT_DURATION: 600000, // 10 minutes in ms
  PUNISHMENT_URL: 'https://scratch.mit.edu/projects/105500895/fullscreen/', // A web Geometry Dash clone
  POINTS: {
    PRODUCTIVE: -5,
    UNPRODUCTIVE: 15,
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
