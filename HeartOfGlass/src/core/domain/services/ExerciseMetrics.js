/**
 * ExerciseMetrics.js
 *
 * Service métier pour le calcul des statistiques d'exercice
 *
 * Responsable de :
 * - Calcul des statistiques de vitesse (moyenne, max, min)
 * - Comptage des rotations par direction (horaire/antihoraire)
 * - Comptage des repositionnements
 * - Calcul du ratio de déduplication des commandes audio
 * - Génération du rapport de statistiques complet
 *
 * Architecture: Core/Domain/Services
 */

class ExerciseMetrics {
 constructor() {
 // Service stateless - pas de configuration nécessaire
 }

 /**
 * Calcule les statistiques de vitesse à partir de l'historique
 *
 * @param {Array} rotationHistory - Historique des rotations [{velocity, direction, timestamp, ...}]
 * @returns {Object} Statistiques de vitesse {avg, max, min}
 */
 calculateVelocityStats(rotationHistory) {
 if (!rotationHistory || rotationHistory.length === 0) {
 return {
 avg: 0,
 max: 0,
 min: 0
 };
 }

 const velocities = rotationHistory.map(h => h.velocity);
 const sum = velocities.reduce((a, b) => a + b, 0);
 const avg = sum / velocities.length;
 const max = Math.max(...velocities);
 const min = Math.min(...velocities);

 return {
 avg: Math.round(avg),
 max: Math.round(max),
 min: Math.round(min)
 };
 }

 /**
 * Compte les rotations par direction
 *
 * @param {Array} rotationHistory - Historique des rotations
 * @returns {Object} Comptage {forward, backward}
 */
 countDirections(rotationHistory) {
 if (!rotationHistory || rotationHistory.length === 0) {
 return {
 forward: 0,
 backward: 0
 };
 }

 const forward = rotationHistory.filter(h => h.direction === 1).length;
 const backward = rotationHistory.filter(h => h.direction === -1).length;

 return { forward, backward };
 }

 /**
 * Compte le nombre de repositionnements distincts
 * Un repositionnement est compté quand on passe de non-repositioning à repositioning
 *
 * @param {Array} rotationHistory - Historique des rotations
 * @returns {number} Nombre de repositionnements
 */
 countRepositions(rotationHistory) {
 if (!rotationHistory || rotationHistory.length === 0) {
 return 0;
 }

 let repositionCount = 0;
 let wasRepositioning = false;

 for (const sample of rotationHistory) {
 if (sample.isRepositioning && !wasRepositioning) {
 repositionCount++;
 }
 wasRepositioning = sample.isRepositioning;
 }

 return repositionCount;
 }

 /**
 * Calcule le ratio de déduplication des commandes audio
 * Indique combien de commandes audio sont envoyées par rapport au nombre total d'updates
 *
 * @param {number} audioCommandCount - Nombre de commandes audio envoyées
 * @param {number} updateCount - Nombre total d'updates
 * @returns {number} Ratio en pourcentage (0-100)
 */
 calculateDeduplicationRatio(audioCommandCount, updateCount) {
 if (updateCount === 0) {
 return 0;
 }

 const ratio = (audioCommandCount / updateCount) * 100;
 return Math.round(ratio);
 }

 /**
 * Calcule la durée écoulée en secondes
 *
 * @param {number} startTime - Timestamp de démarrage (ms)
 * @param {number} endTime - Timestamp de fin (ms), par défaut Date.now()
 * @returns {number} Durée en secondes
 */
 calculateDuration(startTime, endTime = null) {
 const end = endTime || Date.now();
 const durationMs = end - startTime;
 return Math.round(durationMs / 1000);
 }

 /**
 * Génère le rapport complet de statistiques
 * Méthode principale qui orchestre tous les calculs
 *
 * @param {Array} rotationHistory - Historique des rotations
 * @param {number} startTime - Timestamp de démarrage
 * @param {number} updateCount - Nombre total d'updates
 * @param {number} audioCommandCount - Nombre de commandes audio
 * @returns {Object} Rapport complet de statistiques
 */
 calculateStats(rotationHistory, startTime, updateCount, audioCommandCount) {
 // Cas vide : historique vide
 if (!rotationHistory || rotationHistory.length === 0) {
 return {
 avgVelocity: 0,
 maxVelocity: 0,
 minVelocity: 0,
 duration: 0,
 samplesInRange: 0,
 totalSamples: 0,
 consistency: 0,
 forwardRotations: 0,
 backwardRotations: 0,
 repositionCount: 0,
 totalUpdates: updateCount,
 totalAudioCommands: audioCommandCount,
 deduplicationRatio: 0
 };
 }

 // Calculer les statistiques de vitesse
 const velocityStats = this.calculateVelocityStats(rotationHistory);

 // Compter les directions
 const directions = this.countDirections(rotationHistory);

 // Compter les repositionnements
 const repositionCount = this.countRepositions(rotationHistory);

 // Calculer le ratio de déduplication
 const deduplicationRatio = this.calculateDeduplicationRatio(audioCommandCount, updateCount);

 // Calculer la durée
 const duration = this.calculateDuration(startTime);

 // [NEW] v3.6.0 : Plus de notion de zone - tous les échantillons sont valides
 const samplesInRange = rotationHistory.length;
 const consistency = 100; // Toujours 100% sans zone de confort

 return {
 avgVelocity: velocityStats.avg,
 maxVelocity: velocityStats.max,
 minVelocity: velocityStats.min,
 duration: duration,
 samplesInRange: samplesInRange,
 totalSamples: rotationHistory.length,
 consistency: consistency,
 forwardRotations: directions.forward,
 backwardRotations: directions.backward,
 repositionCount: repositionCount,
 totalUpdates: updateCount,
 totalAudioCommands: audioCommandCount,
 deduplicationRatio: deduplicationRatio
 };
 }
}

module.exports = ExerciseMetrics;
