/**
 * Gerencia a janela modal do editor de parâmetros de efeitos.
 */

function closeParameterEditor() {
    APP_STATE.currentlyEditingEffect = null;
    DOM.parameterEditorModal.classList.add('hidden');
    
    // Limpa o conteúdo dinamicamente carregado ao fechar
    DOM.parameterEditorBody.innerHTML = ''; 
    DOM.parameterEditorSpecificUIContainer.innerHTML = '';
}

/**
 * Cria um controle de slider para um parâmetro e anexa seus eventos.
 * Esta função agora lida com parâmetros simples e parâmetros de banda (para o EQ).
 */
function createParameterSlider(paramDef, effectInstance, container, bandIndex = -1, paramKey = '') {
    // console.log('createParameterSlider called for:', paramDef.name || paramKey, 'ID:', paramDef.id);
    const { trackId, instanceId } = effectInstance;
    let currentValue;
    let parameterId;

    // Lida com a estrutura de parâmetros aninhada do EQ
    if (bandIndex > -1) {
        currentValue = effectInstance.parameters[bandIndex][paramKey];
        parameterId = `band-${bandIndex}-${paramKey}-${instanceId}`;
    } else {
        currentValue = effectInstance.parameters[paramDef.id];
        parameterId = `param-${paramDef.id}-${instanceId}`;
    }
    
    const controlWrapper = document.createElement('div');
    controlWrapper.className = 'parameter-control';
    
    controlWrapper.innerHTML = `
        <label for="${parameterId}" class="flex justify-between text-sm font-medium text-gray-300">
            <span>${paramDef.name || paramKey.toUpperCase()}</span>
            <span id="value-display-${parameterId}">${parseFloat(currentValue).toFixed(2)}</span>
        </label>
        <input 
            type="range" 
            id="${parameterId}" 
            min="${paramDef.min}" 
            max="${paramDef.max}" 
            step="${paramDef.step || 0.01}" 
            value="${currentValue}"
            class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer mt-1"
        >
    `;
    
    container.appendChild(controlWrapper);

    const slider = document.getElementById(parameterId);
    const valueDisplay = document.getElementById(`value-display-${parameterId}`);

    slider.addEventListener('input', (e) => {
        const newValue = parseFloat(e.target.value);
        valueDisplay.textContent = newValue.toFixed(2);
        
        // Atualiza o estado
        if (bandIndex > -1) {
            effectInstance.parameters[bandIndex][paramKey] = newValue;
        } else {
            effectInstance.parameters[paramDef.id] = newValue;
        }

        if (effectInstance.uiUpdateFunction && typeof effectInstance.uiUpdateFunction === 'function') {
            effectInstance.uiUpdateFunction(effectInstance.parameters);
        }

        if (APP_STATE.isPlaying) {
            const trackNodes = APP_STATE.activeEffectNodes.get(trackId);
            if (trackNodes) {
                const effectNodeObject = trackNodes.get(instanceId);
                if (effectNodeObject && typeof effectNodeObject.update === 'function') {
                    const updateParams = effectInstance.effectId === 'parametric_eq' ? effectInstance.parameters : effectInstance.parameters;
                    effectNodeObject.update(updateParams);
                }
            }
        }
    });
}


/**
 * Abre o editor de parâmetros para uma instância de efeito específica.
 */
async function openParameterEditor(instanceId, trackId) {
    console.log('--- Abrindo Editor de Parâmetros ---');
    const effectsChain = APP_STATE.trackEffects.get(trackId);
    if (!effectsChain) {
        console.warn('Cadeia de efeitos não encontrada para trackId:', trackId);
        return;
    }

    const effectInstance = effectsChain.find(fx => fx.instanceId === instanceId);
    if (!effectInstance) {
        console.warn('Instância de efeito não encontrada para instanceId:', instanceId);
        return;
    }

    const effectDef = APP_STATE.allEffects.find(def => def.id === effectInstance.effectId);
    if (!effectDef) {
        console.warn('Definição de efeito não encontrada para effectId:', effectInstance.effectId);
        return;
    }
    console.log('Efeito Definição encontrada:', effectDef.name, '(ID:', effectDef.id + ')');

    APP_STATE.currentlyEditingEffect = { instanceId, trackId, parameters: effectInstance.parameters };
    DOM.parameterEditorTitle.textContent = `Editando: ${effectDef.name}`;
    
    DOM.parameterEditorBody.innerHTML = ''; 
    DOM.parameterEditorSpecificUIContainer.innerHTML = ''; 

    if (effectDef.ui && effectDef.ui.htmlPath) {
        console.log('Efeito possui UI customizada. HTML Path:', effectDef.ui.htmlPath);
        try {
            const response = await fetch(effectDef.ui.htmlPath);
            if (!response.ok) throw new Error(`Erro ao carregar HTML da UI: ${effectDef.ui.htmlPath}`);
            const uiHtml = await response.text();
            DOM.parameterEditorSpecificUIContainer.innerHTML = uiHtml;
            console.log('HTML da UI injetado.');

            if (effectDef.ui.jsPath) {
                console.log('Efeito possui JS da UI. JS Path:', effectDef.ui.jsPath);
                const oldScript = document.getElementById(`effect-ui-script-${effectDef.id}`);
                if (oldScript) {
                    oldScript.remove();
                    console.log('Script UI antigo removido:', oldScript.id);
                }

                const script = document.createElement('script');
                script.id = `effect-ui-script-${effectDef.id}`;
                script.src = effectDef.ui.jsPath;
                script.onload = () => {
                    const initFunctionName = `init${effectDef.id.replace(/_([a-z])/g, (g) => g[1].toUpperCase()).charAt(0).toUpperCase() + effectDef.id.replace(/_([a-z])/g, (g) => g[1].toUpperCase()).slice(1)}UI`;
                    
                    console.log(`Attempting to call ${initFunctionName} from dynamically loaded script.`);
                    if (typeof window[initFunctionName] === 'function') {
                        console.log(`Function ${initFunctionName} FOUND.`);
                        const uiElements = window[initFunctionName](effectInstance, DOM, createParameterSlider);

                        effectInstance.uiUpdateFunction = (updatedParams) => {
                            if (uiElements && uiElements.update) {
                                uiElements.update(updatedParams);
                            }
                        };
                        effectInstance.uiUpdateFunction(effectInstance.parameters);
                        console.log('UI initialization function called and update handler stored.');

                    } else {
                        console.warn(`Função de inicialização UI '${initFunctionName}' NÃO encontrada (typeof é ${typeof window[initFunctionName]}) para o efeito '${effectDef.id}'.`);
                    }
                };
                script.onerror = (err) => {
                    console.error(`Erro ao carregar JS da UI: ${effectDef.ui.jsPath}`, err);
                    DOM.parameterEditorSpecificUIContainer.innerHTML = '<p class="text-red-400">Erro ao carregar interface do efeito.</p>';
                };
                document.body.appendChild(script);
            } else {
                console.log('Efeito não possui JS da UI (effectDef.ui.jsPath não definido).');
            }
        } catch (error) {
            console.error('Erro ao carregar UI específica do efeito:', error);
            DOM.parameterEditorSpecificUIContainer.innerHTML = '<p class="text-red-400">Erro ao carregar interface do efeito.</p>';
        }
    } else { // UI Genérica (sliders padrão) - Lógica de fallback se não houver UI customizada
        console.log('Efeito usa UI Genérica (sem HTML Path customizado).');
        DOM.parameterEditorBody.style.display = 'block';
        if (effectDef.parameters) {
            effectDef.parameters.forEach(paramDef => {
                createParameterSlider(paramDef, effectInstance, DOM.parameterEditorBody);
            });
        } else if (effectDef.bands) {
             effectDef.bands.forEach((bandDef, index) => {
                Object.keys(bandDef).forEach(key => {
                    if (typeof bandDef[key] === 'object' && bandDef[key].defaultValue !== undefined) {
                        const paramInfo = { name: `${bandDef.id.toUpperCase()} ${key.charAt(0).toUpperCase() + key.slice(1)}`, ...bandDef[key] };
                        createParameterSlider(paramInfo, effectInstance, DOM.parameterEditorBody, index, key);
                    }
                });
            });
        }
    }
    
    if (!effectDef.ui || !effectDef.ui.htmlPath) {
         DOM.parameterEditorBody.style.display = 'block';
         DOM.parameterEditorSpecificUIContainer.style.display = 'none';
    } else {
         DOM.parameterEditorBody.style.display = 'none';
         DOM.parameterEditorSpecificUIContainer.style.display = 'block';
    }

    DOM.parameterEditorModal.classList.remove('hidden');
    console.log('--- Editor de Parâmetros aberto ---');
}

/**
 * Inicializa os eventos básicos da janela do editor de parâmetros.
 */
function initializeParameterEditor() {
    if (!DOM.parameterEditorModal || !DOM.parameterEditorCloseBtn) {
        console.error('Elementos do editor de parâmetros não encontrados no DOM.');
        return;
    }
    DOM.parameterEditorCloseBtn.addEventListener('click', closeParameterEditor);
    DOM.parameterEditorModal.addEventListener('click', (e) => {
        if (e.target === DOM.parameterEditorModal) {
            closeParameterEditor();
        }
    });
}