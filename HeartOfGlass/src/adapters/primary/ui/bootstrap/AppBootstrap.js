// src/adapters/primary/ui/bootstrap/AppBootstrap.js
// Bootstrap pour l'initialisation de tous les contrôleurs UI
// Extrait les fonctions setup*() de app.js pour simplifier l'orchestration

const path = require('path');
const projectRoot = process.cwd();

const TabController = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'controllers', 'TabController.js'));
const SensorUIController = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'controllers', 'SensorUIController.js'));
const AudioUIController = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'controllers', 'AudioUIController.js'));
const RecordingController = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'controllers', 'RecordingController.js'));
const TimelineController = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'controllers', 'TimelineController.js'));
const IMUController = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'controllers', 'IMUController.js'));
const CalibrationUIController = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'controllers', 'CalibrationUIController.js'));
const NarrativeController = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'controllers', 'NarrativeController.js'));
const HeartOfGlassUIController = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'controllers', 'HeartOfGlassUIController.js'));

const CalibrationOrchestrator = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'orchestrators', 'CalibrationOrchestrator.js'));

/**
 * Module Bootstrap pour l'initialisation de tous les contrôleurs UI
 * @class AppBootstrap
 */
class AppBootstrap {
 /**
 * Bootstrap tous les contrôleurs de l'application
 * @param {Object} config - Configuration
 * @param {Object} config.state - StateManager
 * @param {Object} config.SENSOR_CONFIG - Configuration capteurs
 * @param {Object} config.AUDIO_CONFIG - Configuration audio
 * @param {Object} config.IMU_MAPPING - Configuration IMU
 * @param {Object} config.callbacks - Callbacks pour orchestrateurs
 * @returns {Promise<Object>} Contrôleurs initialisés
 */
 static async bootstrap({ state, SENSOR_CONFIG, AUDIO_CONFIG, IMU_MAPPING, callbacks }) {
 console.log('[AppBootstrap] Initialisation des contrôleurs...');

 // Setup des contrôleurs
 const tabController = this.setupTabs();
 const sensorUIController = this.setupSensorInterface(SENSOR_CONFIG, callbacks.onScanToggle);
 const audioUIController = this.setupAudioInterface(AUDIO_CONFIG, callbacks.audioCallbacks);
 const recordingController = this.setupRecordingInterface(state, callbacks.recordingCallbacks);
 const timelineController = this.setupTimelineInterface(state, callbacks.timelineCallbacks);
 const imuController = this.setupIMUInterface(IMU_MAPPING, callbacks.imuCallbacks);

 // [NEW] Setup calibration interface
 const { calibrationOrchestrator, calibrationUIController } = this.setupCalibrationInterface(state, callbacks.calibrationCallbacks);

 // Setup narrative controller
 const narrativeController = await this.setupNarrativeController(state, callbacks.exerciseController, callbacks.audioOrchestrator);

 // Setup Heart of Glass UI
 const heartOfGlassUIController = this.setupHeartOfGlassUI(narrativeController);

 console.log('[AppBootstrap] [OK] Tous les contrôleurs initialisés');

 return {
 tabController,
 sensorUIController,
 audioUIController,
 recordingController,
 timelineController,
 imuController,
 calibrationOrchestrator,
 calibrationUIController,
 narrativeController,
 heartOfGlassUIController
 };
 }

 /**
 * Setup TabController
 * @returns {TabController}
 */
 static setupTabs() {
 const tabController = new TabController();
 const initialized = tabController.initialize();
 
 if (!initialized) {
 console.error('[AppBootstrap] Échec initialisation TabController');
 }
 
 return tabController;
 }

 /**
 * Setup SensorUIController
 * @param {Object} SENSOR_CONFIG - Configuration capteurs
 * @param {Function} onScanToggle - Callback scan toggle
 * @returns {SensorUIController}
 */
 static setupSensorInterface(SENSOR_CONFIG, onScanToggle) {
 const sensorUIController = new SensorUIController({
 sensors: SENSOR_CONFIG,
 onScanToggle
 });
 
 const initialized = sensorUIController.initialize('sensorContainer');
 
 if (!initialized) {
 console.error('[AppBootstrap] Échec initialisation SensorUIController');
 }
 
 return sensorUIController;
 }

 /**
 * Setup AudioUIController
 * @param {Object} AUDIO_CONFIG - Configuration audio
 * @param {Object} callbacks - Callbacks audio
 * @returns {AudioUIController}
 */
 static setupAudioInterface(AUDIO_CONFIG, callbacks) {
 console.log('[Audio] Configuration interface audio...');
 
 const audioUIController = new AudioUIController({
 audioConfig: AUDIO_CONFIG,
 onFileSelect: callbacks.onFileSelect,
 onPlayPauseToggle: callbacks.onPlayPauseToggle,
 onTimelineClick: callbacks.onTimelineClick,
 onGrainSizeChange: callbacks.onGrainSizeChange,
 onOverlapChange: callbacks.onOverlapChange,
 onWindowChange: callbacks.onWindowChange,
 onRecordToggle: callbacks.onRecordToggle
 });
 
 const initialized = audioUIController.initialize();
 
 if (!initialized) {
 console.error('[AppBootstrap] Échec initialisation AudioUIController');
 return null;
 }
 
 console.log('[Audio] Interface audio configurée');
 return audioUIController;
 }

 /**
 * Setup RecordingController
 * @param {Object} state - StateManager
 * @param {Object} callbacks - Callbacks recording
 * @returns {RecordingController}
 */
 static setupRecordingInterface(state, callbacks) {
 console.log('[Recording] Configuration interface enregistrement...');
 
 const recordingController = new RecordingController({
 onRecordingStart: callbacks.onRecordingStart,
 onRecordingStop: callbacks.onRecordingStop,
 onError: callbacks.onError
 });
 
 const initialized = recordingController.initialize();
 
 if (!initialized) {
 console.error('[AppBootstrap] Échec initialisation RecordingController');
 return null;
 }
 
 console.log('[Recording] Interface enregistrement configurée');
 return recordingController;
 }

 /**
 * Setup TimelineController
 * @param {Object} state - StateManager
 * @param {Object} callbacks - Callbacks timeline
 * @returns {TimelineController}
 */
 static setupTimelineInterface(state, callbacks) {
 console.log('[Timeline] Configuration interface timeline...');
 
 const timelineController = new TimelineController({
 updateFrequency: 100,
 onPositionUpdate: callbacks.onPositionUpdate,
 onPlaybackEnd: callbacks.onPlaybackEnd
 });
 
 const initialized = timelineController.initialize();
 
 if (!initialized) {
 console.error('[AppBootstrap] Échec initialisation TimelineController');
 return null;
 }
 
 console.log('[Timeline] Interface timeline configurée');
 return timelineController;
 }

 /**
 * Setup IMUController
 * @param {Object} IMU_MAPPING - Configuration IMU
 * @param {Object} callbacks - Callbacks IMU
 * @returns {IMUController}
 */
 static setupIMUInterface(IMU_MAPPING, callbacks) {
 console.log('[IMU] Configuration interface IMU...');
 
 const imuController = new IMUController({
 velocitySensitivity: IMU_MAPPING.velocitySensitivity,
 volumeSensitivity: IMU_MAPPING.volumeSensitivity,
 minPlaybackRate: IMU_MAPPING.minPlaybackRate,
 maxPlaybackRate: IMU_MAPPING.maxPlaybackRate,
 volumeAngleRange: IMU_MAPPING.volumeAngleRange,
 deadZone: IMU_MAPPING.deadZone,
 smoothingFactor: 0.3,
 onSpeedUpdate: callbacks.onSpeedUpdate,
 onVolumeUpdate: callbacks.onVolumeUpdate
 });
 
 const initialized = imuController.initialize();
 
 if (!initialized) {
 console.error('[AppBootstrap] Échec initialisation IMUController');
 return null;
 }
 
 console.log('[IMU] Interface IMU configurée');
 return imuController;
 }

 /**
 * Setup CalibrationOrchestrator et CalibrationUIController
 * @param {Object} state - StateManager
 * @param {Object} callbacks - Callbacks calibration (optionnel)
 * @returns {Object} { calibrationOrchestrator, calibrationUIController }
 */
 static setupCalibrationInterface(state, callbacks = {}) {
 console.log('[Calibration] Configuration interface calibration...');

 // Créer l'orchestrateur de calibration
 const calibrationOrchestrator = new CalibrationOrchestrator({
 state: state,
 onCalibrationUpdate: callbacks.onCalibrationUpdate || ((update) => {
 console.log('[Calibration] Update:', update);
 }),
 onCalibrationComplete: callbacks.onCalibrationComplete || ((data) => {
 console.log('[Calibration] Complète:', data);
 })
 });

 // Créer le contrôleur UI de calibration
 const calibrationUIController = new CalibrationUIController({
 calibrationOrchestrator: calibrationOrchestrator
 });

 // Connecter les callbacks de l'orchestrateur au contrôleur
 calibrationOrchestrator.onCalibrationUpdate = (update) => {
 calibrationUIController.onCalibrationUpdate(update);
 if (callbacks.onCalibrationUpdate) {
 callbacks.onCalibrationUpdate(update);
 }
 };

 calibrationOrchestrator.onCalibrationComplete = (data) => {
 calibrationUIController.onCalibrationComplete(data);
 if (callbacks.onCalibrationComplete) {
 callbacks.onCalibrationComplete(data);
 }
 };

 // Initialiser le contrôleur UI
 const initialized = calibrationUIController.initialize('calibrationTab');

 if (!initialized) {
 console.error('[AppBootstrap] Échec initialisation CalibrationUIController');
 return { calibrationOrchestrator: null, calibrationUIController: null };
 }

 console.log('[Calibration] Interface calibration configurée');
 return { calibrationOrchestrator, calibrationUIController };
 }

 /**
 * Setup NarrativeController
 * @param {Object} state - StateManager
 * @param {Object} exerciseController - ExerciseController (optionnel)
 * @param {Object} audioOrchestrator - AudioOrchestrator (optionnel)
 * @returns {Promise<NarrativeController>}
 */
 static async setupNarrativeController(state, exerciseController, audioOrchestrator) {
 console.log('[Narrative] Configuration système narratif...');

 const narrativeController = new NarrativeController({
 state,
 exerciseController,
 audioOrchestrator
 });

 const initialized = await narrativeController.initialize();

 if (!initialized) {
 console.error('[AppBootstrap] Échec initialisation NarrativeController');
 return null;
 }

 console.log('[Narrative] Système narratif configuré');
 return narrativeController;
 }

 /**
 * Setup HeartOfGlassUIController
 * @param {NarrativeController} narrativeController - Contrôleur narratif
 * @returns {HeartOfGlassUIController}
 */
 static setupHeartOfGlassUI(narrativeController) {
 console.log('[HeartOfGlass] Configuration interface Heart of Glass...');

 const heartOfGlassUIController = new HeartOfGlassUIController({
 narrativeController
 });

 const initialized = heartOfGlassUIController.initialize('mainContent');

 if (!initialized) {
 console.error('[AppBootstrap] Échec initialisation HeartOfGlassUIController');
 return null;
 }

 console.log('[HeartOfGlass] Interface Heart of Glass configurée');
 return heartOfGlassUIController;
 }
}

module.exports = AppBootstrap;