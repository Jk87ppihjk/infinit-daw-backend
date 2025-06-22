/**
 * Gerencia a posição e o comportamento da agulha de reprodução (playhead).
 */

// --- Funções Auxiliares (Tornadas globalmente acessíveis) ---

/**
 * Converte um tempo em segundos para a posição horizontal na régua.
 * Usa o pixelsPerBeat dinâmico do createRuler para ser preciso.
 * @param {number} timeSec - Tempo em segundos.
 * @returns {number} Posição horizontal em pixels.
 */
function timeToPositionPx(timeSec) {
    const defaultBPM = 120;
    const basePixelsPerBeatAtDefaultBPM = 60;
    const dynamicPixelsPerBeat = basePixelsPerBeatAtDefaultBPM * (defaultBPM / APP_STATE.bpm);
    const secondsPerBeat = 60 / APP_STATE.bpm;
    const pixelsPerSecond = dynamicPixelsPerBeat / secondsPerBeat;
    return timeSec * pixelsPerSecond;
}

/**
 * Converte uma posição horizontal na régua (pixels) para um tempo em segundos.
 * Usa o pixelsPerBeat dinâmico do createRuler para ser preciso.
 * @param {number} positionPx - Posição horizontal em pixels.
 * @returns {number} Tempo em segundos.
 */
function positionPxToTimeSec(positionPx) {
    const defaultBPM = 120;
    const basePixelsPerBeatAtDefaultBPM = 60;
    const dynamicPixelsPerBeat = basePixelsPerBeatAtDefaultBPM * (defaultBPM / APP_STATE.bpm);
    const secondsPerBeat = 60 / APP_STATE.bpm;
    const pixelsPerSecond = dynamicPixelsPerBeat / secondsPerBeat;
    return positionPx / pixelsPerSecond;
}

/**
 * Atualiza a posição da agulha de reprodução na tela.
 * @param {number} newX - A nova posição X em pixels para a agulha.
 */
function movePlayhead(newX) {
    const positionX = APP_STATE.isPlaying ? newX : getSnapPosition(newX);
    const boundedX = Math.max(0, Math.min(positionX, APP_STATE.timelineWidth));
    
    DOM.playhead.style.left = `${boundedX}px`;
    DOM.playheadDragger.style.left = `${boundedX - 5}px`;

    if (!APP_STATE.isPlaying) {
        APP_STATE.playbackStartPositionPx = boundedX;
    }
    
    if (!APP_STATE.isPlaying) {
        const scrollContainer = DOM.timelineScrollContainer;
        const containerWidth = scrollContainer.clientWidth;
        const currentScroll = scrollContainer.scrollLeft;
        const rightEdge = currentScroll + containerWidth;

        const isOutsideView = (boundedX < currentScroll) || (boundedX > rightEdge);

        if (isOutsideView) {
            const newScrollLeft = boundedX - (containerWidth / 2);
            scrollContainer.scrollLeft = newScrollLeft;
        }
    }
}

/**
 * Lida com o arrastar da agulha de reprodução.
 */
function initializePlayheadDragging() {
    let isDragging = false;
    let dragStart = 0;
    let originalPlayheadPositionPx = 0;

    DOM.playheadDragger.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStart = e.clientX;
        originalPlayheadPositionPx = DOM.playhead.offsetLeft;
        window.addEventListener('mousemove', handlePlayheadMouseMove);
        window.addEventListener('mouseup', handlePlayheadMouseUp);
        e.preventDefault();
    });

    const handlePlayheadMouseMove = (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - dragStart;
        const newX = originalPlayheadPositionPx + deltaX;
        movePlayhead(newX);
    };

    const handlePlayheadMouseUp = () => {
        isDragging = false;
        window.removeEventListener('mousemove', handlePlayheadMouseMove);
        window.removeEventListener('mouseup', handlePlayheadMouseUp);
    };
}


// --- Funções para o Loop (Usando APP_STATE.loop) ---

/**
 * Cria os marcadores de loop e os adiciona à régua.
 * Esta função deve ser chamada após a criação da régua.
 */
function createLoopMarkers() {
    // Se os marcadores não foram criados ainda (primeira inicialização)
    if (!APP_STATE.loop.startMarker || !APP_STATE.loop.endMarker || !DOM.ruler.contains(APP_STATE.loop.startMarker)) {
        APP_STATE.loop.startMarker = document.createElement('div');
        APP_STATE.loop.startMarker.className = 'loop-marker loop-start';
        DOM.ruler.appendChild(APP_STATE.loop.startMarker);

        APP_STATE.loop.endMarker = document.createElement('div');
        APP_STATE.loop.endMarker.className = 'loop-marker loop-end';
        DOM.ruler.appendChild(APP_STATE.loop.endMarker);

        // Se é a primeira vez, defina posições iniciais
        if (APP_STATE.loop.startTimePx === undefined || APP_STATE.loop.endTimePx === undefined || APP_STATE.loop.endTimePx === 600) { // Verifica se ainda está no default inicial
            APP_STATE.loop.startTimePx = 0;
            
            // ==========================================================
            // ===== CORREÇÃO PRINCIPAL #1: Tamanho inicial do loop =====
            // ==========================================================
            // Define a largura inicial para apenas 1 compasso.
            const initialLoopDurationBeats = APP_STATE.beatsPerBar; // Alterado de `* 4` para apenas 1 compasso
            const initialLoopEndSec = initialLoopDurationBeats * (60 / APP_STATE.bpm);
            APP_STATE.loop.endTimePx = timeToPositionPx(initialLoopEndSec);
        }
        initializeLoopDragging(); // Anexa listeners de arrasto APENAS quando os marcadores são criados
    }

    // Sempre atualiza a visibilidade e posição visual após criar/re-adicionar
    updateLoopMarkersVisuals(); 
}

/**
 * Atualiza a posição visual dos marcadores de loop com base em APP_STATE.loop.startTimePx e APP_STATE.loop.endTimePx.
 * Também controla a visibilidade com base em APP_STATE.loop.isEnabled.
 */
function updateLoopMarkersVisuals() {
    if (!APP_STATE.loop.startMarker || !APP_STATE.loop.endMarker) {
        // Marcadores ainda não foram criados, a função createLoopMarkers() cuidará disso.
        return; 
    }

    // Esconde os marcadores se o loop não estiver ativado
    if (!APP_STATE.loop.isEnabled) {
        APP_STATE.loop.startMarker.style.display = 'none';
        APP_STATE.loop.endMarker.style.display = 'none';
        // Opcional: ocultar a área de loop se implementada
        // if (DOM.loopRegion) DOM.loopRegion.style.display = 'none';
        return;
    }

    // Se o loop estiver ativado, mostra os marcadores
    APP_STATE.loop.startMarker.style.display = 'block';
    APP_STATE.loop.endMarker.style.display = 'block';
    // if (DOM.loopRegion) DOM.loopRegion.style.display = 'block';

    // Garante que o startMarker nunca passe do endMarker
    if (APP_STATE.loop.startTimePx > APP_STATE.loop.endTimePx) {
        const temp = APP_STATE.loop.startTimePx;
        APP_STATE.loop.startTimePx = APP_STATE.loop.endTimePx;
        APP_STATE.loop.endTimePx = temp;
    }

    // Garante que os marcadores não saiam da timeline
    APP_STATE.loop.startTimePx = Math.max(0, Math.min(APP_STATE.loop.startTimePx, APP_STATE.timelineWidth));
    APP_STATE.loop.endTimePx = Math.max(0, Math.min(APP_STATE.loop.endTimePx, APP_STATE.timelineWidth));
    
    // Assegura que o início e o fim não sejam o mesmo ponto (mínimo de 1 pixel de diferença)
    if (APP_STATE.loop.endTimePx - APP_STATE.loop.startTimePx < 1) {
        APP_STATE.loop.endTimePx = APP_STATE.loop.startTimePx + 1;
    }

    APP_STATE.loop.startMarker.style.left = `${APP_STATE.loop.startTimePx}px`;
    APP_STATE.loop.endMarker.style.left = `${APP_STATE.loop.endTimePx}px`;

    // Opcional: Atualizar alguma barra visual que represente a área do loop
    // if (DOM.loopRegion) {
    //     DOM.loopRegion.style.left = `${APP_STATE.loop.startTimePx}px`;
    //     DOM.loopRegion.style.width = `${APP_STATE.loop.endTimePx - APP_STATE.loop.startTimePx}px`;
    // }
}

/**
 * =========================================================================
 * ===== CORREÇÃO PRINCIPAL #2: Arrastar em dispositivos móveis (touch) =====
 * =========================================================================
 * Inicializa o arrastar dos marcadores de loop, agora com suporte a eventos de toque.
 */
function initializeLoopDragging() {
    let isDraggingStart = false;
    let isDraggingEnd = false;
    let dragStartX = 0;
    let initialMarkerPosition = 0;

    // Função auxiliar para obter a coordenada X tanto de eventos de mouse quanto de toque.
    const getClientX = (e) => e.touches ? e.touches[0].clientX : e.clientX;

    const handleDragMove = (e) => {
        if (!isDraggingStart && !isDraggingEnd) return;
        // Previne que a página role enquanto o usuário arrasta o marcador no celular.
        if (e.cancelable) e.preventDefault();

        const currentX = getClientX(e);
        const deltaX = currentX - dragStartX;
        
        if (isDraggingStart) {
            let newPos = initialMarkerPosition + deltaX;
            APP_STATE.loop.startTimePx = getSnapPosition(newPos);
            updateLoopMarkersVisuals();
        } else if (isDraggingEnd) {
            let newPos = initialMarkerPosition + deltaX;
            APP_STATE.loop.endTimePx = getSnapPosition(newPos);
            updateLoopMarkersVisuals();
        }
    };

    const handleDragEnd = () => {
        isDraggingStart = false;
        isDraggingEnd = false;
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
        DOM.timelineScrollContainer.style.cursor = 'grab';
    };
    
    const addDragListeners = (marker, isStartMarker) => {
        const handleDragStart = (e) => {
            if (isStartMarker) isDraggingStart = true;
            else isDraggingEnd = true;
            
            dragStartX = getClientX(e);
            initialMarkerPosition = isStartMarker ? APP_STATE.loop.startTimePx : APP_STATE.loop.endTimePx;

            // Adiciona os listeners para ambos os tipos de evento
            window.addEventListener('mousemove', handleDragMove);
            window.addEventListener('mouseup', handleDragEnd);
            window.addEventListener('touchmove', handleDragMove, { passive: false });
            window.addEventListener('touchend', handleDragEnd);

            DOM.timelineScrollContainer.style.cursor = 'ew-resize';
            if (e.cancelable) e.preventDefault();
        };

        // Adiciona o listener de início tanto para mousedown quanto para touchstart
        marker.addEventListener('mousedown', handleDragStart);
        marker.addEventListener('touchstart', handleDragStart, { passive: false });
    };

    addDragListeners(APP_STATE.loop.startMarker, true);
    addDragListeners(APP_STATE.loop.endMarker, false);
}


/**
 * Inicializa os eventos da régua (clique para mudar a posição da agulha).
 */
function initializeRulerClickEvents() {
     DOM.rulerContainer.addEventListener('mousedown', (e) => {
        if(e.target === DOM.playheadDragger || e.target.classList.contains('loop-marker')) return;

        if (!APP_STATE.isDraggingPlayhead) {
            const rulerRect = DOM.rulerContainer.getBoundingClientRect();
            const newX = e.clientX - rulerRect.left + DOM.rulerContainer.scrollLeft;
            movePlayhead(newX);
        }
    });
}

/**
 * Inicializa a agulha de reprodução e seus eventos, incluindo os do loop.
 */
function initializePlayheadEvents() { 
    movePlayhead(0);
    initializePlayheadDragging();
    initializeRulerClickEvents();

    createLoopMarkers(); // Cria os marcadores de loop no DOM e define posições iniciais
    // initializeLoopDragging(); // Já é chamado dentro de createLoopMarkers se os marcadores são criados

    updateLoopMarkersVisuals(); // Garante que a visibilidade e posição inicial estejam corretas
}

/**
 * Função principal para atualizar a agulha de reprodução (chamada no loop principal).
 * (Esta função pode ser removida se não for mais usada diretamente)
 */
function updatePlayhead() {
    // movePlayhead é chamado pelo playbackLoop, então esta função pode ser simples
    // ou pode ser removida se não for mais usada.
}