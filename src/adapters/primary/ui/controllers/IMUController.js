// src/adapters/primary/ui/controllers/IMUController.js
// Phase 5 - Step 7 : Controller pour le contrôle IMU vers audio

/**
 * IMUController
 * Gère le mapping des capteurs IMU vers les paramètres audio
 * 
 * Responsabilités :
 * - Activation/désactivation du contrôle IMU
 * - Mapping angles IMU → Playback rate (main droite)
 * - Mapping angles IMU → Volume (main gauche)
 * - Lissage (smoothing) des valeurs
 * - Gestion de la deadzone
 * - Calculs de vélocité angulaire
 */
class IMUController {
  constructor(config = {}) {
    // Configuration IMU
    this.velocitySensitivity = config.velocitySensitivity || 2.0;
    this.volumeSensitivity = config.volumeSensitivity || 1.0;
    this.minPlaybackRate = config.minPlaybackRate || 0.1;
    this.maxPlaybackRate = config.maxPlaybackRate || 3.0;
    this.volumeAngleRange = config.volumeAngleRange || 45;
    this.deadZone = config.deadZone || 2.0;
    this.smoothingFactor = config.smoothingFactor || 0.3;
    
    // État
    this.enabled = false;
    this.smoothedPlaybackRate = 1.0;
    
    // Callbacks
    this.onSpeedUpdate = config.onSpeedUpdate || (() => {});
    this.onVolumeUpdate = config.onVolumeUpdate || (() => {});
    
    console.log('[IMUController] Instancié');
  }
  
  /**
   * Initialise le controller
   * @returns {boolean} - Succès de l'initialisation
   */
  initialize() {
    console.log('[IMUController] Initialisation...');
    
    try {
      console.log('[IMUController] Configuration:');
      console.log('  - Dead zone:', this.deadZone, '°');
      console.log('  - Smoothing factor:', this.smoothingFactor);
      console.log('  - Velocity sensitivity:', this.velocitySensitivity);
      console.log('  - Volume sensitivity:', this.volumeSensitivity);
      
      console.log('[IMUController] ✓ Initialisé');
      return true;
      
    } catch (error) {
      console.error('[IMUController] Erreur initialisation:', error);
      return false;
    }
  }
  
  /**
   * Active ou désactive le contrôle IMU
   * @param {boolean} enabled - État du contrôle IMU
   * @param {Object} audioSystem - Système audio pour reset playback rate
   */
  setEnabled(enabled, audioSystem = null) {
    this.enabled = enabled;
    
    if (this.enabled) {
      this.smoothedPlaybackRate = 1.0;
      console.log('[IMUController] Contrôle IMU vinyle ACTIVÉ');
      console.log('[IMUController] Main DROITE = Vitesse (rotation Pitch Y)');
      console.log('[IMUController] Main GAUCHE = Volume (angle Pitch Y)');
    } else {
      // Reset playback rate à 1.0 quand désactivé
      if (audioSystem) {
        audioSystem.setPlaybackRate(1.0, 1);
      }
      this.smoothedPlaybackRate = 1.0;
      console.log('[IMUController] Contrôle IMU désactivé');
    }
  }
  
  /**
   * Vérifie si le contrôle IMU est activé
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }
  
  /**
   * Applique les données IMU au système audio
   * @param {string} position - Position du capteur ('GAUCHE' ou 'DROIT')
   * @param {Object} angles - Angles {x, y, z}
   * @param {number} angularVelocity - Vitesse angulaire
   * @param {Object} audioSystem - Système audio
   * @param {number} sensitivity - Sensibilité utilisateur (depuis UI)
   */
  applyToAudio(position, angles, angularVelocity, audioSystem, sensitivity = 1.0) {
    if (!this.enabled || !audioSystem) {
      return;
    }
    
    if (position === 'DROIT') {
      this._applyRightHandControl(angles.y, audioSystem, sensitivity);
    } else if (position === 'GAUCHE') {
      this._applyLeftHandControl(angles.y, audioSystem);
    }
  }
  
  /**
   * Contrôle main droite : vitesse de lecture
   * @private
   * @param {number} angle - Angle Y (pitch)
   * @param {Object} audioSystem - Système audio
   * @param {number} sensitivity - Sensibilité utilisateur
   */
  _applyRightHandControl(angle, audioSystem, sensitivity) {
    let playbackRate;
    let direction;
    
    // Dead zone : pas de mouvement si angle trop petit
    if (Math.abs(angle) <= this.deadZone) {
      playbackRate = 1.0;
      direction = 1;
      
      this.smoothedPlaybackRate = 1.0;
      audioSystem.setPlaybackRate(1.0, 1);
      
      // Callback pour mise à jour UI
      this.onSpeedUpdate(1.0, 1, true); // true = dans la deadzone
      
    } 
    // Angle positif : lecture avant accélérée
    else if (angle > this.deadZone) {
      const normalizedAngle = Math.min(angle - this.deadZone, 90) / 90;
      playbackRate = 1.0 + (normalizedAngle * sensitivity);
      direction = 1;
      
      // Clamp entre min et max
      playbackRate = Math.max(this.minPlaybackRate, Math.min(this.maxPlaybackRate, playbackRate));
      
      // Lissage exponentiel
      const newRate = this.smoothedPlaybackRate + (playbackRate - this.smoothedPlaybackRate) * this.smoothingFactor;
      this.smoothedPlaybackRate = newRate;
      
      audioSystem.setPlaybackRate(this.smoothedPlaybackRate, direction);
      
      // Callback pour mise à jour UI
      this.onSpeedUpdate(this.smoothedPlaybackRate, direction, false);
      
    } 
    // Angle négatif : lecture arrière
    else {
      const normalizedAngle = Math.min(Math.abs(angle) - this.deadZone, 90) / 90;
      playbackRate = 1.0 + (normalizedAngle * sensitivity);
      direction = -1;
      
      // Clamp entre min et max
      playbackRate = Math.max(this.minPlaybackRate, Math.min(this.maxPlaybackRate, playbackRate));
      
      // Lissage exponentiel
      const newRate = this.smoothedPlaybackRate + (playbackRate - this.smoothedPlaybackRate) * this.smoothingFactor;
      this.smoothedPlaybackRate = newRate;
      
      audioSystem.setPlaybackRate(this.smoothedPlaybackRate, direction);
      
      // Callback pour mise à jour UI
      this.onSpeedUpdate(this.smoothedPlaybackRate, direction, false);
    }
  }
  
  /**
   * Contrôle main gauche : volume
   * @private
   * @param {number} angle - Angle Y (pitch)
   * @param {Object} audioSystem - Système audio
   */
  _applyLeftHandControl(angle, audioSystem) {
    // Normaliser l'angle entre -45° et +45°
    const normalizedAngle = Math.max(-this.volumeAngleRange, Math.min(this.volumeAngleRange, angle));
    
    // Convertir en ratio 0.0 - 1.0
    const volumeRatio = (normalizedAngle + this.volumeAngleRange) / (this.volumeAngleRange * 2);
    
    // Appliquer la sensibilité
    const volume = volumeRatio * this.volumeSensitivity;
    
    audioSystem.setVolume(volume);
    
    // Callback pour mise à jour UI
    this.onVolumeUpdate(volume);
  }
  
  /**
   * Obtient la vitesse de lecture lissée actuelle
   * @returns {number}
   */
  getSmoothedPlaybackRate() {
    return this.smoothedPlaybackRate;
  }
  
  /**
   * Définit manuellement la vitesse de lecture lissée
   * @param {number} rate - Nouvelle vitesse
   */
  setSmoothedPlaybackRate(rate) {
    this.smoothedPlaybackRate = rate;
  }
  
  /**
   * Met à jour la configuration
   * @param {Object} config - Nouvelle configuration
   */
  updateConfig(config) {
    if (config.velocitySensitivity !== undefined) {
      this.velocitySensitivity = config.velocitySensitivity;
    }
    if (config.volumeSensitivity !== undefined) {
      this.volumeSensitivity = config.volumeSensitivity;
    }
    if (config.deadZone !== undefined) {
      this.deadZone = config.deadZone;
    }
    if (config.smoothingFactor !== undefined) {
      this.smoothingFactor = config.smoothingFactor;
    }
    
    console.log('[IMUController] Configuration mise à jour');
  }
  
  /**
   * Nettoie les ressources
   */
  dispose() {
    console.log('[IMUController] Nettoyage...');
    
    this.enabled = false;
    this.smoothedPlaybackRate = 1.0;
    
    console.log('[IMUController] ✓ Nettoyé');
  }
}

module.exports = IMUController;