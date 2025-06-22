function drawChorusVisualizer(canvas, params) {
    if (!canvas || !params) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#67e8f9'; // cyan-300
    ctx.lineWidth = 2;
    ctx.beginPath();

    const time = Date.now() / 1000;
    const frequency = params.rate;
    const amplitude = params.depth * midY * 0.8;

    for (let x = 0; x < width; x++) {
        const angle = (x / width) * 2 * Math.PI * 2 + time * frequency;
        const y = midY + Math.sin(angle) * amplitude;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}


function initChorusUI(effectInstance, DOM_elements, createSliderFn) {
    const controlsContainer = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#chorus-controls-container');
    const canvas = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#chorus-canvas');
    if (!controlsContainer || !canvas) return { update: () => {} };

    controlsContainer.innerHTML = '';
    const effectDef = APP_STATE.allEffects.find(def => def.id === 'chorus');

    effectDef.parameters.forEach(paramDef => {
        createSliderFn(paramDef, effectInstance, controlsContainer);
    });

    let animationFrameId;
    const animate = () => {
        drawChorusVisualizer(canvas, effectInstance.parameters);
        animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return {
        update: (updatedParams) => {
            // A animação já lê os parâmetros em tempo real.
        }
    };
}