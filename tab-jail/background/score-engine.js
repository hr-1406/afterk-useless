// =============================================================
// TAB JAIL — Score Engine
// =============================================================
// Manages the productivity score [0..100].
// Broadcasts SCORE_CHANGED to all tabs and the runtime.

let currentScore = 50;
let breakEndTime = null;

// Load persisted score on startup
chrome.storage.local.get(['score', 'breakEndTime'], (data) => {
    if (data.score !== undefined) {
        currentScore = data.score;
    } else {
        chrome.storage.local.set({ score: 50 });
    }
    if (data.breakEndTime) {
        breakEndTime = data.breakEndTime;
    }
});

async function saveAndBroadcast(oldScore, reason) {
    const actualChange = currentScore - oldScore;
    await chrome.storage.local.set({ score: currentScore });

    // If we hit 100, start the break
    if (currentScore === 100 && oldScore < 100) {
        breakEndTime = Date.now() + 5 * 60 * 1000;
        await chrome.storage.local.set({ breakEndTime, breakAvailable: true });
        reason = "break_started";
    }

    if (actualChange === 0 && reason !== "break_started" && reason !== "break_ended") return;

    console.log(`TAB JAIL SCORE: ${oldScore} -> ${currentScore} (${reason})`);

    const eventData = {
        type: "SCORE_CHANGED",
        oldScore,
        newScore: currentScore,
        amount: actualChange,
        reason
    };

    // Send to runtime listeners (popup if open) — catch rejection if nobody's listening
    chrome.runtime.sendMessage(eventData).catch(() => {});

    // Send to every tab's content scripts (for the HUD)
    chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
            if (tab.id) {
                chrome.tabs.sendMessage(tab.id, eventData).catch(() => {});
            }
        }
    });
}

export async function addPoints(amount, reason) {
    if (breakEndTime) return; // No productivity gain during break
    const oldScore = currentScore;
    currentScore = Math.min(100, currentScore + amount);
    await saveAndBroadcast(oldScore, reason);
}

export async function removePoints(amount, reason) {
    if (breakEndTime) return; // No penalty during break
    const oldScore = currentScore;
    currentScore = Math.max(0, currentScore - amount);
    await saveAndBroadcast(oldScore, reason);
}

export function getScore() {
    return currentScore;
}

export async function checkBreakState() {
    if (breakEndTime && Date.now() >= breakEndTime) {
        breakEndTime = null;
        const oldScore = currentScore;
        currentScore = 50;
        await chrome.storage.local.set({ breakEndTime: null, breakAvailable: false });
        await saveAndBroadcast(oldScore, "break_ended");
    }
}
