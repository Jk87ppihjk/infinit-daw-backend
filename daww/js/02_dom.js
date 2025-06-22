// app/js/02_dom.js

// Define o objeto DOM e preenche suas propriedades diretamente.
const DOM = {
    rulerContainer: document.getElementById('ruler-container'),
    ruler: document.getElementById('ruler'),
    timelineScrollContainer: document.getElementById('timeline-scroll-container'),
    timelineContent: document.getElementById('timeline-content'),
    trackHeadersContainer: document.getElementById('track-headers-container'),
    playhead: document.getElementById('playhead'),
    playheadDragger: document.getElementById('playhead-dragger'),
    gridBackground: document.querySelector('.grid-background'),
    
    // Controles
    playBtn: document.getElementById('play-btn'),
    stopBtn: document.getElementById('stop-btn'),
    recordBtn: document.getElementById('record-btn'),
    bpmInput: document.getElementById('bpm'),
    snapToggleBtn: document.getElementById('snap-toggle-btn'),
    metronomeBtn: document.getElementById('metronome-btn'),
    loopToggleBtn: document.getElementById('loop-toggle-btn'),
    addTrackBtn: document.getElementById('add-track-btn'),
    importAudioBtn: document.getElementById('import-audio-btn'),
    userDisplayName: document.getElementById('user-display-name'),

    // Menus de Contexto
    clipContextMenu: document.getElementById('clip-context-menu'),
    contextSplitBtn: document.getElementById('context-split'),
    contextCopyBtn: document.getElementById('context-copy'),
    contextDeleteBtn: document.getElementById('context-delete'),
    trackContextMenu: document.getElementById('track-context-menu'),
    contextPasteBtn: document.getElementById('context-paste'),

    // Gaveta (Drawer)
    drawer: document.getElementById('bottom-drawer'),
    drawerHandle: document.getElementById('drawer-handle'),
    drawerContent: document.getElementById('drawer-content'),
    drawerPlaceholder: document.getElementById('drawer-placeholder'),
    drawerTrackControls: document.getElementById('drawer-track-controls'),
    drawerTrackName: document.getElementById('drawer-track-name'),
    drawerVolume: document.getElementById('drawer-volume'),
    drawerPan: document.getElementById('drawer-pan'),
    drawerMuteBtn: document.getElementById('drawer-mute-btn'),
    drawerSoloBtn: document.getElementById('drawer-solo-btn'),
    drawerEffectsBtn: document.getElementById('drawer-effects-btn'),
    drawerEffectsChain: document.getElementById('drawer-effects-chain'),
    
    // --- Adicionado para seleção de microfone ---
    microphoneSelectorContainer: document.getElementById('microphone-selector-container'),
    microphoneSelect: document.getElementById('microphone-select'),
    // --- Fim da adição para seleção de microfone ---

    // Input de arquivo global
    audioFileInput: document.getElementById('audio-file-input'),

    // Janela Modal de Efeitos
    effectsModal: document.getElementById('effects-modal'),
    effectsModalContent: document.getElementById('effects-modal-content'),
    effectsModalCloseBtn: document.getElementById('effects-modal-close-btn'),
    effectsSearchInput: document.getElementById('effects-search-input'),
    effectsModalFilters: document.getElementById('effects-modal-filters'),
    effectsModalGrid: document.getElementById('effects-modal-grid'),

    // Janela Modal do Editor de Parâmetros
    parameterEditorModal: document.getElementById('parameter-editor-modal'),
    parameterEditorTitle: document.getElementById('parameter-editor-title'),
    parameterEditorCloseBtn: document.getElementById('parameter-editor-close-btn'),
    parameterEditorBody: document.getElementById('parameter-editor-body'),
    
    parameterEditorSpecificUIContainer: document.getElementById('parameter-editor-specific-ui-container'),

    // Menu Principal (Hambúrguer)
    hamburgerBtn: document.getElementById('hamburger-btn'),
    mainMenu: document.getElementById('main-menu'),
    menuNewBtn: document.getElementById('menu-new'),
    menuOpenBtn: document.getElementById('menu-open'),
    menuSaveBtn: document.getElementById('menu-save'),
    menuExportBtn: document.getElementById('menu-export'),
    menuLogoutBtn: document.getElementById('menu-logout-btn'),

    // Loader
    exportLoader: document.getElementById('export-loader'),
};