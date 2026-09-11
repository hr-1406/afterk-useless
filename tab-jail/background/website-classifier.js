// =============================================================
// TAB JAIL — Website Classifier
// =============================================================
// Pure classification logic. No side effects, no storage, no DOM.

const PRODUCTIVE_DOMAINS = [
    "chatgpt.com",
    "openai.com",
    "gemini.google.com",
    "perplexity.ai",
    "claude.ai",
    "github.com",
    "gitlab.com",
    "stackoverflow.com",
    "docs.google.com",
    "notion.so"
];

const DISTRACTING_DOMAINS = [
    "youtube.com",
    "netflix.com",
    "instagram.com",
    "facebook.com",
    "twitter.com",
    "x.com",
    "reddit.com",
    "tiktok.com",
    "twitch.tv"
];

function classifyWebsite(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') {
        return "unknown";
    }

    // Skip browser-internal pages
    if (urlStr.startsWith("chrome://") ||
        urlStr.startsWith("brave://") ||
        urlStr.startsWith("edge://") ||
        urlStr.startsWith("about:") ||
        urlStr.startsWith("file://")) {
        return "unknown";
    }

    try {
        const url = new URL(urlStr);
        const hostname = url.hostname.toLowerCase();
        const isMatch = (domain, host) => host === domain || host.endsWith('.' + domain);

        if (PRODUCTIVE_DOMAINS.some(d => isMatch(d, hostname))) return "productive";
        if (DISTRACTING_DOMAINS.some(d => isMatch(d, hostname))) return "distracting";
    } catch (e) {
        return "unknown";
    }

    return "unknown";
}

self.classifyWebsite = classifyWebsite;
