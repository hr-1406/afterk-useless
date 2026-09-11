# Productivity Punisher

A completely useless hackathon project designed to punish productivity and reward procrastination. 

## The Concept

Most productivity extensions block you from browsing Twitter so you can focus on work. **Productivity Punisher** flips that entirely upside down.
If you work too much, you lose points. If you procrastinate, you gain points.

If your score hits 0, you are subjected to an inescapable 10-minute punishment of Geometry Dash, preceded by a jumpscare. Winning Geometry Dash doesn't let you escape early. Only time will release you.

## Features

- **Real-Time Tracking**: Accurately tracks the time you spend on active browser tabs.
- **Scoring Engine**: 
  - `+2 points` every 10 seconds on unproductive sites (Instagram, Netflix, etc.)
  - `-5 points` every 10 seconds on productive sites (GitHub, StackOverflow, etc.)
- **Persistent State**: The punishment timer and score survive browser restarts, extension reloads, and tab closures. 
- **Inescapable Punishment**: Forcefully redirects you back to the punishment page if you attempt to navigate away while serving your sentence.
- **In-Page Notifications**: Clean, top-right Toast notifications injected into your current webpage when points change.
- **Modern Dashboard**: A polished, serious-looking "SaaS-style" dashboard to view your procrastination statistics, built right into the extension for optimal local-first storage synchronization.

## Architecture

This project is built using a Manifest V3 Chrome Extension and Vanilla Javascript.

- **Background Service Worker**: Handles all the authoritative logic—tab detection, domain extraction, timer calculation, scoring, and enforcing the punishment redirect loop.
- **Content Scripts**: Injects the Toast notifications and the Jumpscare overlay into the active DOM.
- **Dashboard (PWA/Extension Page)**: A modular Vanilla JS application served entirely locally via the extension, preventing the need for any cloud sync or external API dependencies. It reacts instantly to `chrome.storage.local` changes.

## Installation

### Loading in Chrome / Brave

1. Open your browser and navigate to `chrome://extensions/` (or `brave://extensions/`).
2. Turn on **Developer mode** in the top right.
3. Click **Load unpacked**.
4. Select the `productivity-punisher/extension` folder inside this repository.
5. Pin the extension to your toolbar.

### Opening the Dashboard

- Click the Productivity Punisher icon in your toolbar to open the quick popup.
- Click **Open Dashboard** to view the full application experience.

## Demo Mode

To test the application quickly without waiting for the default parameters, you can modify `extension/background/config.js`.

Change the values to:
```javascript
SCORING_INTERVAL: 1000, // 1 second
PUNISHMENT_DURATION: 30000, // 30 seconds
```
Then refresh the extension in the `chrome://extensions` page.

## Permissions

The extension requires the following permissions, as defined in `manifest.json`:
- `tabs`: To detect which tab is currently active and its URL.
- `storage`: To persist your score, history, and custom domains locally.
- `webNavigation`: To aggressively enforce the punishment redirect if you try to leave the page.
- `<all_urls>` (Host Permissions): To inject the score notification toasts and jumpscare overlays into the websites you visit.

## Privacy

This project is entirely local-first. No data is sent to any external server. 
- Passwords, forms, cookies, and keystrokes are **never** accessed.
- Only the top-level hostname (e.g., `github.com`) of your active tab is analyzed for scoring.

## Security Limitations

Because this is a standard Chrome extension, it is subject to browser security policies:
- The extension cannot inject content scripts into special `chrome://` or `brave://` pages, meaning notifications and jumpscares will not appear on those tabs (though tracking is paused anyway).
- The extension cannot simulate the `F11` hardware key to force true OS-level fullscreen without explicit user interaction (due to browser sandbox rules).
