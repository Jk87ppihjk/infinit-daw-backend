// app/js/22_projectManager.js

/**
 * ===================================================================
 * === LÓGICA DE GERENCIAMENTO DE PROJETOS (SALVAR/CARREGAR) =========
 * ===================================================================
 */

// Funções utilitárias (copiadas de exporter.js para serem usadas aqui)
function bufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);
    const channels = [];
    let i, sample;
    let offset = 0;
    let pos = 0;

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length of fmt chunk
    setUint16(1); // PCM format
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
    setUint16(numOfChan * 2); // block align
    setUint16(16); // bits per sample
    setUint32(0x61746164); // "data" chunk
    setUint32(length - pos - 4);

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }
    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }

    for (i = 0; i < numOfChan; i++) {
        channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([view], { type: 'audio/wav' });
}

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
 * Coleta o estado atual da DAW e o empacota em um arquivo .ifnt para download.
 */
async function saveProject() {
    console.log("Iniciando processo de salvamento...");
    const loader = document.getElementById('export-loader');
    loader.classList.remove('hidden');

    try {
        const zip = new JSZip();
        const audioFolder = zip.folder("audio");

        const projectData = {
            bpm: APP_STATE.bpm,
            tracks: [],
        };

        const audioBufferMap = new Map(); // Mapeia AudioBuffer para um nome de arquivo único
        let audioIdCounter = 0;

        const trackHeaders = document.querySelectorAll('.track-header[data-track-id]');
        for (const trackHeader of trackHeaders) {
            const trackId = parseInt(trackHeader.dataset.trackId);
            const trackLane = document.querySelector(`.track-lane[data-track-id='${trackId}']`);

            const trackInfo = {
                id: trackId,
                name: trackHeader.querySelector('.font-bold').textContent,
                volume: parseFloat(trackHeader.dataset.volume),
                pan: parseInt(trackHeader.dataset.pan),
                isMuted: trackHeader.dataset.isMuted === 'true',
                isSoloed: trackHeader.dataset.isSoloed === 'true',
                effects: APP_STATE.trackEffects.get(trackId) || [],
                clips: [],
            };

            const clips = trackLane.querySelectorAll('.clip');
            for (const clipEl of clips) {
                const clipId = parseInt(clipEl.dataset.clipId);
                const audioBuffer = APP_STATE.clipAudioBuffers.get(clipId);

                if (audioBuffer) {
                    let audioFilename = audioBufferMap.get(audioBuffer);

                    if (!audioFilename) {
                        audioFilename = `audio_${audioIdCounter++}.wav`;
                        audioBufferMap.set(audioBuffer, audioFilename);
                        const wavBlob = bufferToWav(audioBuffer);
                        audioFolder.file(audioFilename, wavBlob);
                    }

                    trackInfo.clips.push({
                        id: clipId,
                        left: clipEl.style.left,
                        width: clipEl.style.width,
                        originalStartSec: parseFloat(clipEl.dataset.originalStartSec || 0),
                        text: clipEl.querySelector('.clip-text-overlay').textContent,
                        audioFilename: audioFilename,
                    });
                }
            }
            projectData.tracks.push(trackInfo);
        }

        zip.file("project.json", JSON.stringify(projectData, null, 2));

        const projectName = prompt("Digite o nome do seu projeto:", "beat");
        if (!projectName) {
            console.log("Salvamento cancelado pelo usuário.");
            loader.classList.add('hidden');
            return;
        }

        const content = await zip.generateAsync({ type: "blob" });
        downloadBlob(content, `${projectName}.ifnt`);

    } catch (error) {
        console.error("Erro ao salvar o projeto:", error);
        alert("Ocorreu um erro ao salvar o projeto.");
    } finally {
        loader.classList.add('hidden');
    }
}

/**
 * Limpa o projeto atual de forma segura e recria o estado inicial.
 */
function clearProject() {
    console.log("Limpando o projeto atual para criar um novo...");

    if (APP_STATE.isPlaying) {
        pause();
    }

    document.querySelectorAll('.clip').forEach(clip => clip.remove());

    document.querySelectorAll('.track-header, .track-lane').forEach(trackElement => {
        if (trackElement.dataset.trackId) {
            trackElement.remove();
        }
    });

    APP_STATE.clipAudioBuffers.clear();
    APP_STATE.trackEffects.clear();
    APP_STATE.nextTrackId = 1;
    APP_STATE.nextClipId = 1;
    movePlayhead(0);
    APP_STATE.playbackStartPositionPx = 0;

    addTrack();
    addTrack();

    const firstTrack = document.querySelector('.track-header[data-track-id="1"]');
    if (firstTrack) {
        selectTrack(1);
    } else {
        DOM.drawerPlaceholder.classList.remove('hidden');
        DOM.drawerTrackControls.classList.add('hidden');
    }
    console.log("Novo projeto limpo criado com sucesso.");
}


/**
 * ===================================================================
 * === CORREÇÃO APLICADA AQUI ========================================
 * ===================================================================
 * Carrega um projeto a partir de um arquivo .ifnt de forma robusta.
 * @param {File} file O arquivo .ifnt selecionado pelo usuário.
 */
async function loadProject(file) {
    if (!file) return;

    const loader = document.getElementById('export-loader');
    loader.classList.remove('hidden');

    try {
        const zip = await JSZip.loadAsync(file);
        const projectFile = zip.file("project.json");

        if (!projectFile) {
            throw new Error("Arquivo de projeto inválido: project.json não encontrado.");
        }

        const projectData = JSON.parse(await projectFile.async("string"));
        
        clearProject(); // Limpa o estado atual

        // >>> ETAPA DE CORREÇÃO <<<
        // Remove as trilhas padrão que 'clearProject' adiciona para começar do zero.
        document.querySelectorAll('.track-header[data-track-id], .track-lane[data-track-id]').forEach(el => el.remove());
        
        // Carrega e decodifica todos os áudios primeiro
        const audioFiles = zip.folder("audio");
        const loadedAudioBuffers = new Map();
        const audioPromises = [];

        audioFiles.forEach((relativePath, zipEntry) => {
            const promise = zipEntry.async("arraybuffer").then(data => {
                return APP_STATE.audioContext.decodeAudioData(data).then(audioBuffer => {
                    loadedAudioBuffers.set(zipEntry.name.split('/').pop(), audioBuffer);
                });
            });
            audioPromises.push(promise);
        });

        await Promise.all(audioPromises);
        console.log("Todos os áudios do projeto foram carregados e decodificados.");
        
        // Reconstrói a UI com os dados do projeto
        APP_STATE.bpm = projectData.bpm;
        DOM.bpmInput.value = projectData.bpm;
        createRuler();

        // >>> ETAPA DE CORREÇÃO <<<
        // Reconstrói as trilhas manualmente para garantir a correspondência de IDs
        projectData.tracks.forEach(trackInfo => {
            const trackId = trackInfo.id;
            
            // Cria o cabeçalho da trilha
            const trackHeader = document.createElement('div');
            trackHeader.className = 'track-header flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700 cursor-pointer';
            trackHeader.style.height = `${APP_STATE.currentTrackHeight}px`;
            trackHeader.dataset.trackId = trackId;
            trackHeader.dataset.volume = trackInfo.volume;
            trackHeader.dataset.pan = trackInfo.pan;
            trackHeader.dataset.isMuted = trackInfo.isMuted;
            trackHeader.dataset.isSoloed = trackInfo.isSoloed;
            trackHeader.innerHTML = `
                <div class="w-28 pointer-events-none">
                    <p class="font-bold truncate">${trackInfo.name}</p>
                </div>
                <button data-track-id="${trackId}" class="delete-track-btn text-gray-400 hover:text-red-500 font-bold p-1 rounded-full hover:bg-gray-700 transition-colors">✕</button>`;
            trackHeader.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                selectTrack(trackId);
            });
            DOM.trackHeadersContainer.appendChild(trackHeader);

            // Cria a pista da trilha na timeline
            const trackLane = document.createElement('div');
            trackLane.className = 'track-lane border-b border-gray-700 relative';
            trackLane.dataset.trackId = trackId;
            trackLane.style.height = `${APP_STATE.currentTrackHeight}px`;
            DOM.timelineContent.appendChild(trackLane);
            
            // Restaura os efeitos
            APP_STATE.trackEffects.set(trackId, trackInfo.effects || []);
            
            // Restaura os clipes
            trackInfo.clips.forEach(clipInfo => {
                const audioBuffer = loadedAudioBuffers.get(clipInfo.audioFilename);
                if (audioBuffer) {
                    const newClip = addClipToTrack(trackLane, 0, 0, clipInfo.text, audioBuffer, clipInfo.originalStartSec);
                    newClip.style.left = clipInfo.left;
                    newClip.style.width = clipInfo.width;
                    APP_STATE.clipAudioBuffers.set(parseInt(newClip.dataset.clipId), audioBuffer);
                }
            });
        });
        
        updateTimelineHeight();

        // >>> ETAPA DE CORREÇÃO <<<
        // Atualiza os contadores globais para o próximo ID disponível
        const maxTrackId = Math.max(0, ...projectData.tracks.map(t => t.id));
        const maxClipId = Math.max(0, ...projectData.tracks.flatMap(t => t.clips.map(c => c.id || 0)));
        APP_STATE.nextTrackId = maxTrackId + 1;
        APP_STATE.nextClipId = maxClipId + 1;
        
        // Seleciona a primeira trilha do projeto carregado
        if (projectData.tracks.length > 0) {
            selectTrack(projectData.tracks[0].id);
        }

    } catch (error) {
        console.error("Erro ao carregar o projeto:", error);
        alert("Ocorreu um erro ao carregar o projeto. O arquivo pode estar corrompido ou em um formato inválido.");
        clearProject(); // Volta a um estado limpo em caso de erro
    } finally {
        loader.classList.add('hidden');
    }
}


/**
 * Cria e aciona um input de arquivo para o usuário selecionar um projeto para carregar.
 */
function triggerLoadDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ".ifnt,application/zip"; // Aceita .ifnt e .zip

    input.onchange = e => { 
        const file = e.target.files[0];
        if (file) {
            loadProject(file);
        }
    };

    input.click();
}