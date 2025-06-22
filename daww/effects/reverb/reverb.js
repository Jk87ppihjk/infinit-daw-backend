/**
 * Gera uma Impulse Response (IR) simples para um ConvolverNode.
 * Esta IR simula um decaimento básico para reverb.
 * @param {AudioContext} audioContext - O AudioContext.
 * @param {number} duration - Duração total da IR em segundos.
 * @param {number} decayRate - Taxa de decaimento (maior = mais rápido o decaimento).
 * @returns {AudioBuffer} O AudioBuffer contendo a IR.
 */
function generateImpulseResponse(audioContext, duration, decayRate) {
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * duration;
    const impulse = audioContext.createBuffer(2, length, sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        // Ruído branco com decaimento exponencial
        impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - (i / length), decayRate);
        impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - (i / length), decayRate);
    }
    return impulse;
}

/**
 * ===================================================================
 * === CORREÇÃO APLICADA AQUI ========================================
 * ===================================================================
 * Inicializa a UI do Reverb.
 * @param {object} effectInstance - A instância COMPLETA do efeito Reverb.
 * @param {object} DOM_elements - O objeto DOM global para acesso a elementos.
 * @param {function} createSliderFn - A função para criar sliders, passada do parameterEditor.
 */
function initReverbUI(effectInstance, DOM_elements, createSliderFn) {
    console.log('initReverbUI: Função de inicialização do Reverb chamada.');
    
    const slidersContainer = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#reverb-sliders-container');
    const presetSelect = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#reverb-preset-select');
    
    // Limpa sliders antigos se houver
    if (slidersContainer) {
        slidersContainer.innerHTML = ''; 
    }

    const effectDef = APP_STATE.allEffects.find(def => def.id === 'reverb');

    if (effectDef && effectDef.parameters) {
        // --- LÓGICA DE LOOP CORRIGIDA ---
        // Itera sobre as chaves (IDs) e valores (definições) dos parâmetros
        Object.entries(effectDef.parameters).forEach(([paramId, paramDef]) => {
            // Adiciona o ID ao objeto de definição do parâmetro para compatibilidade
            const fullParamDef = { ...paramDef, id: paramId };

            // O Bypass é um conceito legado, não vamos criar um slider para ele.
            // A lógica de bypass real está no motor de áudio.
            if (fullParamDef.type === 'slider') {
                 createSliderFn(fullParamDef, effectInstance, slidersContainer);
            }
        });
    }

    // --- Lógica de Presets (sem alterações, mas mantida) ---
    if (effectDef && effectDef.presets && presetSelect) {
        // Limpa opções antigas para evitar duplicação ao reabrir
        presetSelect.innerHTML = '<option value="">-- Selecione um Preset --</option>';
        
        effectDef.presets.forEach((preset, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = preset.name;
            presetSelect.appendChild(option);
        });

        // Remove listener antigo para evitar múltiplos gatilhos
        const newPresetSelect = presetSelect.cloneNode(true);
        presetSelect.parentNode.replaceChild(newPresetSelect, presetSelect);

        newPresetSelect.addEventListener('change', (e) => {
            const selectedIndex = parseInt(e.target.value);
            if (selectedIndex >= 0 && effectDef.presets[selectedIndex]) {
                const selectedPreset = effectDef.presets[selectedIndex];
                
                // Aplica os valores do preset aos parâmetros da instância do efeito
                Object.keys(selectedPreset).forEach(key => {
                    if(effectInstance.parameters[key] !== undefined) {
                        effectInstance.parameters[key] = selectedPreset[key];
                    }
                });

                // Atualiza a UI dos sliders para refletir os novos valores
                Object.entries(selectedPreset).forEach(([key, value]) => {
                     const slider = document.getElementById(`param-${key}-${effectInstance.instanceId}`);
                     const valueDisplay = document.getElementById(`value-display-param-${key}-${effectInstance.instanceId}`);
                     if (slider) slider.value = value;
                     if (valueDisplay) valueDisplay.textContent = parseFloat(value).toFixed(2);
                });
                
                // Atualiza o motor de áudio em tempo real
                if (APP_STATE.isPlaying) {
                    const trackNodes = APP_STATE.activeEffectNodes.get(effectInstance.trackId);
                    if (trackNodes) {
                        const effectNodeObject = trackNodes.get(effectInstance.instanceId);
                        if (effectNodeObject && typeof effectNodeObject.update === 'function') {
                            effectNodeObject.update(effectInstance.parameters);
                        }
                    }
                }
            }
        });
    }

    // O retorno pode ser um objeto vazio se não houver UI dinâmica para atualizar
    return {
        update: (updatedParams) => {
            // Nenhuma atualização visual dinâmica necessária para este efeito
        }
    };
}