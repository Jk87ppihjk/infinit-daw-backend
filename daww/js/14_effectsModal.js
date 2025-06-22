// app/js/14_effectsModal.js - VERSÃO CORRIGIDA COM LIMITE DE 3 EFEITOS

/**
 * Lida com a abertura, preenchimento e interatividade da janela modal de efeitos.
 */

function openEffectsModal() {
    if (DOM.effectsModal) {
        DOM.effectsModal.classList.remove('hidden');
    }
}

function closeEffectsModal() {
    if (DOM.effectsModal) {
        DOM.effectsModal.classList.add('hidden');
    }
}

function renderEffects(effectsToRender) {
    DOM.effectsModalGrid.innerHTML = ''; 
    
    console.log("RENDER_EFFECTS: Renderizando", effectsToRender.length, "efeitos:", effectsToRender.map(e => e.id));

    effectsToRender.forEach(effect => {
        const effectCard = document.createElement('div');
        effectCard.className = 'effect-card bg-gray-700 p-4 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer hover:bg-purple-700 hover:scale-105 transition-transform';
        effectCard.dataset.effectId = effect.id;
        effectCard.dataset.category = effect.category;

        effectCard.innerHTML = `
            <h3 class="text-lg font-bold">${effect.name}</h3>
            <p class="text-sm text-gray-400 mt-2">${effect.description}</p>
        `;
        DOM.effectsModalGrid.appendChild(effectCard);
    });
}

async function populateEffectsModal() {
    console.log("POPULATE_EFFECTS_MODAL: Função chamada.");
    
    if (APP_STATE.allEffects.length > 0) {
        console.log("POPULATE_EFFECTS_MODAL: Efeitos já carregados. Apenas renderizando novamente.");
        renderEffects(APP_STATE.allEffects);
        return; 
    }

    try {
        console.log("POPULATE_EFFECTS_MODAL: Buscando o manifest principal em 'manifest.json'...");
        const response = await fetch('manifest.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const masterManifest = await response.json();
        console.log("POPULATE_EFFECTS_MODAL: Manifest principal carregado com sucesso:", masterManifest);

        const effectPromises = masterManifest.effects.map(async (effectEntry) => {
            console.log(`POPULATE_EFFECTS_MODAL: Tentando buscar o manifesto para o efeito '${effectEntry.id}' em '${effectEntry.manifest}'`);
            const effectManifestResponse = await fetch(effectEntry.manifest);
            
            if (!effectManifestResponse.ok) {
                console.error(`ERRO: Falha ao carregar o manifesto do efeito: ${effectEntry.manifest}. Status: ${effectManifestResponse.status}`);
                return null;
            }
            
            console.log(`POPULATE_EFFECTS_MODAL: Manifesto para '${effectEntry.id}' carregado com sucesso.`);
            return effectManifestResponse.json();
        });

        const loadedEffects = await Promise.all(effectPromises);
        console.log("POPULATE_EFFECTS_MODAL: Todos os manifestos individuais foram processados.");

        APP_STATE.allEffects = loadedEffects.filter(effect => effect !== null);
        
        renderEffects(APP_STATE.allEffects);

        DOM.effectsModalFilters.innerHTML = '';
        const categories = ['Todos', ...new Set(APP_STATE.allEffects.map(effect => effect.category))];
        categories.forEach(category => {
            const filterButton = document.createElement('button');
            filterButton.className = 'filter-btn bg-gray-600 px-3 py-1 rounded-full text-sm hover:bg-purple-600 transition-colors';
            filterButton.textContent = category;
            filterButton.dataset.category = category;
            if (category === 'Todos') {
                filterButton.classList.add('active', 'bg-purple-600'); 
            }
            DOM.effectsModalFilters.appendChild(filterButton);
        });

    } catch (error) {
        console.error("POPULATE_EFFECTS_MODAL: Erro crítico ao carregar manifestos:", error);
        DOM.effectsModalGrid.innerHTML = '<p class="text-red-500">Erro ao carregar efeitos. Verifique o console (F12).</p>';
    }
}

function initializeEffectsModal() {
    const effectsButtonInDrawer = DOM.drawerEffectsBtn;

    if (!effectsButtonInDrawer || !DOM.effectsModal || !DOM.effectsModalCloseBtn) {
        console.error('Elementos da janela de efeitos ou seu botão de gatilho não encontrados no DOM.');
        return;
    }

    effectsButtonInDrawer.addEventListener('click', () => {
        populateEffectsModal();
        openEffectsModal();
    });

    DOM.effectsModalCloseBtn.addEventListener('click', closeEffectsModal);

    DOM.effectsModal.addEventListener('click', (e) => {
        if (e.target === DOM.effectsModal) {
            closeEffectsModal();
        }
    });

    const applyFilters = () => {
        const searchTerm = DOM.effectsSearchInput.value.toLowerCase();
        const activeFilter = DOM.effectsModalFilters.querySelector('.filter-btn.active');
        const activeCategory = activeFilter ? activeFilter.dataset.category : 'Todos';

        const filteredEffects = APP_STATE.allEffects.filter(effect => {
            const matchesCategory = (activeCategory === 'Todos' || effect.category === activeCategory);
            const matchesSearch = (effect.name.toLowerCase().includes(searchTerm) || effect.description.toLowerCase().includes(searchTerm));
            return matchesCategory && matchesSearch;
        });

        renderEffects(filteredEffects);
    };

    DOM.effectsSearchInput.addEventListener('input', applyFilters);

    DOM.effectsModalFilters.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            DOM.effectsModalFilters.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active', 'bg-purple-600');
            });
            e.target.classList.add('active', 'bg-purple-600');
            applyFilters();
        }
    });

    DOM.effectsModalGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.effect-card');
        if (!card) return;

        const selectedTrackHeader = document.querySelector('.track-header.selected');
        if (!selectedTrackHeader) {
            alert('Erro: Nenhuma trilha selecionada.');
            return;
        }

        const trackId = parseInt(selectedTrackHeader.dataset.trackId);
        const effectId = card.dataset.effectId;
        
        // ==========================================================
        // ===== MUDANÇA PRINCIPAL AQUI =============================
        // ==========================================================
        // Antes de adicionar o efeito, verificamos o nível de acesso e o número de efeitos na trilha.
        if (APP_STATE.userAccessLevel === 'free') {
            const currentEffectsOnTrack = APP_STATE.trackEffects.get(trackId) || [];
            if (currentEffectsOnTrack.length >= 3) {
                alert('Você atingiu o limite de 3 efeitos por trilha para o plano gratuito. Faça o upgrade para ter efeitos ilimitados!');
                return; // Impede a adição do novo efeito.
            }
        }

        const effectDefinition = APP_STATE.allEffects.find(fx => fx.id === effectId);
        if (!effectDefinition) return;

        const newEffectInstance = {
            instanceId: APP_STATE.nextEffectInstanceId++,
            effectId: effectId,
            trackId: trackId, 
            parameters: {}
        };

        if (effectId === 'parametric_eq') {
            newEffectInstance.parameters = [];
        } else if (effectDefinition.parameters) {
            if (Array.isArray(effectDefinition.parameters)) {
                effectDefinition.parameters.forEach(param => {
                    newEffectInstance.parameters[param.id] = param.defaultValue;
                });
            } else if (typeof effectDefinition.parameters === 'object') {
                for (const paramId in effectDefinition.parameters) {
                    if (Object.hasOwnProperty.call(effectDefinition.parameters, paramId)) {
                        newEffectInstance.parameters[paramId] = effectDefinition.parameters[paramId].defaultValue;
                    }
                }
            }
        }

        const currentEffects = APP_STATE.trackEffects.get(trackId);
        if (currentEffects) {
             currentEffects.push(newEffectInstance);
        } else {
            APP_STATE.trackEffects.set(trackId, [newEffectInstance]);
        }

        closeEffectsModal();
        selectTrack(trackId);

        if (APP_STATE.isPlaying) {
            rebuildAndResumeTrack(trackId);
        }
    });
}