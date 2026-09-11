// =============================================================
// TAB JAIL — Eye Tracking Module
// =============================================================

let trackingActive = false;
let videoElement = null;
let stream = null;
let attentionState = "unknown";

// Expose globally for the activity tracker
window.tabJailEyeTracking = {
    startEyeTracking,
    stopEyeTracking,
    getAttentionState
};

async function startEyeTracking() {
    if (trackingActive) return;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement = document.createElement('video');
        videoElement.srcObject = stream;
        videoElement.play();
        trackingActive = true;
        
        // Setup MediaPipe or fallback logic here.
        // For hackathon/demo purposes without bundling the 10MB MediaPipe WASM,
        // we simulate "true" if camera is active, or we could implement a basic light-level check.
        // Since MV3 prohibits remote code execution (no CDN scripts in content scripts), 
        // full face meshing requires bundling the library in the extension.
        
        attentionState = true; // Mocking successful detection for demo if camera granted
        
        // Simulating some eye tracking logic loop
        requestAnimationFrame(processFrame);
        
    } catch (err) {
        console.warn("TAB JAIL Eye Tracking failed to start:", err);
        attentionState = "unknown";
    }
}

function processFrame() {
    if (!trackingActive) return;
    // Real implementation would pass videoElement to FaceLandmarker here
    // and calculate head pose / eye gaze.
    // We keep state as true unless they manually cover camera (which we could detect via brightness).
    requestAnimationFrame(processFrame);
}

function stopEyeTracking() {
    if (!trackingActive) return;
    trackingActive = false;
    attentionState = "unknown";
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (videoElement) {
        videoElement.srcObject = null;
        videoElement = null;
    }
}

function getAttentionState() {
    return attentionState;
}
