function initializeDragAndDrop() {
    DOM.timelineContent.addEventListener('dragstart', (e) => {
        if (APP_STATE.isResizing || !e.target.classList.contains('clip')) {
            return e.preventDefault();
        }
        const draggedClip = e.target;
        APP_STATE.draggedClip = draggedClip;

        // --- CÁLCULO DE OFFSET REFINADO PARA CORRIGIR O BUG ---
        // Em vez de usar e.offsetX, que pode ser impreciso, calculamos
        // a distância manualmente para garantir precisão.
        const clipRect = draggedClip.getBoundingClientRect();
        APP_STATE.draggedClipOffsetX = e.clientX - clipRect.left;
        
        // Adiciona a classe 'dragging' para o efeito visual
        setTimeout(() => draggedClip.classList.add('dragging'), 0);
    });

    DOM.timelineContent.addEventListener('dragend', (e) => {
        if (APP_STATE.draggedClip) {
            APP_STATE.draggedClip.classList.remove('dragging');
        }
        APP_STATE.draggedClip = null;
        APP_STATE.draggedClipOffsetX = 0; // Limpa o offset ao soltar
    });

    DOM.timelineContent.addEventListener('dragover', (e) => {
        e.preventDefault();

        const container = DOM.timelineScrollContainer;
        const draggedClip = APP_STATE.draggedClip;
        
        if (!draggedClip) return;

        // Lógica de autoscroll (sem alterações)
        const containerRect = container.getBoundingClientRect();
        const scrollThreshold = 60; 
        const scrollSpeed = 10;

        if (e.clientX > containerRect.right - scrollThreshold) {
            container.scrollLeft += scrollSpeed;
        } else if (e.clientX < containerRect.left + scrollThreshold) {
            container.scrollLeft -= scrollSpeed;
        }
        
        const targetTrack = e.target.closest('.track-lane');
        if (targetTrack) {
            // O cálculo da posição agora usa o offset preciso
            const mouseXInContainer = e.clientX - containerRect.left + container.scrollLeft;
            const newLeft = getSnapPosition(mouseXInContainer - APP_STATE.draggedClipOffsetX);
            
            // Aplica a nova posição, respeitando os limites da timeline
            draggedClip.style.left = `${Math.max(0, Math.min(newLeft, APP_STATE.timelineWidth - draggedClip.offsetWidth))}px`; // CORRIGIDO: Usando APP_STATE.timelineWidth

            // Move o clipe para uma nova trilha se o mouse estiver sobre outra
            if (draggedClip.parentElement !== targetTrack) {
                targetTrack.appendChild(draggedClip);
            }
        }
    });
}