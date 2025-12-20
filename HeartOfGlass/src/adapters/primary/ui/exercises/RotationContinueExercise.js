/**
 * RotationContinueExercise.js - VERSION 3.8.0
 *
 * [NEW] v3.8.0 : REFACTORING FINAL - Code Cleanup
 * - Suppression commentaires obsolètes (v3.1-v3.5)
 * - Nettoyage notes "déplacé dans Service"
 * - Simplification documentation inline
 * - Code prêt pour production
 *
 * [NEW] v3.7.0 : REFACTORING - Use Case Pattern
 * - Use Case ProcessSensorUpdateUseCase créé pour orchestrer les services de domaine
 * - Architecture hexagonale : Adapter (UI) → Use Case → Services Domaine
 *
 * [NEW] v3.6.6 : REFACTORING - Extraction ExerciseMetrics
 * - Service ExerciseMetrics créé pour isoler les calculs de statistiques
 * - Méthodes extraites: calculateVelocityStats(), countDirections(), countRepositions(), calculateStats()
 *
 * [NEW] v3.6.5 : REFACTORING - Extraction VolumeController
 * - Service VolumeController créé pour isoler la logique de contrôle volume potentiomètre
 * - Méthodes extraites: updateCumulativeAngle(), calculateVolumeFromAngle(), smoothVolume(), snapToEdges()
 *
 * [NEW] v3.6.4 : REFACTORING - Extraction PlaybackCalculator
 * - Service PlaybackCalculator créé pour isoler les calculs de playback rate
 * - Méthodes extraites: calculateTargetRate(), smoothPlaybackRate(), calculateAdaptiveSmoothingFactor()
 *
 * [NEW] v3.6.3 : REFACTORING - Extraction SensorAnalyzer
 * - Service SensorAnalyzer créé pour isoler les calculs capteurs
 * - Méthodes extraites: calculateAngularVelocity(), calculateVelocityVariance(), calculateAngularAcceleration()
 *
 * [NEW] v3.6.2 : REFACTORING - Extraction DirectionDetector
 * - Service DirectionDetector créé pour isoler la logique de détection de direction
 * - Méthodes extraites: detectDirection(), checkConsensusStability(), updateDynamicDeadZone()
 * - Héritage depuis Exercise (classe abstraite de base)
 *
 * [NEW] v3.6.1 : REFACTORING - Extraction configuration
 * - Configuration externalisée dans configs/RotationContinueConfig.js
 *
 * [NEW] v3.6.0 : SIMPLIFICATION RADICALE - Suppression zone de confort
 * - Mapping linéaire universel : vitesse angulaire → playback rate proportionnel
 * - Pas de traitement spécial selon les zones
 * - Rotation progressive naturelle dans les deux sens
 * - Garde ce qui fonctionne : réactivité, détection direction horaire/antihoraire
 *
 * [NEW] v3.4 : CONTRÔLE DE VOLUME POTENTIOMÈTRE
 * - Capteur GAUCHE contrôle le volume comme un potentiomètre physique
 * - Zone gauche (270°-360°): 0% → 50% volume (rotation antihoraire)
 * - Position centrale (0°): 50% volume initial
 * - Zone droite (0°-90°): 50% → 100% volume (rotation horaire)
 * - Zone morte (90°-270°): maintient le volume actuel
 * - Butées virtuelles pour simulation réaliste
 *
 * PHASE D : Calibration Interactive Guidée
 * - [NEW] PHASE D : Calibration en 3 étapes (Repos → Horaire → Antihoraire)
 * - [NEW] PHASE D : Capture plages dynamiques min/max/avg pour chaque sens
 * - [NEW] PHASE D : Détection par distance aux plages (robuste aux variations)
 * - [NEW] PHASE D : UI visuelle avec barre de progression
 * - [NEW] PHASE D : Verrouillage réduit à 800ms (vs 1500ms)
 *
 * Basé sur v3.2/3.3 (ULTRA-RÉACTIF) :
 * [OK] 1. SEUIL RÉDUIT : 65% au lieu de 70%
 * [OK] 2. TEMPS STABILITÉ RÉDUIT : 200ms au lieu de 500ms (2.5x plus rapide)
 * [OK] 3. FENÊTRE RÉDUITE : 8 échantillons au lieu de 15 (2x plus rapide)
 * [OK] 4. ZONE CONFORT ÉLARGIE : ±240°/s au lieu de ±180°/s (33% plus large)
 * [OK] 5. LISSAGE ADAPTATIF : s'adapte à la variance de mouvement
 * [OK] 6. DÉTECTION PRÉDICTIVE : anticipe les changements via accélération
 *
 * Architecture: Adapter - Logique métier de l'exercice
 */

const { exerciseConfig, audioSettings } = require('./configs/RotationContinueConfig');
const Exercise = require('../../../../core/domain/entities/Exercise');
const DirectionDetector = require('../../../../core/domain/services/DirectionDetector');
const SensorAnalyzer = require('../../../../core/domain/services/SensorAnalyzer');
const PlaybackCalculator = require('../../../../core/domain/services/PlaybackCalculator');
const VolumeController = require('../../../../core/domain/services/VolumeController');
const ExerciseMetrics = require('../../../../core/domain/services/ExerciseMetrics');
const BufferManager = require('../../../../core/domain/services/BufferManager');
const ExerciseStateManager = require('../../../../core/domain/services/ExerciseStateManager');
const RepositioningDetector = require('../../../../core/domain/services/RepositioningDetector');
const ProcessSensorUpdateUseCase = require('../../../../core/useCases/ProcessSensorUpdateUseCase');

class RotationContinueExercise extends Exercise {
 constructor({ audioOrchestrator, state, calibrationOrchestrator, audioUIController }) {
 // Appeler le constructeur parent
 super({
 name: 'Rotation Continue',
 duration: exerciseConfig.duration
 });
 this.audioOrchestrator = audioOrchestrator;
 this.state = state;
 this.calibrationOrchestrator = calibrationOrchestrator;
 this.audioUIController = audioUIController;

 // [NEW] v3.6.1 : Configuration externalisée
 this.config = exerciseConfig;
 this.audioSettings = audioSettings;

 // [NEW] v3.6.2 : Services métier
 this.directionDetector = new DirectionDetector(this.config);
 this.sensorAnalyzer = new SensorAnalyzer(this.config);
 this.playbackCalculator = new PlaybackCalculator(this.config);
 this.volumeController = new VolumeController(this.config);
 this.exerciseMetrics = new ExerciseMetrics();
 this.bufferManager = new BufferManager(this.sensorAnalyzer, this.config);
 this.stateManager = new ExerciseStateManager(this.config);
 this.repositioningDetector = new RepositioningDetector(this.config);

 // [NEW] v3.7.0 : Use Case pour orchestration
 this.processSensorUpdateUseCase = new ProcessSensorUpdateUseCase({
 directionDetector: this.directionDetector,
 sensorAnalyzer: this.sensorAnalyzer,
 playbackCalculator: this.playbackCalculator,
 config: this.config,
 calibrationOrchestrator: this.calibrationOrchestrator
 });

 // Note: isActive, startTime hérités depuis Exercise
 this.checkIntervalId = null;
 this.originalAudioParams = null;

 // [NEW] v3.8.0 : Déclaration propriétés d'état (initialisées par StateManager)
 this.lastAngles = null;
 this.lastTimestamp = null;
 this.rotationHistory = null;
 this.velocityBuffer = null;
 this.lastAngularVelocity = null;
 this.lastPlaybackRate = null;
 this.smoothedPlaybackRate = null;
 this.averageVelocity = null;
 this.isInComfortZone = null;
 this.currentVariance = null;
 this.adaptiveSmoothingFactor = null;
 this.currentAngularAcceleration = null;
 this.lastVelocityTimestamp = null;
 this.signedDeltaBuffer = null;
 this.currentDirection = null;
 this.lastDirectionChangeTime = null;
 this.directionChangeCandidate = null;
 this.directionCandidateStartTime = null;
 this.directionConsensusHistory = null;
 this.isInDirectionTransition = null;
 this.directionTransitionStartTime = null;
 this.isRepositioning = null;
 this.repositionStartTime = null;
 this.frozenPlaybackRate = null;
 this.frozenDirection = null;
 this.cumulativeVolumeAngle = null;
 this.lastLeftSensorTimestamp = null;
 this.leftSensorAngle = null;
 this.currentVolume = null;
 this.smoothedVolume = null;
 this.lastVolumeCommand = null;
 this.updateCount = null;
 this.audioCommandCount = null;
 this.lastAudioCommand = null;

 // Initialisation via StateManager
 this.stateManager.applyInitialState(this);

 // Diagnostic snap playback rate
 this.snapDiagnostics = {
 enabled: true,
 lastRate: 1.0,
 snapCount: 0,
 snapThreshold: 0.15
 };
 
 console.log('[RotationContinueExercise] VERSION 3.6.0 - SIMPLIFICATION RADICALE');
 console.log('[RotationContinueExercise] Mapping linéaire universel : vitesse → playback rate proportionnel');
 console.log('[RotationContinueExercise] Référence: 360°/s = 1.0x | Limites: 0.25x-2.0x');
 console.log('[RotationContinueExercise] Pas de zone de confort - Rotation progressive naturelle');
 console.log('[RotationContinueExercise] Utilise CalibrationOrchestrator global');
 }
 
 /**
 * Démarre l'exercice
 */
 start() {
 if (this.isActive) {
 console.warn('[RotationContinueExercise] Exercice déjà actif');
 return false;
 }
 
 console.log('\n═══════════════════════════════════════════════════════════');
 console.log('[RotationContinueExercise] VERSION 3.4 - Démarrage...');
 console.log('[RotationContinueExercise] Contrôle volume potentiomètre activé');
 console.log('═══════════════════════════════════════════════════════════');

 // Vérifier que la calibration globale est disponible
 if (!this.calibrationOrchestrator) {
 console.error('[RotationContinueExercise] [ERROR] CalibrationOrchestrator non disponible !');
 console.error('[RotationContinueExercise] → Veuillez effectuer la calibration dans l\'onglet Calibration d\'abord');
 return false;
 }

 const calibrationModel = this.calibrationOrchestrator.getCalibrationModel();
 if (!calibrationModel || !calibrationModel.isComplete) {
 console.warn('[RotationContinueExercise] [WARNING] Calibration non effectuée !');
 console.warn('[RotationContinueExercise] → Allez dans l\'onglet Calibration pour calibrer les capteurs');
 console.warn('[RotationContinueExercise] → L\'exercice démarrera avec le modèle actuel mais peut être imprécis');
 } else {
 console.log('[RotationContinueExercise] [OK] Calibration globale chargée');
 console.log(` Horaire: ${calibrationModel.clockwise.min.toFixed(1)}° à ${calibrationModel.clockwise.max.toFixed(1)}°`);
 console.log(` Antihoraire: ${calibrationModel.counterclockwise.min.toFixed(1)}° à ${calibrationModel.counterclockwise.max.toFixed(1)}°`);
 }
 console.log('═══════════════════════════════════════════════════════════\n');

 // Sauvegarder et appliquer les paramètres audio optimisés
 const currentParams = this.state.getAudioParameters();
 this.originalAudioParams = {
 grainSize: currentParams.grainSize,
 overlap: currentParams.overlap
 };
 
 console.log('[RotationContinueExercise] Configuration audio:', this.audioSettings);
 this.audioOrchestrator.setGrainSize(this.audioSettings.grainSize);
 this.audioOrchestrator.setOverlap(this.audioSettings.overlap);

 // Initialiser le volume à 50% (position centrale)
 if (this.config.volumeControlEnabled && this.audioOrchestrator && this.audioOrchestrator.setVolume) {
 this.audioOrchestrator.setVolume(this.config.volumeInitialValue);
 console.log(`[RotationContinueExercise] Volume initial: ${(this.config.volumeInitialValue * 100).toFixed(0)}%`);
 }

 // [NEW] v3.8.0 : Réinitialiser état via StateManager
 this.isActive = true;
 this.startTime = Date.now();
 this.stateManager.applyResetState(this);

 // Démarrer la lecture audio
 if (this.audioOrchestrator) {
 const audioState = this.state.getAudioState();
 if (!audioState.isPlaying) {
 this.audioOrchestrator.togglePlayPause();
 console.log('[RotationContinueExercise] Audio démarré');
 }
 }
 
 // Démarrer la surveillance
 this.checkIntervalId = setInterval(() => {
 this._checkProgress();
 }, this.config.checkInterval);
 
 // Notifier l'UI
 this._notifyUI('EXERCISE_STARTED', {
 exerciseName: 'Rotation Continue v3.2',
 duration: this.config.duration,
 targetSpeed: this.config.targetSpeed
 });

 console.log('[RotationContinueExercise] [OK] Exercice démarré');

 return true;
 }
 
 /**
 * Arrête l'exercice
 */
 stop(reason = 'cancelled') {
 if (!this.isActive) {
 return;
 }

 const isCompleted = reason === 'completed';
 console.log(`[RotationContinueExercise] Arrêt... (${isCompleted ? 'COMPLÉTÉ' : 'ANNULÉ'})`);

 this.isActive = false;
 
 // Arrêter la surveillance
 if (this.checkIntervalId) {
 clearInterval(this.checkIntervalId);
 this.checkIntervalId = null;
 }
 
 // Remettre la vitesse normale
 if (this.audioOrchestrator) {
 this.audioOrchestrator.setPlaybackRate(1.0, 1);
 console.log('[RotationContinueExercise] Vitesse audio remise à normale');
 }
 
 // Restaurer les paramètres audio originaux
 if (this.originalAudioParams && this.audioOrchestrator) {
 console.log('[RotationContinueExercise] Restauration paramètres audio');
 this.audioOrchestrator.setGrainSize(this.originalAudioParams.grainSize);
 this.audioOrchestrator.setOverlap(this.originalAudioParams.overlap);
 }

 // Calculer les statistiques
 const stats = this._calculateStats();
 
 console.log('[RotationContinueExercise] Statistiques finales:');
 console.log(` - Updates: ${this.updateCount} | Commandes audio: ${this.audioCommandCount}`);
 console.log(` - Ratio déduplication: ${(this.audioCommandCount / Math.max(1, this.updateCount) * 100).toFixed(1)}%`);
 console.log(` - Vitesse moyenne: ${stats.avgVelocity}°/s (${(stats.avgVelocity/360).toFixed(2)} tour/sec)`);
 
 // Notifier l'UI avec le statut de complétion
 this._notifyUI('EXERCISE_ENDED', {
 exerciseName: 'Rotation Continue v3.2',
 stats: stats,
 completed: isCompleted,
 reason: reason
 });
 }
 
 /**
 * Met à jour avec détection direction robuste
 * Utilise le gyroscope au lieu des deltas d'angles
 * @param {Object} sensorData - { angles: {x,y,z}, gyro: {x,y,z}, accel: {x,y,z} }
 * @param {string} position - 'DROIT' (vitesse) ou 'GAUCHE' (volume) - optionnel, par défaut 'DROIT'
 */
 update(sensorData, position = 'DROIT') {
 if (!this.isActive) {
 return;
 }

 const now = Date.now();
 this.updateCount++;

 // Support ancien format pour compatibilité
 const angles = sensorData.angles || sensorData;
 const gyro = sensorData.gyro || { x: 0, y: 0, z: 0 };

 // Capteur GAUCHE → Contrôle de VOLUME (potentiomètre avec gyroscope)
 if (position === 'GAUCHE' && this.config.volumeControlEnabled) {
 console.log(`[RotationContinue] 📍 GAUCHE détecté - Gyro Y: ${gyro.y.toFixed(1)}°/s`);
 this._updateVolumeFromLeftSensor(angles, gyro, now);
 return; // Le capteur gauche ne gère QUE le volume
 }

 // Capteur DROIT → Contrôle de VITESSE (suite du code existant)

 // Initialisation au premier appel
 if (this.lastTimestamp === null) {
 this.lastTimestamp = now;
 this.lastAngles = { ...angles };
 console.log('[RotationContinueExercise] Premier échantillon - Gyro Y: ' + gyro.y.toFixed(1) + '°/s');
 return;
 }

 const dt = (now - this.lastTimestamp) / 1000;

 // Validation robuste du dt
 if (dt < this.config.minValidDt) {
 return;
 }

 if (dt > this.config.maxValidDt) {
 console.warn(`[RotationContinue] [WARNING] dt aberrant (${(dt*1000).toFixed(0)}ms) - réinitialisation`);
 this.lastTimestamp = now;
 this.lastAngles = { ...angles };
 return;
 }

 // Utiliser directement le gyroscope (vitesse angulaire en °/s)
 let gyroY = gyro.y; // SIGNED: >0 = horaire, <0 = antihoraire
 let angularVelocity = Math.abs(gyroY);

 // Dead zone gyro dynamique (large au repos, étroite en mouvement)
 const currentDeadZone = this.directionDetector.updateDynamicDeadZone(angularVelocity);

 // Appliquer la dead zone dynamique
 if (angularVelocity < currentDeadZone) {
 gyroY = 0;
 angularVelocity = 0;
 }

 this.lastAngularVelocity = angularVelocity;

 // [NEW] v3.7.0 : Utiliser Use Case pour détecter la direction
 const directionResult = this.processSensorUpdateUseCase.updateDirection({
 gyroY,
 now,
 state: {
 signedDeltaBuffer: this.signedDeltaBuffer,
 currentDirection: this.currentDirection,
 lastDirectionChangeTime: this.lastDirectionChangeTime,
 directionChangeCandidate: this.directionChangeCandidate,
 directionCandidateStartTime: this.directionCandidateStartTime,
 directionConsensusHistory: this.directionConsensusHistory,
 lastAngularVelocity: this.lastAngularVelocity,
 currentAngularAcceleration: this.currentAngularAcceleration
 }
 });

 // Appliquer les mises à jour d'état
 if (directionResult.stateUpdates) {
 this.signedDeltaBuffer = directionResult.stateUpdates.signedDeltaBuffer || this.signedDeltaBuffer;
 this.currentDirection = directionResult.stateUpdates.currentDirection || this.currentDirection;
 this.lastDirectionChangeTime = directionResult.stateUpdates.lastDirectionChangeTime !== undefined
 ? directionResult.stateUpdates.lastDirectionChangeTime
 : this.lastDirectionChangeTime;
 this.directionChangeCandidate = directionResult.stateUpdates.directionChangeCandidate !== undefined
 ? directionResult.stateUpdates.directionChangeCandidate
 : this.directionChangeCandidate;
 this.directionCandidateStartTime = directionResult.stateUpdates.directionCandidateStartTime || this.directionCandidateStartTime;
 this.directionConsensusHistory = directionResult.stateUpdates.directionConsensusHistory || this.directionConsensusHistory;

 if (directionResult.stateUpdates.isInDirectionTransition !== undefined) {
 this.isInDirectionTransition = directionResult.stateUpdates.isInDirectionTransition;
 }
 if (directionResult.stateUpdates.directionTransitionStartTime !== undefined) {
 this.directionTransitionStartTime = directionResult.stateUpdates.directionTransitionStartTime;
 }
 }

 // Log changement de direction
 if (directionResult.directionChanged) {
 const oldArrow = directionResult.oldDirection === 1 ? 'CW' : 'CCW';
 const newArrow = directionResult.newDirection === 1 ? 'CW' : 'CCW';
 const metrics = directionResult.metrics || {};

 const logDetails = metrics.predictiveBonus
 ? `Gyro=${metrics.avgGyro?.toFixed(1)}°/s | Accel=${this.currentAngularAcceleration.toFixed(0)}°/s² | ${metrics.candidateStabilityDuration}ms PRÉDIT`
 : `Gyro=${metrics.avgGyro?.toFixed(1)}°/s | ${metrics.candidateStabilityDuration}ms`;

 console.log(`[RotationContinue] CHANGEMENT: ${oldArrow} → ${newArrow} (${logDetails}) → Transition activée`);
 console.log(` └─ Playback: ${this.smoothedPlaybackRate.toFixed(2)}x | Vitesse: ${this.averageVelocity.toFixed(1)}°/s`);
 }

 // Validation : Rejeter vitesses aberrantes (gyroscope max ±2000°/s)
 if (angularVelocity > 2000) {
 console.warn(`[RotationContinue] [WARNING] Vitesse aberrante (${angularVelocity.toFixed(0)}°/s) - ignorée`);
 this.lastTimestamp = now;
 this.lastAngles = { ...angles };
 return;
 }

 // Logs debug périodiques
 if (this.updateCount % 50 === 0) {
 const dirArrow = this.currentDirection === 1 ? 'CW' : 'CCW';
 const gyroDirection = gyroY > 0 ? 'CW' : 'CCW';
 const playbackSpeed = (angularVelocity / this.config.targetSpeed).toFixed(2);
 console.log(`[DEBUG #${this.updateCount}] GY:${gyroY.toFixed(1)}°/s (${gyroDirection}) | Det:${dirArrow} | V:${angularVelocity.toFixed(0)}°/s (${playbackSpeed}x) | DZ:${currentDeadZone.toFixed(2)}°/s`);
 }

 // [NEW] v3.8.0 : Détection repositionnement via RepositioningDetector
 const repositioningResult = this.repositioningDetector.detectRepositioning(
 angularVelocity,
 now,
 {
 isRepositioning: this.isRepositioning,
 repositionStartTime: this.repositionStartTime,
 smoothedPlaybackRate: this.smoothedPlaybackRate,
 currentDirection: this.currentDirection
 }
 );

 // Appliquer les mises à jour d'état
 if (repositioningResult.stateUpdates) {
 Object.keys(repositioningResult.stateUpdates).forEach(key => {
 this[key] = repositioningResult.stateUpdates[key];
 });
 }

 // Log événements de repositionnement
 if (repositioningResult.event) {
 const { type, frozenPlaybackRate, frozenDirection, duration } = repositioningResult.event;

 if (type === 'REPOSITION_START') {
 console.log(`[RotationContinue] Repositionnement - Gel: ${frozenPlaybackRate.toFixed(2)}x dir:${frozenDirection}`);
 } else if (type === 'REPOSITION_END') {
 console.log(`[RotationContinue] Fin repositionnement (${duration}ms)`);
 } else if (type === 'REPOSITION_TIMEOUT') {
 console.warn('[RotationContinue] [WARNING] Repositionnement trop long');
 }
 }

 // [NEW] v3.8.0 : Ajouter au buffer via BufferManager
 const bufferResult = this.bufferManager.addSample(
 this.velocityBuffer,
 {
 timestamp: now,
 velocity: angularVelocity,
 direction: this.currentDirection,
 angles: { ...angles }
 },
 now
 );

 // Mettre à jour l'état avec les résultats du BufferManager
 this.velocityBuffer = bufferResult.velocityBuffer;
 this.averageVelocity = bufferResult.averageVelocity;
 this.currentVariance = bufferResult.variance;
 this.currentAngularAcceleration = bufferResult.angularAcceleration;

 // Enregistrer dans l'historique complet
 this.rotationHistory.push({
 timestamp: now,
 velocity: angularVelocity,
 direction: this.currentDirection,
 angles: { ...angles },
 isRepositioning: this.isRepositioning
 });

 // Contrôler l'audio
 this._controlAudio();

 // Notifier l'UI
 this._notifyUI('EXERCISE_UPDATE', {
 velocity: Math.round(angularVelocity),
 averageVelocity: Math.round(this.averageVelocity),
 targetSpeed: this.config.targetSpeed,
 isInRange: true, // [NEW] v3.6.0 : Plus de notion de zone - toujours valide
 isInComfortZone: false, // [NEW] v3.6.0 : Zone de confort supprimée
 isRepositioning: this.isRepositioning,
 playbackRate: this.smoothedPlaybackRate,
 direction: this.currentDirection
 });

 this.lastAngles = { ...angles };
 this.lastTimestamp = now;
 }


 /**
 * Contrôle audio - Délégué au Use Case
 * @private
 */
 _controlAudio() {
 if (!this.audioOrchestrator) {
 return;
 }

 const now = Date.now();

 // [NEW] v3.7.0 : Déléguer au Use Case
 const audioResult = this.processSensorUpdateUseCase.calculateAudioCommand({
 state: {
 velocityBuffer: this.velocityBuffer,
 averageVelocity: this.averageVelocity,
 isRepositioning: this.isRepositioning,
 frozenPlaybackRate: this.frozenPlaybackRate,
 frozenDirection: this.frozenDirection,
 isInDirectionTransition: this.isInDirectionTransition,
 directionTransitionStartTime: this.directionTransitionStartTime,
 smoothedPlaybackRate: this.smoothedPlaybackRate,
 currentVariance: this.currentVariance,
 currentDirection: this.currentDirection
 },
 now
 });

 // Skip si pas prêt
 if (audioResult.shouldSkip) {
 return;
 }

 // Appliquer mises à jour d'état
 if (audioResult.stateUpdates) {
 this.smoothedPlaybackRate = audioResult.stateUpdates.smoothedPlaybackRate || this.smoothedPlaybackRate;
 this.adaptiveSmoothingFactor = audioResult.stateUpdates.adaptiveSmoothingFactor || this.adaptiveSmoothingFactor;
 if (audioResult.stateUpdates.isInDirectionTransition !== undefined) {
 this.isInDirectionTransition = audioResult.stateUpdates.isInDirectionTransition;
 }
 }

 const { command, metrics } = audioResult;

 // Log périodique pour debug
 if (this.updateCount % 50 === 0 && metrics) {
 const ratio = this.averageVelocity / this.config.targetSpeed;
 console.log(`[Playback] Vitesse:${this.averageVelocity.toFixed(0)}°/s → Rate:${metrics.targetPlaybackRate?.toFixed(2)}x (ratio:${ratio.toFixed(2)})`);
 }

 // Log transition
 if (this.isInDirectionTransition && metrics?.transitionEnded === false) {
 const transitionElapsed = now - this.directionTransitionStartTime;
 if (transitionElapsed < 50) {
 console.log(`[RotationContinue] Transition audio activée (${this.config.directionTransitionDuration}ms à ${(this.config.directionTransitionSpeedFactor*100).toFixed(0)}%)`);
 }
 } else if (metrics?.transitionEnded === true) {
 console.log(`[RotationContinue] [OK] Transition audio terminée`);
 }

 // Diagnostic snap - Détecter les sauts brusques
 if (this.snapDiagnostics.enabled) {
 const rateDelta = Math.abs(command.playbackRate - this.snapDiagnostics.lastRate);

 if (rateDelta > this.snapDiagnostics.snapThreshold) {
 this.snapDiagnostics.snapCount++;
 console.warn(`[!] [SNAP #${this.snapDiagnostics.snapCount}] Détecté: ${this.snapDiagnostics.lastRate.toFixed(2)}x → ${command.playbackRate.toFixed(2)}x`);
 console.warn(` ├─ Vitesse: ${this.averageVelocity.toFixed(1)}°/s | Target: ${metrics?.targetPlaybackRate?.toFixed(2)}x`);
 console.warn(` ├─ Repositionnement: ${this.isRepositioning ? 'OUI' : 'NON'}`);
 console.warn(` ├─ Direction: ${this.currentDirection === 1 ? 'CW Horaire' : 'CCW Antihoraire'} | Transition: ${this.isInDirectionTransition ? 'OUI' : 'NON'}`);
 console.warn(` └─ Smoothing: ${metrics?.smoothingFactor?.toFixed(2)} | Variance: ${this.currentVariance.toFixed(1)}`);
 }

 this.snapDiagnostics.lastRate = command.playbackRate;
 }

 // Envoyer commande
 this._sendAudioCommand(command.playbackRate, command.direction, command.context);
 }
 
 /**
 * Envoie commande audio avec déduplication
 * @private
 */
 _sendAudioCommand(rate, direction, context = 'NORMAL') {
 const now = Date.now();
 
 const rateDiff = Math.abs(rate - this.lastAudioCommand.rate);
 const directionChanged = direction !== this.lastAudioCommand.direction;
 const timeSinceLastCommand = now - this.lastAudioCommand.timestamp;
 
 if (!directionChanged && rateDiff < 0.02 && timeSinceLastCommand < 500) {
 return;
 }
 
 if (directionChanged || rateDiff > 0.05 || this.audioCommandCount % 5 === 0) {
 const arrow = direction === 1 ? 'CW' : 'CCW';
 const changeInfo = directionChanged ? ` | ${this.lastAudioCommand.direction === 1 ? 'CW' : 'CCW'} → ${arrow}` : '';
 const deltaTime = timeSinceLastCommand > 0 ? ` | Δt: ${timeSinceLastCommand}ms` : '';
 
 console.log(`[AUDIO CMD #${this.audioCommandCount}] ${context} | Rate: ${rate.toFixed(2)}x${changeInfo}${deltaTime}`);
 }
 
 this.audioOrchestrator.setPlaybackRate(rate, direction);

 // Mise à jour affichage UI en temps réel
 if (this.audioUIController && this.audioUIController.updateSpeedDisplay) {
 const isNeutral = false;
 this.audioUIController.updateSpeedDisplay(rate, direction, isNeutral);
 }

 this.lastAudioCommand = {
 rate: rate,
 direction: direction,
 timestamp: now
 };

 this.audioCommandCount++;
 }

 /**
 * Contrôle de volume potentiomètre avec capteur gauche
 * [OK] v3.6.5 : Utilise VolumeController service
 *
 * @param {Object} angles - Angles Euler du capteur gauche
 * @param {Object} gyro - Vitesses angulaires du gyroscope {x, y, z}
 * @param {number} now - Timestamp actuel
 * @private
 */
 _updateVolumeFromLeftSensor(angles, gyro, now) {
 // 1. CALCUL DT via VolumeController
 const dt = this.volumeController.calculateDeltaTime(now, this.lastLeftSensorTimestamp);
 this.lastLeftSensorTimestamp = now;

 if (dt === 0) {
 return; // Première lecture ou dt invalide
 }

 // 2. TRAITER VITESSE ANGULAIRE via VolumeController
 let angularVelocity = this.volumeController.applyInversion(gyro.y);

 // 3. METTRE À JOUR ANGLE CUMULATIF via VolumeController
 this.cumulativeVolumeAngle = this.volumeController.updateCumulativeAngle(
 this.cumulativeVolumeAngle,
 angularVelocity,
 dt
 );

 // 4. MAPPER ANGLE → VOLUME via VolumeController
 let targetVolume = this.volumeController.calculateVolumeFromAngle(
 this.cumulativeVolumeAngle,
 this.lastKnownVolume
 );

 // Mémoriser volume pour zone morte
 if (targetVolume !== this.lastKnownVolume) {
 this.lastKnownVolume = targetVolume;
 }

 // 5. LISSAGE via VolumeController
 const smoothingFactor = this.config.volumeSmoothingFactor;
 this.smoothedVolume = this.volumeController.smoothVolume(
 this.smoothedVolume,
 targetVolume,
 smoothingFactor
 );

 // 6. SNAP TO EDGES via VolumeController
 this.smoothedVolume = this.volumeController.snapToEdges(
 this.smoothedVolume,
 this.cumulativeVolumeAngle,
 2 // edgeThreshold
 );

 // 7. ENVOYER COMMANDE
 this._sendVolumeCommand(this.smoothedVolume, now);
 }

 /**
 * Envoie commande de volume avec déduplication
 * [OK] v3.6.5 : Utilise VolumeController service
 * @param {number} volume - Volume (0.0 à 1.0)
 * @param {number} now - Timestamp actuel
 * @private
 */
 _sendVolumeCommand(volume, now) {
 const timeSinceLastCommand = now - this.lastVolumeCommand.timestamp;

 // Déduplication via VolumeController
 if (!this.volumeController.shouldSendCommand(volume, this.lastVolumeCommand.volume, timeSinceLastCommand)) {
 return;
 }

 // Appliquer le volume via audioOrchestrator
 if (this.audioOrchestrator && this.audioOrchestrator.setVolume) {
 this.audioOrchestrator.setVolume(volume);
 }

 // Mémoriser dernière commande
 this.lastVolumeCommand.volume = volume;
 this.lastVolumeCommand.timestamp = now;
 }


 /**
 * Vérifie la progression
 * @private
 */
 _checkProgress() {
 if (!this.isActive) {
 return;
 }

 const elapsed = Date.now() - this.startTime;

 if (elapsed >= this.config.duration) {
 console.log('[RotationContinueExercise] Durée atteinte - Exercice COMPLÉTÉ');
 this.stop('completed'); // Marquer comme complété (vs 'cancelled')
 return;
 }
 
 const progress = Math.round((elapsed / this.config.duration) * 100);
 
 this._notifyUI('EXERCISE_PROGRESS', {
 elapsed: elapsed,
 duration: this.config.duration,
 progress: progress
 });
 }
 
 /**
 * Notifie l'UI
 * @private
 */
 _notifyUI(eventType, data) {
 if (this.state && this.state.notify) {
 this.state.notify(eventType, data);
 }
 
 if (typeof window !== 'undefined') {
 window.dispatchEvent(new CustomEvent('exercise-event', {
 detail: {
 type: eventType,
 data: data
 }
 }));
 }
 }
 
 /**
 * Calcule les statistiques
 * [OK] v3.6.6 : Utilise ExerciseMetrics service
 * @private
 */
 _calculateStats() {
 return this.exerciseMetrics.calculateStats(
 this.rotationHistory,
 this.startTime,
 this.updateCount,
 this.audioCommandCount
 );
 }
 
 /**
 * État actuel
 */
 getStatus() {
 // Calculer ratio de deltas positifs (inline)
 const positiveDeltaRatio = this.signedDeltaBuffer.length === 0
 ? 0.5
 : this.signedDeltaBuffer.filter(s => s.delta > 0).length / this.signedDeltaBuffer.length;

 return {
 isActive: this.isActive,
 elapsed: this.isActive ? Date.now() - this.startTime : 0,
 config: { ...this.config },
 historyLength: this.rotationHistory.length,
 lastVelocity: this.lastAngularVelocity,
 averageVelocity: this.averageVelocity,
 lastPlaybackRate: this.smoothedPlaybackRate,
 isInComfortZone: this.isInComfortZone,
 isRepositioning: this.isRepositioning,
 direction: this.currentDirection,
 positiveDeltaRatio,
 directionCandidate: this.directionChangeCandidate,
 bufferSize: this.velocityBuffer.length,
 updateCount: this.updateCount,
 audioCommandCount: this.audioCommandCount
 };
 }
 
 /**
 * Met à jour la configuration
 */
 updateConfig(newConfig) {
 this.config = { ...this.config, ...newConfig };
 console.log('[RotationContinueExercise] Configuration mise à jour:', this.config);
 }
 
 /**
 * Nettoyage
 */
 dispose() {
 this.stop();
 console.log('[RotationContinueExercise] Disposed');
 }
}

module.exports = RotationContinueExercise;