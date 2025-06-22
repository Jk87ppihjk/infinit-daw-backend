// www/js/mixer.js

document.addEventListener('DOMContentLoaded', () => {
    const mixerContainer = document.getElementById('mixer-container');
    const masterFader = document.getElementById('master-fader');
    let projectState = null;

    /**
     * Carrega o estado do projeto do localStorage e constrói a UI do mixer.
     */
    function loadProjectStateAndBuildMixer() {
        const stateJSON = localStorage.getItem('daw_project_state');
        projectState = stateJSON ? JSON.parse(stateJSON) : null;

        if (!projectState || !projectState.tracks) {
            console.warn("Nenhum estado de projeto encontrado para o mixer.");
            mixerContainer.innerHTML = '<p style="text-align: center; width: 100%;">Nenhuma trilha encontrada. Volte para a DAW e adicione algumas trilhas.</p>';
            return;
        }

        const existingStrips = mixerContainer.querySelectorAll('.channel-strip:not(.master)');
        existingStrips.forEach(strip => strip.remove());

        projectState.tracks.forEach(trackData => {
            const channelStrip = createChannelStrip(trackData);
            mixerContainer.insertBefore(channelStrip, masterFader.parentElement);
        });
    }

    /**
     * Salva uma alteração específica de uma trilha no localStorage.
     * @param {number} trackId - O ID da trilha que foi alterada.
     * @param {string} property - A propriedade que mudou (ex: 'volume').
     * @param {any} value - O novo valor da propriedade.
     */
    function updateStateInStorage(trackId, property, value) {
        if (!projectState) return;

        const trackIndex = projectState.tracks.findIndex(t => t.id === trackId);
        if (trackIndex > -1) {
            projectState.tracks[trackIndex][property] = value;
            localStorage.setItem('daw_project_state', JSON.stringify(projectState));
        }
    }

    /**
     * Cria o elemento HTML para uma única faixa de canal e adiciona seus listeners.
     */
    function createChannelStrip(trackData) {
        const strip = document.createElement('div');
        strip.className = 'channel-strip';
        strip.dataset.trackId = trackData.id;

        strip.innerHTML = `
            <div class="fader-container">
                <input type="range" min="0" max="1.5" step="0.01" value="${trackData.volume}" class="volume-fader" title="Volume">
            </div>
            <div class="pan-control">
                <label>PAN</label>
                <input type="range" min="-100" max="100" value="${trackData.pan}" title="Pan">
            </div>
            <div class="solo-mute-buttons">
                <button class="mute ${trackData.isMuted ? 'active' : ''}" title="Mute">M</button>
                <button class="solo ${trackData.isSoloed ? 'active' : ''}" title="Solo">S</button>
            </div>
            <div class="track-name" title="${trackData.name}">${trackData.name}</div>
        `;

        const volumeFader = strip.querySelector('.volume-fader');
        const panSlider = strip.querySelector('.pan-control input');
        const muteBtn = strip.querySelector('.mute');
        const soloBtn = strip.querySelector('.solo');
        const trackId = trackData.id;

        volumeFader.addEventListener('input', (e) => updateStateInStorage(trackId, 'volume', parseFloat(e.target.value)));
        panSlider.addEventListener('input', (e) => updateStateInStorage(trackId, 'pan', parseInt(e.target.value)));
        muteBtn.addEventListener('click', (e) => {
            e.target.classList.toggle('active');
            updateStateInStorage(trackId, 'isMuted', e.target.classList.contains('active'));
        });
        soloBtn.addEventListener('click', (e) => {
            e.target.classList.toggle('active');
            updateStateInStorage(trackId, 'isSoloed', e.target.classList.contains('active'));
        });

        return strip;
    }

    loadProjectStateAndBuildMixer();
});