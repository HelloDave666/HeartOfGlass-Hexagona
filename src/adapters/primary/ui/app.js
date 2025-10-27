// src/adapters/primary/ui/app.js
// INTÉGRATION : NobleBluetoothAdapter + Système Audio Granulaire + Enregistrement MP3
// Phase 5 - Refactorisation : TabController + StateManager + SensorUIController + AudioUIController + RecordingController + TimelineController + IMUController
// Phase 6 - Step 8 : BluetoothOrchestrator
// Phase 6 - Step 9 : AudioOrchestrator
// Phase 6 - Step 10 : SensorUtils (utilisé par BluetoothOrchestrator)

console.log('Heart of Glass - Version avec NobleBluetoothAdapter + Audio Granulaire + MP3 Recording');

// ========================================
// MODE HYBRIDE : Basculement IPC / Direct
// ========================================
const USE_IPC_MODE = true;
console.log(`[App] Mode: ${USE_IPC_MODE ? 'IPC (Architecture Hexagonale)' : 'DIRECT (Legacy)'}`);

const path = require('path');
const projectRoot = process.cwd();

const AudioParameters = require(path.join(projectRoot, 'src', 'core', 'domain', 'valueObjects', 'AudioParameters.js'));
const AudioState = require(path.join(projectRoot, 'src', 'core', 'domain', 'valueObjects', 'AudioState.js'));

const TabController = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'controllers', 'TabController.js'));
const StateManager = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'services', 'StateManager.js'));
const SensorUIController = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'controllers', 'SensorUIController.js'));
const AudioUIController = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'controllers', 'AudioUIController.js'));
const RecordingController = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'controllers', 'RecordingController.js'));
const TimelineController = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'controllers', 'TimelineController.js'));
const IMUController = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'controllers', 'IMUController.js'));
const BluetoothOrchestrator = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'orchestrators', 'BluetoothOrchestrator.js'));
const AudioOrchestrator = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'orchestrators', 'AudioOrchestrator.js'));

const SENSOR_CONFIG = {
  leftAddress: 'ce:de:c2:f5:17:be',
  rightAddress: 'f0:70:c4:de:d1:22',
  leftColor: 'blue',
  rightColor: 'green'
};

const AUDIO_CONFIG = {
  defaultGrainSize: 60,
  defaultOverlap: 60,
  defaultWindow: 'hann',
  defaultVolume: 0.8,
  minGrainSize: 10,
  maxGrainSize: 500,
  minOverlap: 0,
  maxOverlap: 95
};

const state = new StateManager();
state.setAudioState(AudioState.createInitial());
state.setAudioParameters(new AudioParameters(
  AUDIO_CONFIG.defaultGrainSize,
  AUDIO_CONFIG.defaultOverlap,
  AUDIO_CONFIG.defaultWindow
));

const SMOOTHING_FACTOR = 0.3;

const IMU_MAPPING = {
  velocitySensitivity: 2.0,
  volumeSensitivity: 1.0,
  minPlaybackRate: 0.1,
  maxPlaybackRate: 3.0,
  volumeAngleRange: 45,
  deadZone: 2.0
};

let tabController = null;
let sensorUIController = null;
let audioUIController = null;
let recordingController = null;
let timelineController = null;
let imuController = null;
let bluetoothOrchestrator = null;
let audioOrchestrator = null;

function setupTabs() {
  tabController = new TabController();
  const initialized = tabController.initialize();
  
  if (!initialized) {
    console.error('[App] Echec initialisation TabController');
  }
}

function setupSensorInterface() {
  sensorUIController = new SensorUIController({
    sensors: SENSOR_CONFIG,
    onScanToggle: () => {
      if (bluetoothOrchestrator) {
        bluetoothOrchestrator.toggleScan();
      }
    }
  });
  
  const initialized = sensorUIController.initialize('sensorContainer');
  
  if (!initialized) {
    console.error('[App] Échec initialisation SensorUIController');
  }
}

function updateAngles(position, angles) {
  sensorUIController.updateAngles(position, angles);
  
  if (position === 'DROIT') {
    console.log(`[IMU] DROIT - Y: ${angles.y.toFixed(1)}° | IMU enabled: ${state.isIMUToAudioEnabled()} | Playing: ${state.getAudioState().isPlaying}`);
  }
  
  if (state.isIMUToAudioEnabled() && state.getAudioSystem() && state.getAudioState().isPlaying) {
    const now = Date.now();
    const side = position === 'GAUCHE' ? 'left' : 'right';
    
    const lastAngle = state.getLastAngles()[side];
    const deltaTime = (now - lastAngle.timestamp) / 1000;
    
    if (deltaTime > 0) {
      const angularVelocity = (angles.y - lastAngle.y) / deltaTime;
      
      if (position === 'DROIT' && Math.abs(angularVelocity) > 1) {
        console.log(`[IMU→Audio] Vitesse angulaire: ${angularVelocity.toFixed(1)}°/s`);
      }
      
      applyIMUToAudio(position, angles, angularVelocity);
    }
    
    state.updateLastAngles(side, angles);
  }
}

// ========================================
// AUDIO UI - REFACTORISÉ AVEC AudioUIController
// ========================================

function setupAudioInterface() {
  console.log('[Audio] Configuration interface audio...');
  
  audioUIController = new AudioUIController({
    audioConfig: AUDIO_CONFIG,
    onFileSelect: async (event) => {
      const file = event.target.files[0];
      if (file && audioOrchestrator) {
        try {
          await audioOrchestrator.loadFile(file);
        } catch (error) {
          alert(error.message);
        }
      }
    },
    onPlayPauseToggle: () => {
      if (audioOrchestrator) {
        audioOrchestrator.togglePlayPause();
      }
    },
    onTimelineClick: (event) => {
      if (audioOrchestrator) {
        const percent = audioUIController.getTimelineClickPosition(event);
        audioOrchestrator.seek(percent);
      }
    },
    onGrainSizeChange: (event) => {
      if (audioOrchestrator) {
        audioOrchestrator.setGrainSize(event.target.value);
      }
    },
    onOverlapChange: (event) => {
      if (audioOrchestrator) {
        audioOrchestrator.setOverlap(event.target.value);
      }
    },
    onWindowChange: (event) => {
      if (audioOrchestrator) {
        audioOrchestrator.setWindowType(event.target.value);
      }
    },
    onIMUToggle: (event) => {
      if (audioOrchestrator) {
        audioOrchestrator.toggleIMU(event.target.checked);
      }
    },
    onRecordToggle: async () => {
      if (audioOrchestrator) {
        try {
          await audioOrchestrator.toggleRecording();
        } catch (error) {
          alert('Erreur lors de l\'enregistrement: ' + error.message);
        }
      }
    }
  });
  
  const initialized = audioUIController.initialize();
  
  if (!initialized) {
    console.error('[App] Échec initialisation AudioUIController');
    return;
  }
  
  console.log('[Audio] Interface audio configurée');
}

// ========================================
// RECORDING UI - REFACTORISÉ AVEC RecordingController
// ========================================

function setupRecordingInterface() {
  console.log('[Recording] Configuration interface enregistrement...');
  
  recordingController = new RecordingController({
    onRecordingStart: () => {
      console.log('[App] Callback: Enregistrement démarré');
      state.setIsRecording(true);
      if (audioUIController) {
        audioUIController.updateUI({
          audioState: state.getAudioState(),
          currentFile: state.getCurrentAudioFile(),
          isRecording: state.getIsRecording()
        });
      }
    },
    onRecordingStop: (blob) => {
      console.log('[App] Callback: Enregistrement arrêté');
      state.setIsRecording(false);
      if (audioUIController) {
        audioUIController.updateUI({
          audioState: state.getAudioState(),
          currentFile: state.getCurrentAudioFile(),
          isRecording: state.getIsRecording()
        });
      }
    },
    onError: (error) => {
      console.error('[App] Erreur enregistrement:', error);
      alert('Erreur lors de l\'enregistrement: ' + error.message);
      state.setIsRecording(false);
      if (audioUIController) {
        audioUIController.updateUI({
          audioState: state.getAudioState(),
          currentFile: state.getCurrentAudioFile(),
          isRecording: state.getIsRecording()
        });
      }
    }
  });
  
  const initialized = recordingController.initialize();
  
  if (!initialized) {
    console.error('[App] Échec initialisation RecordingController');
    return;
  }
  
  console.log('[Recording] Interface enregistrement configurée');
}

// ========================================
// TIMELINE UI - REFACTORISÉ AVEC TimelineController
// ========================================

function setupTimelineInterface() {
  console.log('[Timeline] Configuration interface timeline...');
  
  timelineController = new TimelineController({
    updateFrequency: 100, // Mise à jour toutes les 100ms
    onPositionUpdate: (currentPosition) => {
      // Mise à jour de l'état avec la nouvelle position
      state.setAudioState(state.getAudioState().with({ currentPosition }));
      if (audioUIController) {
        audioUIController.updateUI({
          audioState: state.getAudioState(),
          currentFile: state.getCurrentAudioFile(),
          isRecording: state.getIsRecording()
        });
      }
    },
    onPlaybackEnd: () => {
      console.log('[App] Callback: Fin de lecture');
      if (audioOrchestrator) {
        audioOrchestrator.stop();
      }
    }
  });
  
  const initialized = timelineController.initialize();
  
  if (!initialized) {
    console.error('[App] Échec initialisation TimelineController');
    return;
  }
  
  console.log('[Timeline] Interface timeline configurée');
}

// ========================================
// IMU CONTROL - REFACTORISÉ AVEC IMUController
// ========================================

function setupIMUInterface() {
  console.log('[IMU] Configuration interface IMU...');
  
  imuController = new IMUController({
    velocitySensitivity: IMU_MAPPING.velocitySensitivity,
    volumeSensitivity: IMU_MAPPING.volumeSensitivity,
    minPlaybackRate: IMU_MAPPING.minPlaybackRate,
    maxPlaybackRate: IMU_MAPPING.maxPlaybackRate,
    volumeAngleRange: IMU_MAPPING.volumeAngleRange,
    deadZone: IMU_MAPPING.deadZone,
    smoothingFactor: SMOOTHING_FACTOR,
    onSpeedUpdate: (rate, direction, inDeadzone) => {
      audioUIController.updateSpeedDisplay(rate, direction, inDeadzone);
    },
    onVolumeUpdate: (volume) => {
      state.setAudioState(state.getAudioState().with({ volume }));
      audioUIController.updateVolumeDisplay(state.getAudioState());
    }
  });
  
  const initialized = imuController.initialize();
  
  if (!initialized) {
    console.error('[App] Échec initialisation IMUController');
    return;
  }
  
  console.log('[IMU] Interface IMU configurée');
}

// ========================================
// IMU TO AUDIO
// ========================================

function applyIMUToAudio(position, angles, angularVelocity) {
  if (audioOrchestrator) {
    audioOrchestrator.applyIMUToAudio(position, angles, angularVelocity);
  }
}

// ========================================
// INITIALISATION APPLICATION
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] Initialisation application...');
  
  // Setup des contrôleurs UI
  setupTabs();
  setupSensorInterface();
  setupAudioInterface();
  setupRecordingInterface();
  setupTimelineInterface();
  setupIMUInterface();
  
  // Initialisation BluetoothOrchestrator
  bluetoothOrchestrator = new BluetoothOrchestrator({
    state,
    sensorUIController,
    sensorConfig: SENSOR_CONFIG,
    useIPCMode: USE_IPC_MODE,
    onAnglesUpdate: updateAngles
  });
  
  // Initialisation AudioOrchestrator
  audioOrchestrator = new AudioOrchestrator({
    state,
    audioUIController,
    timelineController,
    recordingController,
    imuController,
    audioConfig: AUDIO_CONFIG
  });
  
  const bluetoothOk = await bluetoothOrchestrator.initialize();
  const audioOk = await audioOrchestrator.initialize();
  
  if (bluetoothOk) {
    console.log('[App] Bluetooth prêt');
    sensorUIController.updateStatus('Cliquez sur "Rechercher les capteurs" pour commencer');
  } else {
    console.error('[App] Bluetooth échoué');
  }
  
  if (audioOk) {
    console.log('[Audio] Audio prêt');
  } else {
    console.error('[Audio] Audio échoué');
  }
  
  console.log('[App] Application prête');
});

// ========================================
// CLEANUP
// ========================================

if (window.require) {
  const { ipcRenderer } = window.require('electron');
  
  ipcRenderer.on('app-closing', async () => {
    console.log('[App] Fermeture - Nettoyage...');
    
    // Cleanup orchestrateurs
    if (bluetoothOrchestrator) {
      await bluetoothOrchestrator.cleanup();
      bluetoothOrchestrator.dispose();
      bluetoothOrchestrator = null;
    }
    
    if (audioOrchestrator) {
      await audioOrchestrator.cleanup();
      audioOrchestrator.dispose();
      audioOrchestrator = null;
    }
    
    // Cleanup contrôleurs
    if (tabController) {
      tabController.dispose();
      tabController = null;
    }
    
    if (sensorUIController) {
      sensorUIController.dispose();
      sensorUIController = null;
    }
    
    if (audioUIController) {
      audioUIController.dispose();
      audioUIController = null;
    }
    
    if (recordingController) {
      recordingController.dispose();
      recordingController = null;
    }
    
    if (timelineController) {
      timelineController.dispose();
      timelineController = null;
    }
    
    if (imuController) {
      imuController.dispose();
      imuController = null;
    }
    
    setTimeout(() => {
      ipcRenderer.send('cleanup-complete');
    }, 200);
  });
}