/**
 * RotationContinueExercise.js
 * 
 * Exercice : Rotation continue à vitesse constante
 * L'utilisateur doit maintenir une rotation constante autour de l'axe Y
 * 
 * Architecture: Adapter - Logique métier de l'exercice
 */

class RotationContinueExercise {
  constructor({ audioOrchestrator, state }) {
    this.audioOrchestrator = audioOrchestrator;
    this.state = state;
    
    // Configuration de l'exercice
    this.config = {
      targetSpeed: 180,         // Vitesse cible (degrés/s) - 1 rotation en 2 secondes
      comfortZone: 80,          // Zone de confort totale ±80°/s → 100-260°/s = vitesse 1x
      transitionZone: 60,       // Zone de transition progressive ±60°/s supplémentaires
      duration: 300000,         // Durée (ms) - 5 minutes
      checkInterval: 100,       // Intervalle de vérification (ms)
      smoothingFactor: 0.4      // Lissage transitions (0 = aucun, 1 = lent)
    };
    
    // Paramètres audio optimisés pour l'exercice
    this.audioSettings = {
      grainSize: 160,         // 160ms - optimal pour flux continu
      overlap: 77             // 77% - transitions douces
    };
    
    // État de l'exercice
    this.isActive = false;
    this.startTime = null;
    this.checkIntervalId = null;
    this.lastAngles = { x: 0, y: 0, z: 0 };
    this.lastTimestamp = null;
    this.rotationHistory = [];
    this.lastAngularVelocity = 0;
    this.lastPlaybackRate = 1.0;
    this.smoothedPlaybackRate = 1.0; // Vitesse lissée
    this.imuWasEnabled = false; // Pour restaurer l'état IMU après l'exercice
    
    // Sauvegarder les paramètres audio originaux
    this.originalAudioParams = null;
    
    console.log('[RotationContinueExercise] Exercice créé');
  }
  
  /**
   * Démarre l'exercice
   */
  start() {
    if (this.isActive) {
      console.warn('[RotationContinueExercise] Exercice déjà actif');
      return false;
    }
    
    console.log('[RotationContinueExercise] Démarrage...');
    
    // Sauvegarder et désactiver l'IMU standard
    this.imuWasEnabled = this.state.isIMUToAudioEnabled();
    if (this.imuWasEnabled) {
      console.log('[RotationContinueExercise] 🔇 Désactivation IMU standard pendant l\'exercice');
      this.state.setIMUToAudioEnabled(false);
    }
    
    // Sauvegarder et appliquer les paramètres audio optimisés
    const currentParams = this.state.getAudioParameters();
    this.originalAudioParams = {
      grainSize: currentParams.grainSize,
      overlap: currentParams.overlap
    };
    
    console.log('[RotationContinueExercise] 🎵 Configuration audio optimisée:', this.audioSettings);
    this.audioOrchestrator.setGrainSize(this.audioSettings.grainSize);
    this.audioOrchestrator.setOverlap(this.audioSettings.overlap);
    
    this.isActive = true;
    this.startTime = Date.now();
    this.lastTimestamp = null;
    this.rotationHistory = [];
    this.lastAngles = { x: 0, y: 0, z: 0 };
    this.smoothedPlaybackRate = 1.0; // Réinitialiser le lissage
    
    // Démarrer la lecture audio via AudioOrchestrator
    if (this.audioOrchestrator) {
      const audioState = this.state.getAudioState();
      if (!audioState.isPlaying) {
        this.audioOrchestrator.togglePlayPause();
        console.log('[RotationContinueExercise] Audio démarré');
      } else {
        console.log('[RotationContinueExercise] Audio déjà en lecture');
      }
    }
    
    // Démarrer la surveillance
    this.checkIntervalId = setInterval(() => {
      this._checkProgress();
    }, this.config.checkInterval);
    
    // Notifier l'UI
    this._notifyUI('EXERCISE_STARTED', {
      exerciseName: 'Rotation Continue',
      duration: this.config.duration,
      targetSpeed: this.config.targetSpeed
    });
    
    return true;
  }
  
  /**
   * Arrête l'exercice
   */
  stop() {
    if (!this.isActive) {
      return;
    }
    
    console.log('[RotationContinueExercise] Arrêt...');
    
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
      console.log('[RotationContinueExercise] 🎵 Restauration paramètres audio:', this.originalAudioParams);
      this.audioOrchestrator.setGrainSize(this.originalAudioParams.grainSize);
      this.audioOrchestrator.setOverlap(this.originalAudioParams.overlap);
    }
    
    // Restaurer l'état IMU standard
    if (this.imuWasEnabled) {
      console.log('[RotationContinueExercise] 🔊 Réactivation IMU standard');
      this.state.setIMUToAudioEnabled(true);
    }
    
    // Calculer les statistiques
    const stats = this._calculateStats();
    
    // Notifier l'UI
    this._notifyUI('EXERCISE_ENDED', {
      exerciseName: 'Rotation Continue',
      stats: stats
    });
    
    console.log('[RotationContinueExercise] Statistiques:', stats);
  }
  
  /**
   * Met à jour avec les nouvelles données du capteur
   * @param {Object} angles - { x, y, z } en degrés
   */
  update(angles) {
    if (!this.isActive) {
      return;
    }
    
    const now = Date.now();
    
    // Initialisation au premier appel
    if (this.lastTimestamp === null) {
      this.lastTimestamp = now;
      this.lastAngles = { ...angles };
      console.log('[RotationContinueExercise] Premier angle enregistré');
      return;
    }
    
    const dt = (now - this.lastTimestamp) / 1000; // Convertir en secondes
    
    if (dt > 0 && dt < 1.0) { // Ignorer les deltas > 1 seconde (aberrants)
      // Calculer la vélocité angulaire sur l'axe Y (rotation principale)
      const deltaY = angles.y - this.lastAngles.y;
      
      // Gérer le passage de 360° à 0° ou vice versa
      let normalizedDelta = deltaY;
      if (Math.abs(deltaY) > 180) {
        normalizedDelta = deltaY > 0 
          ? deltaY - 360 
          : deltaY + 360;
      }
      
      const angularVelocity = Math.abs(normalizedDelta / dt);
      this.lastAngularVelocity = angularVelocity;
      
      // Enregistrer dans l'historique
      this.rotationHistory.push({
        timestamp: now,
        velocity: angularVelocity,
        angles: { ...angles }
      });
      
      // Contrôler l'audio en fonction de la vitesse
      this._controlAudio(angularVelocity);
      
      // Notifier l'UI
      this._notifyUI('EXERCISE_UPDATE', {
        velocity: Math.round(angularVelocity),
        targetSpeed: this.config.targetSpeed,
        isInRange: this._isInTargetRange(angularVelocity),
        playbackRate: this.smoothedPlaybackRate
      });
    } else if (dt >= 1.0) {
      console.warn(`[RotationContinue] Delta temps aberrant: ${dt.toFixed(3)}s - ignoré`);
    }
    
    this.lastAngles = { ...angles };
    this.lastTimestamp = now;
  }
  
  /**
   * Vérifie si la vitesse est dans la plage cible
   * @private
   */
  _isInTargetRange(velocity) {
    const min = this.config.targetSpeed - this.config.comfortZone;
    const max = this.config.targetSpeed + this.config.comfortZone;
    return velocity >= min && velocity <= max;
  }
  
  /**
   * Contrôle la lecture audio en fonction de la vitesse de rotation
   * Système à 3 zones pour transitions progressives
   * @private
   */
  _controlAudio(angularVelocity) {
    if (!this.audioOrchestrator) {
      return;
    }
    
    // Définition des 3 zones
    const comfortMin = this.config.targetSpeed - this.config.comfortZone;
    const comfortMax = this.config.targetSpeed + this.config.comfortZone;
    const transitionMin = comfortMin - this.config.transitionZone;
    const transitionMax = comfortMax + this.config.transitionZone;
    
    let targetPlaybackRate;
    
    if (angularVelocity >= comfortMin && angularVelocity <= comfortMax) {
      // ═══════════════════════════════════════════════════════════
      // ZONE 1 (CENTRALE) : ZONE DE CONFORT
      // 100-260°/s → vitesse 1.0x
      // ═══════════════════════════════════════════════════════════
      targetPlaybackRate = 1.0;
      
    } else if (angularVelocity >= transitionMin && angularVelocity < comfortMin) {
      // ═══════════════════════════════════════════════════════════
      // ZONE 2A (TRANSITION BAS) : PROGRESSION DOUCE
      // 40-100°/s → progression linéaire de 0.4x à 1.0x
      // ═══════════════════════════════════════════════════════════
      const progress = (angularVelocity - transitionMin) / this.config.transitionZone;
      const minRate = transitionMin / this.config.targetSpeed; // ~0.22x à 40°/s
      targetPlaybackRate = minRate + (1.0 - minRate) * progress;
      targetPlaybackRate = Math.max(0.25, targetPlaybackRate); // Limiter à 0.25x minimum
      
    } else if (angularVelocity > comfortMax && angularVelocity <= transitionMax) {
      // ═══════════════════════════════════════════════════════════
      // ZONE 2B (TRANSITION HAUT) : PROGRESSION DOUCE
      // 260-320°/s → progression linéaire de 1.0x à 1.8x
      // ═══════════════════════════════════════════════════════════
      const progress = (angularVelocity - comfortMax) / this.config.transitionZone;
      const maxRate = transitionMax / this.config.targetSpeed; // ~1.78x à 320°/s
      targetPlaybackRate = 1.0 + (maxRate - 1.0) * progress;
      targetPlaybackRate = Math.min(2.0, targetPlaybackRate); // Limiter à 2.0x maximum
      
    } else {
      // ═══════════════════════════════════════════════════════════
      // ZONE 3 (EXTÉRIEURE) : RATIO NORMAL
      // < 40°/s ou > 320°/s → ratio calculé normalement
      // ═══════════════════════════════════════════════════════════
      const ratio = angularVelocity / this.config.targetSpeed;
      targetPlaybackRate = Math.max(0.25, Math.min(2.0, ratio));
    }
    
    // ✨ LISSAGE : moyenne pondérée entre l'ancienne et la nouvelle valeur
    this.smoothedPlaybackRate = 
      this.smoothedPlaybackRate * (1 - this.config.smoothingFactor) + 
      targetPlaybackRate * this.config.smoothingFactor;
    
    // Arrondir légèrement pour éviter les micro-variations
    this.smoothedPlaybackRate = Math.round(this.smoothedPlaybackRate * 100) / 100;
    
    // Log uniquement si changement significatif
    if (Math.abs(this.lastPlaybackRate - this.smoothedPlaybackRate) > 0.02) {
      const zone = this._getZoneName(angularVelocity, comfortMin, comfortMax, transitionMin, transitionMax);
      console.log(`[RotationContinue] ${zone} (${angularVelocity.toFixed(1)}°/s) → Vitesse: ${this.smoothedPlaybackRate.toFixed(2)}x`);
      this.lastPlaybackRate = this.smoothedPlaybackRate;
    }
    
    // Appliquer le taux de lecture lissé via AudioOrchestrator
    this.audioOrchestrator.setPlaybackRate(this.smoothedPlaybackRate, 1);
    
    // ⚠️ PAS DE PAUSE AUTOMATIQUE - L'audio continue toujours
    // (supprimé le système de pause qui causait les arrêts)
  }
  
  /**
   * Obtient le nom de la zone pour le log
   * @private
   */
  _getZoneName(velocity, comfortMin, comfortMax, transitionMin, transitionMax) {
    if (velocity >= comfortMin && velocity <= comfortMax) {
      return '✓ Zone confort';
    } else if (velocity >= transitionMin && velocity < comfortMin) {
      return '↗ Transition basse';
    } else if (velocity > comfortMax && velocity <= transitionMax) {
      return '↗ Transition haute';
    } else if (velocity < transitionMin) {
      return '⬇ Zone lente';
    } else {
      return '⬆ Zone rapide';
    }
  }
  
  /**
   * Vérifie la progression de l'exercice
   * @private
   */
  _checkProgress() {
    if (!this.isActive) {
      return;
    }
    
    const elapsed = Date.now() - this.startTime;
    
    // Vérifier si la durée est dépassée
    if (elapsed >= this.config.duration) {
      console.log('[RotationContinueExercise] Durée atteinte, fin de l\'exercice');
      this.stop();
      return;
    }
    
    // Calculer le pourcentage de progression
    const progress = Math.round((elapsed / this.config.duration) * 100);
    
    // Notifier la progression
    this._notifyUI('EXERCISE_PROGRESS', {
      elapsed: elapsed,
      duration: this.config.duration,
      progress: progress
    });
  }
  
  /**
   * Notifie l'UI d'un événement
   * @private
   */
  _notifyUI(eventType, data) {
    if (this.state && this.state.notify) {
      this.state.notify(eventType, data);
    }
    
    // Fallback : dispatch un événement DOM
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
   * Calcule les statistiques finales
   * @private
   */
  _calculateStats() {
    if (this.rotationHistory.length === 0) {
      return {
        avgVelocity: 0,
        maxVelocity: 0,
        minVelocity: 0,
        duration: 0,
        samplesInRange: 0,
        consistency: 0
      };
    }
    
    const velocities = this.rotationHistory.map(h => h.velocity);
    const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const maxVelocity = Math.max(...velocities);
    const minVelocity = Math.min(...velocities);
    
    // Calculer le nombre d'échantillons dans la plage cible
    const samplesInRange = this.rotationHistory.filter(h => 
      this._isInTargetRange(h.velocity)
    ).length;
    
    const consistency = Math.round((samplesInRange / this.rotationHistory.length) * 100);
    
    const duration = Date.now() - this.startTime;
    
    return {
      avgVelocity: Math.round(avgVelocity),
      maxVelocity: Math.round(maxVelocity),
      minVelocity: Math.round(minVelocity),
      duration: Math.round(duration / 1000),
      samplesInRange: samplesInRange,
      totalSamples: this.rotationHistory.length,
      consistency: consistency
    };
  }
  
  /**
   * Retourne l'état actuel de l'exercice
   */
  getStatus() {
    return {
      isActive: this.isActive,
      elapsed: this.isActive ? Date.now() - this.startTime : 0,
      config: { ...this.config },
      historyLength: this.rotationHistory.length,
      lastVelocity: this.lastAngularVelocity,
      lastPlaybackRate: this.smoothedPlaybackRate
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