// app/js/20_recording.js

/**
 * Lógica para gravação de áudio com captura pura e visualização de clipe em tempo real.
 */

// --- FUNÇÕES AUXILIARES ---

/**
 * Combina os pedaços de áudio (chunks) de um canal em um único Float32Array.
 */
function combineAudioChunks(channelChunks) {
    const totalLength = channelChunks.reduce((acc, val) => acc + val.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of channelChunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}

/**
 * Cria um elemento de clipe placeholder para a gravação.
 * Será apenas uma caixa vermelha que cresce.
 */
function createRecordingClipElement(trackElement, startPx) {
    const clip = document.createElement('div');
    clip.className = 'absolute h-16 top-2 rounded-md bg-red-800 border-2 border-red-500 overflow-hidden pointer-events-none';
    clip.style.left = `${startPx}px`;
    clip.style.width = '0px';
    trackElement.appendChild(clip);
    return clip;
}


// --- LÓGICA DE RENDERIZAÇÃO E GRAVAÇÃO ---

/**
 * Atualiza a largura do clipe de gravação para seguir a agulha.
 */
function updateRecordingClipVisuals() {
    if (!APP_STATE.recording.isRecording) return;

    const rec = APP_STATE.recording;
    const clipElement = rec.recordingClipElement;

    if (!clipElement) return;

    const currentWidth = DOM.playhead.offsetLeft - rec.recordingStartPositionPx;
    clipElement.style.width = `${Math.max(0, currentWidth)}px`;

    rec.renderFrameId = requestAnimationFrame(updateRecordingClipVisuals);
}

/**
 * Solicita acesso ao microfone do usuário.
 * // --- Modificado para seleção de microfone ---
 * @param {string} [deviceId] - O ID do dispositivo de áudio para usar, se especificado.
 * // --- Fim da modificação para seleção de microfone ---
 */
// --- Modificado para seleção de microfone ---
async function getMicrophoneStream(deviceId) {
// --- Fim da modificação para seleção de microfone ---
    if (APP_STATE.recording.mediaStream) return APP_STATE.recording.mediaStream;
    try {
        // --- Modificado para seleção de microfone ---
        const constraints = {
            audio: {
                deviceId: deviceId ? { exact: deviceId } : undefined, // Usa o deviceId específico
                echoCancellation: false,
                autoGainControl: false,
                noiseSuppression: false,
                latency: 0
            }
        };
        // --- Fim da modificação para seleção de microfone ---
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        APP_STATE.recording.mediaStream = stream;
        return stream;
    } catch (err) {
        console.error("Erro ao acessar o microfone:", err);
        alert("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
        return null;
    }
}

/**
 * Inicia a gravação de áudio.
 */
async function startRecording(trackId) {
    if (APP_STATE.recording.isRecording) {
        console.warn("Gravação já em andamento.");
        return;
    }

    const audioContext = APP_STATE.audioContext;
    if (!audioContext) {
        alert("O motor de áudio não está pronto.");
        return;
    }

    // --- Modificado para seleção de microfone ---
    const stream = await getMicrophoneStream(APP_STATE.selectedMicrophoneId);
    // --- Fim da modificação para seleção de microfone ---
    if (!stream) return;

    if (audioContext.state === 'suspended') await audioContext.resume();

    const rec = APP_STATE.recording;
    rec.rawAudioData = [];
    rec.currentTrackId = trackId;
    rec.recordingStartPositionPx = DOM.playhead.offsetLeft;

    try {
        await audioContext.audioWorklet.addModule('js/audio-recorder-processor.js');
    } catch (e) {
        console.error("Erro ao carregar o processador de áudio (AudioWorklet).", e);
        return;
    }

    const microphoneSourceNode = audioContext.createMediaStreamSource(stream);
    rec.workletNode = new AudioWorkletNode(audioContext, 'audio-recorder-processor');
    microphoneSourceNode.connect(rec.workletNode);

    rec.workletNode.port.onmessage = (event) => {
        if (rec.isRecording) rec.rawAudioData.push(event.data);
    };

    const trackElement = DOM.timelineContent.querySelector(`.track-lane[data-track-id='${trackId}']`);
    rec.recordingClipElement = createRecordingClipElement(trackElement, rec.recordingStartPositionPx);

    rec.mediaRecorder = new MediaRecorder(stream);
    rec.mediaRecorder.onstop = () => {
        const combinedAudio = combineAudioChunks(rec.rawAudioData);
        const finalClipElement = rec.recordingClipElement;

        if (combinedAudio.length === 0 || !finalClipElement) {
            finalClipElement?.remove();
        } else {
            const finalBuffer = audioContext.createBuffer(1, combinedAudio.length, audioContext.sampleRate);
            finalBuffer.copyToChannel(combinedAudio, 0);

            const clipWidthPx = timeToPositionPx(finalBuffer.duration);
            finalClipElement.style.width = `${clipWidthPx}px`;

            finalClipElement.className = 'clip absolute h-16 top-2 rounded-md bg-blue-600 border-2 border-transparent cursor-pointer overflow-hidden';
            
            const clipId = APP_STATE.nextClipId++;
            APP_STATE.clipAudioBuffers.set(clipId, finalBuffer);
            
            finalClipElement.dataset.clipId = clipId;
            finalClipElement.dataset.originalStartSec = 0;
            finalClipElement.draggable = true;

            finalClipElement.innerHTML = `
                <canvas class="waveform-canvas absolute top-0 left-0 w-full h-full"></canvas>
                <span class="clip-text-overlay absolute top-1 left-2 pointer-events-none text-white text-xs font-bold">Gravação ${new Date().toLocaleTimeString()}</span>
                <div class="resize-handle left"></div>
                <div class="resize-handle right"></div>
            `;

            setTimeout(() => {
                const canvas = finalClipElement.querySelector('.waveform-canvas');
                if (canvas) {
                    drawWaveform(canvas, finalBuffer, 0);
                }
            }, 0);
        }

        rec.workletNode.port.onmessage = null;
        rec.mediaStream.getTracks().forEach(track => track.stop()); // Parar todas as tracks do stream
        
        Object.assign(rec, {
            isRecording: false, mediaStream: null, mediaRecorder: null, rawAudioData: [],
            workletNode: null, recordingClipElement: null, renderFrameId: null
        });

        DOM.recordBtn.classList.remove('active');
        console.log("Gravação de alta qualidade finalizada.");
    };

    rec.mediaRecorder.start();
    rec.isRecording = true;
    DOM.recordBtn.classList.add('active');

    if (!APP_STATE.isPlaying) play();
    
    updateRecordingClipVisuals();
}

/**
 * Para a gravação de áudio.
 */
function stopRecording() {
    const rec = APP_STATE.recording;
    if (rec.isRecording && rec.mediaRecorder && rec.mediaRecorder.state !== "inactive") {
        rec.mediaRecorder.stop();
        rec.isRecording = false; 
        cancelAnimationFrame(rec.renderFrameId);
    }
}