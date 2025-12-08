/**
 * BufferManager.js
 *
 * Service de gestion des buffers de vélocité (fenêtre glissante)
 *
 * Responsabilités :
 * - Gérer le buffer de vélocités avec fenêtre glissante temporelle
 * - Calculer la moyenne des vélocités
 * - Calculer la variance pour lissage adaptatif
 * - Coordonner avec SensorAnalyzer pour accélération angulaire
 *
 * Architecture: Core/Domain/Services
 */

class BufferManager {
  constructor(sensorAnalyzer, config) {
    this.sensorAnalyzer = sensorAnalyzer;
    this.config = config;
  }

  /**
   * Ajoute un échantillon au buffer et applique la fenêtre glissante
   *
   * @param {Array} velocityBuffer - Buffer actuel de vélocités
   * @param {Object} sample - Échantillon à ajouter {timestamp, velocity, direction, angles}
   * @param {number} now - Timestamp actuel
   * @returns {Object} {velocityBuffer, averageVelocity, variance, angularAcceleration}
   */
  addSample(velocityBuffer, sample, now) {
    // 1. AJOUTER ÉCHANTILLON
    const newBuffer = [...velocityBuffer, sample];

    // 2. FENÊTRE GLISSANTE (garder seulement les échantillons dans la fenêtre temporelle)
    const windowStart = now - this.config.samplingWindow;
    const filteredBuffer = newBuffer.filter(s => s.timestamp >= windowStart);

    // 3. CALCULER STATISTIQUES
    let averageVelocity = 0;
    let variance = 0;
    let angularAcceleration = 0;

    if (filteredBuffer.length > 0) {
      // Moyenne
      const sum = filteredBuffer.reduce((acc, s) => acc + s.velocity, 0);
      averageVelocity = sum / filteredBuffer.length;

      // Variance (pour lissage adaptatif)
      variance = this._calculateVariance(filteredBuffer, averageVelocity);

      // Accélération angulaire (pour détection prédictive)
      angularAcceleration = this.sensorAnalyzer.calculateAngularAcceleration(
        averageVelocity,
        now
      );
    }

    return {
      velocityBuffer: filteredBuffer,
      averageVelocity,
      variance,
      angularAcceleration
    };
  }

  /**
   * Calcule la variance du buffer de vélocités
   * @private
   */
  _calculateVariance(buffer, average) {
    if (buffer.length < 2) {
      return 0;
    }

    const squaredDiffs = buffer.map(s => Math.pow(s.velocity - average, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / buffer.length;

    return variance;
  }

  /**
   * Vérifie si le buffer contient assez d'échantillons pour une décision
   *
   * @param {Array} velocityBuffer - Buffer de vélocités
   * @returns {boolean} True si assez d'échantillons
   */
  hasEnoughSamples(velocityBuffer) {
    return velocityBuffer.length >= this.config.minSamplesForDecision;
  }
}

module.exports = BufferManager;
