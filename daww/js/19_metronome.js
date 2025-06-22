// app/js/19_metronome.js

/**
 * Configura os nós de áudio básicos para o metrônomo (oscilador e ganho).
 * Se já existirem, não faz nada.
 */
function setupMetronome() {
    if (!APP_STATE.audioContext) return;

    if (!APP_STATE.metronome.oscillator) {
        APP_STATE.metronome.oscillator = APP_STATE.audioContext.createOscillator();
        APP_STATE.metronome.gainNode = APP_STATE.audioContext.createGain();

        APP_STATE.metronome.oscillator.connect(APP_STATE.metronome.gainNode);
        APP_STATE.metronome.gainNode.connect(APP_STATE.audioContext.destination);
        APP_STATE.metronome.oscillator.start(0);
        APP_STATE.metronome.gainNode.gain.value = 0; // Começa silencioso
    }
}

/**
 * Agenda um único clique do metrônomo em um tempo específico do AudioContext.
 * @param {number} time - O tempo absoluto no AudioContext para agendar o clique.
 */
function scheduleMetronomeClick(time) {
    const audioContext = APP_STATE.audioContext;
    if (!audioContext || !APP_STATE.metronome.oscillator || !APP_STATE.metronome.gainNode) return;

    const gainNode = APP_STATE.metronome.gainNode;
    
    // Pequeno pulso de áudio
    gainNode.gain.cancelScheduledValues(time);
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(0.7, time + 0.01); // Volume do clique
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05); // Decaimento rápido do clique
}

/**
 * O agendador principal do metrônomo, que verifica e agenda cliques futuros.
 * Chamado repetidamente por um setInterval.
 */
function metronomeScheduler() {
    const audioContext = APP_STATE.audioContext;
    if (!audioContext || !APP_STATE.isMetronomeEnabled || !APP_STATE.isPlaying) {
        // Se a reprodução não estiver acontecendo, ou o metrônomo desabilitado, pare o agendador
        if (APP_STATE.metronome.intervalId) {
            clearInterval(APP_STATE.metronome.intervalId);
            APP_STATE.metronome.intervalId = null;
        }
        if (APP_STATE.metronome.gainNode) {
            APP_STATE.metronome.gainNode.gain.cancelScheduledValues(audioContext.currentTime);
            APP_STATE.metronome.gainNode.gain.setValueAtTime(0, audioContext.currentTime); // Garante que o som pare
        }
        return;
    }

    // Calcula a duração de uma batida em segundos
    const secondsPerBeat = 60 / APP_STATE.bpm;

    // A posição atual da agulha em segundos
    const currentPlaybackTime = APP_STATE.startOffset + (audioContext.currentTime - APP_STATE.startTime);

    // Garante que nextClickTime seja a próxima batida a ser agendada.
    // Se a reprodução acabou de começar ou a agulha foi movida, recalcula.
    if (APP_STATE.metronome.nextClickTime < currentPlaybackTime) {
        APP_STATE.metronome.nextClickTime = Math.ceil(currentPlaybackTime / secondsPerBeat) * secondsPerBeat;
    }

    // Agenda os cliques enquanto eles estiverem dentro da janela de agendamento
    while (APP_STATE.metronome.nextClickTime < audioContext.currentTime + APP_STATE.metronome.scheduleAheadTime) {
        scheduleMetronomeClick(APP_STATE.metronome.nextClickTime);
        APP_STATE.metronome.nextClickTime += secondsPerBeat;
    }
}

/**
 * Alterna o estado do metrônomo (ligar/desligar).
 * Inicia ou para o agendador e o som.
 */
function toggleMetronome() {
    setupMetronome(); // Garante que os nós de áudio do metrônomo estejam criados

    if (APP_STATE.isMetronomeEnabled) {
        // Se a reprodução já estiver ativa, inicie o agendador imediatamente
        // ou quando o play for pressionado, o agendador será iniciado por play()
        if (APP_STATE.isPlaying && !APP_STATE.metronome.intervalId) {
             // Reinicia o tempo do próximo clique para a próxima batida após o tempo atual
            const currentPlaybackTime = APP_STATE.startOffset + (APP_STATE.audioContext.currentTime - APP_STATE.startTime);
            const secondsPerBeatMetronome = 60 / APP_STATE.bpm;
            APP_STATE.metronome.nextClickTime = Math.ceil(currentPlaybackTime / secondsPerBeatMetronome) * secondsPerBeatMetronome;

            APP_STATE.metronome.intervalId = setInterval(metronomeScheduler, APP_STATE.metronome.lookahead * 1000);
            metronomeScheduler(); // Chama imediatamente para agendar o primeiro clique
        } else if (!APP_STATE.isPlaying) {
            // Se o metrônomo foi ativado enquanto a música está parada,
            // garantimos que o nextClickTime esteja alinhado com a próxima batida
            // da posição da agulha, para um início preciso quando o play for pressionado.
            const secondsPerBeatMetronome = 60 / APP_STATE.bpm;
            const currentPlayheadTime = APP_STATE.playbackStartPositionPx * ((60 / APP_STATE.bpm) / pixelsPerBeat);
            APP_STATE.metronome.nextClickTime = Math.ceil(currentPlayheadTime / secondsPerBeatMetronome) * secondsPerBeatMetronome;
        }
    } else {
        if (APP_STATE.metronome.intervalId) {
            clearInterval(APP_STATE.metronome.intervalId);
            APP_STATE.metronome.intervalId = null;
        }
        if (APP_STATE.metronome.gainNode) {
            APP_STATE.metronome.gainNode.gain.cancelScheduledValues(APP_STATE.audioContext.currentTime);
            APP_STATE.metronome.gainNode.gain.setValueAtTime(0, APP_STATE.audioContext.currentTime); // Desliga o som imediatamente
        }
    }
}