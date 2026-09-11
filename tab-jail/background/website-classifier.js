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

export function classifyWebsite(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') {
        return "unknown";
    }
    
    // Safely handle special schemes
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

        // Exact match or subdomain match (e.g., www.youtube.com ends with .youtube.com)
        const isMatch = (domain, host) => host === domain || host.endsWith('.' + domain);

        if (PRODUCTIVE_DOMAINS.some(domain => isMatch(domain, hostname))) {
            return "productive";
        }
        if (DISTRACTING_DOMAINS.some(domain => isMatch(domain, hostname))) {
            return "distracting";
        }
    } catch (e) {
        // Invalid URL
        return "unknown";
    }

    return "unknown";
}
