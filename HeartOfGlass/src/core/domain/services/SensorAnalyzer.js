/**
 * SensorAnalyzer - Service d'analyse des données capteurs
 *
 * Responsabilités:
 * - Calculer la vitesse angulaire à partir des données gyroscope
 * - Calculer la variance de vitesse (pour lissage adaptatif)
 * - Calculer l'accélération angulaire (pour détection prédictive)
 *
 * Architecture : Core/Domain/Services
 */
class SensorAnalyzer {
  /**
   * @param {Object} config - Configuration de l'analyseur
   */
  constructor(config) {
    this.config = config;

    // État interne pour le calcul de l'accélération
    this.lastVelocity = 0;
    this.lastVelocityTimestamp = 0;
  }

  /**
   * Calcule la vitesse angulaire à partir des données gyroscope
   *
   * @param {Object} gyro - Données gyroscope {x, y, z}
   * @returns {Object} { signedVelocity: number, absoluteVelocity: number }
   */
  calculateAngularVelocity(gyro) {
    // Utiliser directement le gyroscope Y (vitesse angulaire en °/s)
    // Plus besoin de calculer de deltas ni de gérer les discontinuités !
    const signedVelocity = gyro.y;  // SIGNED: >0 = horaire, <0 = antihoraire
    const absoluteVelocity = Math.abs(signedVelocity);

    return {
      signedVelocity,
      absoluteVelocity
    };
  }

  /**
   * Calcule la variance de vitesse
   * Utilisé pour le lissage adaptatif (variance élevée → plus de lissage)
   *
   * @param {Array} velocityBuffer - Buffer des échantillons de vitesse
   * @param {number} averageVelocity - Vitesse moyenne actuelle
   * @returns {number} Variance de la vitesse (°/s)²
   */
  calculateVelocityVariance(velocityBuffer, averageVelocity) {
    if (velocityBuffer.length < 3) {
      return 0;
    }

    // Calculer la somme des carrés des écarts
    let sumSquaredDiff = 0;
    for (const sample of velocityBuffer) {
      const diff = sample.velocity - averageVelocity;
      sumSquaredDiff += diff * diff;
    }

    // Variance = moyenne des carrés des écarts
    return sumSquaredDiff / velocityBuffer.length;
  }

  /**
   * Calcule l'accélération angulaire
   * Permet de détecter les changements de direction plus tôt (détection prédictive)
   *
   * @param {number} currentVelocity - Vitesse angulaire actuelle (°/s)
   * @param {number} timestamp - Timestamp actuel (ms)
   * @returns {number} Accélération angulaire (°/s²)
   */
  calculateAngularAcceleration(currentVelocity, timestamp) {
    if (!this.config.predictiveDetectionEnabled || this.lastVelocityTimestamp === 0) {
      this.lastVelocity = currentVelocity;
      this.lastVelocityTimestamp = timestamp;
      return 0;
    }

    const dt = (timestamp - this.lastVelocityTimestamp) / 1000; // Convertir en secondes

    // Ignorer les valeurs aberrantes
    if (dt <= 0 || dt > 0.5) {
      this.lastVelocity = currentVelocity;
      this.lastVelocityTimestamp = timestamp;
      return 0;
    }

    // Accélération = (v_current - v_last) / dt
    const acceleration = (currentVelocity - this.lastVelocity) / dt;

    // Mettre à jour pour le prochain calcul
    this.lastVelocity = currentVelocity;
    this.lastVelocityTimestamp = timestamp;

    return acceleration;
  }

  /**
   * Calcule le facteur de lissage adaptatif basé sur la variance
   * Variance faible (mouvement régulier) → lissage minimal
   * Variance élevée (mouvement irrégulier) → lissage maximal
   *
   * @param {number} variance - Variance actuelle de la vitesse
   * @returns {number} Facteur de lissage adaptatif
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
   * Réinitialise l'état interne de l'analyseur
   */
  reset() {
    this.lastVelocity = 0;
    this.lastVelocityTimestamp = 0;
  }

  /**
   * Obtient l'état actuel de l'analyseur (pour debug)
   * @returns {Object} État actuel
   */
  getState() {
    return {
      lastVelocity: this.lastVelocity,
      lastVelocityTimestamp: this.lastVelocityTimestamp
    };
  }
}

module.exports = SensorAnalyzer;
