// app/js/10_main.js - VERSÃO FINAL APONTANDO PARA O SERVIDOR NA NUVEM

/**
 * Aplica o estado de mixagem (volume, pan, etc.) salvo no localStorage
 * aos elementos de cabeçalho de trilha existentes na DAW.
 */
function applyStateFromStorage() {
    const stateJSON = localStorage.getItem('daw_project_state');
    if (!stateJSON) return;

    const projectState = JSON.parse(stateJSON);

    if (projectState && projectState.tracks) {
        projectState.tracks.forEach(trackData => {
            const header = document.querySelector(`.track-header[data-track-id='${trackData.id}']`);
            if (header) {
                header.dataset.volume = trackData.volume;
                header.dataset.pan = trackData.pan;
                header.dataset.isMuted = trackData.isMuted;
                header.dataset.isSoloed = trackData.isSoloed;

                // Atualiza a gaveta se a trilha estiver selecionada
                if (header.classList.contains('selected')) {
                    selectTrack(trackData.id);
                }
            }
        });
        console.log('Estado de mixagem do localStorage aplicado às trilhas.');
    }
}


function logout() {
    const auth = firebase.auth();
    if (auth.currentUser) {
        auth.signOut().then(() => {
            window.location.href = "login.html";
        }).catch((error) => {
            console.error("Logout Error", error);
            alert("Ocorreu um erro ao sair.");
        });
    } else {
        window.location.href = "login.html";
    }
}

function initializeMainMenu() {
    if (DOM.hamburgerBtn && DOM.mainMenu) {
        DOM.hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            DOM.mainMenu.classList.toggle('hidden');
        });
    }

    if (DOM.menuLogoutBtn) {
        DOM.menuLogoutBtn.addEventListener('click', logout);
    }

    document.addEventListener('click', (e) => {
        if (!DOM.mainMenu.classList.contains('hidden') &&
            DOM.hamburgerBtn && !DOM.hamburgerBtn.contains(e.target) &&
            !DOM.mainMenu.contains(e.target)) {
            DOM.mainMenu.classList.add('hidden');
        }
    });

    DOM.menuNewBtn.addEventListener('click', () => {
        localStorage.removeItem('daw_project_state'); // Limpa o estado ao criar novo projeto
        clearProject();
        DOM.mainMenu.classList.add('hidden');
    });
    DOM.menuOpenBtn.addEventListener('click', () => {
        triggerLoadDialog();
        DOM.mainMenu.classList.add('hidden');
    });
    DOM.menuSaveBtn.addEventListener('click', (e) => {
        if (!e.target.classList.contains('disabled-feature')) {
            saveProject();
        }
        DOM.mainMenu.classList.add('hidden');
    });
    DOM.menuExportBtn.addEventListener('click', () => {
        exportProjectToWav();
        DOM.mainMenu.classList.add('hidden');
    });
}

function initializeGlobalListeners() {
    document.addEventListener('click', (e) => {
        if (DOM.clipContextMenu && !DOM.clipContextMenu.contains(e.target) && DOM.clipContextMenu.style.display === 'block') {
            DOM.clipContextMenu.style.display = 'none';
        }
        if (DOM.trackContextMenu && !DOM.trackContextMenu.contains(e.target) && DOM.trackContextMenu.style.display === 'block') {
            DOM.trackContextMenu.style.display = 'none';
        }
    });

    document.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('#timeline-content') && !e.target.closest('#track-headers-container') && !e.target.closest('.clip') && !e.target.closest('.track-lane')) {
            e.preventDefault();
        }
    });

    if (DOM.timelineScrollContainer && DOM.trackHeadersContainer && DOM.rulerContainer) {
        DOM.timelineScrollContainer.addEventListener('scroll', () => {
            DOM.trackHeadersContainer.scrollTop = DOM.timelineScrollContainer.scrollTop;
            DOM.rulerContainer.scrollLeft = DOM.timelineScrollContainer.scrollLeft;
        });
        DOM.trackHeadersContainer.addEventListener('scroll', () => {
            DOM.timelineScrollContainer.scrollTop = DOM.trackHeadersContainer.scrollTop;
        });
    }
}


async function verificarAssinaturaDoUsuario(user) {
    if (!user || !user.email) {
        return 'free';
    }
    try {
        const urlDoServidor = 'https://infinit-daw-backend.onrender.com';
        const response = await fetch(`${urlDoServidor}/verificar-assinatura`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userEmail: user.email })
        });
        if (!response.ok) {
            console.error('Erro na resposta do servidor. Assumindo acesso "free".');
            return 'free';
        }
        const data = await response.json();
        return data.accessLevel;
    } catch (error) {
        console.error('Não foi possível conectar ao servidor para verificar a assinatura.', error);
        alert("Não foi possível conectar ao servidor de licenças. O modo offline (gratuito) será ativado.");
        return 'free';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const startApp = async (user) => {
        let accessLevel = 'free';
        const urlParams = new URLSearchParams(window.location.search);
        const isDevMode = urlParams.get('dev') === 'true';

        if (isDevMode) {
             console.log("MODO DEV ATIVADO: Acesso total concedido.");
             accessLevel = 'producer';
        } else {
            accessLevel = await verificarAssinaturaDoUsuario(user);
        }

        APP_STATE.userAccessLevel = accessLevel;
        console.log(`[App] Nível de acesso final definido como: ${APP_STATE.userAccessLevel}`);

        if (user && DOM.userDisplayName) {
            let userName = user.displayName || user.email;
            DOM.userDisplayName.textContent = userName;
        } else if (isDevMode && DOM.userDisplayName) {
            DOM.userDisplayName.textContent = 'Desenvolvedor';
        }

        try {
            APP_STATE.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error("Web Audio API não é suportada.", e);
            alert("O seu navegador não suporta a Web Audio API, que é essencial para esta aplicação funcionar.");
            return;
        }

        initializeGlobalListeners();
        initializeControls();
        createRuler();
        initializePlayheadEvents();
        initializeClipEditingEvents();
        initializeContextMenuEvents();
        initializeDragAndDrop();
        initializeDrawer();
        initializeEffectsModal();
        initializeParameterEditor();
        initializeMainMenu();
        
        // Só cria trilhas padrão se não houver estado salvo
        if (!localStorage.getItem('daw_project_state')) {
            addTrack();
            addTrack();
        }
        
        movePlayhead(0);
        
        // Aplica o estado do mixer, se existir
        applyStateFromStorage();
        
        applyFeatureRestrictions(APP_STATE.userAccessLevel);
    };

    const firebaseConfig = {
        apiKey: "AIzaSyDmf1rOk04ilQgHsoyGy90gg7VUm8O5V0g",
        authDomain: "meuprimeirosite-70348.firebaseapp.com",
        projectId: "meuprimeirosite-70348",
        storageBucket: "meuprimeirosite-70348.firebasestorage.app",
        messagingSenderId: "297062996692",
        appId: "1:297062996692:web:2863162f2f7c34ebdaf941",
        measurementId: "G-BZPEX75PHF"
    };
    
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    const auth = firebase.auth();

    auth.onAuthStateChanged((user) => {
        const urlParams = new URLSearchParams(window.location.search);
        const isDevMode = urlParams.get('dev') === 'true';
        if (user || isDevMode) {
            startApp(user);
        } else {
            console.log("Nenhum usuário logado. Redirecionando para a página de login.");
            window.location.href = "login.html";
        }
    });
});