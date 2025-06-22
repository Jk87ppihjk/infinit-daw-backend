/**
 * Desenha o gráfico da curva de compressão em um canvas.
 * @param {HTMLCanvasElement} canvas - O elemento canvas para desenhar.
 * @param {object} params - Um objeto com os parâmetros do compressor: threshold, knee, ratio.
 */
function drawCompressorGraph(canvas, params) {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const dbToY = (db) => height - ((db + 100) / 100) * height;
    const inputToX = (inputDb) => ((inputDb + 100) / 100) * width;
    
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 0.5;
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#a0aec0';

    for (let db = -80; db < 0; db += 20) {
        const x = inputToX(db);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.fillText(`${db}`, x + 4, height - 4);
    }
    for (let db = -80; db < 0; db += 20) {
        const y = dbToY(db);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.fillText(`${db}`, 4, y - 4);
    }
    
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, 0);
    ctx.stroke();

    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    
    for (let x = 0; x < width; x++) {
        const inputDb = (x / width) * 100 - 100;

        const { threshold, knee, ratio } = params;
        let outputDb = inputDb;
        const kneeStart = threshold - knee / 2;
        const kneeEnd = threshold + knee / 2;

        if (inputDb > kneeStart) {
            if (inputDb < kneeEnd) {
                const x = (inputDb - threshold + knee / 2) / knee;
                outputDb = inputDb + (1 / ratio - 1) * Math.pow(x, 2) * knee / 2;
            } else {
                outputDb = threshold + (inputDb - threshold) / ratio;
            }
        }
        
        const y = dbToY(outputDb);
        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
}

/**
 * Inicializa a UI do Compressor.
 * @param {object} effectInstance - A instância COMPLETA do efeito compressor.
 * @param {object} DOM_elements - O objeto DOM global para acesso a elementos.
 * @param {function} createSliderFn - A função para criar sliders, passada do parameterEditor.
 * @returns {object} Um objeto com uma função `update` para redesenhar a UI.
 */
function initCompressorUI(effectInstance, DOM_elements, createSliderFn) { // CORRIGIDO: Recebe effectInstance completo
    console.log('initCompressorUI: Função de inicialização do Compressor chamada.');
    console.log('initCompressorUI: effectInstance recebido:', effectInstance); // Log de depuração
    console.log('initCompressorUI: DOM_elements recebidos:', DOM_elements);
    console.log('initCompressorUI: createSliderFn recebida:', typeof createSliderFn);

    const canvas = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#compressor-graph-canvas');
    const slidersContainer = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#compressor-sliders-container');

    console.log('initCompressorUI: Canvas element:', canvas);
    console.log('initCompressorUI: Sliders Container element:', slidersContainer);

    if (!canvas || !slidersContainer) {
        console.error('initCompressorUI: Erro! Canvas ou container de sliders não encontrados no HTML injetado.');
        return { update: () => {} };
    }

    slidersContainer.innerHTML = ''; 

    const effectDef = APP_STATE.allEffects.find(def => def.id === 'compressor');
    console.log('initCompressorUI: Definição do efeito (effectDef) encontrada:', effectDef);

    if (effectDef && effectDef.parameters) {
        console.log('initCompressorUI: Parâmetros definidos em effectDef:', effectDef.parameters.length);
        effectDef.parameters.forEach(paramDef => {
            console.log('initCompressorUI: Criando slider para:', paramDef.name);
            // --- CORRIGIDO: Passa effectInstance COMPLETO para createSliderFn ---
            createSliderFn(paramDef, effectInstance, slidersContainer);
            // --- FIM DA CORREÇÃO ---
        });
    } else {
        console.warn('initCompressorUI: effectDef ou effectDef.parameters não encontrados para o compressor.');
    }

    drawCompressorGraph(canvas, effectInstance.parameters); // Desenha com os parâmetros da instância
    console.log('initCompressorUI: Gráfico do compressor desenhado.');

    return {
        update: (updatedParams) => {
            console.log('initCompressorUI: Função update do gráfico chamada com:', updatedParams);
            drawCompressorGraph(canvas, updatedParams);
        }
    };
}