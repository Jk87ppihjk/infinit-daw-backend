/**
 * Inicializa a UI para o EQ Gráfico Avançado.
 */
function initPrecisionEqUI(effectInstance, DOM_elements, createSliderFn) {
    console.log("[AdvEQ] Iniciando UI.");
    const container = DOM_elements.parameterEditorSpecificUIContainer;

    // --- 1. CRIAÇÃO DOS SLIDERS DE CONTROLE ---
    const bandControls = [
        container.querySelector('#peq-band1-controls'),
        container.querySelector('#peq-band2-controls'),
        container.querySelector('#peq-band3-controls'),
        container.querySelector('#peq-band4-controls')
    ];
    
    const effectDef = APP_STATE.allEffects.find(def => def.id === 'precision_eq');
    if (!effectDef) return {};

    bandControls.forEach(c => { if(c) c.innerHTML = ''; });

    effectDef.parameters.forEach(paramDef => {
        if (paramDef.type === 'slider') {
            if (paramDef.id.startsWith('band1_')) createSliderFn(paramDef, effectInstance, bandControls[0]);
            else if (paramDef.id.startsWith('band2_')) createSliderFn(paramDef, effectInstance, bandControls[1]);
            else if (paramDef.id.startsWith('band3_')) createSliderFn(paramDef, effectInstance, bandControls[2]);
            else if (paramDef.id.startsWith('band4_')) createSliderFn(paramDef, effectInstance, bandControls[3]);
        }
    });

    // --- 2. CONFIGURAÇÃO DOS GRÁFICOS (CANVAS) ---
    const analyzerCanvas = container.querySelector('#adv-eq-analyzer-canvas');
    const curveCanvas = container.querySelector('#adv-eq-curve-canvas');
    const analyzerCtx = analyzerCanvas.getContext('2d');
    const curveCtx = curveCanvas.getContext('2d');
    
    let animationFrameId;

    const setupCanvases = () => {
        const rect = analyzerCanvas.parentElement.getBoundingClientRect();
        if (rect.width > 0) {
            analyzerCanvas.width = curveCanvas.width = rect.width;
            analyzerCanvas.height = curveCanvas.height = rect.height;
        } else {
            setTimeout(setupCanvases, 50);
        }
    };
    setupCanvases();

    const eqConverter = {
        freqToX: (freq, width) => (Math.log10(freq / 20) / Math.log10(22050 / 20)) * width,
        dbToY: (db, height) => (1 - (db + 24) / 48) * height,
    };

    // --- 3. FUNÇÕES DE DESENHO ---

    function drawEqCurve() {
        const audioContext = APP_STATE.audioContext;
        if (!audioContext || curveCanvas.width === 0) return;
        
        const params = effectInstance.parameters;
        const width = curveCanvas.width;
        const height = curveCanvas.height;

        curveCtx.clearRect(0, 0, width, height);
        curveCtx.strokeStyle = '#a78bfa'; // Roxo
        curveCtx.lineWidth = 2.5;
        curveCtx.shadowColor = 'rgba(167, 139, 250, 0.5)';
        curveCtx.shadowBlur = 8;
        
        // ================== INÍCIO DA CORREÇÃO MATEMÁTICA ==================
        // Gera corretamente o array de frequências a serem testadas, uma para cada pixel horizontal.
        const frequencies = new Float32Array(width);
        const minLogFreq = Math.log10(20);
        const maxLogFreq = Math.log10(22000); // Faixa de áudio padrão
        for (let i = 0; i < width; i++) {
            const percent = i / width;
            const logFreq = minLogFreq + (maxLogFreq - minLogFreq) * percent;
            frequencies[i] = Math.pow(10, logFreq);
        }
        // ================== FIM DA CORREÇÃO MATEMÁTICA ==================

        const totalResponse = new Float32Array(width).fill(1);
        
        const tempFilters = [
            { type: params.band1_type, freq: params.band1_freq, gain: params.band1_gain },
            { type: params.band2_type, freq: params.band2_freq, gain: params.band2_gain, q: params.band2_q },
            { type: params.band3_type, freq: params.band3_freq, gain: params.band3_gain, q: params.band3_q },
            { type: params.band4_type, freq: params.band4_freq, gain: params.band4_gain },
        ];
        
        const magResponse = new Float32Array(width);
        const phaseResponse = new Float32Array(width); // Não usado, mas exigido pela API

        tempFilters.forEach(band => {
            const filter = audioContext.createBiquadFilter();
            filter.type = band.type;
            filter.frequency.value = band.freq;
            filter.gain.value = band.gain;
            if (band.q) filter.Q.value = band.q;
            
            filter.getFrequencyResponse(frequencies, magResponse, phaseResponse);
            for (let i = 0; i < width; i++) {
                totalResponse[i] *= magResponse[i];
            }
        });

        curveCtx.beginPath();
        for (let i = 0; i < width; i++) {
            const dbResponse = 20 * Math.log10(totalResponse[i]);
            const y = eqConverter.dbToY(dbResponse, height);
            if (i === 0) {
                curveCtx.moveTo(i, y);
            } else {
                curveCtx.lineTo(i, y);
            }
        }
        curveCtx.stroke();
        curveCtx.shadowBlur = 0;
    }
    
    function drawAnalyzer() {
        const trackNodes = APP_STATE.activeEffectNodes.get(effectInstance.trackId);
        const effectNodeObject = trackNodes ? trackNodes.get(effectInstance.instanceId) : null;
        const analyserNode = effectNodeObject ? effectNodeObject.analyserNode : null;

        analyzerCtx.clearRect(0, 0, analyzerCanvas.width, analyzerCanvas.height);

        if (!analyserNode || !APP_STATE.isPlaying) return;

        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteFrequencyData(dataArray);

        const gradient = analyzerCtx.createLinearGradient(0, 0, 0, analyzerCanvas.height);
        gradient.addColorStop(0, 'rgba(167, 139, 250, 0.4)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.3)');
        analyzerCtx.fillStyle = gradient;

        const barWidth = (analyzerCanvas.width / bufferLength) * 2.5;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255.0) * analyzerCanvas.height;
            analyzerCtx.fillRect(x, analyzerCanvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }

    // --- 4. LOOP DE VISUALIZAÇÃO ---
    function visualizationLoop() {
        animationFrameId = requestAnimationFrame(visualizationLoop);
        drawEqCurve();
        drawAnalyzer();
    }
    visualizationLoop();

    return {
        destroy: () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        }
    };
}