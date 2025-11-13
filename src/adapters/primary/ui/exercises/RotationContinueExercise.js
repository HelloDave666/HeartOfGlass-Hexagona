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
      targetSpeed: 50,        // Vitesse cible (degrés/s)
      tolerance: 20,          // Tolérance (degrés/s)
      duration: 30000,        // Durée (ms)
      checkInterval: 100      // Intervalle de vérification (ms)
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
    
    this.isActive = true;
    this.startTime = Date.now();
    this.lastTimestamp = Date.now();
    this.rotationHistory = [];
    this.lastAngles = { x: 0, y: 0, z: 0 };
    
    // Démarrer la lecture audio
    if (this.audioOrchestrator && this.audioOrchestrator.play) {
      this.audioOrchestrator.play();
      console.log('[RotationContinueExercise] Audio démarré');
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
    
    // Arrêter l'audio
    if (this.audioOrchestrator && this.audioOrchestrator.pause) {
      this.audioOrchestrator.pause();
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
    const dt = (now - this.lastTimestamp) / 1000; // Convertir en secondes
    
    if (dt > 0 && this.lastTimestamp) {
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
        playbackRate: this.lastPlaybackRate
      });
    }
    
    this.lastAngles = { ...angles };
    this.lastTimestamp = now;
  }
  
  /**
   * Vérifie si la vitesse est dans la plage cible
   * @private
   */
  _isInTargetRange(velocity) {
    const min = this.config.targetSpeed - this.config.tolerance;
    const max = this.config.targetSpeed + this.config.tolerance;
    return velocity >= min && velocity <= max;
  }
  
  /**
   * Contrôle la lecture audio en fonction de la vitesse de rotation
   * @private
   */
  _controlAudio(angularVelocity) {
    if (!this.audioOrchestrator) {
      return;
    }
    
    // Calculer le ratio de vitesse (entre 0 et 2)
    // 0 = arrêt, 1 = vitesse normale, 2 = double vitesse
    const ratio = angularVelocity / this.config.targetSpeed;
    
    // Limiter entre 0.25 et 2.0 pour éviter les distorsions extrêmes
    const playbackRate = Math.max(0.25, Math.min(2.0, ratio));
    
    this.lastPlaybackRate = playbackRate;
    
    // Appliquer le taux de lecture
    if (this.audioOrchestrator.setPlaybackRate) {
      this.audioOrchestrator.setPlaybackRate(playbackRate);
    }
    
    // Si la vitesse est trop basse, mettre en pause
    if (angularVelocity < 5) {
      if (this.audioOrchestrator.pause) {
        this.audioOrchestrator.pause();
      }
    } else {
      if (this.audioOrchestrator.play) {
        this.audioOrchestrator.play();
      }
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
      lastPlaybackRate: this.lastPlaybackRate
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