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
      targetSpeed: 180,
      comfortZone: 100,
      transitionZone: 100,
      duration: 300000,
      checkInterval: 100,
      smoothingFactor: 0.7,
      
      // Paramètres fenêtre glissante
      samplingWindow: 2000,
      hysteresisMargin: 40,
      minSamplesForDecision: 5,
      
      // Paramètres direction robuste
      directionChangeThreshold: 0.70,   // ✅ Remonté à 70% pour plus de stabilité
      minSamplesForDirectionChange: 8,  // ✅ Plus d'échantillons requis
      
      // Paramètres repositionnement
      repositionThreshold: 15,
      repositionMaxDuration: 2000,
      freezePlaybackDuringReposition: true,
      
      // Mode debug
      debugMode: false  // ✅ Désactivé par défaut
    };
    
    // Paramètres audio optimisés
    this.audioSettings = {
      grainSize: 160,
      overlap: 77
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
    this.smoothedPlaybackRate = 1.0;
    this.imuWasEnabled = false;
    
    // ✅ NOUVEAU : Angle cumulatif pour détecter le vrai sens de rotation
    this.cumulativeAngle = 0;
    this.lastRawAngleY = 0;
    
    // État fenêtre glissante
    this.velocityBuffer = [];
    this.averageVelocity = 0;
    this.isLockedInComfort = false;
    
    // Direction lissée
    this.stableDirection = 1;
    this.instantDirection = 1;
    
    // État repositionnement
    this.isRepositioning = false;
    this.repositionStartTime = null;
    this.frozenPlaybackRate = 1.0;
    this.frozenDirection = 1;
    
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
    this.smoothedPlaybackRate = 1.0;
    
    // ✅ Réinitialiser angle cumulatif
    this.cumulativeAngle = 0;
    this.lastRawAngleY = 0;
    
    // Réinitialiser fenêtre glissante
    this.velocityBuffer = [];
    this.averageVelocity = 0;
    this.isLockedInComfort = false;
    this.stableDirection = 1;
    this.instantDirection = 1;
    
    // Réinitialiser état repositionnement
    this.isRepositioning = false;
    this.repositionStartTime = null;
    this.frozenPlaybackRate = 1.0;
    this.frozenDirection = 1;
    
    // Démarrer la lecture audio
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
    
    console.log('[RotationContinueExercise] 💡 IMPORTANT: Tournez CONTINUELLEMENT dans un sens pour rester en zone confort');
    console.log('[RotationContinueExercise] 💡 Pour inverser la lecture, tournez CONTINUELLEMENT dans l\'autre sens');
    
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
      this.lastRawAngleY = angles.y;
      this.cumulativeAngle = 0;
      
      console.log('[RotationContinueExercise] Initialisation - Angle Y:', angles.y.toFixed(1) + '°');
      return;
    }
    
    const dt = (now - this.lastTimestamp) / 1000;
    
    if (dt > 0 && dt < 1.0) {
      // ═══════════════════════════════════════════════════════════
      // ✅ CALCUL ANGLE CUMULATIF (débordant, peut dépasser 360°)
      // ═══════════════════════════════════════════════════════════
      
      const deltaY = angles.y - this.lastRawAngleY;
      
      // Gérer le wraparound 360° → 0° ou 0° → 360°
      let normalizedDelta = deltaY;
      if (Math.abs(deltaY) > 180) {
        normalizedDelta = deltaY > 0 
          ? deltaY - 360 
          : deltaY + 360;
      }
      
      // ✅ ACCUMULER le delta dans l'angle cumulatif
      // Cet angle peut devenir négatif ou > 360°, c'est VOULU
      this.cumulativeAngle += normalizedDelta;
      
      // ✅ Détecter le sens de rotation sur une FENÊTRE COURTE
      // On regarde la tendance des derniers deltas, pas juste le delta actuel
      const angularVelocitySigned = normalizedDelta / dt; // AVEC LE SIGNE
      const angularVelocity = Math.abs(angularVelocitySigned);
      this.lastAngularVelocity = angularVelocity;
      
      // ✅ Direction instantanée basée sur la vélocité SIGNÉE
      this.instantDirection = angularVelocitySigned >= 0 ? 1 : -1;
      
      if (this.config.debugMode && angularVelocity > 10) {
        const dirText = this.instantDirection === 1 ? 'HORAIRE ↻' : 'ANTI-HORAIRE ↺';
        console.log(`[DEBUG] Y: ${angles.y.toFixed(1)}° | Delta: ${normalizedDelta.toFixed(1)}° | Cumulatif: ${this.cumulativeAngle.toFixed(1)}° | ${dirText}`);
      }
      
      // Détection repositionnement main
      this._detectRepositioning(angularVelocity, now);
      
      // Ajouter au buffer de la fenêtre glissante
      this._addToVelocityBuffer({
        timestamp: now,
        velocity: angularVelocity,
        direction: this.instantDirection,
        angles: { ...angles },
        cumulativeAngle: this.cumulativeAngle
      });
      
      // CALCUL DIRECTION STABLE (lissée sur fenêtre)
      this._updateStableDirection();
      
      // Enregistrer dans l'historique complet
      this.rotationHistory.push({
        timestamp: now,
        velocity: angularVelocity,
        direction: this.stableDirection,
        angles: { ...angles },
        isRepositioning: this.isRepositioning
      });
      
      // Contrôler l'audio
      this._controlAudio();
      
      // Notifier l'UI
      this._notifyUI('EXERCISE_UPDATE', {
        velocity: Math.round(angularVelocity),
        averageVelocity: Math.round(this.averageVelocity),
        targetSpeed: this.config.targetSpeed,
        isInRange: this._isInTargetRange(this.averageVelocity),
        isLockedInComfort: this.isLockedInComfort,
        isRepositioning: this.isRepositioning,
        playbackRate: this.smoothedPlaybackRate,
        direction: this.stableDirection,
        cumulativeAngle: this.cumulativeAngle
      });
      
      this.lastRawAngleY = angles.y;
      
    } else if (dt >= 1.0) {
      console.warn(`[RotationContinue] Delta temps aberrant: ${dt.toFixed(3)}s - ignoré`);
    }
    
    this.lastAngles = { ...angles };
    this.lastTimestamp = now;
  }
  
  /**
   * Détecte si l'utilisateur est en train de repositionner sa main
   * @private
   */
  _detectRepositioning(angularVelocity, now) {
    // Détection ENTRÉE en repositionnement
    if (!this.isRepositioning && angularVelocity < this.config.repositionThreshold) {
      this.isRepositioning = true;
      this.repositionStartTime = now;
      
      // Sauvegarder la vitesse ET la direction actuelles
      this.frozenPlaybackRate = this.smoothedPlaybackRate;
      this.frozenDirection = this.stableDirection;
      
      console.log('[RotationContinue] 🤚 Repositionnement - Gel: ' + this.frozenPlaybackRate.toFixed(2) + 'x dir:' + this.frozenDirection);
    }
    
    // Détection SORTIE du repositionnement
    if (this.isRepositioning && angularVelocity >= this.config.repositionThreshold) {
      const repositionDuration = now - this.repositionStartTime;
      
      this.isRepositioning = false;
      this.repositionStartTime = null;
      
      console.log('[RotationContinue] ✋ Fin repositionnement (' + repositionDuration + 'ms)');
    }
    
    // Sécurité : repositionnement trop long
    if (this.isRepositioning && (now - this.repositionStartTime) > this.config.repositionMaxDuration) {
      console.warn('[RotationContinue] ⚠️ Repositionnement trop long - Retour normal');
      this.isRepositioning = false;
      this.repositionStartTime = null;
    }
  }
  
  /**
   * Ajoute une mesure au buffer de fenêtre glissante
   * @private
   */
  _addToVelocityBuffer(sample) {
    const now = Date.now();
    
    this.velocityBuffer.push(sample);
    
    // Retirer échantillons trop anciens
    const windowStart = now - this.config.samplingWindow;
    this.velocityBuffer = this.velocityBuffer.filter(s => s.timestamp >= windowStart);
    
    // Recalculer la moyenne de vitesse
    if (this.velocityBuffer.length > 0) {
      const sum = this.velocityBuffer.reduce((acc, s) => acc + s.velocity, 0);
      this.averageVelocity = sum / this.velocityBuffer.length;
    } else {
      this.averageVelocity = 0;
    }
  }
  
  /**
   * ✅ Met à jour la direction stable basée sur la TENDANCE de l'angle cumulatif
   * @private
   */
  _updateStableDirection() {
    // Attendre d'avoir assez d'échantillons
    if (this.velocityBuffer.length < this.config.minSamplesForDirectionChange) {
      return;
    }
    
    // ✅ NOUVELLE MÉTHODE : Analyser la TENDANCE de l'angle cumulatif
    // Si l'angle cumulatif augmente globalement → rotation horaire
    // Si l'angle cumulatif diminue globalement → rotation anti-horaire
    
    const oldestSample = this.velocityBuffer[0];
    const newestSample = this.velocityBuffer[this.velocityBuffer.length - 1];
    
    const angleDrift = newestSample.cumulativeAngle - oldestSample.cumulativeAngle;
    const timeDrift = (newestSample.timestamp - oldestSample.timestamp) / 1000;
    
    const averageTrend = angleDrift / timeDrift; // Tendance moyenne en °/s
    
    // Compter aussi les échantillons avec leur direction instantanée (backup)
    const forwardCount = this.velocityBuffer.filter(s => s.direction === 1).length;
    const backwardCount = this.velocityBuffer.filter(s => s.direction === -1).length;
    const totalCount = this.velocityBuffer.length;
    
    const forwardRatio = forwardCount / totalCount;
    const backwardRatio = backwardCount / totalCount;
    
    // ✅ DÉCISION BASÉE SUR LA TENDANCE (priorité) + ratio (backup)
    const previousDirection = this.stableDirection;
    
    // Seuil pour changer : tendance claire ET ratio majoritaire
    const trendThreshold = 30; // °/s sur la fenêtre
    
    if (this.stableDirection === 1) {
      // Direction actuelle: HORAIRE
      // On passe en ANTI-HORAIRE si tendance négative ET >70% échantillons arrière
      if (averageTrend < -trendThreshold && backwardRatio > this.config.directionChangeThreshold) {
        this.stableDirection = -1;
        console.log(`[RotationContinue] 🔄 Changement: HORAIRE ↻ → ANTI-HORAIRE ↺ (tendance: ${averageTrend.toFixed(1)}°/s, ${(backwardRatio*100).toFixed(0)}% arrière)`);
      }
    } else if (this.stableDirection === -1) {
      // Direction actuelle: ANTI-HORAIRE
      // On passe en HORAIRE si tendance positive ET >70% échantillons avant
      if (averageTrend > trendThreshold && forwardRatio > this.config.directionChangeThreshold) {
        this.stableDirection = 1;
        console.log(`[RotationContinue] 🔄 Changement: ANTI-HORAIRE ↺ → HORAIRE ↻ (tendance: ${averageTrend.toFixed(1)}°/s, ${(forwardRatio*100).toFixed(0)}% avant)`);
      }
    }
    
    // Debug
    if (this.config.debugMode && totalCount % 10 === 0) {
      const dirText = this.stableDirection === 1 ? 'HORAIRE ↻' : 'ANTI-HORAIRE ↺';
      console.log(`[DEBUG] Tendance: ${averageTrend.toFixed(1)}°/s | Ratio: ${forwardRatio.toFixed(2)}↻ / ${backwardRatio.toFixed(2)}↺ | Direction: ${dirText}`);
    }
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
   * Contrôle la lecture audio avec transitions ULTRA progressives
   * @private
   */
  _controlAudio() {
    if (!this.audioOrchestrator) {
      return;
    }
    
    // MODE REPOSITIONNEMENT : GELER vitesse ET direction
    if (this.isRepositioning && this.config.freezePlaybackDuringReposition) {
      this.audioOrchestrator.setPlaybackRate(this.frozenPlaybackRate, this.frozenDirection);
      return;
    }
    
    // Attendre d'avoir assez d'échantillons
    if (this.velocityBuffer.length < this.config.minSamplesForDecision) {
      return;
    }
    
    // Définition des zones ÉLARGIES
    const comfortMin = this.config.targetSpeed - this.config.comfortZone;
    const comfortMax = this.config.targetSpeed + this.config.comfortZone;
    const hysteresisMin = comfortMin - this.config.hysteresisMargin;
    const hysteresisMax = comfortMax + this.config.hysteresisMargin;
    
    // VERROUILLAGE ZONE CONFORT (direction TOUJOURS mise à jour)
    if (this.isLockedInComfort) {
      // Vérifier si on doit sortir
      if (this.averageVelocity < hysteresisMin || this.averageVelocity > hysteresisMax) {
        this.isLockedInComfort = false;
        console.log('[RotationContinue] 🔓 Sortie zone confort (avg: ' + this.averageVelocity.toFixed(1) + '°/s)');
      } else {
        // Rester verrouillé à 1.0x MAIS mettre à jour la direction STABLE
        this.smoothedPlaybackRate = 1.0;
        this.audioOrchestrator.setPlaybackRate(1.0, this.stableDirection);
        return;
      }
    }
    
    // Vérifier si on peut entrer en zone confort
    if (!this.isLockedInComfort) {
      if (this.averageVelocity >= comfortMin && this.averageVelocity <= comfortMax) {
        this.isLockedInComfort = true;
        const dirText = this.stableDirection === 1 ? 'HORAIRE ↻' : 'ANTI-HORAIRE ↺';
        console.log(`[RotationContinue] 🔒 Entrée zone confort (avg: ${this.averageVelocity.toFixed(1)}°/s, ${dirText})`);
        this.smoothedPlaybackRate = 1.0;
        this.audioOrchestrator.setPlaybackRate(1.0, this.stableDirection);
        return;
      }
    }
    
    // HORS ZONE CONFORT : TRANSITIONS PROGRESSIVES
    const transitionMinStart = comfortMin - this.config.transitionZone;
    const transitionMaxEnd = comfortMax + this.config.transitionZone;
    
    let targetPlaybackRate;
    
    if (this.averageVelocity >= transitionMinStart && this.averageVelocity < comfortMin) {
      // Zone transition basse
      const transitionRange = comfortMin - transitionMinStart;
      const progress = (this.averageVelocity - transitionMinStart) / transitionRange;
      const easedProgress = this._easeInOutCubic(progress);
      
      const minRate = Math.max(0.25, transitionMinStart / this.config.targetSpeed);
      targetPlaybackRate = minRate + (1.0 - minRate) * easedProgress;
      targetPlaybackRate = Math.max(0.25, targetPlaybackRate);
      
    } else if (this.averageVelocity > comfortMax && this.averageVelocity <= transitionMaxEnd) {
      // Zone transition haute
      const transitionRange = transitionMaxEnd - comfortMax;
      const progress = (this.averageVelocity - comfortMax) / transitionRange;
      const easedProgress = this._easeInOutCubic(progress);
      
      const maxRate = Math.min(2.0, transitionMaxEnd / this.config.targetSpeed);
      targetPlaybackRate = 1.0 + (maxRate - 1.0) * easedProgress;
      targetPlaybackRate = Math.min(2.0, targetPlaybackRate);
      
    } else {
      // Zones extrêmes
      const ratio = this.averageVelocity / this.config.targetSpeed;
      targetPlaybackRate = Math.max(0.25, Math.min(2.0, ratio));
    }
    
    // Lissage ultra-fort
    this.smoothedPlaybackRate = 
      this.smoothedPlaybackRate * (1 - this.config.smoothingFactor) + 
      targetPlaybackRate * this.config.smoothingFactor;
    
    this.smoothedPlaybackRate = Math.round(this.smoothedPlaybackRate * 100) / 100;
    
    // Log uniquement si changement significatif
    if (Math.abs(this.lastPlaybackRate - this.smoothedPlaybackRate) > 0.02) {
      const dirSymbol = this.stableDirection === 1 ? '↻' : '↺';
      console.log(`[RotationContinue] Avg: ${this.averageVelocity.toFixed(1)}°/s → ${this.smoothedPlaybackRate.toFixed(2)}x ${dirSymbol}`);
      this.lastPlaybackRate = this.smoothedPlaybackRate;
    }
    
    // Appliquer avec direction STABLE
    this.audioOrchestrator.setPlaybackRate(this.smoothedPlaybackRate, this.stableDirection);
  }
  
  /**
   * Fonction d'easing pour transitions ultra-progressives
   * @private
   */
  _easeInOutCubic(t) {
    return t < 0.5 
      ? 4 * t * t * t 
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
    
    if (elapsed >= this.config.duration) {
      console.log('[RotationContinueExercise] Durée atteinte, fin de l\'exercice');
      this.stop();
      return;
    }
    
    const progress = Math.round((elapsed / this.config.duration) * 100);
    
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
        consistency: 0,
        forwardRotations: 0,
        backwardRotations: 0,
        repositionCount: 0
      };
    }
    
    const velocities = this.rotationHistory.map(h => h.velocity);
    const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const maxVelocity = Math.max(...velocities);
    const minVelocity = Math.min(...velocities);
    
    const samplesInRange = this.rotationHistory.filter(h => 
      this._isInTargetRange(h.velocity)
    ).length;
    
    const consistency = Math.round((samplesInRange / this.rotationHistory.length) * 100);
    
    const forwardRotations = this.rotationHistory.filter(h => h.direction === 1).length;
    const backwardRotations = this.rotationHistory.filter(h => h.direction === -1).length;
    
    let repositionCount = 0;
    let wasRepositioning = false;
    for (const sample of this.rotationHistory) {
      if (sample.isRepositioning && !wasRepositioning) {
        repositionCount++;
      }
      wasRepositioning = sample.isRepositioning;
    }
    
    const duration = Date.now() - this.startTime;
    
    return {
      avgVelocity: Math.round(avgVelocity),
      maxVelocity: Math.round(maxVelocity),
      minVelocity: Math.round(minVelocity),
      duration: Math.round(duration / 1000),
      samplesInRange: samplesInRange,
      totalSamples: this.rotationHistory.length,
      consistency: consistency,
      forwardRotations: forwardRotations,
      backwardRotations: backwardRotations,
      repositionCount: repositionCount
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
      averageVelocity: this.averageVelocity,
      lastPlaybackRate: this.smoothedPlaybackRate,
      isLockedInComfort: this.isLockedInComfort,
      isRepositioning: this.isRepositioning,
      direction: this.stableDirection,
      bufferSize: this.velocityBuffer.length,
      cumulativeAngle: this.cumulativeAngle
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