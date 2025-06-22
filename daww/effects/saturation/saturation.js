function makeDistortionCurve(amount) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
        const x = i * 2 / n_samples - 1;
        curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
}

function drawSaturationCurve(canvas, params) {
    if (!canvas || !params) return;
    const curve = makeDistortionCurve(params.drive);
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#fcd34d'; // amber-300
    ctx.lineWidth = 2;

    ctx.beginPath();
    for (let i = 0; i < width; i++) {
        const x = i;
        const curveIndex = Math.floor((i / width) * curve.length);
        const y = (1 - (curve[curveIndex] + 1) / 2) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}

function initSaturationUI(effectInstance, DOM_elements, createSliderFn) {
    const controlsContainer = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#saturation-controls-container');
    const canvas = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#saturation-canvas');
    if (!controlsContainer || !canvas) return { update: () => {} };

    controlsContainer.innerHTML = '';
    const effectDef = APP_STATE.allEffects.find(def => def.id === 'saturation');

    effectDef.parameters.forEach(paramDef => {
        createSliderFn(paramDef, effectInstance, controlsContainer);
    });

    drawSaturationCurve(canvas, effectInstance.parameters);

    return {
        update: (updatedParams) => {
            drawSaturationCurve(canvas, updatedParams);
        }
    };
}