function drawDelayVisualizer(canvas, params) {
    if (!canvas || !params) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);

    let currentFeedback = params.feedback;
    let currentTime = params.time;
    let currentX = 20;
    let currentY = height / 2;
    let currentHeight = height * 0.8;
    
    ctx.fillStyle = '#60a5fa'; // blue-400

    // Desenha o pulso original
    ctx.fillRect(currentX, currentY - currentHeight / 2, 5, currentHeight);

    // Desenha os ecos
    for (let i = 0; i < 6; i++) {
        currentX += (currentTime * 80); // Mapeia o tempo para a posição X
        currentHeight *= currentFeedback; // Diminui a altura com o feedback
        if (currentX > width || currentHeight < 2) break;
        
        ctx.globalAlpha = currentFeedback ** (i + 1);
        ctx.fillRect(currentX, currentY - currentHeight / 2, 5, currentHeight);
    }
    ctx.globalAlpha = 1.0;
}

function initDelayUI(effectInstance, DOM_elements, createSliderFn) {
    const controlsContainer = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#delay-controls-container');
    const canvas = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#delay-canvas');
    if (!controlsContainer || !canvas) return { update: () => {} };

    controlsContainer.innerHTML = '';
    const effectDef = APP_STATE.allEffects.find(def => def.id === 'delay');

    effectDef.parameters.forEach(paramDef => {
        createSliderFn(paramDef, effectInstance, controlsContainer);
    });

    drawDelayVisualizer(canvas, effectInstance.parameters);

    return {
        update: (updatedParams) => {
            drawDelayVisualizer(canvas, updatedParams);
        }
    };
}