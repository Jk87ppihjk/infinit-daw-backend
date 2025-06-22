// app/js/13_audioEngine.js - VERSÃO COM ROTEAMENTO DE ÁUDIO CORRIGIDO

const ICONS = {
    PLAY: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"></path></svg>`,
    PAUSE: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pause-fill" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/></svg>`
};

function play() {
    if (APP_STATE.isPlaying) return;
    const audioContext = APP_STATE.audioContext;
    if (audioContext.state === 'suspended') { audioContext.resume(); }
    
    APP_STATE.isPlaying = true;
    DOM.playBtn.innerHTML = ICONS.PAUSE;
    DOM.stopBtn.disabled = false;
    
    // Garante que os nós mestres existam
    if (!APP_STATE.masterInputNode) {
        APP_STATE.masterInputNode = audioContext.createGain();
    }
    if (!APP_STATE.masterGainNode) {
        APP_STATE.masterGainNode = audioContext.createGain();
        APP_STATE.masterInputNode.connect(APP_STATE.masterGainNode);
        APP_STATE.masterGainNode.connect(audioContext.destination);
    }
    
    const secondsPerPixel = (60 / APP_STATE.bpm) / APP_STATE.dynamicPixelsPerBeat;

    if (APP_STATE.loop.isEnabled) {
        if (APP_STATE.playbackStartPositionPx < APP_STATE.loop.startTimePx || APP_STATE.playbackStartPositionPx >= APP_STATE.loop.endTimePx) {
            APP_STATE.playbackStartPositionPx = APP_STATE.loop.startTimePx;
        }
    }
    
    APP_STATE.startOffset = APP_STATE.playbackStartPositionPx * secondsPerPixel;
    APP_STATE.startTime = audioContext.currentTime;

    APP_STATE.activeEffectNodes.clear();
    APP_STATE.activeTrackNodes.clear();

    if (APP_STATE.isMetronomeEnabled) {
        toggleMetronome(); 
    }

    document.querySelectorAll('.clip').forEach(clipEl => {
        const clipId = parseInt(clipEl.dataset.clipId);
        const audioBuffer = APP_STATE.clipAudioBuffers.get(clipId);
        const trackId = parseInt(clipEl.parentElement.dataset.trackId);
        const trackHeader = document.querySelector(`.track-header[data-track-id='${trackId}']`);

        if (audioBuffer && trackHeader) {
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.trackId = trackId;

            let lastNode = source;

            if (!APP_STATE.activeTrackNodes.has(trackId)) {
                const muteNode = audioContext.createGain();
                const pannerNode = audioContext.createStereoPanner();
                const volumeNode = audioContext.createGain();
                const analyserNode = audioContext.createAnalyser();
                analyserNode.fftSize = 256;

                // Roteamento CORRETO: Mute -> Pan -> VOLUME -> Analisador -> Saída Master
                muteNode.connect(pannerNode);
                pannerNode.connect(volumeNode);
                volumeNode.connect(analyserNode);
                analyserNode.connect(APP_STATE.masterInputNode);
                
                APP_STATE.activeTrackNodes.set(trackId, { muteNode, pannerNode, volumeNode, analyserNode });
            }
            const trackNodes = APP_STATE.activeTrackNodes.get(trackId);

            // Aplica os valores iniciais de volume e pan
            const initialVolume = parseFloat(trackHeader.dataset.volume) || 1.0;
            const initialPan = (parseInt(trackHeader.dataset.pan) || 0) / 100;
            trackNodes.volumeNode.gain.value = initialVolume;
            trackNodes.pannerNode.pan.value = initialPan;
            
            // Conecta a cadeia de efeitos (se houver)
            const effectsChain = APP_STATE.trackEffects.get(trackId);
            if (effectsChain && effectsChain.length > 0) {
                if (!APP_STATE.activeEffectNodes.has(trackId)) APP_STATE.activeEffectNodes.set(trackId, new Map());
                effectsChain.forEach(effectInstance => {
                    const effectNodeObject = createEffectNode(effectInstance);
                    if (effectNodeObject) {
                        lastNode.connect(effectNodeObject.input);
                        lastNode = effectNodeObject.output;
                        APP_STATE.activeEffectNodes.get(trackId).set(effectInstance.instanceId, effectNodeObject);
                    }
                });
            }
            // Conecta a fonte (ou o último efeito) ao início da cadeia de nós da trilha
            lastNode.connect(trackNodes.muteNode);
            
            // Lógica de agendamento do clipe
            const clipStartPx = clipEl.offsetLeft;
            const clipWidthPx = clipEl.offsetWidth;
            const clipStartSec = clipStartPx * secondsPerPixel;
            const clipVisualDurationSec = clipWidthPx * secondsPerPixel;
            const clipBufferStartSec = parseFloat(clipEl.dataset.originalStartSec || 0);

            let offsetInClip = Math.max(0, APP_STATE.startOffset - clipStartSec);
            let playAt = APP_STATE.startTime + Math.max(0, clipStartSec - APP_STATE.startOffset);
            let duration = clipVisualDurationSec - offsetInClip;

            if (duration > 0) {
                source.start(playAt, clipBufferStartSec + offsetInClip, duration);
                APP_STATE.scheduledSources.push(source);
            }
        }
    });
    
    if (typeof updateAllTrackStates === 'function') updateAllTrackStates();
    playbackLoop();
}

function pause() {
    if (!APP_STATE.isPlaying) return;

    if (APP_STATE.recording.isRecording) {
        stopRecording();
    }

    APP_STATE.isPlaying = false;
    DOM.playBtn.innerHTML = ICONS.PLAY;

    APP_STATE.scheduledSources.forEach(source => { try { source.stop(0); source.disconnect(); } catch (e) {} });
    APP_STATE.scheduledSources = [];

    if (APP_STATE.isMetronomeEnabled) toggleMetronome(); 

    for (const trackNodeMap of APP_STATE.activeEffectNodes.values()) {
        for (const effectNodeObject of trackNodeMap.values()) {
            effectNodeObject.nodes.forEach(node => { try { node.disconnect(); } catch(e) {} });
        }
    }
    for (const trackNodes of APP_STATE.activeTrackNodes.values()) {
        // Agora o volumeNode se conecta ao analyserNode, então precisamos desconectá-lo ao parar.
        try { trackNodes.volumeNode.disconnect(); } catch(e) {}
    }
    APP_STATE.activeEffectNodes.clear();
    APP_STATE.activeTrackNodes.clear();

    if (APP_STATE.animationFrameId) {
        cancelAnimationFrame(APP_STATE.animationFrameId);
        APP_STATE.animationFrameId = null;
    }
}

function playbackLoop() {
    if (!APP_STATE.isPlaying) return;
    const secondsPerPixel = (60 / APP_STATE.bpm) / APP_STATE.dynamicPixelsPerBeat;
    const elapsedTime = APP_STATE.audioContext.currentTime - APP_STATE.startTime;
    let newPlayheadPx = (APP_STATE.startOffset / secondsPerPixel) + (elapsedTime / secondsPerPixel);

    if (APP_STATE.loop.isEnabled && newPlayheadPx >= APP_STATE.loop.endTimePx) {
        pause();
        APP_STATE.playbackStartPositionPx = APP_STATE.loop.startTimePx;
        play();
        return;
    }
    if (!APP_STATE.loop.isEnabled && newPlayheadPx >= APP_STATE.timelineWidth) {
        pause();
        movePlayhead(0);
        APP_STATE.playbackStartPositionPx = 0;
        return;
    }

    movePlayhead(newPlayheadPx);
    const scrollContainer = DOM.timelineScrollContainer;
    const containerWidth = scrollContainer.clientWidth;
    const currentScroll = scrollContainer.scrollLeft;
    if (newPlayheadPx > currentScroll + containerWidth * 0.75 || newPlayheadPx < currentScroll) {
        scrollContainer.scrollLeft = newPlayheadPx - (containerWidth / 4);
    }
    APP_STATE.animationFrameId = requestAnimationFrame(playbackLoop);
}

function rebuildAndResumeTrack(trackId) {
    if (!APP_STATE.isPlaying) return;

    const audioContext = APP_STATE.audioContext;
    
    const sourcesToStop = APP_STATE.scheduledSources.filter(s => s.trackId === trackId);
    sourcesToStop.forEach(s => { try { s.stop(0); s.disconnect(); } catch (e) {} });
    APP_STATE.scheduledSources = APP_STATE.scheduledSources.filter(s => s.trackId !== trackId);

    const oldEffects = APP_STATE.activeEffectNodes.get(trackId);
    if (oldEffects) {
        oldEffects.forEach(effect => effect.nodes.forEach(node => { try { node.disconnect(); } catch(e) {} }));
        oldEffects.clear();
    } else {
        APP_STATE.activeEffectNodes.set(trackId, new Map());
    }

    const trackLane = DOM.timelineContent.querySelector(`.track-lane[data-track-id='${trackId}']`);
    const trackNodes = APP_STATE.activeTrackNodes.get(trackId);
    if (!trackLane || !trackNodes) return;

    const secondsPerPixel = (60 / APP_STATE.bpm) / APP_STATE.dynamicPixelsPerBeat;
    const currentPlaybackTime = (audioContext.currentTime - APP_STATE.startTime) + APP_STATE.startOffset;
    
    const effectsChain = APP_STATE.trackEffects.get(trackId);

    trackLane.querySelectorAll('.clip').forEach(clipEl => {
        const clipId = parseInt(clipEl.dataset.clipId);
        const audioBuffer = APP_STATE.clipAudioBuffers.get(clipId);
        if (!audioBuffer) return;

        const newSource = audioContext.createBufferSource();
        newSource.buffer = audioBuffer;
        newSource.trackId = trackId;

        let lastNode = newSource;
        if (effectsChain && effectsChain.length > 0) {
            effectsChain.forEach(effectInstance => {
                const effectNodeObject = createEffectNode(effectInstance);
                if (effectNodeObject) {
                    lastNode.connect(effectNodeObject.input);
                    lastNode = effectNodeObject.output;
                    APP_STATE.activeEffectNodes.get(trackId).set(effectInstance.instanceId, effectNodeObject);
                }
            });
        }
        lastNode.connect(trackNodes.muteNode);

        const clipStartSec = clipEl.offsetLeft * secondsPerPixel;
        const clipEndSec = clipStartSec + (clipEl.offsetWidth * secondsPerPixel);
        const clipBufferStartSec = parseFloat(clipEl.dataset.originalStartSec || 0);

        if (currentPlaybackTime < clipEndSec) {
            const offsetIntoClipBuffer = clipBufferStartSec + Math.max(0, currentPlaybackTime - clipStartSec);
            const remainingDuration = clipEndSec - currentPlaybackTime;
            
            if (remainingDuration > 0 && offsetIntoClipBuffer < audioBuffer.duration) {
                newSource.start(audioContext.currentTime, offsetIntoClipBuffer, remainingDuration);
                APP_STATE.scheduledSources.push(newSource);
            }
        }
    });
}