function drawPhaserVisualizer(canvas, params) {
    if (!canvas || !params) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const center = { x: width / 2, y: height / 2 };

    ctx.clearRect(0, 0, width, height);
    
    const time = Date.now() / 500;
    const rate = params.rate || 1;
    const depth = params.depth || 0.5;
    const feedback = params.feedback || 0.3;

    const orbitCount = 4;
    for (let i = 0; i < orbitCount; i++) {
        const radius = (center.x * 0.8) * ((i + 1) / orbitCount);
        const angle = time * rate * (1 + i * 0.2);
        const planetRadius = 3 + (feedback * 4);

        // Desenha a órbita
        ctx.beginPath();
        ctx.strokeStyle = `rgba(196, 181, 253, ${0.1 + i * 0.05})`; // purple-300 com opacidade
        ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Desenha o "planeta"
        const planetX = center.x + Math.cos(angle) * radius;
        const planetY = center.y + Math.sin(angle) * radius;
        
        ctx.beginPath();
        ctx.fillStyle = `rgba(221, 214, 254, ${0.6 + depth * 0.4})`; // purple-200 com opacidade
        ctx.arc(planetX, planetY, planetRadius, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// ==========================================================
// ===== CORREÇÃO AQUI: Nome da função corrigido ============
// ==========================================================
function initPlanetaryPhaserUI(effectInstance, DOM_elements, createSliderFn) {
    const controlsContainer = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#phaser-controls-container');
    const canvas = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#phaser-canvas');
    if (!controlsContainer || !canvas) return { update: () => {} };

    controlsContainer.innerHTML = '';
    const effectDef = APP_STATE.allEffects.find(def => def.id === 'planetary_phaser');

    effectDef.parameters.forEach(paramDef => {
        createSliderFn(paramDef, effectInstance, controlsContainer);
    });

    let animationFrameId;
    const animate = () => {
        drawPhaserVisualizer(canvas, effectInstance.parameters);
        animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    // Função para limpar a animação quando o modal for fechado
    return {
        destroy: () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        }
    };
}