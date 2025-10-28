/// <reference path="../../../globals.d.ts" />
// src/adapters/primary/ui/app.js
// INTÉGRATION : NobleBluetoothAdapter + Système Audio Granulaire + Enregistrement MP3 + Exercices
// Phase 7 - Step 11 : AppBootstrap - app.js simplifié à ~180 lignes

console.log('Heart of Glass - Version avec Architecture Hexagonale Complète + Exercices');

// ========================================
// MODE HYBRIDE : Basculement IPC / Direct
// ========================================
const USE_IPC_MODE = true;
console.log(`[App] Mode: ${USE_IPC_MODE ? 'IPC (Architecture Hexagonale)' : 'DIRECT (Legacy)'}`);

const path = require('path');
const projectRoot = process.cwd();

const AudioParameters = require(path.join(projectRoot, 'src', 'core', 'domain', 'valueObjects', 'AudioParameters.js'));
const AudioState = require(path.join(projectRoot, 'src', 'core', 'domain', 'valueObjects', 'AudioState.js'));
const StateManager = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'services', 'StateManager.js'));
const AppBootstrap = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'bootstrap', 'AppBootstrap.js'));
const BluetoothOrchestrator = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'orchestrators', 'BluetoothOrchestrator.js'));
const AudioOrchestrator = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'orchestrators', 'AudioOrchestrator.js'));
const ExerciseOrchestrator = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'orchestrators', 'ExerciseOrchestrator.js'));

// ========================================
// CONFIGURATION
// ========================================

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

const IMU_MAPPING = {
  velocitySensitivity: 2.0,
  volumeSensitivity: 1.0,
  minPlaybackRate: 0.1,
  maxPlaybackRate: 3.0,
  volumeAngleRange: 45,
  deadZone: 2.0
};

const SMOOTHING_FACTOR = 0.3;

// ========================================
// ÉTAT ET RÉFÉRENCES
// ========================================

const state = new StateManager();
state.setAudioState(AudioState.createInitial());
state.setAudioParameters(new AudioParameters(
  AUDIO_CONFIG.defaultGrainSize,
  AUDIO_CONFIG.defaultOverlap,
  AUDIO_CONFIG.defaultWindow
));

let controllers = {};
let orchestrators = {};

// ========================================
// CALLBACKS
// ========================================

function updateAngles(position, angles) {
  controllers.sensorUIController.updateAngles(position, angles);
  
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
      
      if (orchestrators.audio) {
        orchestrators.audio.applyIMUToAudio(position, angles, angularVelocity);
      }
    }
    
    state.updateLastAngles(side, angles);
  }
}

// ========================================
// INITIALISATION APPLICATION
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] Initialisation application...');
  
  // Bootstrap tous les contrôleurs via AppBootstrap
  controllers = await AppBootstrap.bootstrap({
    state,
    SENSOR_CONFIG,
    AUDIO_CONFIG,
    IMU_MAPPING,
    callbacks: {
      onScanToggle: () => {
        if (orchestrators.bluetooth) {
          orchestrators.bluetooth.toggleScan();
        }
      },
      audioCallbacks: {
        onFileSelect: async (event) => {
          const file = event.target.files[0];
          if (file && orchestrators.audio) {
            try {
              await orchestrators.audio.loadFile(file);
            } catch (error) {
              alert(error.message);
            }
          }
        },
        onPlayPauseToggle: () => {
          if (orchestrators.audio) {
            orchestrators.audio.togglePlayPause();
          }
        },
        onTimelineClick: (event) => {
          if (orchestrators.audio && controllers.audioUIController) {
            const percent = controllers.audioUIController.getTimelineClickPosition(event);
            orchestrators.audio.seek(percent);
          }
        },
        onGrainSizeChange: (event) => {
          if (orchestrators.audio) {
            orchestrators.audio.setGrainSize(event.target.value);
          }
        },
        onOverlapChange: (event) => {
          if (orchestrators.audio) {
            orchestrators.audio.setOverlap(event.target.value);
          }
        },
        onWindowChange: (event) => {
          if (orchestrators.audio) {
            orchestrators.audio.setWindowType(event.target.value);
          }
        },
        onIMUToggle: (event) => {
          if (orchestrators.audio) {
            orchestrators.audio.toggleIMU(event.target.checked);
          }
        },
        onRecordToggle: async () => {
          if (orchestrators.audio) {
            try {
              await orchestrators.audio.toggleRecording();
            } catch (error) {
              alert('Erreur lors de l\'enregistrement: ' + error.message);
            }
          }
        }
      },
      recordingCallbacks: {
        onRecordingStart: () => {
          console.log('[App] Callback: Enregistrement démarré');
          state.setIsRecording(true);
          if (controllers.audioUIController) {
            controllers.audioUIController.updateUI({
              audioState: state.getAudioState(),
              currentFile: state.getCurrentAudioFile(),
              isRecording: state.getIsRecording()
            });
          }
        },
        onRecordingStop: (blob) => {
          console.log('[App] Callback: Enregistrement arrêté');
          state.setIsRecording(false);
          if (controllers.audioUIController) {
            controllers.audioUIController.updateUI({
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
          if (controllers.audioUIController) {
            controllers.audioUIController.updateUI({
              audioState: state.getAudioState(),
              currentFile: state.getCurrentAudioFile(),
              isRecording: state.getIsRecording()
            });
          }
        }
      },
      timelineCallbacks: {
        onPositionUpdate: (currentPosition) => {
          state.setAudioState(state.getAudioState().with({ currentPosition }));
          if (controllers.audioUIController) {
            controllers.audioUIController.updateUI({
              audioState: state.getAudioState(),
              currentFile: state.getCurrentAudioFile(),
              isRecording: state.getIsRecording()
            });
          }
        },
        onPlaybackEnd: () => {
          console.log('[App] Callback: Fin de lecture');
          if (orchestrators.audio) {
            orchestrators.audio.stop();
          }
        }
      },
      imuCallbacks: {
        onSpeedUpdate: (rate, direction, inDeadzone) => {
          if (controllers.audioUIController) {
            controllers.audioUIController.updateSpeedDisplay(rate, direction, inDeadzone);
          }
        },
        onVolumeUpdate: (volume) => {
          state.setAudioState(state.getAudioState().with({ volume }));
          if (controllers.audioUIController) {
            controllers.audioUIController.updateVolumeDisplay(state.getAudioState());
          }
        }
      }
    }
  });
  
  // Initialisation BluetoothOrchestrator
  orchestrators.bluetooth = new BluetoothOrchestrator({
    state,
    sensorUIController: controllers.sensorUIController,
    sensorConfig: SENSOR_CONFIG,
    useIPCMode: USE_IPC_MODE,
    onAnglesUpdate: updateAngles
  });
  
  // Initialisation AudioOrchestrator
  orchestrators.audio = new AudioOrchestrator({
    state,
    audioUIController: controllers.audioUIController,
    timelineController: controllers.timelineController,
    recordingController: controllers.recordingController,
    imuController: controllers.imuController,
    audioConfig: AUDIO_CONFIG
  });
  
  const bluetoothOk = await orchestrators.bluetooth.initialize();
  const audioOk = await orchestrators.audio.initialize();
  
  if (bluetoothOk) {
    console.log('[App] Bluetooth prêt');
    controllers.sensorUIController.updateStatus('Cliquez sur "Rechercher les capteurs" pour commencer');
  } else {
    console.error('[App] Bluetooth échoué');
  }
  
  if (audioOk) {
    console.log('[App] Audio prêt');
  } else {
    console.error('[App] Audio échoué');
  }

  // ========================================
  // INITIALISATION EXERCICE ORCHESTRATOR
  // ========================================
  
  orchestrators.exercise = new ExerciseOrchestrator({
    state,
    bluetoothOrchestrator: orchestrators.bluetooth,
    audioOrchestrator: orchestrators.audio,
    exerciseUIController: null // TODO: créer le controller UI plus tard
  });

  const exerciseOk = await orchestrators.exercise.initialize();

  if (exerciseOk) {
    console.log('[App] ✓ Exercices prêts');
    
    // Exposer globalement pour tests dans la console DevTools
    // @ts-ignore - Fonction exposée dynamiquement pour tests
    window.startHeartOfFrost = (level = 0) => orchestrators.exercise.startHeartOfFrost(level);
    // @ts-ignore - Fonction exposée dynamiquement pour tests
    window.stopExercise = () => orchestrators.exercise.stopExercise();
    // @ts-ignore - Fonction exposée dynamiquement pour tests
    window.resetExercise = () => orchestrators.exercise.resetExercise();
    
    console.log('[App] 💡 Fonctions d\'exercices disponibles dans la console :');
    console.log('  - window.startHeartOfFrost(level)  // level = 0 ou 1');
    console.log('  - window.stopExercise()');
    console.log('  - window.resetExercise()');
  } else {
    console.error('[App] ✗ Exercices échoués');
  }
  
  console.log('[App] ✓ Application prête');
});  // ← CETTE LIGNE ÉTAIT MANQUANTE (ferme document.addEventListener)

// ========================================
// CLEANUP
// ========================================

if (window.require) {
  const { ipcRenderer } = window.require('electron');
  
  ipcRenderer.on('app-closing', async () => {
    console.log('[App] Fermeture - Nettoyage...');
    
    // Cleanup orchestrateurs
    if (orchestrators.bluetooth) {
      await orchestrators.bluetooth.cleanup();
      orchestrators.bluetooth.dispose();
    }
    
    if (orchestrators.audio) {
      await orchestrators.audio.cleanup();
      orchestrators.audio.dispose();
    }
    
    if (orchestrators.exercise) {
      await orchestrators.exercise.cleanup();
      orchestrators.exercise.dispose();
    }
    
    // Cleanup contrôleurs
    Object.values(controllers).forEach(controller => {
      if (controller && controller.dispose) {
        controller.dispose();
      }
    });
    
    setTimeout(() => {
      ipcRenderer.send('cleanup-complete');
    }, 200);
  });
}