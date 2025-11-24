/**
 * RotationContinueExercise.js - VERSION 3.4 PHASE D
 *
 * PHASE D : Calibration Interactive Guidée
 * - 🆕 PHASE D : Calibration en 3 étapes (Repos → Horaire → Antihoraire)
 * - 🆕 PHASE D : Capture plages dynamiques min/max/avg pour chaque sens
 * - 🆕 PHASE D : Détection par distance aux plages (robuste aux variations)
 * - 🆕 PHASE D : UI visuelle avec barre de progression
 * - 🆕 PHASE D : Verrouillage réduit à 800ms (vs 1500ms)
 *
 * Basé sur v3.2 (STABLE) :
 * ✅ 1. SEUIL RÉDUIT : 70% au lieu de 80%
 * ✅ 2. TEMPS STABILITÉ RÉDUIT : 500ms au lieu de 1000ms
 * ✅ 3. FENÊTRE RÉDUITE : 15 échantillons au lieu de 20
 * ✅ 4. ZONE CONFORT DYNAMIQUE
 * ✅ 5. TRANSITIONS PLUS DOUCES (lissage 0.85)
 *
 * Architecture: Adapter - Logique métier de l'exercice
 */

class RotationContinueExercise {
  constructor({ audioOrchestrator, state, calibrationOrchestrator }) {
    this.audioOrchestrator = audioOrchestrator;
    this.state = state;
    this.calibrationOrchestrator = calibrationOrchestrator;
    
    // Configuration de l'exercice
    this.config = {
      targetSpeed: 360,           // 1 tour par seconde
      comfortZone: 180,           // Zone ±180°/s = [180-540°/s]
      transitionZone: 180,

      duration: 300000,           // 5 minutes
      checkInterval: 100,
      smoothingFactor: 0.85,      // ✅ v3.1 : Lissage renforcé (0.85 vs 0.7)

      // Paramètres fenêtre glissante
      samplingWindow: 4000,
      hysteresisMargin: 40,
      minSamplesForDecision: 8,

      // Validation dt robuste
      minValidDt: 0.01,
      maxValidDt: 0.2,

      // Repositionnement
      repositionThreshold: 10,
      repositionMinDuration: 200,
      repositionMaxDuration: 2500,
      freezePlaybackDuringReposition: true,

      // ✅ v3.1 : Détection direction OPTIMISÉE
      directionWindowSize: 15,            // 15 échantillons (~450ms à 30Hz)
      directionChangeThreshold: 0.70,     // 70% des deltas (vs 80% avant)
      directionStabilityTime: 500,        // 500ms (vs 1000ms avant)

      // 🆕 PHASE D : Anti-oscillation réduit
      directionChangeLockTime: 800,       // Verrouillage 800ms après changement (vs 1500ms)

      // ✅ v3.1 : Zone confort dynamique
      comfortZoneLockEnabled: false,      // Ne plus verrouiller à 1.0x
      comfortZoneSmoothingFactor: 0.95,   // Lissage TRÈS fort dans zone confort

      // 🆕 PHASE D : Calibration interactive guidée
      calibrationRestDuration: 4000,      // 4s repos pour mesurer bruit de fond
      calibrationStepDuration: 6000,      // 6s par rotation (horaire + antihoraire)
      calibrationMinSamples: 30           // Minimum 30 échantillons par phase (~1s à 30Hz)
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
    
    // État fenêtre glissante
    this.velocityBuffer = [];
    this.averageVelocity = 0;
    this.isInComfortZone = false;        // ✅ v3.1 : Renommé (pas "locked")
    
    // Détection direction
    this.signedDeltaBuffer = [];
    this.currentDirection = 1;
    this.lastDirectionChangeTime = 0;
    this.directionChangeCandidate = null;
    this.directionCandidateStartTime = 0;

    // État repositionnement
    this.isRepositioning = false;
    this.repositionStartTime = null;
    this.frozenPlaybackRate = 1.0;
    this.frozenDirection = 1;
    
    // Mémorisation dernière commande audio
    this.lastAudioCommand = {
      rate: 1.0,
      direction: 1,
      timestamp: 0
    };
    
    // Sauvegarder les paramètres audio originaux
    this.originalAudioParams = null;
    
    // Compteurs debug
    this.updateCount = 0;
    this.audioCommandCount = 0;
    
    console.log('[RotationContinueExercise] VERSION 3.5 - Calibration UI Globale');
    console.log('[RotationContinueExercise] 🎯 Cible: 1 tour/sec (360°/s) | Zone confort: 180-540°/s');
    console.log('[RotationContinueExercise] 📐 Détection: 70% sur 15 échantillons (~450ms)');
    console.log('[RotationContinueExercise] 🔧 Utilise CalibrationOrchestrator global');
  }
  
  /**
   * Démarre l'exercice
   */
  start() {
    if (this.isActive) {
      console.warn('[RotationContinueExercise] Exercice déjà actif');
      return false;
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('[RotationContinueExercise] VERSION 3.5 - Démarrage...');
    console.log('═══════════════════════════════════════════════════════════');

    // Vérifier que la calibration globale est disponible
    if (!this.calibrationOrchestrator) {
      console.error('[RotationContinueExercise] ❌ CalibrationOrchestrator non disponible !');
      console.error('[RotationContinueExercise] → Veuillez effectuer la calibration dans l\'onglet Calibration d\'abord');
      return false;
    }

    const calibrationModel = this.calibrationOrchestrator.getCalibrationModel();
    if (!calibrationModel || !calibrationModel.isComplete) {
      console.warn('[RotationContinueExercise] ⚠️ Calibration non effectuée !');
      console.warn('[RotationContinueExercise] → Allez dans l\'onglet Calibration pour calibrer les capteurs');
      console.warn('[RotationContinueExercise] → L\'exercice démarrera avec le modèle actuel mais peut être imprécis');
    } else {
      console.log('[RotationContinueExercise] ✅ Calibration globale chargée');
      console.log(`   Horaire:      ${calibrationModel.clockwise.min.toFixed(1)}° à ${calibrationModel.clockwise.max.toFixed(1)}°`);
      console.log(`   Antihoraire:  ${calibrationModel.counterclockwise.min.toFixed(1)}° à ${calibrationModel.counterclockwise.max.toFixed(1)}°`);
    }
    console.log('═══════════════════════════════════════════════════════════\n');

    // Sauvegarder et désactiver l'IMU standard
    this.imuWasEnabled = this.state.isIMUToAudioEnabled();
    if (this.imuWasEnabled) {
      console.log('[RotationContinueExercise] 🔇 Désactivation IMU standard');
      this.state.setIMUToAudioEnabled(false);
    }
    
    // Sauvegarder et appliquer les paramètres audio optimisés
    const currentParams = this.state.getAudioParameters();
    this.originalAudioParams = {
      grainSize: currentParams.grainSize,
      overlap: currentParams.overlap
    };
    
    console.log('[RotationContinueExercise] 🎵 Configuration audio:', this.audioSettings);
    this.audioOrchestrator.setGrainSize(this.audioSettings.grainSize);
    this.audioOrchestrator.setOverlap(this.audioSettings.overlap);
    
    this.isActive = true;
    this.startTime = Date.now();
    this.lastTimestamp = null;
    this.rotationHistory = [];
    this.lastAngles = { x: 0, y: 0, z: 0 };
    this.smoothedPlaybackRate = 1.0;
    
    // Réinitialiser fenêtre glissante
    this.velocityBuffer = [];
    this.averageVelocity = 0;
    this.isInComfortZone = false;
    
    // Réinitialiser détection direction
    this.signedDeltaBuffer = [];
    this.currentDirection = 1;
    this.lastDirectionChangeTime = Date.now();
    this.directionChangeCandidate = null;
    this.directionCandidateStartTime = 0;

    // Réinitialiser état repositionnement
    this.isRepositioning = false;
    this.repositionStartTime = null;
    this.frozenPlaybackRate = 1.0;
    this.frozenDirection = 1;
    
    // Réinitialiser compteurs
    this.updateCount = 0;
    this.audioCommandCount = 0;
    
    // Réinitialiser dernière commande
    this.lastAudioCommand = {
      rate: 1.0,
      direction: 1,
      timestamp: 0
    };
    
    // Démarrer la lecture audio
    if (this.audioOrchestrator) {
      const audioState = this.state.getAudioState();
      if (!audioState.isPlaying) {
        this.audioOrchestrator.togglePlayPause();
        console.log('[RotationContinueExercise] Audio démarré');
      }
    }
    
    // Démarrer la surveillance
    this.checkIntervalId = setInterval(() => {
      this._checkProgress();
    }, this.config.checkInterval);
    
    // Notifier l'UI
    this._notifyUI('EXERCISE_STARTED', {
      exerciseName: 'Rotation Continue v3.2',
      duration: this.config.duration,
      targetSpeed: this.config.targetSpeed
    });

    console.log('[RotationContinueExercise] ✅ Exercice démarré');

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
      console.log('[RotationContinueExercise] 🎵 Restauration paramètres audio');
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
    
    console.log('[RotationContinueExercise] 📊 Statistiques finales:');
    console.log(`  - Updates: ${this.updateCount} | Commandes audio: ${this.audioCommandCount}`);
    console.log(`  - Ratio déduplication: ${(this.audioCommandCount / Math.max(1, this.updateCount) * 100).toFixed(1)}%`);
    console.log(`  - Vitesse moyenne: ${stats.avgVelocity}°/s (${(stats.avgVelocity/360).toFixed(2)} tour/sec)`);
    
    // Notifier l'UI
    this._notifyUI('EXERCISE_ENDED', {
      exerciseName: 'Rotation Continue v3.2',
      stats: stats
    });
  }
  
  /**
   * Met à jour avec détection direction robuste
   * ✅ MODIFIÉ : Utilise le gyroscope au lieu des deltas d'angles
   * @param {Object} sensorData - { angles: {x,y,z}, gyro: {x,y,z}, accel: {x,y,z} }
   */
  update(sensorData) {
    if (!this.isActive) {
      return;
    }

    const now = Date.now();
    this.updateCount++;

    // Support ancien format pour compatibilité
    const angles = sensorData.angles || sensorData;
    const gyro = sensorData.gyro || { x: 0, y: 0, z: 0 };

    // Initialisation au premier appel
    if (this.lastTimestamp === null) {
      this.lastTimestamp = now;
      this.lastAngles = { ...angles };
      console.log('[RotationContinueExercise] Premier échantillon - Gyro Y: ' + gyro.y.toFixed(1) + '°/s');
      return;
    }

    const dt = (now - this.lastTimestamp) / 1000;

    // Validation robuste du dt
    if (dt < this.config.minValidDt) {
      return;
    }

    if (dt > this.config.maxValidDt) {
      console.warn(`[RotationContinue] ⚠️ dt aberrant (${(dt*1000).toFixed(0)}ms) - réinitialisation`);
      this.lastTimestamp = now;
      this.lastAngles = { ...angles };
      return;
    }

    // ✅ NOUVEAU : Utiliser directement le gyroscope (vitesse angulaire en °/s)
    // Plus besoin de calculer de deltas ni de gérer les discontinuités !
    const gyroY = gyro.y;  // SIGNED: >0 = horaire, <0 = antihoraire
    const angularVelocity = Math.abs(gyroY);
    this.lastAngularVelocity = angularVelocity;

    // Utiliser le modèle de calibration global pour détecter la direction
    this._updateDirectionDetection(gyroY, now);

    // Validation : Rejeter vitesses aberrantes (gyroscope max ±2000°/s)
    if (angularVelocity > 2000) {
      console.warn(`[RotationContinue] ⚠️ Vitesse aberrante (${angularVelocity.toFixed(0)}°/s) - ignorée`);
      this.lastTimestamp = now;
      this.lastAngles = { ...angles };
      return;
    }

    // Logs debug périodiques
    if (this.updateCount % 50 === 0) {
      const dirArrow = this.currentDirection === 1 ? '↻' : '↺';
      const gyroDirection = gyroY > 0 ? '↻' : '↺';
      const comfortStatus = this.isInComfortZone ? '🎯' : '⚠️';
      console.log(`[DEBUG #${this.updateCount}] GY:${gyroY.toFixed(1)}°/s (${gyroDirection}) | Det:${dirArrow} | V:${angularVelocity.toFixed(0)}°/s | ${comfortStatus}`);
    }

    // Détection repositionnement main
    this._detectRepositioning(angularVelocity, now);

    // Ajouter au buffer de la fenêtre glissante
    this._addToVelocityBuffer({
      timestamp: now,
      velocity: angularVelocity,
      direction: this.currentDirection,
      angles: { ...angles }
    });

    // Enregistrer dans l'historique complet
    this.rotationHistory.push({
      timestamp: now,
      velocity: angularVelocity,
      direction: this.currentDirection,
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
      isInComfortZone: this.isInComfortZone,
      isRepositioning: this.isRepositioning,
      playbackRate: this.smoothedPlaybackRate,
      direction: this.currentDirection
    });

    this.lastAngles = { ...angles };
    this.lastTimestamp = now;
  }

  /**
   * ✅ MODIFIÉ : Détection direction avec gyroscope
   * @private
   */
  _updateDirectionDetection(gyroY, now) {
    // Ajouter la valeur gyro signée au buffer
    this.signedDeltaBuffer.push({
      delta: gyroY,  // Gyroscope Y en °/s (SIGNED)
      timestamp: now
    });

    // Garder seulement les N derniers échantillons
    if (this.signedDeltaBuffer.length > this.config.directionWindowSize) {
      this.signedDeltaBuffer.shift();
    }

    // Attendre d'avoir assez d'échantillons
    if (this.signedDeltaBuffer.length < this.config.directionWindowSize) {
      return;
    }

    // Ne PAS détecter changement si vélocité trop faible
    if (this.lastAngularVelocity < 5) {
      // Capteur probablement immobile - garder direction actuelle
      this.directionChangeCandidate = null;
      this.directionCandidateStartTime = 0;
      return;
    }

    // Zone morte anti-oscillation
    // Bloquer tout changement pendant X ms après le dernier changement
    const timeSinceLastChange = now - this.lastDirectionChangeTime;
    if (timeSinceLastChange < this.config.directionChangeLockTime) {
      // Encore dans la période de verrouillage - pas de nouveau changement possible
      this.directionChangeCandidate = null;
      this.directionCandidateStartTime = 0;
      return;
    }

    // Utiliser le modèle calibré pour déterminer la direction
    const candidateDirection = this._getDirectionFromModel();

    // Modèle pas encore calibré ou pas de consensus
    if (candidateDirection === null) {
      this.directionChangeCandidate = null;
      this.directionCandidateStartTime = 0;
      return;
    }

    // La candidate est la même que la direction actuelle
    if (candidateDirection === this.currentDirection) {
      this.directionChangeCandidate = null;
      this.directionCandidateStartTime = 0;
      return;
    }

    // Une NOUVELLE direction candidate apparaît
    if (this.directionChangeCandidate !== candidateDirection) {
      this.directionChangeCandidate = candidateDirection;
      this.directionCandidateStartTime = now;
      return;
    }

    // La candidate est stable depuis assez longtemps
    const candidateStabilityDuration = now - this.directionCandidateStartTime;
    if (candidateStabilityDuration >= this.config.directionStabilityTime) {
      // CHANGER LA DIRECTION
      const oldDirection = this.currentDirection;
      this.currentDirection = candidateDirection;
      this.lastDirectionChangeTime = now;
      this.directionChangeCandidate = null;
      this.directionCandidateStartTime = 0;

      // Calculer gyro moyen pour log
      const avgGyro = this.signedDeltaBuffer.reduce((sum, s) => sum + s.delta, 0) / this.signedDeltaBuffer.length;

      const oldArrow = oldDirection === 1 ? '↻' : '↺';
      const newArrow = candidateDirection === 1 ? '↻' : '↺';
      console.log(`[RotationContinue] 🔄 CHANGEMENT: ${oldArrow} → ${newArrow} (Gyro_moy=${avgGyro.toFixed(1)}°/s | ${candidateStabilityDuration}ms)`);
    }
  }
  
  /**
   * Calcule le ratio de valeurs gyro positives dans le buffer
   * ✅ MODIFIÉ : Plus de gestion des discontinuités avec le gyroscope
   * @private
   */
  _getPositiveDeltaRatio() {
    if (this.signedDeltaBuffer.length === 0) {
      return 0.5;
    }

    let positiveCount = 0;

    for (const sample of this.signedDeltaBuffer) {
      if (sample.delta > 0) {
        positiveCount++;
      }
    }

    return positiveCount / this.signedDeltaBuffer.length;
  }

  /**
   * Détermine la direction à partir du modèle de calibration global
   * ✅ MODIFIÉ : Utilise les valeurs de gyroscope au lieu des deltas d'angles
   * @private
   */
  _getDirectionFromModel() {
    // Récupérer le modèle de calibration global
    if (!this.calibrationOrchestrator) {
      return null;
    }

    const calibrationModel = this.calibrationOrchestrator.getCalibrationModel();

    // Vérifier que le modèle est calibré
    if (!calibrationModel || !calibrationModel.isComplete) {
      return null;
    }

    // Calculer la moyenne des valeurs gyroscope du buffer
    const gyroValues = this.signedDeltaBuffer.map(s => s.delta);

    if (gyroValues.length === 0) {
      return null;
    }

    const avgGyro = gyroValues.reduce((sum, d) => sum + d, 0) / gyroValues.length;

    // Calculer distance aux deux plages (noter le mapping: clockwise = horaire, counterclockwise = antihoraire)
    const distHoraire = this._distanceToRange(avgGyro, calibrationModel.clockwise);
    const distAntihoraire = this._distanceToRange(avgGyro, calibrationModel.counterclockwise);

    // Choisir la direction la plus proche
    // Si les distances sont trop similaires, pas de consensus clair
    const minDist = Math.min(distHoraire, distAntihoraire);
    const maxDist = Math.max(distHoraire, distAntihoraire);

    // Besoin d'une séparation claire (ratio > 2)
    if (maxDist / Math.max(0.1, minDist) < 2) {
      return null; // Pas de consensus
    }

    // Mapping: Utiliser les plages calibrées pour déterminer la direction
    // Note: Le signe exact du gyroscope dépend de l'orientation physique du capteur
    // Mapping inversé selon la convention souhaitée:
    // - Rotation horaire → lecture NORMALE (direction -1)
    // - Rotation antihoraire → lecture INVERSE (direction 1)
    if (distHoraire < distAntihoraire) {
      return -1;  // Plage horaire détectée → direction -1 (AVANT)
    } else {
      return 1;   // Plage antihoraire détectée → direction 1 (ARRIÈRE)
    }
  }

  /**
   * Calcule la distance entre une valeur et une plage
   * @private
   */
  _distanceToRange(value, range) {
    // Si la valeur est dans la plage, distance = 0
    if (value >= range.min && value <= range.max) {
      return 0;
    }

    // Sinon, distance = écart au bord le plus proche
    if (value < range.min) {
      return range.min - value;
    } else {
      return value - range.max;
    }
  }

  /**
   * Détecte repositionnement
   * @private
   */
  _detectRepositioning(angularVelocity, now) {
    if (!this.isRepositioning && angularVelocity < this.config.repositionThreshold) {
      this.isRepositioning = true;
      this.repositionStartTime = now;
      this.frozenPlaybackRate = this.smoothedPlaybackRate;
      this.frozenDirection = this.currentDirection;
      
      console.log('[RotationContinue] 🤚 Repositionnement - Gel: ' + this.frozenPlaybackRate.toFixed(2) + 'x dir:' + this.frozenDirection);
    }
    
    if (this.isRepositioning && angularVelocity >= this.config.repositionThreshold) {
      const repositionDuration = now - this.repositionStartTime;
      
      if (repositionDuration < this.config.repositionMinDuration) {
        this.isRepositioning = false;
        this.repositionStartTime = null;
        return;
      }
      
      this.isRepositioning = false;
      this.repositionStartTime = null;
      
      console.log('[RotationContinue] ✋ Fin repositionnement (' + repositionDuration + 'ms)');
    }
    
    if (this.isRepositioning && (now - this.repositionStartTime) > this.config.repositionMaxDuration) {
      console.warn('[RotationContinue] ⚠️ Repositionnement trop long');
      this.isRepositioning = false;
      this.repositionStartTime = null;
    }
  }
  
  /**
   * Ajoute une mesure au buffer
   * @private
   */
  _addToVelocityBuffer(sample) {
    const now = Date.now();
    
    this.velocityBuffer.push(sample);
    
    const windowStart = now - this.config.samplingWindow;
    this.velocityBuffer = this.velocityBuffer.filter(s => s.timestamp >= windowStart);
    
    if (this.velocityBuffer.length > 0) {
      const sum = this.velocityBuffer.reduce((acc, s) => acc + s.velocity, 0);
      this.averageVelocity = sum / this.velocityBuffer.length;
    } else {
      this.averageVelocity = 0;
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
   * ✅ v3.1 : Contrôle audio avec ZONE CONFORT DYNAMIQUE
   * @private
   */
  _controlAudio() {
    if (!this.audioOrchestrator) {
      return;
    }
    
    // MODE REPOSITIONNEMENT
    if (this.isRepositioning && this.config.freezePlaybackDuringReposition) {
      this._sendAudioCommand(this.frozenPlaybackRate, this.frozenDirection, 'REPOSITION');
      return;
    }
    
    // Attendre d'avoir assez d'échantillons
    if (this.velocityBuffer.length < this.config.minSamplesForDecision) {
      return;
    }
    
    const comfortMin = this.config.targetSpeed - this.config.comfortZone;  // 180°/s
    const comfortMax = this.config.targetSpeed + this.config.comfortZone;  // 540°/s
    const hysteresisMin = comfortMin - this.config.hysteresisMargin;       // 140°/s
    const hysteresisMax = comfortMax + this.config.hysteresisMargin;       // 580°/s
    
    // Mise à jour état zone confort (avec hystérésis)
    if (this.isInComfortZone) {
      if (this.averageVelocity < hysteresisMin || this.averageVelocity > hysteresisMax) {
        this.isInComfortZone = false;
        console.log('[RotationContinue] 🔓 Sortie zone confort');
      }
    } else {
      if (this.averageVelocity >= comfortMin && this.averageVelocity <= comfortMax) {
        this.isInComfortZone = true;
        console.log('[RotationContinue] 🎯 Entrée zone confort (' + this.averageVelocity.toFixed(1) + '°/s)');
      }
    }
    
    // ✅ v3.1 : ZONE CONFORT DYNAMIQUE
    // Au lieu de bloquer à 1.0x, on calcule toujours le rate mais avec lissage TRÈS fort
    const transitionMinStart = comfortMin - this.config.transitionZone;    // 0°/s
    const transitionMaxEnd = comfortMax + this.config.transitionZone;      // 720°/s
    
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
      
    } else if (this.averageVelocity >= comfortMin && this.averageVelocity <= comfortMax) {
      // ✅ v3.1 : DANS LA ZONE CONFORT - mapping proportionnel avec lissage fort
      // Calcul proportionnel : 180°/s = 0.5x, 360°/s = 1.0x, 540°/s = 1.5x
      const ratio = this.averageVelocity / this.config.targetSpeed;
      targetPlaybackRate = Math.max(0.5, Math.min(1.5, ratio));
      
    } else {
      // Zones extrêmes
      const ratio = this.averageVelocity / this.config.targetSpeed;
      targetPlaybackRate = Math.max(0.25, Math.min(2.0, ratio));
    }
    
    // ✅ v3.1 : Lissage adaptatif
    // Dans zone confort : lissage TRÈS fort (0.95)
    // Hors zone confort : lissage normal (0.85)
    const smoothingFactor = this.isInComfortZone 
      ? this.config.comfortZoneSmoothingFactor 
      : this.config.smoothingFactor;
    
    this.smoothedPlaybackRate = 
      this.smoothedPlaybackRate * (1 - smoothingFactor) + 
      targetPlaybackRate * smoothingFactor;
    
    this.smoothedPlaybackRate = Math.round(this.smoothedPlaybackRate * 100) / 100;
    
    // Envoyer commande
    const context = this.isInComfortZone ? 'COMFORT_ZONE' : 'NORMAL';
    this._sendAudioCommand(this.smoothedPlaybackRate, this.currentDirection, context);
  }
  
  /**
   * Envoie commande audio avec déduplication
   * @private
   */
  _sendAudioCommand(rate, direction, context = 'NORMAL') {
    const now = Date.now();
    
    const rateDiff = Math.abs(rate - this.lastAudioCommand.rate);
    const directionChanged = direction !== this.lastAudioCommand.direction;
    const timeSinceLastCommand = now - this.lastAudioCommand.timestamp;
    
    if (!directionChanged && rateDiff < 0.02 && timeSinceLastCommand < 500) {
      return;
    }
    
    if (directionChanged || rateDiff > 0.05 || this.audioCommandCount % 5 === 0) {
      const arrow = direction === 1 ? '↻' : '↺';
      const changeInfo = directionChanged ? ` | ${this.lastAudioCommand.direction === 1 ? '↻' : '↺'} → ${arrow}` : '';
      const deltaTime = timeSinceLastCommand > 0 ? ` | Δt: ${timeSinceLastCommand}ms` : '';
      
      console.log(`[AUDIO CMD #${this.audioCommandCount}] ${context} | Rate: ${rate.toFixed(2)}x${changeInfo}${deltaTime}`);
    }
    
    this.audioOrchestrator.setPlaybackRate(rate, direction);
    
    this.lastAudioCommand = {
      rate: rate,
      direction: direction,
      timestamp: now
    };
    
    this.audioCommandCount++;
  }
  
  /**
   * Fonction d'easing
   * @private
   */
  _easeInOutCubic(t) {
    return t < 0.5 
      ? 4 * t * t * t 
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  
  /**
   * Vérifie la progression
   * @private
   */
  _checkProgress() {
    if (!this.isActive) {
      return;
    }
    
    const elapsed = Date.now() - this.startTime;
    
    if (elapsed >= this.config.duration) {
      console.log('[RotationContinueExercise] Durée atteinte');
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
   * Notifie l'UI
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
   * Calcule les statistiques
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
        repositionCount: 0,
        totalUpdates: this.updateCount,
        totalAudioCommands: this.audioCommandCount
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
      repositionCount: repositionCount,
      totalUpdates: this.updateCount,
      totalAudioCommands: this.audioCommandCount,
      deduplicationRatio: Math.round((this.audioCommandCount / Math.max(1, this.updateCount)) * 100)
    };
  }
  
  /**
   * État actuel
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
      isInComfortZone: this.isInComfortZone,
      isRepositioning: this.isRepositioning,
      direction: this.currentDirection,
      positiveDeltaRatio: this._getPositiveDeltaRatio(),
      directionCandidate: this.directionChangeCandidate,
      bufferSize: this.velocityBuffer.length,
      updateCount: this.updateCount,
      audioCommandCount: this.audioCommandCount
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