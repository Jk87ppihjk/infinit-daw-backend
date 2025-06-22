// =================================================================
// ===== NOVAS FUNÇÕES PARA O ZOOM VERTICAL ========================
// =================================================================

/**
 * Aplica a altura da trilha atual (zoom vertical) a todos os elementos relevantes.
 * Esta função é o núcleo visual do zoom.
 */
function applyVerticalZoom() {
    const newHeight = APP_STATE.currentTrackHeight;

    // Aplica a nova altura a todos os cabeçalhos e pistas de trilha
    document.querySelectorAll('.track-header, .track-lane').forEach(el => {
        el.style.height = `${newHeight}px`;
    });

    // Ajusta os clipes e redesenha suas waveforms, pois a altura do canvas mudou
    document.querySelectorAll('.clip').forEach(clip => {
        clip.style.height = `${newHeight * 0.8}px`; // O clipe ocupa 80% da altura
        clip.style.top = `${newHeight * 0.1}px`;   // Margem de 10% para centralizar

        const canvas = clip.querySelector('.waveform-canvas');
        if (canvas) {
            const clipId = parseInt(clip.dataset.clipId);
            const audioBuffer = APP_STATE.clipAudioBuffers.get(clipId);
            const startSec = parseFloat(clip.dataset.originalStartSec || 0);
            if (audioBuffer) {
                // A função drawWaveform já redimensiona o canvas antes de desenhar
                drawWaveform(canvas, audioBuffer, startSec);
            }
        }
    });

    // Atualiza a altura total do contêiner da timeline para ajustar a barra de rolagem
    if (typeof updateTimelineHeight === 'function') {
        updateTimelineHeight();
    }
}

/**
 * Inicializa os listeners para o zoom vertical (Shift + Scroll e Pinch-to-Zoom).
 * A lógica é adicionada ao contêiner dos cabeçalhos.
 */
function initializeVerticalZoom() {
    let initialPinchDistance = 0;
    let initialTrackHeightOnPinch = 0;

    // Lógica para o zoom com SHIFT + SCROLL no PC
    const handleWheelZoom = (e) => {
        if (!e.shiftKey) return; // Só funciona com a tecla Shift pressionada

        e.preventDefault();
        const zoomIntensity = 5; // Pixels a adicionar/remover a cada scroll
        let newHeight = APP_STATE.currentTrackHeight;

        if (e.deltaY < 0) { // Scroll para cima = Zoom In
            newHeight += zoomIntensity;
        } else { // Scroll para baixo = Zoom Out
            newHeight -= zoomIntensity;
        }

        // Garante que a altura fique dentro dos limites definidos no estado
        APP_STATE.currentTrackHeight = Math.max(APP_STATE.minTrackHeight, Math.min(newHeight, APP_STATE.maxTrackHeight));
        
        applyVerticalZoom();
    };

    // Lógica para o zoom com gesto de "PINÇA" no Celular/Tablet
    const handleTouchStart = (e) => {
        if (e.touches.length === 2) { // Se são dois dedos na tela
            e.preventDefault();
            initialPinchDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialTrackHeightOnPinch = APP_STATE.currentTrackHeight;
        }
    };

    const handleTouchMove = (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const currentPinchDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );

            if (initialPinchDistance > 0) {
                const scale = currentPinchDistance / initialPinchDistance;
                const newHeight = initialTrackHeightOnPinch * scale;

                APP_STATE.currentTrackHeight = Math.max(APP_STATE.minTrackHeight, Math.min(newHeight, APP_STATE.maxTrackHeight));
                
                applyVerticalZoom();
            }
        }
    };
    
    const handleTouchEnd = () => {
        // Reseta as variáveis de controle do gesto
        initialPinchDistance = 0;
        initialTrackHeightOnPinch = 0;
    };

    // Adiciona os listeners ao contêiner dos cabeçalhos das trilhas
    DOM.trackHeadersContainer.addEventListener('wheel', handleWheelZoom, { passive: false });
    DOM.trackHeadersContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
    DOM.trackHeadersContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    DOM.trackHeadersContainer.addEventListener('touchend', handleTouchEnd);
}

/**
 * ===================================================================
 * === NOVA FUNÇÃO PARA ARRASTAR A TIMELINE ==========================
 * ===================================================================
 */
function initializeTimelineDragging() {
    const scrollContainer = DOM.timelineScrollContainer;
    // Adicionamos a régua também como uma área de arrastar
    const elementsToDrag = [scrollContainer, DOM.rulerContainer];

    let isPanning = false;
    let startX;
    let scrollLeftStart;

    const startPan = (e) => {
        // Ignora o arraste se o clique foi em um elemento interativo
        const ignoredElements = '.clip, .resize-handle, #playhead-dragger, .loop-marker, button, input';
        if (e.target.closest(ignoredElements)) {
            return;
        }
        
        e.preventDefault();
        isPanning = true;
        scrollContainer.classList.add('is-panning');
        // Usamos pageX para funcionar corretamente mesmo com scroll
        startX = e.pageX - scrollContainer.offsetLeft;
        scrollLeftStart = scrollContainer.scrollLeft;
        
        // Adiciona listeners ao window para que o arraste continue fora da área da timeline
        window.addEventListener('mousemove', handlePan);
        window.addEventListener('mouseup', endPan);
        window.addEventListener('mouseleave', endPan);
    };

    const handlePan = (e) => {
        if (!isPanning) return;
        const x = e.pageX - scrollContainer.offsetLeft;
        const walk = (x - startX) * 1.5; // O multiplicador dá uma sensação de "aceleração"
        scrollContainer.scrollLeft = scrollLeftStart - walk;
    };

    const endPan = () => {
        isPanning = false;
        scrollContainer.classList.remove('is-panning');
        // Remove os listeners do window para não interferir com outras ações
        window.removeEventListener('mousemove', handlePan);
        window.removeEventListener('mouseup', endPan);
        window.removeEventListener('mouseleave', endPan);
    };
    
    // Adiciona o listener de início de arraste para a timeline e a régua
    elementsToDrag.forEach(element => {
        if (element) {
            element.addEventListener('mousedown', startPan);
        }
    });
}


/**
 * Lida com o processo de importação de arquivo de áudio para uma trilha específica.
 * @param {File} file - O objeto File do arquivo de áudio selecionado.
 * @param {number} trackId - O ID da trilha onde o áudio será importado.
 */
async function handleAudioImport(file, trackId) {
    if (!file || !APP_STATE.audioContext) return;

    const trackElement = DOM.timelineContent.querySelector(`.track-lane[data-track-id='${trackId}']`);
    if (!trackElement) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await APP_STATE.audioContext.decodeAudioData(arrayBuffer);

        const duration = audioBuffer.duration;
        const secondsPerBeat = 60 / APP_STATE.bpm;
        const widthInBeats = duration / secondsPerBeat;
        
        const clipWidth = widthInBeats * APP_STATE.dynamicPixelsPerBeat;

        const startPosition = getSnapPosition(DOM.playhead.offsetLeft);

        addClipToTrack(trackElement, startPosition, clipWidth, file.name, audioBuffer, 0);

    } catch (e) {
        console.error("Erro ao decodificar o arquivo de áudio:", e);
        alert("Não foi possível processar o arquivo de áudio. Verifique se o formato é suportado (ex: WAV, MP3).");
    }
}

/**
 * Inicializa todos os ouvintes de evento e estados iniciais dos controles da DAW.
 */
function initializeControls() {
    DOM.bpmInput.value = APP_STATE.bpm;
    DOM.snapToggleBtn.classList.toggle('active', APP_STATE.isSnapEnabled);
    DOM.metronomeBtn.classList.toggle('active', APP_STATE.isMetronomeEnabled);
    
    if (DOM.loopToggleBtn) {
        DOM.loopToggleBtn.classList.toggle('active', APP_STATE.loop.isEnabled);
    }
    if (DOM.recordBtn) {
        DOM.recordBtn.classList.toggle('active', APP_STATE.recording.isRecording);
    }

    DOM.playBtn.addEventListener('click', () => {
        if (APP_STATE.isPlaying) {
            pause();
        } else {
            play();
        }
    });

    DOM.stopBtn.addEventListener('click', () => {
        if (APP_STATE.isPlaying) {
            pause();
        }
        movePlayhead(0);
        APP_STATE.playbackStartPositionPx = 0;
    });

    DOM.bpmInput.addEventListener('change', (e) => {
        const currentLoopStartSec = positionPxToTimeSec(APP_STATE.loop.startTimePx);
        const currentLoopEndSec = positionPxToTimeSec(APP_STATE.loop.endTimePx);
        
        APP_STATE.bpm = parseInt(e.target.value) || 120;
        
        createRuler(); 
        createLoopMarkers(); 
        
        APP_STATE.loop.startTimePx = timeToPositionPx(currentLoopStartSec);
        APP_STATE.loop.endTimePx = timeToPositionPx(currentLoopEndSec);

        updateLoopMarkersVisuals(); 

        document.querySelectorAll('.track-lane').forEach(trackLane => {
            trackLane.style.width = `${APP_STATE.timelineWidth}px`;
        });
    });

    DOM.snapToggleBtn.addEventListener('click', () => {
        APP_STATE.isSnapEnabled = !APP_STATE.isSnapEnabled;
        DOM.snapToggleBtn.classList.toggle('active', APP_STATE.isSnapEnabled);
    });

    DOM.metronomeBtn.addEventListener('click', () => {
        APP_STATE.isMetronomeEnabled = !APP_STATE.isMetronomeEnabled;
        toggleMetronome();
    });

    if (DOM.loopToggleBtn) {
        DOM.loopToggleBtn.addEventListener('click', () => {
            APP_STATE.loop.isEnabled = !APP_STATE.loop.isEnabled;
            DOM.loopToggleBtn.classList.toggle('active', APP_STATE.loop.isEnabled);

            if (APP_STATE.loop.isEnabled) {
                const pixelsPerBar = APP_STATE.dynamicPixelsPerBeat * APP_STATE.beatsPerBar;
                const playheadPx = APP_STATE.playbackStartPositionPx;
                const startOfBarPx = Math.floor(playheadPx / pixelsPerBar) * pixelsPerBar;
                APP_STATE.loop.startTimePx = startOfBarPx;
                APP_STATE.loop.endTimePx = startOfBarPx + pixelsPerBar;
            }

            updateLoopMarkersVisuals();
        });
    }

    if (DOM.recordBtn) {
        DOM.recordBtn.addEventListener('click', () => {
            if (!APP_STATE.recording.isRecording) {
                const selectedTrackHeader = document.querySelector('.track-header.selected');
                if (!selectedTrackHeader) {
                    alert('Por favor, selecione uma trilha para gravar o áudio.');
                    return;
                }
                const trackId = parseInt(selectedTrackHeader.dataset.trackId);
                startRecording(trackId);
            } else {
                stopRecording();
            }
        });
    }

    DOM.addTrackBtn.addEventListener('click', addTrack);

    DOM.importAudioBtn.addEventListener('click', () => {
        const selectedTrack = document.querySelector('.track-header.selected');
        if (!selectedTrack) {
            alert('Por favor, selecione uma trilha antes de importar o áudio.');
            return;
        }
        DOM.audioFileInput.click();
    });

    DOM.audioFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const selectedTrack = document.querySelector('.track-header.selected');
        if (file && selectedTrack) {
            const trackId = selectedTrack.dataset.trackId;
            handleAudioImport(file, trackId);
        }
        e.target.value = '';
    });

    DOM.trackHeadersContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-track-btn')) {
            deleteTrack(e.target.dataset.trackId);
        }
    });

    window.addEventListener('keydown', (event) => {
        if (event.code === 'Space' &&
            !event.target.matches('input[type="number"], input[type="text"], input[type="search"]')) {
            event.preventDefault();
            if (APP_STATE.isPlaying) {
                pause();
            } else {
                play();
            }
        }
    });

    initializeVerticalZoom();
    
    // --- CHAMADA DA NOVA FUNÇÃO ---
    initializeTimelineDragging();
}