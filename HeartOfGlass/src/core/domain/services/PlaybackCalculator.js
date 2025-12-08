/**
 * PlaybackCalculator - Service de calcul du playback rate
 *
 * Responsabilités:
 * - Calculer le playback rate cible à partir de la vitesse angulaire
 * - Lisser le playback rate pour éviter les variations brusques
 * - Gérer les transitions lors des changements de direction
 *
 * Architecture : Core/Domain/Services
 */
class PlaybackCalculator {
 /**
 * @param {Object} config - Configuration du calculateur
 */
 constructor(config) {
 this.config = config;
 }

 /**
 * Calcule le playback rate cible à partir de la vitesse angulaire
 * Mapping linéaire universel : vitesse → playback rate proportionnel
 * 360°/s (1 tour/sec) = 1.0x playback rate (référence)
 *
 * @param {number} averageVelocity - Vitesse angulaire moyenne (°/s)
 * @param {boolean} isInTransition - Est en transition de direction
 * @param {number} transitionElapsed - Temps écoulé depuis début transition (ms)
 * @returns {number} Playback rate cible (0.25x - 2.0x)
 */
 calculateTargetRate(averageVelocity, isInTransition = false, transitionElapsed = 0) {
 // [NEW] v3.6.0 : MAPPING LINÉAIRE UNIVERSEL
 // Pas de zones spéciales - juste un ratio proportionnel
 const ratio = averageVelocity / this.config.targetSpeed;
 let targetPlaybackRate = ratio;

 // Clamper entre les limites configurées (0.25x - 2.0x)
 targetPlaybackRate = Math.max(
 this.config.minPlaybackRate,
 Math.min(this.config.maxPlaybackRate, targetPlaybackRate)
 );

 // [NEW] TRANSITION DOUCE lors changement de direction pour éviter artefacts audio
 if (isInTransition && transitionElapsed < this.config.directionTransitionDuration) {
 // Encore en transition : réduire temporairement la vitesse
 const transitionFactor = this.config.directionTransitionSpeedFactor;
 targetPlaybackRate *= transitionFactor;
 }

 return targetPlaybackRate;
 }

 /**
 * Lisse le playback rate pour éviter les variations brusques
 * Utilise un filtre exponentiel (EMA - Exponential Moving Average)
 *
 * @param {number} currentRate - Playback rate actuel lissé
 * @param {number} targetRate - Playback rate cible
 * @param {number} smoothingFactor - Facteur de lissage (0-1)
 * @returns {number} Playback rate lissé
 */
 smoothPlaybackRate(currentRate, targetRate, smoothingFactor) {
 // Filtre EMA : new = old * (1-α) + target * α
 // α proche de 0 → très lissé (lent à réagir)
 // α proche de 1 → peu lissé (réactif)
 const smoothedRate = currentRate * (1 - smoothingFactor) + targetRate * smoothingFactor;

 // Arrondir à 2 décimales pour éviter accumulation d'erreurs
 return Math.round(smoothedRate * 100) / 100;
 }

 /**
 * Calcule le facteur de lissage adaptatif basé sur la variance
 * Variance faible (mouvement régulier) → lissage faible (réactif)
 * Variance élevée (mouvement irrégulier) → lissage fort (stable)
 *
 * @param {number} variance - Variance de la vitesse (°/s)²
 * @returns {number} Facteur de lissage adaptatif (baseSmoothingFactor - maxSmoothingFactor)
 */
 calculateAdaptiveSmoothingFactor(variance) {
 if (!this.config.adaptiveSmoothingEnabled) {
 // Si désactivé, utiliser le smoothing factor standard
 return this.config.smoothingFactor;
 }

 // Normaliser la variance entre 0 et 1
 // variance faible (mouvement régulier) → 0
 // variance élevée (mouvement irrégulier) → 1
 const normalizedVariance = Math.min(1.0, variance / this.config.varianceThreshold);

 // Interpoler entre le lissage minimal et maximal
 const adaptiveFactor =
 this.config.baseSmoothingFactor +
 normalizedVariance * (this.config.maxSmoothingFactor - this.config.baseSmoothingFactor);

 return adaptiveFactor;
 }

 /**
 * Détecte les "snaps" (changements brusques de playback rate)
 * Utile pour le diagnostic et l'optimisation
 *
 * @param {number} previousRate - Rate précédent
 * @param {number} currentRate - Rate actuel
 * @param {number} threshold - Seuil de détection (ex: 0.15)
 * @returns {Object} { isSnap: boolean, delta: number }
 */
 detectSnap(previousRate, currentRate, threshold = 0.15) {
 const delta = Math.abs(currentRate - previousRate);
 const isSnap = delta > threshold;

 return {
 isSnap,
 delta
 };
 }

 /**
 * Calcule les statistiques de playback pour monitoring
 *
 * @param {number} smoothedRate - Rate lissé actuel
 * @param {number} targetRate - Rate cible
 * @param {number} averageVelocity - Vitesse moyenne
 * @returns {Object} Statistiques
 */
 getPlaybackStats(smoothedRate, targetRate, averageVelocity) {
 return {
 smoothedRate: smoothedRate.toFixed(2),
 targetRate: targetRate.toFixed(2),
 velocity: averageVelocity.toFixed(1),
 ratio: (averageVelocity / this.config.targetSpeed).toFixed(2),
 delta: Math.abs(smoothedRate - targetRate).toFixed(3)
 };
 }
}

module.exports = PlaybackCalculator;
