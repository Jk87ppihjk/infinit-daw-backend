function drawBlackHoleVisualizer(canvas, params) {
    if (!canvas || !params) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const center = { x: width / 2, y: height / 2 };

    if (!canvas.particles) {
        canvas.particles = [];
        for(let i = 0; i < 50; i++) {
            canvas.particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 2 + 1,
                speed: Math.random() * 0.5 + 0.2
            });
        }
    }

    ctx.clearRect(0, 0, width, height);

    // Desenha o "buraco negro" no centro
    const gradient = ctx.createRadialGradient(center.x, center.y, 5, center.x, center.y, 30);
    gradient.addColorStop(0, '#111');
    gradient.addColorStop(1, 'black');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 30, 0, Math.PI * 2);
    ctx.fill();

    // Atualiza e desenha as partículas
    const pullStrength = (params.q / 20) * 2; // Q afeta a força da "gravidade"

    canvas.particles.forEach(p => {
        const dx = center.x - p.x;
        const dy = center.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 30) { // Reset particle if it reaches the center
            p.x = Math.random() * width;
            p.y = Math.random() > 0.5 ? height : 0;
        }

        // Move a partícula em direção ao centro
        p.x += (dx / dist) * p.speed * pullStrength;
        p.y += (dy / dist) * p.speed * pullStrength;
        
        ctx.beginPath();
        ctx.fillStyle = `rgba(200, 200, 200, ${1 - dist/width})`;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
}


function initBlackHoleVoiceUI(effectInstance, DOM_elements, createSliderFn) {
    const controlsContainer = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#bh-controls-container');
    const canvas = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#bh-visualizer');
    if (!controlsContainer || !canvas) return { update: () => {} };

    controlsContainer.innerHTML = '';
    const effectDef = APP_STATE.allEffects.find(def => def.id === 'black_hole_voice');

    effectDef.parameters.forEach(paramDef => {
        createSliderFn(paramDef, effectInstance, controlsContainer);
    });

    let animationFrameId;
    const animate = () => {
        drawBlackHoleVisualizer(canvas, effectInstance.parameters);
        animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return {
        destroy: () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        }
    };
}