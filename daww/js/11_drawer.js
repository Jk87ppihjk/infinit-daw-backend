// app/js/11_drawer.js - VERSÃO COM ESTRUTURA HTML CORRIGIDA

let currentDrawerTrackId = null; 
let meterAnimationId = null;

// --- FUNÇÕES DA GAVETA DO MIXER (DIREITA) ---

function buildMixerChannels() {
    const channelsContainer = document.getElementById('mixer-channels-container');
    if (!channelsContainer) return;

    channelsContainer.innerHTML = '';

    const tracks = document.querySelectorAll('.track-header[data-track-id]');
    
    tracks.forEach((trackHeader, index) => {
        const trackId = parseInt(trackHeader.dataset.trackId);
        const trackData = {
            id: trackId,
            number: index + 1,
            name: trackHeader.querySelector('.font-bold').textContent,
            volume: parseFloat(trackHeader.dataset.volume),
            pan: parseInt(trackHeader.dataset.pan),
            isMuted: trackHeader.dataset.isMuted === 'true',
            isSoloed: trackHeader.dataset.isSoloed === 'true',
            effects: APP_STATE.trackEffects.get(trackId) || []
        };
        const channelStrip = createMixerChannelStrip(trackData);
        channelsContainer.appendChild(channelStrip);
    });

    const masterChannel = createMasterChannelStrip();
    channelsContainer.appendChild(masterChannel);
}

function openMixerDrawer() {
    const mixerDrawer = document.getElementById('mixer-drawer');
    if (!mixerDrawer) return;
    
    buildMixerChannels(); 
    mixerDrawer.classList.add('open');
    startMeterAnimation();
}

function closeMixerDrawer() {
    document.getElementById('mixer-drawer')?.classList.remove('open');
    stopMeterAnimation();
}

function refreshMixerDrawer() {
    const mixerDrawer = document.getElementById('mixer-drawer');
    if (mixerDrawer && mixerDrawer.classList.contains('open')) {
        buildMixerChannels();
    }
}

function volumeToDb(volume) {
    if (volume <= 0.0001) { 
        return -Infinity;
    }
    return 20 * Math.log10(volume);
}


function createMixerChannelStrip(trackData) {
    const strip = document.createElement('div');
    strip.className = 'channel-strip';
    strip.dataset.trackId = trackData.id;

    const initialDb = volumeToDb(trackData.volume);
    const initialDbText = isFinite(initialDb) ? `${initialDb.toFixed(1)} dB` : '-INF dB';

    // ==========================================================
    // ===== ESTRUTURA HTML MODIFICADA AQUI =====================
    // ==========================================================
    // Agrupamos os controles em 'top' e 'bottom' para o layout flexível funcionar corretamente.
    strip.innerHTML = `
        <div class="channel-top-controls">
            <div class="track-name-plate" title="${trackData.name}">
                <span class="track-number">${trackData.number}</span>
                <span class="track-name">${trackData.name}</span>
            </div>
            <div class="pan-control">
                <label>PAN</label>
                <input type="range" class="pan-slider" min="-100" max="100" value="${trackData.pan}" title="Pan">
            </div>
            <div class="effects-rack"></div>
        </div>

        <div class="fader-meter-section">
            <div class="fader-container">
                <input type="range" class="volume-fader" min="0" max="1.5" step="0.01" value="${trackData.volume}" title="Volume">
            </div>
            <div class="peak-meter-container">
                <div class="peak-meter-fill"></div>
            </div>
        </div>

        <div class="channel-bottom-controls">
            <div class="fader-value-display">${initialDbText}</div> 
            <div class="solo-mute-buttons">
                <button class="mute ${trackData.isMuted ? 'active' : ''}" title="Mute">M</button>
                <button class="solo ${trackData.isSoloed ? 'active' : ''}" title="Solo">S</button>
            </div>
        </div>
    `;

    const trackId = trackData.id;
    const header = document.querySelector(`.track-header[data-track-id='${trackId}']`);

    const updateTrack = (prop, value) => {
        if (header) header.dataset[prop] = value;
        if (currentDrawerTrackId === trackId) {
            updateDrawer(trackData);
        }
        if (APP_STATE.isPlaying) {
            const trackNodes = APP_STATE.activeTrackNodes.get(trackId);
            if (prop === 'volume' && trackNodes?.volumeNode) trackNodes.volumeNode.gain.setTargetAtTime(value, APP_STATE.audioContext.currentTime, 0.01);
            if (prop === 'pan' && trackNodes?.pannerNode) trackNodes.pannerNode.pan.setTargetAtTime(value / 100, APP_STATE.audioContext.currentTime, 0.01);
            if (prop === 'isMuted' || prop === 'isSoloed') updateAllTrackStates();
        }
    };

    const volumeFader = strip.querySelector('.volume-fader');
    const initialPercentage = (trackData.volume / 1.5) * 100;
    volumeFader.style.setProperty('--fader-fill', `${initialPercentage}%`);
    
    const dbDisplay = strip.querySelector('.fader-value-display');

    volumeFader.addEventListener('input', (e) => {
        const newVolume = parseFloat(e.target.value);
        const percentage = (newVolume / 1.5) * 100;
        e.target.style.setProperty('--fader-fill', `${percentage}%`);
        updateTrack('volume', newVolume);
        const dbValue = volumeToDb(newVolume);
        dbDisplay.textContent = isFinite(dbValue) ? `${dbValue.toFixed(1)} dB` : '-INF dB';
    });

    strip.querySelector('.pan-slider').addEventListener('input', (e) => updateTrack('pan', parseInt(e.target.value)));
    strip.querySelector('.mute').addEventListener('click', (e) => { e.target.classList.toggle('active'); updateTrack('isMuted', e.target.classList.contains('active')); });
    strip.querySelector('.solo').addEventListener('click', (e) => { e.target.classList.toggle('active'); updateTrack('isSoloed', e.target.classList.contains('active')); });

    const effectsRack = strip.querySelector('.effects-rack');
    populateEffectsRack(effectsRack, trackId, trackData.effects);

    return strip;
}

function createMasterChannelStrip() {
    const strip = document.createElement('div');
    strip.className = 'channel-strip master';
    strip.dataset.trackId = 'master';
    const currentMasterVolume = APP_STATE.masterGainNode ? APP_STATE.masterGainNode.gain.value : 1;
    
    const initialDb = volumeToDb(currentMasterVolume);
    const initialDbText = isFinite(initialDb) ? `${initialDb.toFixed(1)} dB` : '-INF dB';

    strip.innerHTML = `
        <div class="channel-top-controls">
            <div class="track-name-plate" style="border-color: #9ca3af;">
                <span class="track-name">MASTER</span>
            </div>
            <div class="pan-control" style="visibility: hidden;"><label>PAN</label><input type="range"></div>
            <div class="effects-rack"></div>
        </div>
        
        <div class="fader-meter-section">
            <div class="fader-container">
                <input type="range" min="0" max="1.5" step="0.01" value="${currentMasterVolume}" class="volume-fader" id="master-fader" title="Volume Master">
            </div>
            <div class="peak-meter-container">
                <div class="peak-meter-fill"></div>
            </div>
        </div>

        <div class="channel-bottom-controls">
            <div class="fader-value-display">${initialDbText}</div>
            <div class="solo-mute-buttons" style="visibility: hidden;"><button>M</button><button>S</button></div>
        </div>
    `;

    const masterFader = strip.querySelector('#master-fader');
    const initialPercentage = (currentMasterVolume / 1.5) * 100;
    masterFader.style.setProperty('--fader-fill', `${initialPercentage}%`);

    const masterDbDisplay = strip.querySelector('.fader-value-display');

    masterFader.addEventListener('input', (e) => {
        const newVolume = parseFloat(e.target.value);
        e.target.style.setProperty('--fader-fill', `${(newVolume / 1.5) * 100}%`);
        if(APP_STATE.masterGainNode) {
            APP_STATE.masterGainNode.gain.setTargetAtTime(newVolume, APP_STATE.audioContext.currentTime, 0.01);
        }
        const dbValue = volumeToDb(newVolume);
        masterDbDisplay.textContent = isFinite(dbValue) ? `${dbValue.toFixed(1)} dB` : '-INF dB';
    });

    const effectsRack = strip.querySelector('.effects-rack');
    populateEffectsRack(effectsRack, 'master', APP_STATE.masterEffects);

    return strip;
}

function populateEffectsRack(rackElement, targetId, effects) {
    rackElement.innerHTML = '';
    if (effects && effects.length > 0) {
        effects.forEach(effectInstance => {
            const effectDef = APP_STATE.allEffects.find(e => e.id === effectInstance.effectId);
            if (!effectDef) return;
            const effectPill = document.createElement('div');
            effectPill.className = 'effect-pill-mixer';
            effectPill.dataset.instanceId = effectInstance.instanceId;
            effectPill.innerHTML = `<span class="truncate" style="max-width: 60px;">${effectDef.name}</span><button class="remove-btn" title="Remover Efeito">&times;</button>`;
            
            effectPill.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-btn')) return;
                openParameterEditor(effectInstance.instanceId, targetId);
            });
            effectPill.querySelector('.remove-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                let trackEffects = (targetId === 'master') ? APP_STATE.masterEffects : APP_STATE.trackEffects.get(targetId);
                trackEffects = trackEffects.filter(fx => fx.instanceId !== effectInstance.instanceId);
                if (targetId === 'master') {
                    APP_STATE.masterEffects = trackEffects;
                } else {
                    APP_STATE.trackEffects.set(targetId, trackEffects);
                }
                refreshMixerDrawer();
                if (targetId !== 'master' && targetId === currentDrawerTrackId) selectTrack(targetId);
                if (APP_STATE.isPlaying) {
                    if (targetId !== 'master') rebuildAndResumeTrack(targetId);
                }
            });
            rackElement.appendChild(effectPill);
        });
    }
    const addEffectBtn = document.createElement('button');
    addEffectBtn.className = 'add-effect-btn';
    addEffectBtn.textContent = '+';
    addEffectBtn.title = 'Adicionar Efeito';
    addEffectBtn.addEventListener('click', () => {
        APP_STATE.addEffectTarget = targetId;
        openEffectsModal();
    });
    rackElement.appendChild(addEffectBtn);
}

function updateAllMeters() {
    if (!document.getElementById('mixer-drawer')?.classList.contains('open')) {
        meterAnimationId = null;
        return;
    }
    document.querySelectorAll('.channel-strip[data-track-id]').forEach(strip => {
        const targetId = strip.dataset.trackId;
        const fillElement = strip.querySelector('.peak-meter-fill');
        if (!fillElement) return;
        let analyserNode = null;
        if (targetId === 'master') {
            // Analisador do Master a ser implementado
        } else {
            const trackId = parseInt(targetId);
            const trackNodes = APP_STATE.activeTrackNodes.get(trackId);
            if (trackNodes) analyserNode = trackNodes.analyserNode;
        }
        let peak = 0;
        if (analyserNode && APP_STATE.isPlaying) {
            const dataArray = new Float32Array(analyserNode.fftSize);
            analyserNode.getFloatTimeDomainData(dataArray);
            for(let i = 0; i < dataArray.length; i++) {
                const value = Math.abs(dataArray[i]);
                if (value > peak) peak = value;
            }
        }
        fillElement.style.height = `${peak * 100}%`;
    });
    meterAnimationId = requestAnimationFrame(updateAllMeters);
}

function startMeterAnimation() {
    if (!meterAnimationId) meterAnimationId = requestAnimationFrame(updateAllMeters);
}

function stopMeterAnimation() {
    if (meterAnimationId) {
        cancelAnimationFrame(meterAnimationId);
        meterAnimationId = null;
    }
}

// --- Adicionado para seleção de microfone ---
async function getMicrophoneDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.warn("enumerateDevices() não suportado no seu navegador.");
        return [];
    }

    try {
        // Pedir permissão para enumerar dispositivos, caso contrário, pode não listar todos os nomes
        await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(device => device.kind === 'audioinput');
    } catch (err) {
        console.error("Erro ao enumerar dispositivos de áudio:", err);
        // Em caso de erro (permissão negada), ainda tentamos listar os básicos se houver
        return [];
    }
}

async function populateMicrophoneSelect(selectedDeviceId = 'default') {
    const selectElement = DOM.microphoneSelect;
    if (!selectElement) return;

    selectElement.innerHTML = ''; // Limpa as opções existentes

    const devices = await getMicrophoneDevices();
    let defaultFound = false;

    devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Microfone ${device.deviceId.substring(0, 8)}...`;
        if (device.deviceId === selectedDeviceId) {
            option.selected = true;
            defaultFound = true;
        }
        selectElement.appendChild(option);
    });

    // Adiciona uma opção 'Padrão do Sistema' se não houver dispositivos ou se o padrão não foi explicitamente selecionado
    if (!defaultFound) {
        const defaultOption = document.createElement('option');
        defaultOption.value = 'default';
        defaultOption.textContent = 'Padrão do Sistema';
        defaultOption.selected = true; // Seleciona como padrão
        selectElement.prepend(defaultOption); // Adiciona no início da lista
    }
}
// --- Fim da adição para seleção de microfone ---


function updateDrawer(trackData) {
    currentDrawerTrackId = trackData.id;
    DOM.drawerPlaceholder.classList.add('hidden');
    DOM.drawerTrackControls.classList.remove('hidden');
    DOM.drawerTrackName.textContent = trackData.name;
    DOM.drawerVolume.value = trackData.volume;
    DOM.drawerPan.value = trackData.pan;
    DOM.drawerMuteBtn.classList.toggle('active', trackData.isMuted);
    DOM.drawerSoloBtn.classList.toggle('active', trackData.isSoloed);

    DOM.drawerEffectsChain.innerHTML = '';
    const effectsChain = APP_STATE.trackEffects.get(trackData.id);
    if (effectsChain && effectsChain.length > 0) {
        effectsChain.forEach(effectInstance => {
            const effectDef = APP_STATE.allEffects.find(e => e.id === effectInstance.effectId);
            if (!effectDef) return;
            const effectPill = document.createElement('div');
            effectPill.className = 'effect-badge flex items-center justify-between bg-purple-200 text-purple-800 text-sm font-semibold px-2 py-1 rounded-full w-full cursor-pointer hover:bg-purple-300';
            effectPill.dataset.instanceId = effectInstance.instanceId;
            effectPill.innerHTML = `<span>${effectDef.name}</span><button data-instance-id="${effectInstance.instanceId}" class="remove-effect-btn ml-2 text-purple-600 hover:text-purple-900 font-bold">&times;</button>`;
            DOM.drawerEffectsChain.appendChild(effectPill);
        });
    } else {
        DOM.drawerEffectsChain.innerHTML = '<p class="text-xs text-gray-500">Nenhum efeito adicionado.</p>';
    }

    // --- Modificado para seleção de microfone ---
    // Exibe o seletor de microfone apenas quando uma trilha for selecionada e permite a gravação
    if (APP_STATE.userAccessLevel !== 'free') { // Ou outra condição para habilitar a gravação
        DOM.microphoneSelectorContainer.classList.remove('hidden');
        populateMicrophoneSelect(APP_STATE.selectedMicrophoneId); // Preenche e seleciona o ID salvo
    } else {
        DOM.microphoneSelectorContainer.classList.add('hidden');
    }
    // --- Fim da modificação para seleção de microfone ---
}

function updateTrackHeaderData(property, value) {
    if (currentDrawerTrackId === null) return;
    const trackHeader = DOM.trackHeadersContainer.querySelector(`.track-header[data-track-id='${currentDrawerTrackId}']`);
    if (trackHeader) {
        trackHeader.dataset[property] = value;
    }
}

function updateAllTrackStates() {
    if (!APP_STATE.isPlaying) return; 

    const allHeaders = [...DOM.trackHeadersContainer.querySelectorAll('.track-header')];
    const isAnyTrackSoloed = allHeaders.some(h => h.dataset.isSoloed === 'true');

    APP_STATE.activeTrackNodes.forEach((nodes, trackId) => {
        const header = allHeaders.find(h => parseInt(h.dataset.trackId) === trackId);
        if (!header) return;
        const isMuted = header.dataset.isMuted === 'true';
        const isSoloed = header.dataset.isSoloed === 'true';

        if (isAnyTrackSoloed) {
            nodes.muteNode.gain.setTargetAtTime(isSoloed ? 1 : 0, APP_STATE.audioContext.currentTime, 0.01);
        } else {
            nodes.muteNode.gain.setTargetAtTime(isMuted ? 0 : 1, APP_STATE.audioContext.currentTime, 0.01);
        }
    });
}

function initializeDrawer() {
    if (!DOM.drawerHandle || !DOM.drawer) {
        console.error("Elementos da gaveta não encontrados no DOM.");
        return;
    }
    DOM.drawerHandle.addEventListener('click', (e) => {
        if (e.target.id === 'drawer-mix-btn') return;
        DOM.drawer.classList.toggle('open');
    });

    document.getElementById('drawer-mix-btn')?.addEventListener('click', openMixerDrawer);
    document.getElementById('close-mixer-btn')?.addEventListener('click', closeMixerDrawer);
    
    DOM.drawerVolume.addEventListener('input', e => {
        const newVolume = parseFloat(e.target.value);
        updateTrackHeaderData('volume', newVolume);
        const faderInMixer = document.querySelector(`.channel-strip[data-track-id="${currentDrawerTrackId}"] .volume-fader`);
        if(faderInMixer) {
            faderInMixer.value = newVolume;
            faderInMixer.style.setProperty('--fader-fill', `${(newVolume / 1.5) * 100}%`);
        }
        if (APP_STATE.isPlaying) {
            const trackNodes = APP_STATE.activeTrackNodes.get(currentDrawerTrackId);
            if (trackNodes?.volumeNode) trackNodes.volumeNode.gain.setTargetAtTime(newVolume, APP_STATE.audioContext.currentTime, 0.01);
        }
    });
    DOM.drawerPan.addEventListener('input', e => {
        const newPan = parseInt(e.target.value);
        updateTrackHeaderData('pan', newPan);
        const panInMixer = document.querySelector(`.channel-strip[data-track-id="${currentDrawerTrackId}"] .pan-slider`);
        if(panInMixer) panInMixer.value = newPan;
        if (APP_STATE.isPlaying) {
            const trackNodes = APP_STATE.activeTrackNodes.get(currentDrawerTrackId);
            if (trackNodes?.pannerNode) trackNodes.pannerNode.pan.setTargetAtTime(newPan / 100, APP_STATE.audioContext.currentTime, 0.01);
        }
    });
    DOM.drawerMuteBtn.addEventListener('click', e => {
        const isActive = e.target.classList.toggle('active');
        updateTrackHeaderData('isMuted', isActive);
        updateAllTrackStates();
    });
    DOM.drawerSoloBtn.addEventListener('click', e => {
        const isActive = e.target.classList.toggle('active');
        updateTrackHeaderData('isSoloed', isActive);
        updateAllTrackStates();
    });
    DOM.drawerEffectsChain.addEventListener('click', e => {
        const selectedTrackHeader = document.querySelector('.track-header.selected');
        if (!selectedTrackHeader) return;
        
        const trackId = parseInt(selectedTrackHeader.dataset.trackId);
        const removeButton = e.target.closest('.remove-effect-btn');
        const effectBadge = e.target.closest('.effect-badge');

        if (removeButton) {
            e.stopPropagation();
            const instanceIdToRemove = parseInt(removeButton.dataset.instanceId);
            let effects = APP_STATE.trackEffects.get(trackId);
            
            if (effects) {
                APP_STATE.trackEffects.set(trackId, effects.filter(fx => fx.instanceId !== instanceIdToRemove));
                selectTrack(trackId);
                if (APP_STATE.isPlaying) {
                    rebuildAndResumeTrack(trackId);
                }
            }
        } else if (effectBadge) {
            const instanceId = parseInt(effectBadge.dataset.instanceId);
            openParameterEditor(instanceId, trackId);
        }
    });

    // --- Adicionado para seleção de microfone ---
    if (DOM.microphoneSelect) {
        DOM.microphoneSelect.addEventListener('change', (e) => {
            APP_STATE.selectedMicrophoneId = e.target.value;
            console.log("Microfone selecionado:", APP_STATE.selectedMicrophoneId);
        });
    }
    // --- Fim da adição para seleção de microfone ---
}