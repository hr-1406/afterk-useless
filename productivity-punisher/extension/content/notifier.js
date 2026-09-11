chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'POINT_UPDATE') {
    showToast(message.payload);
  }
});

let activeToasts = 0;

function showToast({ pointsChange, domain, classification, durationSeconds, totalScore }) {
  const toast = document.createElement('div');
  toast.className = `pp-toast ${pointsChange > 0 ? 'pp-toast-unproductive' : 'pp-toast-productive'}`;
  
  // Calculate offset if multiple toasts stack
  const offset = 20 + (activeToasts * 100);
  toast.style.top = `${offset}px`;
  
  const sign = pointsChange > 0 ? '+' : '';
  const pointsHTML = `<div class="pp-toast-points">${sign}${pointsChange} POINTS</div>`;
  const domainHTML = `<div class="pp-toast-domain">${domain}</div>`;
  const timeHTML = `<div class="pp-toast-time">${durationSeconds} seconds &bull; Total: ${totalScore}</div>`;
  
  toast.innerHTML = pointsHTML + domainHTML + timeHTML;
  document.body.appendChild(toast);
  
  activeToasts++;

  // Trigger entrance animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('pp-show');
    });
  });

  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('pp-show');
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
      activeToasts = Math.max(0, activeToasts - 1);
    }, 400); // match transition duration
  }, 3000);
}
