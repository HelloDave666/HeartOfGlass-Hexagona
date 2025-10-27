// src/adapters/primary/ui/utils/SensorUtils.js
// Phase 6 - Step 10 : Utilitaires Capteurs
// Fonctions utilitaires pour manipulation des données capteurs

class SensorUtils {
  /**
   * Obtient les informations d'un capteur depuis son adresse
   * @param {string} address - Adresse MAC du capteur
   * @param {Object} sensorConfig - Configuration des capteurs (leftAddress, rightAddress, leftColor, rightColor)
   * @returns {Object|null} - { position: 'GAUCHE'|'DROIT', color: string } ou null si non trouvé
   */
  static getSensorInfo(address, sensorConfig) {
    const addrLower = address.toLowerCase();
    
    if (addrLower === sensorConfig.leftAddress.toLowerCase()) {
      return { position: 'GAUCHE', color: sensorConfig.leftColor };
    }
    
    if (addrLower === sensorConfig.rightAddress.toLowerCase()) {
      return { position: 'DROIT', color: sensorConfig.rightColor };
    }
    
    return null;
  }

  /**
   * Normalise un angle dans l'intervalle [-180, 180]
   * @param {number} angle - Angle en degrés
   * @returns {number} - Angle normalisé
   */
  static normalizeAngle(angle) {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  }

  /**
   * Calcule la vitesse angulaire depuis deux mesures
   * @param {number} currentAngle - Angle actuel
   * @param {number} previousAngle - Angle précédent
   * @param {number} deltaTime - Delta temps en secondes
   * @returns {number} - Vitesse angulaire en degrés/seconde
   */
  static calculateAngularVelocity(currentAngle, previousAngle, deltaTime) {
    if (deltaTime <= 0) return 0;
    return (currentAngle - previousAngle) / deltaTime;
  }

  /**
   * Vérifie si un angle est dans la dead zone
   * @param {number} angle - Angle à vérifier
   * @param {number} deadZone - Taille de la dead zone en degrés
   * @returns {boolean} - True si dans la dead zone
   */
  static isInDeadZone(angle, deadZone) {
    return Math.abs(angle) <= deadZone;
  }

  /**
   * Calcule les angles normalisés depuis un offset de calibration
   * @param {Object} rawAngles - Angles bruts { x, y, z }
   * @param {Object} calibrationOffset - Offset de calibration { x, y, z }
   * @returns {Object} - Angles normalisés { x, y, z }
   */
  static normalizeAnglesWithOffset(rawAngles, calibrationOffset) {
    return {
      x: SensorUtils.normalizeAngle(rawAngles.x - calibrationOffset.x),
      y: SensorUtils.normalizeAngle(rawAngles.y - calibrationOffset.y),
      z: SensorUtils.normalizeAngle(rawAngles.z - calibrationOffset.z)
    };
  }

  /**
   * Parse les données du protocole BWT901BLECL5.0
   * @param {Uint8Array|Array} data - Données brutes du capteur
   * @returns {Object|null} - { x, y, z } en degrés ou null si invalide
   */
  static parseBWT901Data(data) {
    if (!data || data.length < 20) return null;
    
    // Protocole BWT901BLECL5.0 : header 0x55 0x61
    if (data[0] !== 0x55 || data[1] !== 0x61) return null;
    
    return {
      x: ((data[15] << 8 | data[14]) / 32768 * 180),
      y: ((data[17] << 8 | data[16]) / 32768 * 180),
      z: ((data[19] << 8 | data[18]) / 32768 * 180)
    };
  }

  /**
   * Calcule la distance entre deux angles (en tenant compte de la circularité)
   * @param {number} angle1 - Premier angle en degrés
   * @param {number} angle2 - Second angle en degrés
   * @returns {number} - Distance angulaire minimale
   */
  static angularDistance(angle1, angle2) {
    const diff = Math.abs(angle1 - angle2);
    return diff > 180 ? 360 - diff : diff;
  }

  /**
   * Applique un filtre de lissage exponentiel
   * @param {number} currentValue - Valeur actuelle
   * @param {number} previousValue - Valeur précédente lissée
   * @param {number} smoothingFactor - Facteur de lissage [0-1] (0 = pas de lissage, 1 = lissage maximal)
   * @returns {number} - Valeur lissée
   */
  static exponentialSmoothing(currentValue, previousValue, smoothingFactor) {
    return previousValue + smoothingFactor * (currentValue - previousValue);
  }

  /**
   * Mappe un angle vers une plage de valeurs
   * @param {number} angle - Angle en degrés
   * @param {number} minAngle - Angle minimum
   * @param {number} maxAngle - Angle maximum
   * @param {number} minValue - Valeur minimum de sortie
   * @param {number} maxValue - Valeur maximum de sortie
   * @returns {number} - Valeur mappée et clampée
   */
  static mapAngleToRange(angle, minAngle, maxAngle, minValue, maxValue) {
    // Clamper l'angle d'entrée
    const clampedAngle = Math.max(minAngle, Math.min(maxAngle, angle));
    
    // Mapper linéairement
    const normalized = (clampedAngle - minAngle) / (maxAngle - minAngle);
    return minValue + normalized * (maxValue - minValue);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SensorUtils;
}