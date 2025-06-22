// app/js/01_state.js

const APP_STATE = {
    bpm: 120,
    isSnapEnabled: true,
    isMetronomeEnabled: false,
    clipboard: null,

    userAccessLevel: 'free',

    // --- Adicionado para seleção de microfone ---
    selectedMicrophoneId: 'default', // 'default' ou o deviceId do microfone selecionado
    // --- Fim da adição para seleção de microfone ---

    currentTrackHeight: 80,
    minTrackHeight: 40,
    maxTrackHeight: 200,

    nextTrackId: 1,
    nextClipId: 1, 
    clipAudioBuffers: new Map(), 
    audioContext: null, 

    // Efeitos
    allEffects: [],
    trackEffects: new Map(),
    masterEffects: [], 
    nextEffectInstanceId: 1,
    currentlyEditingEffect: null,
    addEffectTarget: null, // NOVO: Guarda o alvo (trilha ou master) ao adicionar um efeito

    // Motor de Áudio
    isPlaying: false,
    scheduledSources: [],
    activeEffectNodes: new Map(),
    activeTrackNodes: new Map(),
    masterInputNode: null, // Entrada da cadeia de efeitos do master
    masterGainNode: null, 
    startTime: 0,
    startOffset: 0,
    playbackStartPositionPx: 0, 
    animationFrameId: null,

    // Menus de Contexto
    contextMenuTargetClip: null,
    contextMenuPasteX: 0,
    
    timelineWidth: 0, 

    metronome: {
        oscillator: null,
        gainNode: null,
        nextClickTime: 0,
        scheduleAheadTime: 0.1,
        lookahead: 0.025,
        intervalId: null
    },

    loop: {
        isEnabled: false,
        startTimePx: 0,
        endTimePx: 600,
        startMarker: null,
        endMarker: null
    },

    recording: {
        isRecording: false,
        mediaStream: null,
        mediaRecorder: null, 
        rawAudioData: [],
        audioStartTime: 0,
        currentTrackId: null,
        recordingStartPositionPx: 0,
        workletNode: null,
        recordingClipElement: null,
        renderFrameId: null
    },

    dynamicPixelsPerBeat: 60,
    beatsPerBar: 4, 
    totalBeats: 2000,
};


// --- CONSTANTES DE CONFIGURAÇÃO ---
const pixelsPerBeat = 60;
const METRONOME_HIGH_FREQ = 1000;
const METRONOME_LOW_FREQ = 600;
const METRONOME_CLICK_DURATION = 0.05;
const METRONOME_CLICK_GAIN_HIGH = 0.7;
const METRONOME_CLICK_GAIN_LOW = 0.5;