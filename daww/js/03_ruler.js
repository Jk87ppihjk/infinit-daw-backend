// Remova as constantes globais de 01_state.js para beatsPerBar, pixelsPerBeat, totalBeats, timelineWidth
// Elas serão definidas ou calculadas dinamicamente.

function createRuler() {
    DOM.ruler.innerHTML = '';
    
    // Recalcula pixelsPerBeat e timelineWidth com base no BPM atual
    const beatsPerBar = 4; // Constante de compasso (4/4)
    const pixelsPerBeat = 60; // Pixels por batida (pode ser ajustado)
    const totalBeats = 2000; // Quantidade total de batidas (pode ser ajustado)

    // A largura da timeline agora depende do pixelsPerBeat (que em si depende do BPM para a representação)
    // Para ajustar a régua de acordo com o BPM, a "densidade" dos pixels por batida precisa mudar.
    // Uma forma simples é manter pixelsPerBeat fixo e ajustar a largura total, ou
    // ajustar pixelsPerBeat com base em um valor de referência.
    
    // Vamos fazer pixelsPerBeat ser inversamente proporcional ao BPM para que
    // mais BPMs resultem em batidas mais "apertadas" na tela (mas a régua se estende)
    // Ou, manter a largura visual de uma batida e estender a régua para mais compassos.
    
    // Opção 1: Manter a "largura visual" da batida em um BPM padrão (ex: 120 BPM)
    // E dimensionar os clips com base na duração real.
    // Se o BPM for o dobro, a mesma duração de 1 segundo terá o dobro de batidas,
    // e o clipe será mais largo na régua se a "densidade" for mantida.
    
    // Vamos manter pixelsPerBeat como um valor fixo visual para uma batida na tela,
    // e o BPM influenciará a duração real dos clips e a reprodução, mas não a "aparência" da régua em si,
    // apenas o número de batidas dentro de um espaço fixo se a régua tivesse um limite.
    // Como a régua se estende, ela vai apenas ter mais ou menos divisões por segundo.

    // A maneira mais direta de "ajustar a régua ao BPM" é garantir que
    // a relação tempo-pixel seja sempre consistente.

    // No seu código atual, pixelsPerBeat já é uma constante.
    // O que precisa ajustar é como essa constante *representa* o tempo.
    // Atualmente: `(60 / APP_STATE.bpm) / pixelsPerBeat` segundos por pixel.

    // Se a ideia é que a régua "se estique" ou "encolha" visualmente para o mesmo número de compassos
    // dependendo do BPM, então `pixelsPerBeat` em si precisa ser calculado a partir do BPM.

    // Vamos definir uma largura de compasso padrão para 120 BPM, e ajustar a escala.
    const defaultBPM = 120;
    const basePixelsPerBeatAtDefaultBPM = 60; // 60px por batida a 120 BPM

    // Aumentar o BPM significa que as batidas são mais curtas, então pixelsPerBeat deve diminuir.
    // Diminuir o BPM significa que as batidas são mais longas, então pixelsPerBeat deve aumentar.
    // Formula: pixelsPorBatida = basePixelsPorBatida * (BPM_Padrão / BPM_Atual)
    const dynamicPixelsPerBeat = basePixelsPerBeatAtDefaultBPM * (defaultBPM / APP_STATE.bpm);

    // --- LINHA ADICIONADA ---
    // Armazena o valor dinâmico no estado global para que outras funções possam usá-lo.
    APP_STATE.dynamicPixelsPerBeat = dynamicPixelsPerBeat;
    // --- FIM DA ADIÇÃO ---


    // Atualiza a largura total da timeline com o novo dynamicPixelsPerBeat
    const newTimelineWidth = totalBeats * dynamicPixelsPerBeat;
    
    // Atualiza a variável global timelineWidth para refletir o novo cálculo
    // (Presumo que `timelineWidth` seja global e usada por outros módulos)
    // Se `timelineWidth` for uma const, precisará ser redefinida ou passada como argumento.
    // Para simplificar, vou assumir que `timelineWidth` pode ser atualizada.
    // Se não for, APP_STATE.timelineWidth precisaria ser usada.
    // Pelo 01_state.js, `timelineWidth` é uma const, então precisamos ajustá-la lá.
    // Vou usar APP_STATE.timelineWidth para a largura total da timeline.
    APP_STATE.timelineWidth = newTimelineWidth; // Atualiza no estado global.


    DOM.ruler.style.width = `${APP_STATE.timelineWidth}px`; // Usa o valor atualizado
    
    if (DOM.gridBackground) {
        DOM.gridBackground.style.width = `${APP_STATE.timelineWidth}px`; // Usa o valor atualizado
    }
    
    // --- LINHA ADICIONADA ---
    // Define a largura do contêiner principal das pistas para que ele se expanda corretamente.
    if (DOM.timelineContent) {
        DOM.timelineContent.style.width = `${APP_STATE.timelineWidth}px`;
    }
    // --- FIM DA ADIÇÃO ---


    for (let beat = 0; beat < totalBeats; beat++) {
        const mark = document.createElement('div');
        mark.className = 'absolute top-0 h-full flex items-end';
        mark.style.left = `${beat * dynamicPixelsPerBeat}px`; // Usa o pixelsPerBeat dinâmico
        
        if (beat % beatsPerBar === 0) { // Marca de compasso (bar)
            const barNumber = (beat / beatsPerBar) + 1;
            mark.innerHTML = `<div class="w-px h-6 bg-gray-300"></div><span class="absolute bottom-0 left-1 text-sm text-gray-300">${barNumber}</span>`;
        } else { // Marca de batida (beat)
            const beatNumber = beat % beatsPerBar + 1;
            mark.innerHTML = `<div class="w-px h-3 bg-gray-600"></div><span class="absolute bottom-6 left-1 text-xs text-gray-500">${beatNumber}</span>`;
        }
        DOM.ruler.appendChild(mark);
    }
    DOM.gridBackground.style.backgroundSize = `${dynamicPixelsPerBeat}px 100%`; // Usa o pixelsPerBeat dinâmico
}

/**
 * Calcula a posição de "snap" mais próxima na grade.
 * @param {number} x - A posição em pixels a ser ajustada.
 * @returns {number} A posição ajustada para a grade.
 */
function getSnapPosition(x) {
    if (!APP_STATE.isSnapEnabled) {
        return x;
    }

    // Define a divisão da batida para o snap.
    const snapDivision = 4; // Semicolcheia
    
    // Recalcula o pixelsPerBeat atual para o snap
    const defaultBPM = 120;
    const basePixelsPerBeatAtDefaultBPM = 60;
    const dynamicPixelsPerBeat = basePixelsPerBeatAtDefaultBPM * (defaultBPM / APP_STATE.bpm);

    const subBeatStep = dynamicPixelsPerBeat / snapDivision;
    
    return Math.round(x / subBeatStep) * subBeatStep;
}