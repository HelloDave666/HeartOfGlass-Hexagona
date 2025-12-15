// src/adapters/primary/ui/app.js
// INTÉGRATION : NobleBluetoothAdapter + Système Audio Granulaire + Enregistrement MP3 + ExerciseController
// Phase 7 - Step 11 : AppBootstrap - app.js simplifié à ~180 lignes
// AJOUT : ExerciseController pour gérer les exercices (RotationContinue, etc.)

console.log('Fool of Craft: The Sound from Gesture - Architecture Hexagonale + Explorations Sonores');

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
const SplashScreenController = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'controllers', 'SplashScreenController.js'));

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

// ╔═══════════════════════════════════════════════════════════════╗
// ║ AJOUT 1/5 : Variable pour le contrôleur d'exercices ║
// ╚═══════════════════════════════════════════════════════════════╝
let exerciseController = null;

// ╔═══════════════════════════════════════════════════════════════╗
// ║ AJOUT 2/5 : Variable pour l'orchestrateur de calibration ║
// ╚═══════════════════════════════════════════════════════════════╝
let calibrationOrchestrator = null;

// ╔═══════════════════════════════════════════════════════════════╗
// ║ AJOUT 3/5 : Référence au FoolOfCraftUIController             ║
// ╚═══════════════════════════════════════════════════════════════╝
let foolOfCraftUIController = null;

// [OK] MODIFIÉ : Stocker toutes les données de chaque capteur (angles, gyro, accel)
let lastSensorAngles = {
 left: {
 angles: { x: 0, y: 0, z: 0 },
 gyro: { x: 0, y: 0, z: 0 },
 accel: { x: 0, y: 0, z: 0 }
 },
 right: {
 angles: { x: 0, y: 0, z: 0 },
 gyro: { x: 0, y: 0, z: 0 },
 accel: { x: 0, y: 0, z: 0 }
 }
};

// ========================================
// CALLBACKS
// ========================================

function updateAngles(position, sensorData) {
 // ╔═══════════════════════════════════════════════════════════════╗
 // ║ AJOUT 3/5 : Router vers calibration si active (priorité 1) ║
 // ╚═══════════════════════════════════════════════════════════════╝

 // Support de l'ancien format (angles uniquement) pour compatibilité
 const angles = sensorData.angles || sensorData;
 const gyro = sensorData.gyro || { x: 0, y: 0, z: 0 };
 const accel = sensorData.accel || { x: 0, y: 0, z: 0 };

 // [OK] MODIFIÉ : Stocker toutes les données du capteur (angles + gyro + accel)
 const side = position === 'GAUCHE' ? 'left' : 'right';
 lastSensorAngles[side] = { angles: { ...angles }, gyro: { ...gyro }, accel: { ...accel } };

 // PRIORITÉ 1 : Si calibration active, router uniquement vers calibration
 if (calibrationOrchestrator && calibrationOrchestrator.currentPhase !== null) {
 // Passer les données complètes du capteur DROIT à l'orchestrateur de calibration
 // (on utilise le capteur droit comme référence pour la calibration)
 if (position === 'DROIT') {
 calibrationOrchestrator.processIMUData({ angles, gyro, accel });
 }

 // Mettre à jour l'UI des capteurs pour feedback visuel (angles seulement pour l'instant)
 controllers.sensorUIController.updateAngles(position, angles);

 // Ne pas appliquer audio ni exercices pendant calibration
 return;
 }

 // ╔═══════════════════════════════════════════════════════════════╗
 // ║ PRIORITÉ 2 : Router vers exercice si actif ║
 // ╚═══════════════════════════════════════════════════════════════╝

 // Si un exercice est actif, router les données vers lui SEULEMENT
 if (exerciseController && exerciseController.currentExercise) {
 // [NEW] v3.3 : Passer les données des DEUX capteurs à l'exercice
 // DROIT → Contrôle vitesse de lecture
 // GAUCHE → Contrôle volume
 if (position === 'DROIT') {
 exerciseController.updateAngles(lastSensorAngles.right, 'DROIT');
 } else if (position === 'GAUCHE') {
 exerciseController.updateAngles(lastSensorAngles.left, 'GAUCHE');
 }

 // Mettre à jour l'UI des capteurs quand même (pour voir les angles)
 controllers.sensorUIController.updateAngles(position, angles);

 // Ne pas appliquer l'audio standard (l'exercice s'en occupe)
 return;
 }

 // ╔═══════════════════════════════════════════════════════════════╗
 // ║ PRIORITÉ 3 : COMPORTEMENT NORMAL (si rien d'actif) ║
 // ╚═══════════════════════════════════════════════════════════════╝
 controllers.sensorUIController.updateAngles(position, angles);
}

// ========================================
// INITIALISATION APPLICATION
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
 console.log('[App] Initialisation application...');

 // Afficher le splash screen d'introduction
 const splashScreen = new SplashScreenController({
 imagePath: null, // Pas d'image, affichage texte par défaut
 duration: 6000, // 6 secondes
 skippable: true // Peut skip avec click/espace
 });

 // Attendre que le splash se termine
 await splashScreen.show(() => {
 console.log('[App] Splash screen terminé, chargement de Fool of Craft...');
 });

 // ╔═══════════════════════════════════════════════════════════════╗
 // ║ CRÉER ExerciseController AVANT bootstrap                      ║
 // ╚═══════════════════════════════════════════════════════════════╝
 // Note: Créer la référence maintenant, sera initialisé après bootstrap
 const ExerciseController = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'controllers', 'ExerciseController.js'));

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
 },
 calibrationCallbacks: {
 onCalibrationUpdate: (update) => {
 console.log('[App→Calibration] Update:', update);
 },
 onCalibrationComplete: (data) => {
 console.log('[App→Calibration] Calibration complète:', data);
 console.log('[App→Calibration] Ranges sauvegardés dans StateManager');
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
 console.log('[Audio] Audio prêt');
 } else {
 console.error('[Audio] Audio échoué');
 }
 
 // ╔═══════════════════════════════════════════════════════════════╗
 // ║ AJOUT 4/5 : Récupérer CalibrationOrchestrator ║
 // ╚═══════════════════════════════════════════════════════════════╝
 calibrationOrchestrator = controllers.calibrationOrchestrator;

 if (calibrationOrchestrator) {
 console.log('[App] [OK] CalibrationOrchestrator connecté');
 console.log('[App] 💡 Onglet Calibration disponible dans l\'interface');
 } else {
 console.warn('[App] CalibrationOrchestrator non disponible');
 }

 // ╔═══════════════════════════════════════════════════════════════╗
 // ║ AJOUT 5/6 : Initialisation ExerciseController                 ║
 // ╚═══════════════════════════════════════════════════════════════╝
 try {
 exerciseController = new ExerciseController({
 audioOrchestrator: orchestrators.audio,
 state,
 calibrationOrchestrator: calibrationOrchestrator,
 audioUIController: controllers.audioUIController
 });

 exerciseController.initialize();

 console.log('[App] [OK] ExerciseController prêt');

 // Exposer les commandes globalement (pour console)
 if (window) {
 // @ts-ignore
 window.startRotationExercise = () => {
 console.log('[App] Démarrage exercice RotationContinue...');
 exerciseController.startExercise('rotationContinue');
 };

 // @ts-ignore
 window.stopRotationExercise = () => {
 console.log('[App] Arrêt exercice actif...');
 exerciseController.stopCurrentExercise();
 };

 // @ts-ignore
 window.getExerciseStatus = () => {
 return exerciseController.getStatus();
 };

 console.log('[App] 💡 Commandes exercices:');
 console.log(' - window.startRotationExercise()');
 console.log(' - window.stopRotationExercise()');
 console.log(' - window.getExerciseStatus()');
 }
 } catch (error) {
 console.warn('[App] ExerciseController non disponible:', error.message);
 console.warn('[App] L\'application fonctionnera sans les exercices');
 }

 // ╔═══════════════════════════════════════════════════════════════╗
 // ║ AJOUT 6/6 : Initialisation FoolOfCraftUIController            ║
 // ╚═══════════════════════════════════════════════════════════════╝
 try {
 const FoolOfCraftUIController = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'controllers', 'FoolOfCraftUIController.js'));

 foolOfCraftUIController = new FoolOfCraftUIController({
 state,
 tabController: controllers.tabController,
 exerciseController: exerciseController
 });

 const initialized = foolOfCraftUIController.initialize('explorationsContent');

 if (initialized) {
 console.log('[App] [OK] FoolOfCraftUIController initialisé');
 controllers.foolOfCraftUIController = foolOfCraftUIController;
 } else {
 console.error('[App] Échec initialisation FoolOfCraftUIController');
 }
 } catch (error) {
 console.warn('[App] FoolOfCraftUIController non disponible:', error.message);
 }
 
 console.log('[App] [OK] Application prête');
});

// ========================================
// CLEANUP
// ========================================

if (window.require) {
 const { ipcRenderer } = window.require('electron');
 
 ipcRenderer.on('app-closing', async () => {
 console.log('[App] Fermeture - Nettoyage...');
 
 // ╔═══════════════════════════════════════════════════════════════╗
 // ║ Cleanup ExerciseController & CalibrationOrchestrator ║
 // ╚═══════════════════════════════════════════════════════════════╝
 if (exerciseController) {
 exerciseController.dispose();
 }

 if (calibrationOrchestrator && calibrationOrchestrator.dispose) {
 calibrationOrchestrator.dispose();
 }
 
 // Cleanup orchestrateurs
 if (orchestrators.bluetooth) {
 await orchestrators.bluetooth.cleanup();
 orchestrators.bluetooth.dispose();
 }
 
 if (orchestrators.audio) {
 await orchestrators.audio.cleanup();
 orchestrators.audio.dispose();
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