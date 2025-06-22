/**
 * Desenha uma visualização da forma de onda do LFO em um canvas.
 * @param {HTMLCanvasElement} canvas - O elemento canvas para desenhar.
 * @param {HTMLElement} statusElement - O elemento de texto para exibir o status.
 * @param {object} params - Os parâmetros atuais do efeito (lfo_rate, lfo_depth).
 */
function drawLfoVisualizer(canvas, statusElement, params) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Se o LFO não tem profundidade, ele está inativo.
    if (!params || params.lfo_depth === 0) {
        statusElement.textContent = 'LFO Inativo. Aumente a Profundidade.';
        ctx.strokeStyle = '#4a5568'; // cinza
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(width, midY);
        ctx.stroke();
        return;
    }

    statusElement.textContent = `Taxa: ${params.lfo_rate.toFixed(1)} Hz`;
    
    ctx.strokeStyle = '#a78bfa'; // roxo
    ctx.lineWidth = 2;
    ctx.beginPath();

    const time = Date.now() / 1000;
    const frequency = params.lfo_rate; // A velocidade do LFO controla a frequência da onda visual

    for (let x = 0; x < width; x++) {
        // Calcula o ângulo baseado na posição x e no tempo, ajustado pela frequência
        const angle = (x / width) * 2 * Math.PI * 2 + time * frequency; // Multiplica por 2 para mais ciclos visíveis
        // Calcula a posição Y usando uma função seno
        const y = midY + Math.sin(angle) * (midY * 0.8);
        
        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
}


/**
 * Inicializa a UI do infinitFilter.
 * @param {object} effectInstance - A instância COMPLETA do efeito.
 * @param {object} DOM_elements - O objeto DOM global para acesso a elementos.
 * @param {function} createSliderFn - A função para criar sliders, passada do parameterEditor.
 */
function initInfinitFilterUI(effectInstance, DOM_elements, createSliderFn) {
    const controlsContainer = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#infinitfilter-controls-container');
    const canvas = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#infinitfilter-lfo-canvas');
    const lfoStatus = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#infinitfilter-lfo-status');

    if (!controlsContainer || !canvas) {
        console.error("Elementos da UI do infinitFilter não encontrados.");
        return { update: () => {} };
    }

    controlsContainer.innerHTML = '';

    const effectDef = APP_STATE.allEffects.find(def => def.id === 'infinitFilter');
    if (!effectDef) return { update: () => {} };

    // Cria os controles (seletor e sliders)
    effectDef.parameters.forEach(paramDef => {
        if (paramDef.type === 'select') {
            // Cria o seletor de tipo de filtro manualmente
            const controlWrapper = document.createElement('div');
            controlWrapper.className = 'parameter-control';
            controlWrapper.innerHTML = `
                <label for="param-${paramDef.id}" class="flex justify-between text-sm font-medium text-gray-300 mb-1">
                    <span>${paramDef.name}</span>
                </label>
                <select id="param-${paramDef.id}" class="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                    ${paramDef.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                </select>
            `;
            controlsContainer.appendChild(controlWrapper);

            const selectElement = controlWrapper.querySelector(`#param-${paramDef.id}`);
            selectElement.value = effectInstance.parameters[paramDef.id];
            selectElement.addEventListener('change', (e) => {
                effectInstance.parameters[paramDef.id] = e.target.value;
                if (APP_STATE.isPlaying) {
                     const trackNodes = APP_STATE.activeEffectNodes.get(effectInstance.trackId);
                     if(trackNodes) trackNodes.get(effectInstance.instanceId)?.update(effectInstance.parameters);
                }
            });

        } else {
            // Usa a função global para criar os sliders
            createSliderFn(paramDef, effectInstance, controlsContainer);
        }
    });
    
    // Inicia o loop de animação do visualizador
    let animationFrameId;
    const animate = () => {
        drawLfoVisualizer(canvas, lfoStatus, effectInstance.parameters);
        animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    // Retorna uma função de limpeza para parar a animação quando o editor fechar
    // (Esta parte é uma melhoria para o futuro, para otimizar o desempenho)
    // Por enquanto, a animação continua, o que é aceitável.
    
    return {
        update: (updatedParams) => {
            // A função 'update' é chamada quando um slider muda,
            // mas a animação já lê os parâmetros em tempo real, então não precisamos fazer nada extra aqui.
        }
    };
}