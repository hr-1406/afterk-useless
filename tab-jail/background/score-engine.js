let currentScore = 50;
let hasReachedZero = false;
let hasReachedMax = false;

// Initialize score from storage
chrome.storage.local.get(['score', 'punishmentTriggered', 'maxTriggered'], (data) => {
    if (data.score !== undefined) {
        currentScore = data.score;
    } else {
        currentScore = 50;
        chrome.storage.local.set({ score: 50 });
    }
    
    if (data.punishmentTriggered !== undefined) {
        hasReachedZero = data.punishmentTriggered;
    }
    
    if (data.maxTriggered !== undefined) {
        hasReachedMax = data.maxTriggered;
    }
});

export async function getScore() {
    const data = await chrome.storage.local.get('score');
    return data.score !== undefined ? data.score : 50;
}

export async function setScore(value) {
    // Enforce bounds
    let newScore = Math.max(0, Math.min(100, value));
    let oldScore = currentScore;
    currentScore = newScore;
    
    await chrome.storage.local.set({ score: currentScore });
    
    // Check 0 transition
    if (currentScore === 0 && oldScore > 0) {
        hasReachedZero = true;
        await chrome.storage.local.set({ punishmentTriggered: true });
        notifyEvent("SCORE_ZERO", oldScore, currentScore, 0, "reached_zero");
    } else if (currentScore > 0) {
        hasReachedZero = false;
        await chrome.storage.local.set({ punishmentTriggered: false });
    }

    // Check 100 transition
    if (currentScore === 100 && oldScore < 100) {
        hasReachedMax = true;
        await chrome.storage.local.set({ maxTriggered: true });
        notifyEvent("SCORE_MAXED", oldScore, currentScore, 0, "reached_max");
    } else if (currentScore < 100) {
        hasReachedMax = false;
        await chrome.storage.local.set({ maxTriggered: false });
    }
    
    return currentScore;
}

export async function addPoints(amount, reason) {
    const oldScore = currentScore;
    await setScore(oldScore + amount);
    const actualChange = currentScore - oldScore;
    
    if (actualChange !== 0) {
        console.log(`TAB JAIL SCORE:\n${oldScore} -> ${currentScore}\nREASON: ${reason}`);
        notifyEvent("SCORE_CHANGED", oldScore, currentScore, actualChange, reason);
    }
}

export async function removePoints(amount, reason) {
    const oldScore = currentScore;
    await setScore(oldScore - amount);
    const actualChange = currentScore - oldScore;
    
    if (actualChange !== 0) {
        console.log(`TAB JAIL SCORE:\n${oldScore} -> ${currentScore}\nREASON: ${reason}`);
        notifyEvent("SCORE_CHANGED", oldScore, currentScore, actualChange, reason);
    }
}

export async function resetScore(value) {
    await setScore(value);
}

export function getScoreState() {
    return {
        score: currentScore,
        hasReachedZero,
        hasReachedMax
    };
}

function notifyEvent(eventType, oldScore, newScore, amount, reason) {
    const eventData = {
        type: eventType,
        oldScore: oldScore,
        newScore: newScore,
        amount: amount,
        reason: reason
    };
    
    // Broadcast to popup or other listeners
    try {
        chrome.runtime.sendMessage(eventData);
    } catch (e) {
        // Ignored if there are no listeners (e.g. popup closed)
    }
}
