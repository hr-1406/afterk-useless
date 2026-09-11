chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRIGGER_JUMPSCARE') {
    triggerJumpscare();
  }
});

function triggerJumpscare() {
  const overlay = document.createElement('div');
  overlay.className = 'pp-jumpscare-overlay';
  
  const text = document.createElement('div');
  text.className = 'pp-jumpscare-text';
  text.innerText = 'PUNISHMENT ACTIVE';
  
  overlay.appendChild(text);
  document.body.appendChild(overlay);

  // Play a jarring sound if permitted
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(100, audioCtx.currentTime); // low frequency
    oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.5);
    
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 1.5);
  } catch (e) {
    // Autoplay blocked or web audio unsupported, just rely on visuals
  }
}
