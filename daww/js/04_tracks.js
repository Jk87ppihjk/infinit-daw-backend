// app/js/04_tracks.js - VERSÃO CORRIGIDA COM LIMITE DE 9 TRILHAS E ALTURA DINÂMICA

/**
 * Seleciona uma trilha, atualiza o estado visual e preenche a gaveta com suas informações.
 * @param {number} trackId - O ID da trilha a ser selecionada.
 */
function selectTrack(trackId) {
    const currentlySelected = document.querySelector('.track-header.selected');
    if (currentlySelected) {
        currentlySelected.classList.remove('selected');
    }

    const trackHeaderToSelect = document.querySelector(`.track-header[data-track-id='${trackId}']`);
    if (trackHeaderToSelect) {
        trackHeaderToSelect.classList.add('selected');

        const trackData = {
            id: parseInt(trackId),
            name: trackHeaderToSelect.querySelector('.font-bold').textContent,
            volume: parseFloat(trackHeaderToSelect.dataset.volume),
            pan: parseInt(trackHeaderToSelect.dataset.pan),
            isMuted: trackHeaderToSelect.dataset.isMuted === 'true',
            isSoloed: trackHeaderToSelect.dataset.isSoloed === 'true'
        };

        if (typeof updateDrawer === 'function') {
            updateDrawer(trackData);
        }
    }
}


function addTrack() {
    // ==========================================================
    // ===== LÓGICA DE LIMITE DE TRILHAS (JÁ EXISTENTE) =========
    // ==========================================================
    if (APP_STATE.userAccessLevel === 'free') {
        const currentTrackCount = DOM.trackHeadersContainer.querySelectorAll('.track-header').length;
        if (currentTrackCount >= 9) {
            alert('Você atingiu o limite de 9 trilhas para o plano gratuito. Faça o upgrade para ter trilhas ilimitadas!');
            return; 
        }
    }

    const trackId = APP_STATE.nextTrackId++;
    const trackHeader = document.createElement('div');
    // REMOVIDO: h-20 da lista de classes para permitir altura dinâmica
    trackHeader.className = 'track-header flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700 cursor-pointer';
    trackHeader.dataset.trackId = trackId;

    // ==========================================================
    // ===== ALTERAÇÃO PARA ZOOM VERTICAL =======================
    // ==========================================================
    // Define a altura inicial com base no estado da aplicação
    trackHeader.style.height = `${APP_STATE.currentTrackHeight}px`;

    trackHeader.dataset.volume = "1.0";
    trackHeader.dataset.pan = "0";
    trackHeader.dataset.isMuted = "false";
    trackHeader.dataset.isSoloed = "false";

    // ==========================================================
    // ===== CORREÇÃO: Botões M, S, R removidos daqui =========
    // ==========================================================
    trackHeader.innerHTML = `
        <div class="w-28 pointer-events-none">
            <p class="font-bold truncate">Trilha ${trackId}</p>
        </div>
        <button data-track-id="${trackId}" class="delete-track-btn text-gray-400 hover:text-red-500 font-bold p-1 rounded-full hover:bg-gray-700 transition-colors">✕</button>`;
    
    trackHeader.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        selectTrack(trackId);
    });

    DOM.trackHeadersContainer.appendChild(trackHeader);

    const trackContent = document.createElement('div');
    // REMOVIDO: h-20 da lista de classes para permitir altura dinâmica
    trackContent.className = 'track-lane border-b border-gray-700 relative';
    trackContent.dataset.trackId = trackId;
    // Define a altura inicial com base no estado da aplicação
    trackContent.style.height = `${APP_STATE.currentTrackHeight}px`;
    
    DOM.timelineContent.appendChild(trackContent);
    
    APP_STATE.trackEffects.set(trackId, []);

    updateTimelineHeight();
    selectTrack(trackId);
}

/**
 * Adiciona um clipe visual a uma trilha.
 * @param {HTMLElement} trackElement - O elemento da pista onde o clipe será adicionado.
 * @param {number} startPx - A posição inicial do clipe em pixels.
 * @param {number} widthPx - A largura do clipe em pixels.
 * @param {string} text - O texto a ser exibido no clipe.
 * @param {AudioBuffer} audioBuffer - O buffer de áudio associado.
 * @param {number} originalStartSec - O ponto de início (em segundos) dentro do audioBuffer.
 */
function addClipToTrack(trackElement, startPx, widthPx, text = 'Clip de Áudio', audioBuffer = null, originalStartSec = 0) {
    const clipId = APP_STATE.nextClipId++;
    const clip = document.createElement('div');
    // REMOVIDO: h-16 e top-2 das classes para permitir altura e posição dinâmicas
    clip.className = 'clip absolute rounded-md bg-blue-600 border-2 border-transparent cursor-pointer overflow-hidden';
    clip.style.left = `${startPx}px`;
    clip.style.width = `${widthPx}px`;
    clip.draggable = true;
    clip.dataset.clipId = clipId;
    clip.dataset.originalStartSec = originalStartSec;
    
    // ==========================================================
    // ===== ALTERAÇÃO PARA ZOOM VERTICAL =======================
    // ==========================================================
    // Define a altura e posição do clipe proporcionalmente à altura da trilha
    clip.style.height = `${APP_STATE.currentTrackHeight * 0.8}px`; // O clipe ocupa 80% da altura da trilha
    clip.style.top = `${APP_STATE.currentTrackHeight * 0.1}px`;    // O clipe fica centralizado com 10% de margem

    clip.innerHTML = `
        <canvas class="waveform-canvas absolute top-0 left-0 h-full"></canvas>
        <span class="clip-text-overlay absolute top-1 left-2 pointer-events-none text-white text-xs font-bold">${text}</span>
        <div class="resize-handle left"></div>
        <div class="resize-handle right"></div>
    `;
    
    trackElement.appendChild(clip);

    if (audioBuffer) {
        APP_STATE.clipAudioBuffers.set(clipId, audioBuffer);
        
        setTimeout(() => {
            const canvas = clip.querySelector('.waveform-canvas');
            if (canvas) {
                const totalAudioDurationSec = audioBuffer.duration;
                const totalCanvasWidthPx = timeToPositionPx(totalAudioDurationSec);

                canvas.style.width = `${totalCanvasWidthPx}px`;
                
                drawWaveform(canvas, audioBuffer, 0);

                const canvasOffsetPx = timeToPositionPx(originalStartSec);
                canvas.style.left = `-${canvasOffsetPx}px`;
            }
        }, 0);
    }
    
    return clip;
}


function deleteTrack(trackIdToDelete) {
    const trackIdNum = parseInt(trackIdToDelete);
    const headerToRemove = DOM.trackHeadersContainer.querySelector(`.track-header[data-track-id='${trackIdNum}']`);
    const wasSelected = headerToRemove && headerToRemove.classList.contains('selected');

    headerToRemove?.remove();
    DOM.timelineContent.querySelector(`.track-lane[data-track-id='${trackIdNum}']`)?.remove();
    updateTimelineHeight();

    APP_STATE.trackEffects.delete(trackIdNum);

    if (wasSelected) {
        const firstTrack = DOM.trackHeadersContainer.querySelector('.track-header');
        if (firstTrack) {
            selectTrack(parseInt(firstTrack.dataset.trackId));
        } else {
            DOM.drawerPlaceholder.classList.remove('hidden');
            DOM.drawerTrackControls.classList.add('hidden');
        }
    }
}

function updateTimelineHeight() {
    const currentTrackCount = DOM.timelineContent.querySelectorAll('.track-lane').length;
    // ==========================================================
    // ===== ALTERAÇÃO PARA ZOOM VERTICAL =======================
    // ==========================================================
    // Usa a altura da trilha do estado global em vez de uma constante fixa
    const totalHeight = currentTrackCount * APP_STATE.currentTrackHeight;
    DOM.timelineContent.style.height = `${Math.max(totalHeight, APP_STATE.currentTrackHeight)}px`;
}