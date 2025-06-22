// app/js/21_exporter.js

/**
 * Converte um AudioBuffer para um Blob no formato WAV.
 * @param {AudioBuffer} buffer O buffer de áudio a ser convertido.
 * @returns {Blob} Um Blob contendo os dados do arquivo WAV.
 */
function bufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);
    const channels = [];
    let i, sample;
    let offset = 0;
    let pos = 0;

    // Escreve o cabeçalho WAV
    // RIFF
    setUint32(0x46464952);
    // Tamanho do arquivo
    setUint32(length - 8);
    // WAVE
    setUint32(0x45564157);

    // Sub-chunk "fmt "
    // "fmt "
    setUint32(0x20746d66);
    // Tamanho do sub-chunk
    setUint32(16);
    // Formato de áudio (PCM)
    setUint16(1);
    // Número de canais
    setUint16(numOfChan);
    // Sample rate
    setUint32(buffer.sampleRate);
    // Byte rate
    setUint32(buffer.sampleRate * 2 * numOfChan);
    // Block align
    setUint16(numOfChan * 2);
    // Bits por amostra
    setUint16(16);

    // Sub-chunk "data"
    // "data"
    setUint32(0x61746164);
    // Tamanho dos dados
    setUint32(length - pos - 4);

    // Funções auxiliares de escrita
    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }

    // Obtém os dados de cada canal
    for (i = 0; i < numOfChan; i++) {
        channels.push(buffer.getChannelData(i));
    }

    // Escreve os dados de áudio intercalando os canais
    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset])); // Limita o valor entre -1 e 1
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // Converte para PCM 16-bit
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([view], { type: 'audio/wav' });
}


/**
 * Inicia o download de um Blob como um arquivo.
 * @param {Blob} blob O conteúdo do arquivo.
 * @param {string} filename O nome do arquivo a ser baixado.
 */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
}


/**
 * Recria toda a cadeia de áudio da DAW em um OfflineAudioContext para renderização.
 * @param {OfflineAudioContext} offlineCtx O contexto de áudio offline.
 */
async function recreateOfflineAudioGraph(offlineCtx) {
    const trackHeaders = Array.from(document.querySelectorAll('.track-header'));

    for (const trackHeader of trackHeaders) {
        const trackId = parseInt(trackHeader.dataset.trackId);
        const trackLane = document.querySelector(`.track-lane[data-track-id='${trackId}']`);
        if (!trackLane) continue;

        // Cria os nós principais da trilha (volume, pan, mute) no contexto OFFLINE
        const muteNode = offlineCtx.createGain();
        const pannerNode = offlineCtx.createStereoPanner();
        const volumeNode = offlineCtx.createGain();

        // Conecta os nós principais da trilha e ao destino final do contexto offline
        pannerNode.connect(volumeNode);
        volumeNode.connect(offlineCtx.destination);

        // Define os valores de volume, pan e mute/solo
        const isMuted = trackHeader.dataset.isMuted === 'true';
        const isSoloed = trackHeader.dataset.isSoloed === 'true';
        const isAnyTrackSoloed = trackHeaders.some(h => h.dataset.isSoloed === 'true');

        if (isAnyTrackSoloed) {
            muteNode.gain.value = isSoloed ? 1 : 0;
        } else {
            muteNode.gain.value = isMuted ? 0 : 1;
        }
        
        // Conecta o muteNode ao panner, que é o início da cadeia de processamento da trilha.
        muteNode.connect(pannerNode);

        volumeNode.gain.value = parseFloat(trackHeader.dataset.volume) || 1.0;
        pannerNode.pan.value = (parseInt(trackHeader.dataset.pan) || 0) / 100;

        // Cria a cadeia de efeitos
        let lastNodeInChain = muteNode; // Os clipes serão conectados aqui
        const effectsChain = APP_STATE.trackEffects.get(trackId);
        if (effectsChain && effectsChain.length > 0) {
            // Nota: Isso assume que createEffectNode pode operar com um context diferente.
            // A função original precisa ser adaptada para `createEffectNode(effectInstance, context)`
            // Por enquanto, vamos assumir que isso será feito.
            for (const effectInstance of effectsChain) {
                // Passamos o offlineCtx para a fábrica de efeitos
                const effectNodeObject = createEffectNode(effectInstance, offlineCtx);
                if (effectNodeObject) {
                    lastNodeInChain.connect(effectNodeObject.input);
                    lastNodeInChain = effectNodeObject.output;
                }
            }
        }
        // O final da cadeia de efeitos se conecta ao panner
        lastNodeInChain.connect(pannerNode);

        // Processa cada clipe na trilha
        const clips = trackLane.querySelectorAll('.clip');
        for (const clipEl of clips) {
            const clipId = parseInt(clipEl.dataset.clipId);
            const audioBuffer = APP_STATE.clipAudioBuffers.get(clipId);
            if (!audioBuffer) continue;

            // Cria a fonte de áudio no contexto OFFLINE
            const source = offlineCtx.createBufferSource();
            source.buffer = audioBuffer;

            // Conecta a fonte ao início da cadeia de processamento da trilha (muteNode)
            source.connect(muteNode);

            // Calcula o tempo de início do clipe em segundos
            const clipStartPx = clipEl.offsetLeft;
            const clipStartSec = positionPxToTimeSec(clipStartPx);
            const clipBufferStartSec = parseFloat(clipEl.dataset.originalStartSec || 0);

            // Agenda o início da reprodução do clipe no tempo correto do contexto offline
            source.start(clipStartSec, clipBufferStartSec);
        }
    }
}


/**
 * Função principal para exportar o projeto inteiro para um arquivo WAV.
 */
async function exportProjectToWav() {
    if (!APP_STATE.audioContext) {
        alert("O motor de áudio não foi inicializado.");
        return;
    }

    const loader = document.getElementById('export-loader');
    loader.classList.remove('hidden');

    try {
        // 1. Calcula a duração total do projeto
        let maxEndTime = 0;
        document.querySelectorAll('.clip').forEach(clipEl => {
            const endPx = clipEl.offsetLeft + clipEl.offsetWidth;
            const endSec = positionPxToTimeSec(endPx);
            if (endSec > maxEndTime) {
                maxEndTime = endSec;
            }
        });

        if (maxEndTime === 0) {
            alert("O projeto está vazio. Adicione alguns clipes para exportar.");
            loader.classList.add('hidden');
            return;
        }

        // 2. Cria o OfflineAudioContext
        const totalDurationSamples = Math.ceil(maxEndTime * APP_STATE.audioContext.sampleRate);
        const offlineCtx = new OfflineAudioContext(2, totalDurationSamples, APP_STATE.audioContext.sampleRate);

        // 3. Recria todo o grafo de áudio no contexto offline
        await recreateOfflineAudioGraph(offlineCtx);

        // 4. Inicia a renderização
        console.log("Iniciando renderização offline...");
        const renderedBuffer = await offlineCtx.startRendering();
        console.log("Renderização concluída.");

        // 5. Converte o buffer renderizado para o formato WAV
        const wavBlob = bufferToWav(renderedBuffer);

        // 6. Inicia o download
        downloadBlob(wavBlob, `meu-projeto-${new Date().toISOString().slice(0, 10)}.wav`);

    } catch (error) {
        console.error("Erro durante a exportação para WAV:", error);
        alert("Ocorreu um erro inesperado durante a exportação. Verifique o console para mais detalhes.");
    } finally {
        // 7. Esconde a tela de carregamento
        loader.classList.add('hidden');
    }
}