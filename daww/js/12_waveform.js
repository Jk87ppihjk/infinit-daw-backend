/**
 * Desenha a forma de onda de um segmento de um AudioBuffer.
 * @param {HTMLCanvasElement} canvas O elemento canvas onde a onda será desenhada.
 * @param {AudioBuffer} audioBuffer O buffer de áudio com os dados da onda.
 * @param {number} [startSec=0] O ponto de início (em segundos) dentro do audioBuffer para começar a desenhar.
 * @param {string} [color='#93c5fd'] A cor da forma de onda (Tailwind's blue-300 por padrão).
 */
function drawWaveform(canvas, audioBuffer, startSec = 0, color = '#93c5fd') {
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Garante que a resolução do canvas corresponda ao seu tamanho de exibição
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const width = canvas.width;
    const height = canvas.height;
    const middleY = height / 2;
    
    // Pega os dados do primeiro canal de áudio
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Calcula o índice da amostra inicial e a duração visual do clipe em amostras
    const startIndex = Math.floor(startSec * sampleRate);
    
    // CORRIGIDO: Acessa o BPM a partir do estado global da aplicação para o cálculo de secondsPerPixel
    // Para desenhar a waveform, a largura visual do clipe (canvas.width) em pixels
    // precisa ser mapeada para um número de segundos.
    // Se pixelsPerBeat na régua está mudando, a relação tempo-pixel do clipe também deve.
    // Usaremos a mesma lógica do dynamicPixelsPerBeat para manter a consistência.
    
    const defaultBPM = 120; // BPM padrão usado para basePixelsPerBeatAtDefaultBPM
    const basePixelsPerBeatAtDefaultBPM = 60; // Base de pixels por batida
    const dynamicPixelsPerBeat = basePixelsPerBeatAtDefaultBPM * (defaultBPM / APP_STATE.bpm);

    // O `secondsPerPixel` é a duração em segundos que cada pixel do canvas representa.
    // Isso é inversamente proporcional a `dynamicPixelsPerBeat`
    // (dynamicPixelsPerBeat pixels = 1 beat; 1 beat = 60/BPM segundos)
    const secondsPerPixel = (60 / APP_STATE.bpm) / dynamicPixelsPerBeat;


    const visualDurationSec = width * secondsPerPixel;
    const totalSamplesInView = Math.floor(visualDurationSec * sampleRate);
    const samplesPerPixel = Math.floor(totalSamplesInView / width);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color;

    // Itera por cada pixel horizontal do canvas
    for (let x = 0; x < width; x++) {
        const blockStartSample = startIndex + (x * samplesPerPixel);
        let min = 1.0;
        let max = -1.0;

        // Encontra o valor de amplitude mínimo e máximo para o grupo de amostras
        for (let i = 0; i < samplesPerPixel; i++) {
            const sample = channelData[blockStartSample + i];
            if (sample) {
                if (sample < min) min = sample;
                if (sample > max) max = sample;
            }
        }

        // Converte os valores de amplitude (-1.0 a 1.0) para coordenadas Y no canvas
        const yMax = middleY * (1 - max); // Invertido, pois o canvas Y cresce para baixo
        const yMin = middleY * (1 - min);
        
        // Desenha uma linha vertical para representar a amplitude naquele ponto
        // Garante que a linha tenha pelo menos 1px de altura para ser visível
        const lineHeight = Math.max(1, yMin - yMax);
        ctx.fillRect(x, yMax, 1, lineHeight);
    }
}