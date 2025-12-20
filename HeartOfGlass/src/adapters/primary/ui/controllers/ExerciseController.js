/**
 * ExerciseController.js
 * 
 * Contrôleur principal pour gérer les exercices
 * 
 * Architecture: Primary Adapter - Orchestration des exercices
 */

const path = require('path');

class ExerciseController {
 constructor({ audioOrchestrator, state, calibrationOrchestrator, audioUIController }) {
 this.audioOrchestrator = audioOrchestrator;
 this.state = state;
 this.calibrationOrchestrator = calibrationOrchestrator;
 this.audioUIController = audioUIController;
 
 // Exercice actif
 this.currentExercise = null;
 this.currentExerciseName = null;
 
 // Catalogue des exercices disponibles
 this.availableExercises = {
 rotationContinue: {
 name: 'Rotation Continue',
 description: 'Maintenir une rotation constante',
 class: null // Chargé à l'initialisation
 }
 };
 
 console.log('[ExerciseController] Controller créé');
 }
 
 /**
 * Initialise le contrôleur et charge les exercices
 */
 initialize() {
 console.log('[ExerciseController] Initialisation...');
 
 try {
 // Charger l'exercice RotationContinue avec chemin RELATIF
 // ExerciseController est dans: src/adapters/primary/ui/controllers/
 // RotationContinue est dans: src/adapters/primary/ui/exercises/
 // Donc: ../exercises/RotationContinueExercise.js
 const RotationContinueExercise = require(
 path.join(__dirname, '..', 'exercises', 'RotationContinueExercise.js')
 );
 
 this.availableExercises.rotationContinue.class = RotationContinueExercise;
 
 console.log('[ExerciseController] [OK] Exercices chargés:', Object.keys(this.availableExercises));
 } catch (error) {
 console.error('[ExerciseController] Erreur chargement exercices:', error);
 throw error;
 }
 }
 
 /**
 * Démarre un exercice
 * @param {string} exerciseName - Nom de l'exercice (rotationContinue, etc.)
 */
 startExercise(exerciseName, duration = '5min') {
 console.log('[ExerciseController] Démarrage exercice:', exerciseName, 'Durée:', duration);

 // Vérifier si un exercice est déjà actif
 if (this.currentExercise) {
 console.warn('[ExerciseController] Un exercice est déjà actif, arrêt...');
 this.stopCurrentExercise();
 }

 // Vérifier si l'exercice existe
 const exerciseConfig = this.availableExercises[exerciseName];
 if (!exerciseConfig || !exerciseConfig.class) {
 console.error('[ExerciseController] Exercice inconnu:', exerciseName);
 return false;
 }

 try {
 // Créer l'instance de l'exercice
 const ExerciseClass = exerciseConfig.class;
 this.currentExercise = new ExerciseClass({
 audioOrchestrator: this.audioOrchestrator,
 state: this.state,
 calibrationOrchestrator: this.calibrationOrchestrator,
 audioUIController: this.audioUIController
 });

 this.currentExerciseName = exerciseName;

 // Configurer la durée de l'exercice AVANT de le démarrer
 const durationMs = this._convertDurationToMs(duration);
 if (this.currentExercise.config && durationMs !== null) {
 this.currentExercise.config.duration = durationMs;
 console.log(`[ExerciseController] Durée configurée: ${durationMs}ms (${duration})`);
 }

 // Démarrer l'exercice
 const started = this.currentExercise.start();

 if (started) {
 console.log('[ExerciseController] [OK] Exercice démarré:', exerciseName, `(${duration})`);
 return true;
 } else {
 console.error('[ExerciseController] Échec démarrage exercice');
 this.currentExercise = null;
 this.currentExerciseName = null;
 return false;
 }
 } catch (error) {
 console.error('[ExerciseController] Erreur démarrage exercice:', error);
 this.currentExercise = null;
 this.currentExerciseName = null;
 return false;
 }
 }

 /**
 * Convertit une durée en millisecondes
 * @param {string} duration - '3min', '5min', 'free'
 * @returns {number|null}
 * @private
 */
 _convertDurationToMs(duration) {
 switch(duration) {
 case '3min':
 return 3 * 60 * 1000; // 180000ms
 case '5min':
 return 5 * 60 * 1000; // 300000ms
 case 'free':
 return 365 * 24 * 60 * 60 * 1000; // 1 an (temps infini effectif)
 default:
 console.warn('[ExerciseController] Durée invalide:', duration);
 return 5 * 60 * 1000; // Par défaut 5min
 }
 }
 
 /**
 * Arrête l'exercice en cours
 */
 stopCurrentExercise() {
 if (!this.currentExercise) {
 console.warn('[ExerciseController] Aucun exercice actif');
 return false;
 }
 
 console.log('[ExerciseController] Arrêt exercice:', this.currentExerciseName);
 
 try {
 this.currentExercise.stop();
 this.currentExercise.dispose();
 
 this.currentExercise = null;
 this.currentExerciseName = null;
 
 console.log('[ExerciseController] [OK] Exercice arrêté');
 return true;
 } catch (error) {
 console.error('[ExerciseController] Erreur arrêt exercice:', error);
 return false;
 }
 }
 
 /**
 * Met à jour les données capteurs depuis les IMU
 * [OK] MODIFIÉ : Accepte maintenant toutes les données du capteur
 * [NEW] v3.3 : Supporte le paramètre position pour capteur GAUCHE (volume)
 * À appeler depuis app.js quand les données capteurs changent
 * @param {Object} sensorData - { angles: {x,y,z}, gyro: {x,y,z}, accel: {x,y,z} }
 * @param {string} position - 'DROIT' (vitesse) ou 'GAUCHE' (volume) - optionnel, par défaut 'DROIT'
 */
 updateAngles(sensorData, position = 'DROIT') {
 if (this.currentExercise && this.currentExercise.update) {
 this.currentExercise.update(sensorData, position);
 }
 }
 
 /**
 * Retourne l'état actuel
 */
 getStatus() {
 return {
 hasActiveExercise: this.currentExercise !== null,
 currentExerciseName: this.currentExerciseName,
 availableExercises: Object.keys(this.availableExercises),
 exerciseStatus: this.currentExercise ? this.currentExercise.getStatus() : null
 };
 }
 
 /**
 * Nettoyage
 */
 dispose() {
 console.log('[ExerciseController] Dispose...');
 
 if (this.currentExercise) {
 this.stopCurrentExercise();
 }
 
 console.log('[ExerciseController] [OK] Disposed');
 }
}

module.exports = ExerciseController;