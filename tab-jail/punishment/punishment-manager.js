// =============================================================
// TAB JAIL — Punishment Manager
// =============================================================

(function() {
    let punishmentActive = false;
    let overlay = null;

    chrome.storage.local.get(['score'], (data) => {
        if (data.score === 0) {
            startPunishment();
        }
    });

    chrome.storage.onChanged.addListener((changes, ns) => {
        if (ns === 'local' && changes.score) {
            if (changes.score.newValue === 0 && !punishmentActive) {
                startPunishment();
            } else if (changes.score.newValue > 0 && punishmentActive) {
                endPunishment();
            }
        }
    });

    function startPunishment() {
        if (punishmentActive) return;
        punishmentActive = true;
        
        overlay = document.createElement('div');
        overlay.id = 'tab-jail-punishment-overlay';
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:#000; z-index:2147483647; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#0f0; font-family:monospace;';
        
        const warning = document.createElement('h1');
        warning.textContent = "JAILBREAK REQUIRED";
        warning.style.fontSize = '3rem';
        
        const sub = document.createElement('h2');
        sub.textContent = "Clear 3 lines to escape.";
        
        const btn = document.createElement('button');
        btn.textContent = "ENTER PUNISHMENT";
        btn.style.cssText = 'padding: 20px 40px; font-size: 2rem; background: #f00; color: #fff; cursor:pointer; margin-top:20px; font-family:monospace; border:none; border-radius:5px;';
        
        const msg = document.createElement('div');
        msg.style.marginTop = '20px';
        msg.style.color = '#f00';
        msg.id = 'tab-jail-punishment-msg';
        
        btn.onclick = () => {
            document.documentElement.requestFullscreen().then(() => {
                showTetris();
            }).catch(e => {
                msg.textContent = "You must allow fullscreen to serve your time.";
            });
        };
        
        overlay.appendChild(warning);
        overlay.appendChild(sub);
        overlay.appendChild(btn);
        overlay.appendChild(msg);
        
        document.documentElement.appendChild(overlay);
        
        document.addEventListener('fullscreenchange', handleFullscreenChange);
    }
    
    function showTetris() {
        overlay.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.src = chrome.runtime.getURL('punishment/tetris.html');
        iframe.style.cssText = 'width:100%; height:100%; border:none;';
        overlay.appendChild(iframe);
    }

    function handleFullscreenChange() {
        if (!document.fullscreenElement && punishmentActive) {
            overlay.innerHTML = '';
            
            const warning = document.createElement('h1');
            warning.textContent = "NICE TRY, INMATE.";
            warning.style.fontSize = '3rem';
            warning.style.color = '#f00';
            
            const btn = document.createElement('button');
            btn.textContent = "RESUME PUNISHMENT";
            btn.style.cssText = 'padding: 20px 40px; font-size: 2rem; background: #f00; color: #fff; cursor:pointer; margin-top:20px; font-family:monospace; border:none; border-radius:5px;';
            
            const msg = document.createElement('div');
            msg.style.marginTop = '20px';
            msg.style.color = '#f00';
            msg.id = 'tab-jail-punishment-msg';
            
            btn.onclick = () => {
                document.documentElement.requestFullscreen().then(() => {
                    showTetris();
                }).catch(e => {
                    msg.textContent = "You must allow fullscreen to serve your time.";
                });
            };
            
            overlay.appendChild(warning);
            overlay.appendChild(btn);
            overlay.appendChild(msg);
        }
    }

    function endPunishment() {
        punishmentActive = false;
        if (overlay) {
            overlay.remove();
            overlay = null;
        }
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(()=>{});
        }
    }
    
    window.addEventListener('message', (event) => {
        if (event.data === 'TETRIS_CLEARED_3_LINES') {
            chrome.runtime.sendMessage({ type: "PUNISHMENT_COMPLETE" });
        }
    });

})();
