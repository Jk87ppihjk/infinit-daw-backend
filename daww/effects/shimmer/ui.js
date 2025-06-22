/**
 * Desenha um visualizador de partículas que reage aos parâmetros do Shimmer.
 */
function drawShimmerVisualizer(canvas, params) {
    if (!canvas || !params) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Inicializa as partículas se elas não existirem
    if (!canvas.particles) {
        canvas.particles = [];
    }
    let particles = canvas.particles;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';

    // Adiciona novas partículas com base no mix e shimmer
    if (Math.random() < params.mix * 0.5) {
        particles.push({
            x: Math.random() * width,
            y: height,
            size: 2 + Math.random() * 3,
            speedY: 0.5 + Math.random() * 1.5,
            opacity: 0.5 + Math.random() * 0.5
        });
    }

    // Atualiza e desenha as partículas
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.y -= p.speedY;
        p.opacity -= 0.005;

        // Remove partículas que saíram da tela ou desapareceram
        if (p.y < 0 || p.opacity <= 0) {
            particles.splice(i, 1);
        } else {
            ctx.globalAlpha = p.opacity;
            ctx.beginPath();
            // As partículas brilham mais com mais shimmer
            ctx.arc(p.x, p.y, p.size * (1 + params.shimmer_amount * 0.5), 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1.0;
}


/**
 * Inicializa a UI do Ethereal Shimmer.
 */
function initEtherealShimmerUI(effectInstance, DOM_elements, createSliderFn) {
    const controlsContainer = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#shimmer-controls-container');
    const canvas = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#shimmer-canvas');
    if (!controlsContainer || !canvas) return { update: () => {} };

    controlsContainer.innerHTML = '';
    const effectDef = APP_STATE.allEffects.find(def => def.id === 'ethereal_shimmer');
    if (!effectDef) return { update: () => {} };

    // Cria os controles (seletor e sliders)
    effectDef.parameters.forEach(paramDef => {
        if (paramDef.type === 'select') {
            const controlWrapper = document.createElement('div');
            controlWrapper.className = 'parameter-control';
            controlWrapper.innerHTML = `
                <label for="param-${paramDef.id}" class="flex justify-between text-sm font-medium text-gray-300 mb-1">
                    <span>${paramDef.name}</span>
                </label>
                <select id="param-${paramDef.id}" class="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                    ${paramDef.options.map(opt => `<option value="${opt}" ${effectInstance.parameters[paramDef.id] === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            `;
            controlsContainer.appendChild(controlWrapper);

            const selectElement = controlWrapper.querySelector(`#param-${paramDef.id}`);
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
        drawShimmerVisualizer(canvas, effectInstance.parameters);
        animationFrameId = requestAnimationFrame(animate);
    };
    animate();
    
    // Retorna a função de update para parar a animação quando o editor fechar (boa prática)
    return {
        // A animação já lê os parâmetros em tempo real, então a função 'update' não precisa fazer nada.
        update: (updatedParams) => {}, 
        // Adiciona uma função de 'destroy' para limpar o loop de animação.
        destroy: () => {
            if(animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        }
    };
}