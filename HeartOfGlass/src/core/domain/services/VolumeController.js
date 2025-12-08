/**
 * VolumeController.js
 *
 * Service métier pour le contrôle de volume potentiomètre avec capteur gauche
 *
 * Modèle potentiomètre physique avec butées :
 * - Zone gauche (-90° à 0°) : 0% → 50% volume (rotation antihoraire)
 * - Position centrale (0°) : 50% volume
 * - Zone droite (0° à 90°) : 50% → 100% volume (rotation horaire)
 * - Zone morte (au-delà de ±90°) : garde le volume actuel (butées physiques)
 *
 * Architecture: Core/Domain/Services
 */

class VolumeController {
  constructor(config) {
    this.config = config;
  }

  /**
   * Met à jour l'angle cumulatif basé sur le gyroscope
   *
   * @param {number} currentCumulativeAngle - Angle cumulatif actuel (°)
   * @param {number} angularVelocity - Vitesse angulaire du gyroscope (°/s)
   * @param {number} dt - Temps écoulé depuis dernière mesure (s)
   * @returns {number} Nouvel angle cumulatif avec butées appliquées (-90° à +90°)
   */
  updateCumulativeAngle(currentCumulativeAngle, angularVelocity, dt) {
    // Zone morte gyroscope (ignorer micro-mouvements)
    if (Math.abs(angularVelocity) < this.config.volumeGyroDeadZone) {
      return currentCumulativeAngle;
    }

    // Calculer changement d'angle : delta = vitesse × temps
    const deltaAngle = angularVelocity * dt;

    // Ajouter au cumul
    let newAngle = currentCumulativeAngle + deltaAngle;

    // Clamper l'angle entre -90° et +90° (butées strictes)
    const maxAngle = this.config.volumeRightZoneEnd; // 90°
    newAngle = Math.max(-maxAngle, Math.min(maxAngle, newAngle));

    return newAngle;
  }

  /**
   * Calcule le volume cible à partir de l'angle cumulatif
   * Mapping linéaire potentiomètre :
   * - Zone gauche (-90° à 0°) : 0% → 50%
   * - Zone droite (0° à 90°) : 50% → 100%
   *
   * @param {number} cumulativeAngle - Angle cumulatif (°)
   * @param {number} lastKnownVolume - Dernier volume connu (pour zone morte)
   * @returns {number} Volume cible (0.0 à 1.0)
   */
  calculateVolumeFromAngle(cumulativeAngle, lastKnownVolume) {
    const maxAngle = this.config.volumeRightZoneEnd; // 90°
    let targetVolume;

    // Zone active DROITE (0° à 90°) : 50% → 100% volume
    if (cumulativeAngle >= 0 && cumulativeAngle <= maxAngle) {
      const progress = cumulativeAngle / maxAngle; // 0.0 à 1.0
      targetVolume = 0.5 + (progress * 0.5); // 0.5 à 1.0
    }
    // Zone active GAUCHE (-90° à 0°) : 0% → 50% volume
    else if (cumulativeAngle < 0 && cumulativeAngle >= -maxAngle) {
      const progress = (cumulativeAngle + maxAngle) / maxAngle; // 0.0 à 1.0
      targetVolume = progress * 0.5; // 0.0 à 0.5
    }
    // Zones MORTES (sécurité)
    else {
      targetVolume = lastKnownVolume;
    }

    // Clamper entre 0 et 1
    return Math.max(0.0, Math.min(1.0, targetVolume));
  }

  /**
   * Lisse le volume pour affichage UI stable
   * Utilise un filtre exponentiel (EMA - Exponential Moving Average)
   *
   * @param {number} currentSmoothedVolume - Volume lissé actuel
   * @param {number} targetVolume - Volume cible
   * @param {number} smoothingFactor - Facteur de lissage (0.0 à 1.0)
   * @returns {number} Volume lissé arrondi
   */
  smoothVolume(currentSmoothedVolume, targetVolume, smoothingFactor) {
    const smoothed =
      currentSmoothedVolume * (1 - smoothingFactor) +
      targetVolume * smoothingFactor;

    // Arrondir pour éviter micro-variations
    return Math.round(smoothed * 100) / 100;
  }

  /**
   * Snap to edge : Force les limites exactes quand aux butées
   * Si l'angle est à ±90° (butées), forcer 0% ou 100% exactement
   *
   * @param {number} smoothedVolume - Volume lissé actuel
   * @param {number} cumulativeAngle - Angle cumulatif (°)
   * @param {number} edgeThreshold - Seuil en degrés pour considérer qu'on est à la butée (défaut: 2°)
   * @returns {number} Volume avec snap aux butées
   */
  snapToEdges(smoothedVolume, cumulativeAngle, edgeThreshold = 2) {
    const maxAngle = this.config.volumeRightZoneEnd; // 90°

    // Butée droite → 100%
    if (Math.abs(cumulativeAngle - maxAngle) < edgeThreshold) {
      return 1.0;
    }
    // Butée gauche → 0%
    else if (Math.abs(cumulativeAngle + maxAngle) < edgeThreshold) {
      return 0.0;
    }

    return smoothedVolume;
  }

  /**
   * Détermine si une commande de volume doit être envoyée (déduplication)
   *
   * @param {number} currentVolume - Volume actuel
   * @param {number} lastSentVolume - Dernier volume envoyé
   * @param {number} timeSinceLastCommand - Temps depuis dernière commande (ms)
   * @returns {boolean} true si la commande doit être envoyée
   */
  shouldSendCommand(currentVolume, lastSentVolume, timeSinceLastCommand) {
    const volumeDiff = Math.abs(currentVolume - lastSentVolume);

    // Déduplication : ignorer si changement < 2% et délai < 100ms
    if (volumeDiff < 0.02 && timeSinceLastCommand < 100) {
      return false;
    }

    return true;
  }

  /**
   * Calcule le dt (temps écoulé) avec validation
   *
   * @param {number} now - Timestamp actuel (ms)
   * @param {number} lastTimestamp - Timestamp précédent (ms)
   * @returns {number} dt en secondes (0 si invalide)
   */
  calculateDeltaTime(now, lastTimestamp) {
    if (lastTimestamp === 0) {
      return 0; // Première lecture
    }

    const dt = (now - lastTimestamp) / 1000; // Convertir ms → s

    // Sécurité : ignorer les dt aberrants
    if (dt > 0.5 || dt <= 0) {
      return 0;
    }

    return dt;
  }

  /**
   * Applique l'inversion pour capteur gauche si configuré
   *
   * @param {number} angularVelocity - Vitesse angulaire (°/s)
   * @returns {number} Vitesse angulaire inversée si nécessaire
   */
  applyInversion(angularVelocity) {
    if (this.config.leftSensorInverted) {
      return -angularVelocity;
    }
    return angularVelocity;
  }
}

module.exports = VolumeController;
