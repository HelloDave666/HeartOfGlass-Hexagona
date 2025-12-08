/**
 * CalibrationOrchestrator.js
 *
 * Orchestrateur de calibration globale des capteurs IMU.
 * Gère le workflow de calibration en 3 phases :
 * 1. Repos (rest) - Mesure du bruit de fond
 * 2. Horaire (clockwise) - Capture plage rotation horaire
 * 3. Antihoraire (counterclockwise) - Capture plage rotation antihoraire
 *
 * Architecture: Orchestrator - Coordonne la calibration entre UI et StateManager
 */

class CalibrationOrchestrator {
 constructor({ state, onCalibrationUpdate, onCalibrationComplete }) {
 this.state = state;
 this.onCalibrationUpdate = onCalibrationUpdate;
 this.onCalibrationComplete = onCalibrationComplete;

 // État de calibration actuel
 this.currentPhase = null; // 'rest', 'clockwise', 'counterclockwise', null
 this.phaseStartTime = null;
 this.phaseData = {
 samples: [],
 startTime: null
 };

 // Modèle de calibration (résultats)
 this.calibrationModel = {
 rest: {
 noiseLevel: 0,
 samples: 0
 },
 clockwise: {
 min: Infinity,
 max: -Infinity,
 avg: 0,
 samples: 0,
 deltas: []
 },
 counterclockwise: {
 min: Infinity,
 max: -Infinity,
 avg: 0,
 samples: 0,
 deltas: []
 },
 isComplete: false,
 timestamp: null
 };

 // Configuration
 this.config = {
 minSamplesRest: 50, // ~1.5s à 30Hz
 minSamplesRotation: 100, // ~3s à 30Hz
 minSeparation: 10 // 10° minimum entre horaire/antihoraire
 };

 // Dernier angle enregistré (pour calculer deltas)
 this.lastAngle = null;
 this.lastTimestamp = null;

 console.log('[CalibrationOrchestrator] Créé et prêt');
 }

 /**
 * Démarre une phase de calibration
 * @param {string} phase - 'rest', 'clockwise', 'counterclockwise'
 * @returns {boolean} - true si démarré avec succès
 */
 startPhase(phase) {
 if (this.currentPhase !== null) {
 console.warn('[CalibrationOrchestrator] Phase déjà en cours:', this.currentPhase);
 return false;
 }

 if (!['rest', 'clockwise', 'counterclockwise'].includes(phase)) {
 console.error('[CalibrationOrchestrator] Phase invalide:', phase);
 return false;
 }

 console.log(`[CalibrationOrchestrator] Démarrage phase: ${phase}`);

 this.currentPhase = phase;
 this.phaseStartTime = Date.now();
 this.phaseData = {
 samples: [],
 startTime: Date.now()
 };
 this.lastAngle = null;
 this.lastTimestamp = null;

 // Notifier UI
 this._notifyUpdate({
 phase: phase,
 status: 'started',
 samplesCollected: 0,
 message: this._getPhaseInstruction(phase)
 });

 return true;
 }

 /**
 * Arrête la phase actuelle et calcule les résultats
 * @returns {Object|null} - Résultats de la phase ou null si erreur
 */
 stopPhase() {
 if (this.currentPhase === null) {
 console.warn('[CalibrationOrchestrator] Aucune phase active');
 return null;
 }

 const phase = this.currentPhase;
 const samples = this.phaseData.samples;

 console.log(`[CalibrationOrchestrator] Arrêt phase: ${phase} (${samples.length} échantillons)`);

 // Vérifier minimum d'échantillons
 const minSamples = phase === 'rest'
 ? this.config.minSamplesRest
 : this.config.minSamplesRotation;

 if (samples.length < minSamples) {
 console.warn(`[CalibrationOrchestrator] Pas assez d'échantillons: ${samples.length}/${minSamples}`);
 this._notifyUpdate({
 phase: phase,
 status: 'error',
 samplesCollected: samples.length,
 message: `Pas assez de données (${samples.length}/${minSamples}). Continuez à tourner.`
 });
 return null;
 }

 // Calculer les résultats selon la phase
 let results = null;

 if (phase === 'rest') {
 results = this._calculateRestResults(samples);
 this.calibrationModel.rest = results;

 } else if (phase === 'clockwise') {
 results = this._calculateRotationResults(samples);
 this.calibrationModel.clockwise = results;

 } else if (phase === 'counterclockwise') {
 results = this._calculateRotationResults(samples);
 this.calibrationModel.counterclockwise = results;
 }

 // Réinitialiser état
 this.currentPhase = null;
 this.phaseStartTime = null;
 this.lastAngle = null;
 this.lastTimestamp = null;

 // Notifier UI
 this._notifyUpdate({
 phase: phase,
 status: 'completed',
 samplesCollected: samples.length,
 results: results,
 message: `Phase ${phase} terminée avec succès !`
 });

 // Vérifier si calibration complète
 if (this._isCalibrationComplete()) {
 this._finalizeCalibration();
 }

 return results;
 }

 /**
 * Annule la phase actuelle sans sauvegarder
 */
 cancelPhase() {
 if (this.currentPhase === null) {
 return;
 }

 console.log(`[CalibrationOrchestrator] Annulation phase: ${this.currentPhase}`);

 const phase = this.currentPhase;
 this.currentPhase = null;
 this.phaseStartTime = null;
 this.lastAngle = null;
 this.lastTimestamp = null;

 this._notifyUpdate({
 phase: phase,
 status: 'cancelled',
 message: 'Phase annulée'
 });
 }

 /**
 * Traite les données IMU pendant une phase active
 * @param {Object} sensorData - Objet SensorData avec {angles: {x,y,z}, gyro: {x,y,z}, accel: {x,y,z}}
 */
 processIMUData(sensorData) {
 if (this.currentPhase === null) {
 return; // Pas de phase active
 }

 const now = Date.now();

 // Support de l'ancien format (angles uniquement) pour compatibilité
 const gyro = sensorData.gyro || { x: 0, y: 0, z: 0 };
 const angles = sensorData.angles || sensorData; // Fallback si appelé avec ancien format

 // LOG DÉTAILLÉ : Afficher les données brutes toutes les 30 frames
 if (this.phaseData.samples.length % 30 === 0) {
 console.log(`[CalibrationOrchestrator] Phase ${this.currentPhase} | Gyro: GX=${gyro.x.toFixed(1)}°/s GY=${gyro.y.toFixed(1)}°/s GZ=${gyro.z.toFixed(1)}°/s | Angles: Y=${angles.y.toFixed(1)}°`);
 }

 // Phase repos : collecter le niveau de bruit du gyroscope
 if (this.currentPhase === 'rest') {
 // Utiliser directement la vitesse angulaire du gyroscope (pas besoin de calculer de delta)
 const gyroVelocity = Math.abs(gyro.y); // Vitesse angulaire Y en °/s

 this.phaseData.samples.push({
 timestamp: now,
 velocity: gyroVelocity
 });

 // Notifier progression avec vitesse moyenne
 if (this.phaseData.samples.length % 15 === 0) {
 const avgVelocity = this.phaseData.samples.reduce((sum, s) => sum + s.velocity, 0) / this.phaseData.samples.length;
 this._notifyUpdate({
 phase: this.currentPhase,
 status: 'collecting',
 samplesCollected: this.phaseData.samples.length,
 progress: Math.min(100, (this.phaseData.samples.length / this.config.minSamplesRest) * 100),
 currentVelocity: avgVelocity
 });
 }

 return;
 }

 // Phases rotation : collecter les vitesses angulaires SIGNÉES du gyroscope
 if (this.currentPhase === 'clockwise' || this.currentPhase === 'counterclockwise') {
 // Utiliser directement le gyroscope Y (SIGNÉ!)
 // Note: Le signe (+ ou -) dépend de l'orientation physique du capteur
 // On collecte simplement les valeurs sans interpréter le signe
 const gyroY = gyro.y; // En °/s, avec signe
 const velocity = Math.abs(gyroY);

 // LOG DÉTAILLÉ : Afficher les données toutes les 30 frames
 // Note: On n'interprète PAS le signe (horaire/antihoraire) car ça dépend de l'orientation du capteur
 if (this.phaseData.samples.length % 30 === 0) {
 const sign = gyroY >= 0 ? '+' : '-';
 console.log(`[CalibrationOrchestrator] Phase ${this.currentPhase} | GY=${sign}${velocity.toFixed(1)}°/s | ${this.phaseData.samples.length} échantillons`);
 }

 this.phaseData.samples.push({
 timestamp: now,
 delta: gyroY, // Vitesse angulaire signée (comportement de potentiomètre!)
 velocity: velocity
 });

 // Notifier progression avec delta moyen et vitesse
 if (this.phaseData.samples.length % 15 === 0) {
 const avgDelta = this.phaseData.samples.reduce((sum, s) => sum + s.delta, 0) / this.phaseData.samples.length;
 const avgVelocity = this.phaseData.samples.reduce((sum, s) => sum + s.velocity, 0) / this.phaseData.samples.length;
 this._notifyUpdate({
 phase: this.currentPhase,
 status: 'collecting',
 samplesCollected: this.phaseData.samples.length,
 progress: Math.min(100, (this.phaseData.samples.length / this.config.minSamplesRotation) * 100),
 currentDelta: avgDelta,
 currentVelocity: avgVelocity
 });
 }
 }
 }

 /**
 * Calcule les résultats de la phase repos
 * @private
 */
 _calculateRestResults(samples) {
 const avgVelocity = samples.reduce((sum, s) => sum + s.velocity, 0) / samples.length;

 return {
 noiseLevel: avgVelocity,
 samples: samples.length
 };
 }

 /**
 * Calcule les résultats d'une phase de rotation
 * @private
 */
 _calculateRotationResults(samples) {
 const deltas = samples.map(s => s.delta);
 const min = Math.min(...deltas);
 const max = Math.max(...deltas);
 const avg = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;

 return {
 min: min,
 max: max,
 avg: avg,
 samples: samples.length,
 deltas: deltas
 };
 }

 /**
 * Vérifie si toutes les phases sont complètes
 * @private
 */
 _isCalibrationComplete() {
 const restComplete = (
 this.calibrationModel.rest.samples > 0 &&
 typeof this.calibrationModel.rest.noiseLevel === 'number'
 );

 const clockwiseComplete = (
 this.calibrationModel.clockwise.samples > 0 &&
 typeof this.calibrationModel.clockwise.avg === 'number' &&
 typeof this.calibrationModel.clockwise.min === 'number' &&
 typeof this.calibrationModel.clockwise.max === 'number'
 );

 const counterclockwiseComplete = (
 this.calibrationModel.counterclockwise.samples > 0 &&
 typeof this.calibrationModel.counterclockwise.avg === 'number' &&
 typeof this.calibrationModel.counterclockwise.min === 'number' &&
 typeof this.calibrationModel.counterclockwise.max === 'number'
 );

 const isComplete = restComplete && clockwiseComplete && counterclockwiseComplete;

 console.log(`[CalibrationOrchestrator] Check complete: rest=${restComplete}, cw=${clockwiseComplete}, ccw=${counterclockwiseComplete} => ${isComplete}`);

 return isComplete;
 }

 /**
 * Finalise la calibration et sauvegarde dans StateManager
 * @private
 */
 _finalizeCalibration() {
 console.log('\n═══════════════════════════════════════════════════════════');
 console.log('[CalibrationOrchestrator] FINALISATION CALIBRATION');
 console.log('═══════════════════════════════════════════════════════════');

 const rest = this.calibrationModel.rest;
 const clockwise = this.calibrationModel.clockwise;
 const counterclockwise = this.calibrationModel.counterclockwise;

 // Vérifier que toutes les données sont présentes
 if (!rest || typeof rest.noiseLevel !== 'number') {
 console.error('[CalibrationOrchestrator] Données de repos invalides');
 return;
 }

 if (!clockwise || typeof clockwise.avg !== 'number' ||
 typeof clockwise.min !== 'number' || typeof clockwise.max !== 'number') {
 console.error('[CalibrationOrchestrator] Données horaire invalides');
 return;
 }

 if (!counterclockwise || typeof counterclockwise.avg !== 'number' ||
 typeof counterclockwise.min !== 'number' || typeof counterclockwise.max !== 'number') {
 console.error('[CalibrationOrchestrator] Données antihoraire invalides');
 return;
 }

 console.log(`\n RÉSULTATS :`);
 console.log(` Repos: ${rest.noiseLevel.toFixed(2)}°/s (${rest.samples} échantillons)`);
 console.log(` Horaire: Moy=${clockwise.avg.toFixed(2)}° | [${clockwise.min.toFixed(2)}, ${clockwise.max.toFixed(2)}] (${clockwise.samples} échantillons)`);
 console.log(` Antihoraire: Moy=${counterclockwise.avg.toFixed(2)}° | [${counterclockwise.min.toFixed(2)}, ${counterclockwise.max.toFixed(2)}] (${counterclockwise.samples} échantillons)`);

 // Vérifier séparation
 const separation = Math.abs(clockwise.avg - counterclockwise.avg);
 console.log(`\n[OK] SÉPARATION : ${separation.toFixed(2)}°`);

 if (separation < this.config.minSeparation) {
 console.warn(` [WARNING] Séparation faible (${separation.toFixed(2)}° < ${this.config.minSeparation}°)`);
 console.warn(` → Risque de détection imprécise`);
 } else {
 console.log(` [OK] Séparation suffisante`);
 }

 // Détecter inversion du capteur
 const clockwiseIsNegative = clockwise.avg < -5;
 const counterclockwiseIsPositive = counterclockwise.avg > 5;

 console.log(`\n ORIENTATION CAPTEUR :`);
 if (clockwiseIsNegative && counterclockwiseIsPositive) {
 console.log(` CAPTEUR INVERSÉ détecté !`);
 console.log(` → Horaire: ${clockwise.avg.toFixed(2)}° (négatif)`);
 console.log(` → Antihoraire: ${counterclockwise.avg.toFixed(2)}° (positif)`);
 console.log(` → Les plages seront automatiquement inversées`);

 // Inverser les plages
 const temp = this.calibrationModel.clockwise;
 this.calibrationModel.clockwise = this.calibrationModel.counterclockwise;
 this.calibrationModel.counterclockwise = temp;

 } else {
 console.log(` [OK] Capteur orientation NORMALE`);
 console.log(` → Horaire: ${clockwise.avg.toFixed(2)}°`);
 console.log(` → Antihoraire: ${counterclockwise.avg.toFixed(2)}°`);
 }

 // Marquer comme complet
 this.calibrationModel.isComplete = true;
 this.calibrationModel.timestamp = Date.now();

 // Sauvegarder dans StateManager
 this._saveToState();

 // Sauvegarder dans localStorage
 this._saveToLocalStorage();

 console.log('\n═══════════════════════════════════════════════════════════');
 console.log('[OK] CALIBRATION TERMINÉE ET SAUVEGARDÉE !');
 console.log('═══════════════════════════════════════════════════════════\n');

 // Notifier UI
 if (this.onCalibrationComplete) {
 this.onCalibrationComplete({
 model: this.calibrationModel,
 separation: separation,
 isValid: separation >= this.config.minSeparation
 });
 }
 }

 /**
 * Sauvegarde dans StateManager
 * @private
 */
 _saveToState() {
 if (!this.state) return;

 // Utiliser la Map calibrationOffsets existante
 const calibrationOffsets = this.state.getCalibrationOffsets();
 calibrationOffsets.set('global', this.calibrationModel);

 console.log('[CalibrationOrchestrator] Modèle sauvegardé dans StateManager');
 }

 /**
 * Sauvegarde dans localStorage
 * @private
 */
 _saveToLocalStorage() {
 try {
 const data = {
 model: this.calibrationModel,
 timestamp: Date.now()
 };
 localStorage.setItem('hog-calibration', JSON.stringify(data));
 console.log('[CalibrationOrchestrator] Modèle sauvegardé dans localStorage');
 } catch (error) {
 console.error('[CalibrationOrchestrator] Erreur sauvegarde localStorage:', error);
 }
 }

 /**
 * Charge la calibration depuis localStorage
 * @returns {boolean} - true si chargé avec succès
 */
 loadFromLocalStorage() {
 try {
 const data = localStorage.getItem('hog-calibration');
 if (!data) return false;

 const parsed = JSON.parse(data);
 if (!parsed.model || !parsed.model.isComplete) return false;

 this.calibrationModel = parsed.model;
 console.log('[CalibrationOrchestrator] Calibration chargée depuis localStorage');

 // Sauvegarder aussi dans StateManager
 this._saveToState();

 return true;
 } catch (error) {
 console.error('[CalibrationOrchestrator] Erreur chargement localStorage:', error);
 return false;
 }
 }

 /**
 * Récupère le modèle de calibration actuel
 * @returns {Object} - Modèle de calibration
 */
 getCalibrationModel() {
 return this.calibrationModel;
 }

 /**
 * Vérifie si la calibration est complète
 * @returns {boolean}
 */
 isCalibrated() {
 return this.calibrationModel.isComplete === true;
 }

 /**
 * Réinitialise la calibration
 */
 reset() {
 console.log('[CalibrationOrchestrator] Réinitialisation calibration');

 this.currentPhase = null;
 this.phaseStartTime = null;
 this.lastAngle = null;
 this.lastTimestamp = null;

 this.calibrationModel = {
 rest: { noiseLevel: 0, samples: 0 },
 clockwise: { min: Infinity, max: -Infinity, avg: 0, samples: 0, deltas: [] },
 counterclockwise: { min: Infinity, max: -Infinity, avg: 0, samples: 0, deltas: [] },
 isComplete: false,
 timestamp: null
 };

 // Supprimer de localStorage
 try {
 localStorage.removeItem('hog-calibration');
 } catch (error) {
 console.error('[CalibrationOrchestrator] Erreur suppression localStorage:', error);
 }

 this._notifyUpdate({
 status: 'reset',
 message: 'Calibration réinitialisée'
 });
 }

 /**
 * Récupère l'instruction pour une phase
 * @private
 */
 _getPhaseInstruction(phase) {
 const instructions = {
 rest: 'Maintenez le capteur IMMOBILE sur la table.',
 clockwise: 'Tournez le capteur LENTEMENT dans le sens HORAIRE (CW). Faites plusieurs tours à votre vitesse habituelle.',
 counterclockwise: 'Tournez le capteur LENTEMENT dans le sens ANTIHORAIRE (CCW). Faites plusieurs tours à votre vitesse habituelle.'
 };
 return instructions[phase] || '';
 }

 /**
 * Notifie l'UI d'une mise à jour
 * @private
 */
 _notifyUpdate(update) {
 if (this.onCalibrationUpdate) {
 this.onCalibrationUpdate(update);
 }
 }

 /**
 * Nettoyage
 */
 dispose() {
 this.currentPhase = null;
 this.phaseStartTime = null;
 this.lastAngle = null;
 this.lastTimestamp = null;
 console.log('[CalibrationOrchestrator] Disposed');
 }
}

// Export CommonJS
if (typeof module !== 'undefined' && module.exports) {
 module.exports = CalibrationOrchestrator;
}
