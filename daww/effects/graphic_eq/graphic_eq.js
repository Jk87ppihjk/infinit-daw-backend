/**
 * Inicializa a UI do Equalizador Gráfico de 10 bandas.
 * @param {object} effectInstance - A instância COMPLETA do efeito.
 * @param {object} DOM_elements - O objeto DOM global para acesso a elementos.
 */
function initGraphicEqUI(effectInstance, DOM_elements) {
    const bandsContainer = DOM_elements.parameterEditorSpecificUIContainer.querySelector('#graphic-eq-bands-container');
    if (!bandsContainer) {
        console.error("Container de bandas do EQ Gráfico não encontrado.");
        return { update: () => {} };
    }

    // Limpa o container para garantir que não haja duplicatas ao reabrir
    bandsContainer.innerHTML = '';

    // Busca a definição do efeito no estado da aplicação para obter os parâmetros das bandas
    const effectDef = APP_STATE.allEffects.find(def => def.id === 'graphic_eq');
    if (!effectDef || !effectDef.parameters) {
        console.error("Definição ou parâmetros para o EQ Gráfico não encontrados.");
        return { update: () => {} };
    }

    // Itera sobre cada parâmetro (banda) definido no manifest.json e cria um slider
    effectDef.parameters.forEach(paramDef => {
        const band = document.createElement('div');
        band.className = 'band';

        const sliderWrapper = document.createElement('div');
        sliderWrapper.className = 'slider-wrapper';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = paramDef.min;
        slider.max = paramDef.max;
        slider.step = paramDef.step;
        // Define o valor inicial do slider com base no valor da instância do efeito
        slider.value = effectInstance.parameters[paramDef.id];
        slider.setAttribute('aria-label', `Ganho para ${paramDef.name}`);

        const label = document.createElement('label');
        label.textContent = paramDef.name;

        // Adiciona o listener de evento que faz a mágica acontecer
        slider.addEventListener('input', () => {
            const newValue = parseFloat(slider.value);
            // Atualiza o valor do parâmetro na instância atual do efeito
            effectInstance.parameters[paramDef.id] = newValue;

            // Se a música estiver tocando, atualiza o motor de áudio em tempo real
            if (APP_STATE.isPlaying) {
                const { trackId, instanceId } = effectInstance;
                const trackNodes = APP_STATE.activeEffectNodes.get(trackId);
                if (trackNodes) {
                    const effectNodeObject = trackNodes.get(instanceId);
                    if (effectNodeObject && typeof effectNodeObject.update === 'function') {
                        // Envia todos os parâmetros atualizados para o nó de áudio
                        effectNodeObject.update(effectInstance.parameters);
                    }
                }
            }
        });
        
        // Monta a estrutura HTML de cada banda
        sliderWrapper.appendChild(slider);
        band.appendChild(sliderWrapper);
        band.appendChild(label);
        bandsContainer.appendChild(band);
    });

    // Esta função de 'update' não é criticamente necessária para este efeito,
    // pois não há um gráfico dinâmico para redesenhar.
    return {
        update: (updatedParams) => {
            console.log("Graphic EQ UI update called (sem ação visual)", updatedParams);
        }
    };
}