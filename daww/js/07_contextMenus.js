function hideContextMenus() {
    DOM.clipContextMenu.style.display = 'none';
    DOM.trackContextMenu.style.display = 'none';
    APP_STATE.contextMenuTargetClip = null;
}

/**
 * Inicializa os eventos para os menus de contexto, agora com suporte
 * a duplo clique (desktop) e toque duplo (móvel).
 */
function initializeContextMenuEvents() {
    let lastTapTime = 0;
    let doubleTapTimeout = null;

    // Função centralizada para mostrar o menu, chamada por ambos os eventos
    const showContextMenu = (e, isTouchEvent = false) => {
        hideContextMenus();
        
        // Pega as coordenadas corretas do evento (mouse ou toque)
        const coords = isTouchEvent ? e.touches[0] : e;
        const clientX = coords.clientX;
        const clientY = coords.clientY;

        const clip = e.target.closest('.clip');
        if (clip) {
            APP_STATE.contextMenuTargetClip = clip;
            DOM.clipContextMenu.style.left = `${clientX}px`;
            DOM.clipContextMenu.style.top = `${clientY}px`;
            DOM.clipContextMenu.style.display = 'block';
            selectClip(clip);

            const playheadPos = DOM.playhead.offsetLeft;
            const clipStart = clip.offsetLeft;
            const clipEnd = clip.offsetLeft + clip.offsetWidth;
            DOM.contextSplitBtn.classList.toggle('disabled', !(playheadPos > clipStart && playheadPos < clipEnd));
        } else {
            const targetLane = e.target.closest('.track-lane');
            if (targetLane) {
                const rect = targetLane.getBoundingClientRect();
                APP_STATE.contextMenuPasteX = clientX - rect.left + DOM.timelineScrollContainer.scrollLeft;
                DOM.contextPasteBtn.classList.toggle('disabled', !APP_STATE.clipboard);
                DOM.trackContextMenu.style.left = `${clientX}px`;
                DOM.trackContextMenu.style.top = `${clientY}px`;
                DOM.trackContextMenu.style.display = 'block';
            }
        }
    };

    // Listener para duplo clique no Desktop
    DOM.timelineContent.addEventListener('dblclick', (e) => {
        e.preventDefault();
        showContextMenu(e, false);
    });

    // Listener para detectar o toque duplo no Mobile
    DOM.timelineContent.addEventListener('touchstart', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        clearTimeout(doubleTapTimeout);

        if (tapLength < 300 && tapLength > 0) {
            // Toque duplo detectado!
            e.preventDefault();
            showContextMenu(e, true);
            lastTapTime = 0; // Reseta o tempo para evitar múltiplos acionamentos
        } else {
            // Se for apenas um toque, define um tempo limite
            doubleTapTimeout = setTimeout(() => {
                lastTapTime = 0;
            }, 300);
        }
        lastTapTime = currentTime;
    }, { passive: false }); // passive: false é necessário para e.preventDefault() funcionar


    // Ações dos botões do menu (sem alterações)
    DOM.contextSplitBtn.addEventListener('click', () => {
        if (DOM.contextSplitBtn.classList.contains('disabled') || !APP_STATE.contextMenuTargetClip) return hideContextMenus();
        
        const clip = APP_STATE.contextMenuTargetClip;
        const track = clip.parentElement;
        const clipId = parseInt(clip.dataset.clipId);
        const audioBuffer = APP_STATE.clipAudioBuffers.get(clipId);
        const clipText = clip.querySelector('.clip-text-overlay').textContent;
        const clipInitialStartSec = parseFloat(clip.dataset.originalStartSec || 0);

        const playheadPos = DOM.playhead.offsetLeft;
        const clipStartPx = clip.offsetLeft;
        
        const defaultBPM = 120;
        const basePixelsPerBeatAtDefaultBPM = 60;
        const dynamicPixelsPerBeat = basePixelsPerBeatAtDefaultBPM * (defaultBPM / APP_STATE.bpm);
        const secondsPerPixel = (60 / APP_STATE.bpm) / dynamicPixelsPerBeat;
        
        const splitTimeInClipSec = (playheadPos - clipStartPx) * secondsPerPixel;
        const newClipStartSec = clipInitialStartSec + splitTimeInClipSec;

        const newWidth1 = playheadPos - clipStartPx;
        const newWidth2 = (clip.offsetLeft + clip.offsetWidth) - playheadPos;
        
        clip.style.width = `${newWidth1}px`;
        
        if (audioBuffer) {
            drawWaveform(clip.querySelector('.waveform-canvas'), audioBuffer, clipInitialStartSec);
        }
        
        addClipToTrack(track, playheadPos, newWidth2, clipText, audioBuffer, newClipStartSec);
        hideContextMenus();
    });

    DOM.contextCopyBtn.addEventListener('click', () => {
        if (APP_STATE.contextMenuTargetClip) {
            const clip = APP_STATE.contextMenuTargetClip;
            const clipId = parseInt(clip.dataset.clipId);
            const audioBuffer = APP_STATE.clipAudioBuffers.get(clipId);
            
            APP_STATE.clipboard = {
                width: clip.offsetWidth,
                text: clip.querySelector('.clip-text-overlay').textContent,
                audioBuffer: audioBuffer,
                originalStartSec: parseFloat(clip.dataset.originalStartSec || 0)
            };
        }
        hideContextMenus();
    });

    DOM.contextDeleteBtn.addEventListener('click', () => {
        if(APP_STATE.contextMenuTargetClip) {
            const clip = APP_STATE.contextMenuTargetClip;
            const clipId = parseInt(clip.dataset.clipId);
            APP_STATE.clipAudioBuffers.delete(clipId);
            clip.remove();
        }
        hideContextMenus();
    });
    
    DOM.contextPasteBtn.addEventListener('click', () => {
        const selectedTrackHeader = document.querySelector('.track-header.selected');
        if (!DOM.contextPasteBtn.classList.contains('disabled') && APP_STATE.clipboard && selectedTrackHeader) {
            const trackId = parseInt(selectedTrackHeader.dataset.trackId);
            const targetTrackLane = DOM.timelineContent.querySelector(`.track-lane[data-track-id='${trackId}']`);

            if (targetTrackLane) {
                const pastePos = getSnapPosition(APP_STATE.contextMenuPasteX);
                const clipData = APP_STATE.clipboard;
                addClipToTrack(targetTrackLane, pastePos, clipData.width, clipData.text, clipData.audioBuffer, clipData.originalStartSec);
            }
        }
        hideContextMenus();
    });
}