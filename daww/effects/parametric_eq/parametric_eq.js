// Variáveis de estado do módulo para gerenciar a UI do EQ
let currentEffectInstance;
let selectedBandIndex = -1;
let isDraggingDot = false;
let canvas, canvasRect;

// Elementos DOM para os controles universais
let universalSlidersContainer, noBandSelectedMsg, gainSlider, qSlider, typeSelect;
let gainValueDisplay, qValueDisplay, deleteBandBtn, addBandBtn;

const converter = {
    freqToX: (freq, width) => (Math.log10(freq) - Math.log10(20)) / (Math.log10(22000) - Math.log10(20)) * width,
    dbToY: (db, height) => (1 - (db + 40) / 80) * height,
    xToFreq: (x, width) => Math.pow(10, (x / width) * (Math.log10(22000) - Math.log10(20)) + Math.log10(20)),
    yToDb: (y, height) => (1 - y / height) * 80 - 40,
};

function drawParametricEqGraph() {
    if (!canvas || !currentEffectInstance) return;
    const audioContext = APP_STATE.audioContext;
    if (!audioContext) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 0.5;
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#a0aec0';
    const zeroDbY = converter.dbToY(0, height);
    ctx.beginPath();
    ctx.moveTo(0, zeroDbY);
    ctx.lineTo(width, zeroDbY);
    ctx.stroke();
    ctx.fillText('0dB', 4, zeroDbY - 4);
    [100, 1000, 10000].forEach(freq => {
        const x = converter.freqToX(freq, width);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.fillText(freq >= 1000 ? `${freq/1000}k` : `${freq}`, x + 4, height - 4);
    });

    if (currentEffectInstance.parameters.length > 0) {
        const frequencies = new Float32Array(width).map((_, i) => converter.xToFreq(i, width));
        const totalResponse = new Float32Array(width).fill(1);
        const phaseResponse = new Float32Array(width);

        currentEffectInstance.parameters.forEach(params => {
            const filter = audioContext.createBiquadFilter();
            filter.type = params.type;
            filter.frequency.value = params.freq;
            filter.gain.value = params.gain;
            filter.Q.value = params.q;
            const magResponse = new Float32Array(width);
            filter.getFrequencyResponse(frequencies, magResponse, phaseResponse);
            for (let i = 0; i < width; i++) {
                totalResponse[i] *= magResponse[i];
            }
        });

        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < width; i++) {
            const db = 20 * Math.log10(totalResponse[i]);
            const y = converter.dbToY(db, height);
            if (i === 0) ctx.moveTo(i, y);
            else ctx.lineTo(i, y);
        }
        ctx.stroke();
    }

    currentEffectInstance.parameters.forEach((params, i) => {
        const x = converter.freqToX(params.freq, width);
        const y = converter.dbToY(params.gain, height);
        const isSelected = (i === selectedBandIndex);

        ctx.beginPath();
        ctx.arc(x, y, isSelected ? 8 : 6, 0, 2 * Math.PI);
        ctx.fillStyle = isSelected ? '#fce7f3' : '#db2777';
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#db2777' : '#fce7f3';
        ctx.lineWidth = isSelected ? 2.5 : 2;
        ctx.stroke();
    });
}

function getClosestDot(mouseX, mouseY) {
    let closestIndex = -1;
    let minDistance = Infinity;
    if (!currentEffectInstance || !Array.isArray(currentEffectInstance.parameters)) return -1;
    
    currentEffectInstance.parameters.forEach((params, i) => {
        const dotX = converter.freqToX(params.freq, canvas.width);
        const dotY = converter.dbToY(params.gain, canvas.height);
        const dist = Math.sqrt(Math.pow(mouseX - dotX, 2) + Math.pow(mouseY - dotY, 2));
        if (dist < 15 && dist < minDistance) { // Aumenta a área de toque para 15px
            minDistance = dist;
            closestIndex = i;
        }
    });
    return closestIndex;
}

function triggerAudioEngineUpdate() {
    if (!currentEffectInstance) return;
    const { trackId, instanceId } = currentEffectInstance;
    const trackNodes = APP_STATE.activeEffectNodes.get(trackId);
    if (trackNodes) {
        const effectNodeObject = trackNodes.get(instanceId);
        if (effectNodeObject && typeof effectNodeObject.update === 'function') {
            effectNodeObject.update(currentEffectInstance.parameters);
        }
    }
}

function updateControlsUI() {
    if (selectedBandIndex === -1 || !currentEffectInstance.parameters[selectedBandIndex]) {
        noBandSelectedMsg.classList.remove('hidden');
        universalSlidersContainer.classList.add('hidden');
        deleteBandBtn.disabled = true;
    } else {
        noBandSelectedMsg.classList.add('hidden');
        universalSlidersContainer.classList.remove('hidden');
        deleteBandBtn.disabled = false;

        const params = currentEffectInstance.parameters[selectedBandIndex];
        typeSelect.value = params.type;
        gainSlider.value = params.gain;
        qSlider.value = params.q;
        gainValueDisplay.textContent = `${parseFloat(params.gain).toFixed(1)} dB`;
        qValueDisplay.textContent = parseFloat(params.q).toFixed(2);

        const isShelf = params.type === 'lowshelf' || params.type === 'highshelf';
        const isNotch = params.type === 'notch';
        qSlider.disabled = isShelf;
        gainSlider.disabled = isNotch;
        qSlider.style.opacity = isShelf ? '0.5' : '1';
        gainSlider.style.opacity = isNotch ? '0.5' : '1';
    }
    drawParametricEqGraph();
}

function addBand(freq, gain) {
    if (currentEffectInstance.parameters.length >= 8) {
        alert("Máximo de 8 bandas atingido.");
        return;
    }
    const newBand = { type: 'peaking', freq, gain, q: 1.41 };
    currentEffectInstance.parameters.push(newBand);
    selectedBandIndex = currentEffectInstance.parameters.length - 1;
    triggerAudioEngineUpdate();
    updateControlsUI();
}

function deleteBand() {
    if (selectedBandIndex === -1) return;
    currentEffectInstance.parameters.splice(selectedBandIndex, 1);
    selectedBandIndex = -1;
    triggerAudioEngineUpdate();
    updateControlsUI();
}

/**
 * ===================================================================
 * === CORREÇÃO APLICADA AQUI ========================================
 * ===================================================================
 * Inicializa a UI e os eventos de interação para o EQ Paramétrico,
 * agora com suporte a mouse e toque.
 */
function initParametricEqUI(effectInstance, DOM_elements) {
    currentEffectInstance = effectInstance;
    selectedBandIndex = -1;
    isDraggingDot = false;
    
    const container = DOM_elements.parameterEditorSpecificUIContainer;
    canvas = container.querySelector('#parametric-eq-graph-canvas');
    universalSlidersContainer = container.querySelector('#universal-sliders-container');
    noBandSelectedMsg = container.querySelector('#eq-no-band-selected');
    typeSelect = container.querySelector('#universal-type');
    gainSlider = container.querySelector('#universal-gain');
    qSlider = container.querySelector('#universal-q');
    gainValueDisplay = container.querySelector('#universal-gain-value');
    qValueDisplay = container.querySelector('#universal-q-value');
    deleteBandBtn = container.querySelector('#eq-delete-band-btn');
    addBandBtn = container.querySelector('#eq-add-band-btn');
    
    addBandBtn.onclick = () => addBand(1000, 0);
    deleteBandBtn.onclick = deleteBand;

    const setupControlListeners = () => {
        gainSlider.addEventListener('input', () => {
            if (selectedBandIndex > -1) {
                currentEffectInstance.parameters[selectedBandIndex].gain = parseFloat(gainSlider.value);
                triggerAudioEngineUpdate();
                updateControlsUI();
            }
        });
        qSlider.addEventListener('input', () => {
            if (selectedBandIndex > -1) {
                currentEffectInstance.parameters[selectedBandIndex].q = parseFloat(qSlider.value);
                triggerAudioEngineUpdate();
                updateControlsUI();
            }
        });
        typeSelect.addEventListener('change', () => {
            if (selectedBandIndex > -1) {
                currentEffectInstance.parameters[selectedBandIndex].type = typeSelect.value;
                triggerAudioEngineUpdate();
                updateControlsUI();
            }
        });
    };
    setupControlListeners();

    // --- LÓGICA DE INTERAÇÃO UNIFICADA ---

    const getEventCoords = (e) => {
        const rect = canvas.getBoundingClientRect();
        if (e.touches && e.touches.length > 0) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const handleInteractionMove = (e) => {
        if (!isDraggingDot) return;
        if (e.cancelable) e.preventDefault();

        const coords = getEventCoords(e);
        const mouseX = Math.max(0, Math.min(coords.x, canvas.width));
        const mouseY = Math.max(0, Math.min(coords.y, canvas.height));
        
        const params = currentEffectInstance.parameters[selectedBandIndex];
        params.freq = converter.xToFreq(mouseX, canvas.width);
        if (!gainSlider.disabled) {
            params.gain = converter.yToDb(mouseY, canvas.height);
        }
        
        triggerAudioEngineUpdate();
        updateControlsUI(); // Atualiza a UI para refletir a mudança no arrasto
    };

    const handleInteractionEnd = () => {
        if (isDraggingDot) {
            isDraggingDot = false;
        }
        window.removeEventListener('mousemove', handleInteractionMove);
        window.removeEventListener('mouseup', handleInteractionEnd);
        window.removeEventListener('touchmove', handleInteractionMove);
        window.removeEventListener('touchend', handleInteractionEnd);
    };

    const handleInteractionStart = (e) => {
        e.preventDefault();
        const coords = getEventCoords(e);
        const clickedIndex = getClosestDot(coords.x, coords.y);
        
        selectedBandIndex = clickedIndex;
        updateControlsUI();
        
        if (clickedIndex !== -1) {
            isDraggingDot = true;
            window.addEventListener('mousemove', handleInteractionMove);
            window.addEventListener('mouseup', handleInteractionEnd);
            window.addEventListener('touchmove', handleInteractionMove, { passive: false });
            window.addEventListener('touchend', handleInteractionEnd);
        }
    };

    canvas.addEventListener('mousedown', handleInteractionStart);
    canvas.addEventListener('touchstart', handleInteractionStart, { passive: false });

    canvas.addEventListener('dblclick', (e) => {
        const coords = getEventCoords(e);
        addBand(converter.xToFreq(coords.x, canvas.width), converter.yToDb(coords.y, canvas.height));
    });
    
    updateControlsUI();

    return { update: (p) => { currentEffectInstance.parameters = p; updateControlsUI(); } };
}