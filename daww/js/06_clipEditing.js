// app/js/06_clipEditing.js

function selectClip(clipToSelect) {
    // Primeiro, remove a classe 'resizing' de qualquer clipe para evitar que ela fique presa
    document.querySelectorAll('.clip.resizing').forEach(c => c.classList.remove('resizing'));
    
    document.querySelectorAll('.clip.selected').forEach(c => c.classList.remove('selected'));
    if (clipToSelect) {
        clipToSelect.classList.add('selected');
    }
}

function initializeClipEditingEvents() {
    let isResizing = false;
    let handle, clip, canvas, startX, initialWidth, initialLeft, initialCanvasLeft;

    const getClientX = (e) => {
        return e.touches ? e.touches[0].clientX : e.clientX;
    };

    const onResizeStart = (e) => {
        e.preventDefault(); 
        e.stopPropagation();

        handle = e.target;
        clip = handle.parentElement;
        canvas = clip.querySelector('.waveform-canvas');
        
        isResizing = true;
        APP_STATE.isResizing = true; 

        clip.classList.add('resizing');
        
        startX = getClientX(e);
        initialWidth = clip.offsetWidth;
        initialLeft = clip.offsetLeft;
        initialCanvasLeft = parseFloat(canvas.style.left) || 0;

        window.addEventListener('mousemove', onResizeMove);
        window.addEventListener('mouseup', onResizeEnd);
        window.addEventListener('touchmove', onResizeMove, { passive: false });
        window.addEventListener('touchend', onResizeEnd);
    };

    const onResizeMove = (e) => {
        if (!isResizing) return;
        e.preventDefault();

        const currentX = getClientX(e);
        const dx = currentX - startX;

        if (handle.classList.contains('right')) {
            // --- LÓGICA SIMPLIFICADA PARA A ALÇA DIREITA ---
            // Apenas ajusta a largura da "janela" do clipe.
            const newWidth = initialWidth + dx;
            clip.style.width = `${Math.max(20, newWidth)}px`; 
        } else { // Alça da esquerda
            // --- LÓGICA ATUALIZADA PARA A ALÇA ESQUERDA ---
            const newLeft = initialLeft + dx;
            const newWidth = initialWidth - dx;

            if (newWidth > 20) {
                // Move a "janela" do clipe
                clip.style.left = `${newLeft}px`;
                clip.style.width = `${newWidth}px`;
                // E move o canvas interno na direção oposta para manter a forma de onda no lugar
                canvas.style.left = `${initialCanvasLeft - dx}px`;
            }
        }
    };

    const onResizeEnd = () => {
        if (!isResizing) return;
        
        if (clip) {
            clip.classList.remove('resizing');

            // --- ALTERAÇÃO AQUI: Atualiza o ponto de início do áudio (originalStartSec) ---
            // "Commita" a nova posição inicial do áudio no atributo do clipe
            const finalCanvasLeft = parseFloat(canvas.style.left) || 0;
            const newOriginalStartSec = positionPxToTimeSec(-finalCanvasLeft);
            clip.dataset.originalStartSec = newOriginalStartSec;
        }

        isResizing = false;
        APP_STATE.isResizing = false;

        window.removeEventListener('mousemove', onResizeMove);
        window.removeEventListener('mouseup', onResizeEnd);
        window.removeEventListener('touchmove', onResizeMove);
        window.removeEventListener('touchend', onResizeEnd);

        // NÂO PRECISAMOS MAIS REDESENHAR A FORMA DE ONDA AQUI!
        
        handle = null;
        clip = null;
        canvas = null;
    };

    const handleInteractionStart = (e) => {
        const target = e.target;
        if (target.classList.contains('resize-handle')) {
            onResizeStart(e);
        } else {
            const clickedClip = target.closest('.clip');
            selectClip(clickedClip);
        }
    };

    DOM.timelineContent.addEventListener('mousedown', handleInteractionStart);
    DOM.timelineContent.addEventListener('touchstart', handleInteractionStart, { passive: false });
}