/**
 * RotationContinueExercise.js - VERSION 3.4
 *
 * 🆕 v3.4 : CONTRÔLE DE VOLUME POTENTIOMÈTRE
 * - Capteur GAUCHE contrôle le volume comme un potentiomètre physique
 * - Zone gauche (270°-360°): 0% → 50% volume (rotation antihoraire)
 * - Position centrale (0°): 50% volume initial
 * - Zone droite (0°-90°): 50% → 100% volume (rotation horaire)
 * - Zone morte (90°-270°): maintient le volume actuel
 * - Butées virtuelles pour simulation réaliste
 *
 * PHASE D : Calibration Interactive Guidée
 * - 🆕 PHASE D : Calibration en 3 étapes (Repos → Horaire → Antihoraire)
 * - 🆕 PHASE D : Capture plages dynamiques min/max/avg pour chaque sens
 * - 🆕 PHASE D : Détection par distance aux plages (robuste aux variations)
 * - 🆕 PHASE D : UI visuelle avec barre de progression
 * - 🆕 PHASE D : Verrouillage réduit à 800ms (vs 1500ms)
 *
 * Basé sur v3.2/3.3 (ULTRA-RÉACTIF) :
 * ✅ 1. SEUIL RÉDUIT : 65% au lieu de 70%
 * ✅ 2. TEMPS STABILITÉ RÉDUIT : 200ms au lieu de 500ms (2.5x plus rapide)
 * ✅ 3. FENÊTRE RÉDUITE : 8 échantillons au lieu de 15 (2x plus rapide)
 * ✅ 4. ZONE CONFORT ÉLARGIE : ±240°/s au lieu de ±180°/s (33% plus large)
 * ✅ 5. LISSAGE ADAPTATIF : s'adapte à la variance de mouvement
 * ✅ 6. DÉTECTION PRÉDICTIVE : anticipe les changements via accélération
 *
 * Architecture: Adapter - Logique métier de l'exercice
 */

class RotationContinueExercise {
  constructor({ audioOrchestrator, state, calibrationOrchestrator, audioUIController }) {
    this.audioOrchestrator = audioOrchestrator;
    this.state = state;
    this.calibrationOrchestrator = calibrationOrchestrator;
    this.audioUIController = audioUIController;
    
    // Configuration de l'exercice
    this.config = {
      targetSpeed: 360,           // 1 tour par seconde
      comfortZone: 240,           // 🚀 v3.3 : Zone élargie ±240°/s = [120-600°/s] (vs ±180) → plus facile à trouver
      transitionZone: 180,

      duration: 300000,           // 5 minutes
      checkInterval: 100,
      smoothingFactor: 0.65,      // 🚀 v3.3 : Lissage encore réduit (0.65 vs 0.70) → ultra-réactif

      // Paramètres fenêtre glissante
      samplingWindow: 4000,
      hysteresisMargin: 30,       // 🚀 v3.3 : Réduit de 40 à 30 → transitions plus fluides
      minSamplesForDecision: 5,   // 🚀 v3.3 : Réduit de 6 à 5 → réaction instantanée

      // Validation dt robuste
      minValidDt: 0.01,
      maxValidDt: 0.2,

      // Repositionnement
      repositionThreshold: 10,
      repositionMinDuration: 200,
      repositionMaxDuration: 2500,
      freezePlaybackDuringReposition: true,

      // 🚀 v3.2 : Détection direction ULTRA-RÉACTIVE
      directionWindowSize: 8,             // 🚀 8 échantillons (~240ms à 30Hz) vs 15
      directionChangeThreshold: 0.65,     // 🚀 65% des deltas (vs 70%) → plus sensible
      directionStabilityTime: 200,        // 🚀 200ms (vs 500ms) → détection 2.5x plus rapide

      // 🚀 v3.2 : Anti-oscillation très réduit
      directionChangeLockTime: 300,       // 🚀 300ms (vs 800ms) → changements rapides possibles

      // 🆕 Transition douce lors changement de direction (anti-artefacts audio)
      directionTransitionDuration: 250,    // Durée transition 250ms pour éviter les sautes
      directionTransitionSpeedFactor: 0.4, // Réduire à 40% de la vitesse pendant transition

      // 🚀 v3.3 : Lissage adaptatif dynamique ultra-réactif
      comfortZoneLockEnabled: false,      // Ne plus verrouiller à 1.0x
      comfortZoneSmoothingFactor: 0.60,   // 🚀 v3.3 : Lissage encore réduit (0.60 vs 0.65) → zone confort ultra-réactive

      // 🚀 v3.3 : IDÉE 1 - Lissage adaptatif affiné
      adaptiveSmoothingEnabled: true,     // Activer lissage adaptatif
      baseSmoothingFactor: 0.55,          // 🚀 v3.3 : Lissage minimal réduit (0.55 vs 0.60) → mouvement régulier TRÈS réactif
      maxSmoothingFactor: 0.80,           // 🚀 v3.3 : Lissage maximal réduit (0.80 vs 0.85) → mouvement irrégulier plus fluide
      varianceThreshold: 60,              // 🚀 v3.3 : Seuil augmenté (60 vs 50) → tolérance accrue

      // 🆕 v3.2 : IDÉE 2 - Détection prédictive par accélération
      predictiveDetectionEnabled: true,   // Activer détection prédictive
      accelerationThreshold: 800,         // Seuil d'accélération angulaire (°/s²)
      earlyDetectionBonus: 150,           // Réduction du temps de stabilité si accélération détectée (ms)

      // 🆕 PHASE D : Calibration interactive guidée
      calibrationRestDuration: 4000,      // 4s repos pour mesurer bruit de fond
      calibrationStepDuration: 6000,      // 6s par rotation (horaire + antihoraire)
      calibrationMinSamples: 30,          // Minimum 30 échantillons par phase (~1s à 30Hz)

      // 🚀 v3.4 : Contrôle de volume POTENTIOMÈTRE avec capteur GAUCHE
      volumeControlEnabled: true,         // Activer contrôle volume capteur gauche
      volumeCenterAngle: 0,               // Position centrale (0°) = 50% volume
      volumeRightZoneEnd: 90,             // Butée droite (90°) = 100% volume (rotation horaire)
      volumeLeftZoneStart: 270,           // Butée gauche (270° ou -90°) = 0% volume (rotation antihoraire)
      volumeDeadZoneStart: 90,            // Début zone morte (90° à 270°)
      volumeDeadZoneEnd: 270,             // Fin zone morte
      volumeSmoothingFactor: 0.45,        // Lissage pour transitions fluides
      volumeInitialValue: 0.5,            // Volume initial au démarrage (50%)
      leftSensorInverted: true            // Capteur gauche inversé (main opposée)
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

    // État fenêtre glissante
    this.velocityBuffer = [];
    this.averageVelocity = 0;
    this.isInComfortZone = false;        // ✅ v3.1 : Renommé (pas "locked")

    // 🆕 v3.2 : Lissage adaptatif basé sur variance
    this.currentVariance = 0;            // Variance actuelle de la vitesse (°/s)²
    this.adaptiveSmoothingFactor = this.config.smoothingFactor;  // Facteur de lissage adaptatif

    // 🆕 v3.2 : Détection prédictive par accélération
    this.currentAngularAcceleration = 0; // Accélération angulaire (°/s²)
    this.lastVelocityTimestamp = 0;      // Timestamp de la dernière mesure pour calcul accélération

    // Détection direction
    this.signedDeltaBuffer = [];
    this.currentDirection = 1;
    this.lastDirectionChangeTime = 0;
    this.directionChangeCandidate = null;
    this.directionCandidateStartTime = 0;

    // 🆕 Transition douce lors changement direction
    this.isInDirectionTransition = false;
    this.directionTransitionStartTime = 0;

    // État repositionnement
    this.isRepositioning = false;
    this.repositionStartTime = null;
    this.frozenPlaybackRate = 1.0;
    this.frozenDirection = 1;

    // 🆕 v3.4 : Contrôle de volume POTENTIOMÈTRE avec capteur gauche
    this.cumulativeVolumeAngle = 0;      // Angle cumulatif basé sur gyroscope (ne boucle pas)
    this.lastLeftSensorTimestamp = 0;    // Timestamp dernière lecture capteur gauche
    this.leftSensorAngle = 0;            // Angle actuel du capteur gauche (°) - pour debug
    this.currentVolume = 0.5;            // Volume actuel (0.0 à 1.0) - INIT à 50%
    this.smoothedVolume = 0.5;           // Volume lissé (0.0 à 1.0) - INIT à 50%
    this.lastVolumeCommand = {           // Dernière commande de volume envoyée
      volume: 0.5,                       // Volume initial à 50%
      timestamp: 0
    };
    this.lastKnownVolume = 0.5;          // Dernier volume connu (pour zone morte)

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
    console.log('[RotationContinueExercise] VERSION 3.4 - Démarrage...');
    console.log('[RotationContinueExercise] 🔊 Contrôle volume potentiomètre activé');
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

    // Sauvegarder et appliquer les paramètres audio optimisés
    const currentParams = this.state.getAudioParameters();
    this.originalAudioParams = {
      grainSize: currentParams.grainSize,
      overlap: currentParams.overlap
    };
    
    console.log('[RotationContinueExercise] 🎵 Configuration audio:', this.audioSettings);
    this.audioOrchestrator.setGrainSize(this.audioSettings.grainSize);
    this.audioOrchestrator.setOverlap(this.audioSettings.overlap);

    // 🆕 v3.4 : Initialiser le volume à 50% (position centrale du potentiomètre)
    if (this.config.volumeControlEnabled && this.audioOrchestrator && this.audioOrchestrator.setVolume) {
      this.audioOrchestrator.setVolume(this.config.volumeInitialValue);
      console.log(`[RotationContinueExercise] 🔊 Volume initial: ${(this.config.volumeInitialValue * 100).toFixed(0)}%`);
    }

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

    // 🚀 v3.2 : Réinitialiser lissage adaptatif et détection prédictive
    this.currentVariance = 0;
    this.adaptiveSmoothingFactor = this.config.smoothingFactor;
    this.currentAngularAcceleration = 0;
    this.lastVelocityTimestamp = 0;

    // Réinitialiser détection direction
    this.signedDeltaBuffer = [];
    this.currentDirection = 1;
    this.lastDirectionChangeTime = Date.now();
    this.directionChangeCandidate = null;
    this.directionCandidateStartTime = 0;

    // 🆕 Réinitialiser transition douce
    this.isInDirectionTransition = false;
    this.directionTransitionStartTime = 0;

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

    // 🆕 v3.3 : Réinitialiser contrôle volume
    this.leftSensorAngle = 0;
    this.currentVolume = 1.0;
    this.smoothedVolume = 1.0;
    this.lastVolumeCommand = {
      volume: 1.0,
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
   * 🆕 v3.3 : Supporte capteur GAUCHE pour contrôle volume
   * @param {Object} sensorData - { angles: {x,y,z}, gyro: {x,y,z}, accel: {x,y,z} }
   * @param {string} position - 'DROIT' (vitesse) ou 'GAUCHE' (volume) - optionnel, par défaut 'DROIT'
   */
  update(sensorData, position = 'DROIT') {
    if (!this.isActive) {
      return;
    }

    const now = Date.now();
    this.updateCount++;

    // Support ancien format pour compatibilité
    const angles = sensorData.angles || sensorData;
    const gyro = sensorData.gyro || { x: 0, y: 0, z: 0 };

    // 🆕 v3.4 : Capteur GAUCHE → Contrôle de VOLUME (potentiomètre avec gyroscope)
    if (position === 'GAUCHE' && this.config.volumeControlEnabled) {
      console.log(`[RotationContinue] 📍 GAUCHE détecté - Gyro Y: ${gyro.y.toFixed(1)}°/s`);
      this._updateVolumeFromLeftSensor(angles, gyro, now);
      return; // Le capteur gauche ne gère QUE le volume
    }

    // Capteur DROIT → Contrôle de VITESSE (suite du code existant)

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

    // 🚀 v3.2 : IDÉE 2 - Détection prédictive par accélération
    // Si forte accélération détectée, réduire le temps de stabilité requis
    let requiredStabilityTime = this.config.directionStabilityTime;

    if (this.config.predictiveDetectionEnabled) {
      // Détecter accélération forte (ralentissement ou changement brusque)
      const absAcceleration = Math.abs(this.currentAngularAcceleration);

      if (absAcceleration > this.config.accelerationThreshold) {
        // Forte accélération détectée → réduire le temps de stabilité
        requiredStabilityTime = Math.max(
          50, // Minimum 50ms pour éviter faux positifs
          this.config.directionStabilityTime - this.config.earlyDetectionBonus
        );
      }
    }

    // La candidate est stable depuis assez longtemps
    const candidateStabilityDuration = now - this.directionCandidateStartTime;
    if (candidateStabilityDuration >= requiredStabilityTime) {
      // CHANGER LA DIRECTION
      const oldDirection = this.currentDirection;
      this.currentDirection = candidateDirection;
      this.lastDirectionChangeTime = now;
      this.directionChangeCandidate = null;
      this.directionCandidateStartTime = 0;

      // 🆕 ACTIVER TRANSITION DOUCE pour éviter artefacts audio
      this.isInDirectionTransition = true;
      this.directionTransitionStartTime = now;

      // Calculer gyro moyen pour log
      const avgGyro = this.signedDeltaBuffer.reduce((sum, s) => sum + s.delta, 0) / this.signedDeltaBuffer.length;

      const oldArrow = oldDirection === 1 ? '↻' : '↺';
      const newArrow = candidateDirection === 1 ? '↻' : '↺';

      // 🚀 v3.2 : Log amélioré avec détection prédictive
      const predictiveBonus = requiredStabilityTime < this.config.directionStabilityTime;
      const logDetails = predictiveBonus
        ? `Gyro=${avgGyro.toFixed(1)}°/s | Accel=${this.currentAngularAcceleration.toFixed(0)}°/s² | ${candidateStabilityDuration}ms ⚡PRÉDIT`
        : `Gyro=${avgGyro.toFixed(1)}°/s | ${candidateStabilityDuration}ms`;

      console.log(`[RotationContinue] 🔄 CHANGEMENT: ${oldArrow} → ${newArrow} (${logDetails}) → Transition activée`);
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

      // 🚀 v3.2 : IDÉE 2 - Calculer l'accélération angulaire pour détection prédictive
      this.currentAngularAcceleration = this._calculateAngularAcceleration(
        this.averageVelocity,
        now
      );
    } else {
      this.averageVelocity = 0;
      this.currentAngularAcceleration = 0;
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

    // 🆕 TRANSITION DOUCE lors changement de direction pour éviter artefacts audio
    const now = Date.now();
    if (this.isInDirectionTransition) {
      const transitionElapsed = now - this.directionTransitionStartTime;

      if (transitionElapsed < this.config.directionTransitionDuration) {
        // Encore en transition : réduire temporairement la vitesse
        const transitionFactor = this.config.directionTransitionSpeedFactor;
        targetPlaybackRate *= transitionFactor;

        // Log uniquement au début de la transition
        if (transitionElapsed < 50) {
          console.log(`[RotationContinue] 🎵 Transition audio activée (${this.config.directionTransitionDuration}ms à ${(transitionFactor*100).toFixed(0)}%)`);
        }
      } else {
        // Transition terminée
        this.isInDirectionTransition = false;
        console.log(`[RotationContinue] ✅ Transition audio terminée`);
      }
    }

    // 🚀 v3.2 : Lissage adaptatif basé sur variance (IDÉE 1)
    // Variance faible (mouvement régulier) → lissage faible (réactif)
    // Variance élevée (mouvement irrégulier) → lissage fort (stable)
    const smoothingFactor = this._calculateAdaptiveSmoothingFactor();
    this.adaptiveSmoothingFactor = smoothingFactor; // Stocker pour debug

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

    // 🆕 v3.4 : Mise à jour affichage UI en temps réel
    if (this.audioUIController && this.audioUIController.updateSpeedDisplay) {
      // Déterminer si on est en zone confort (neutre)
      const isNeutral = this.isInComfortZone;
      this.audioUIController.updateSpeedDisplay(rate, direction, isNeutral);
    }

    this.lastAudioCommand = {
      rate: rate,
      direction: direction,
      timestamp: now
    };

    this.audioCommandCount++;
  }

  /**
   * 🆕 v3.4 : Contrôle de volume POTENTIOMÈTRE avec capteur gauche
   * ✅ CORRIGÉ : Utilise GYROSCOPE (angle cumulatif) au lieu d'Euler angles (qui bouclent)
   *
   * Modèle potentiomètre physique avec butées :
   * - Zone gauche (-90° à 0°) : 0% → 50% volume (rotation antihoraire)
   * - Position centrale (0°) : 50% volume
   * - Zone droite (0° à 90°) : 50% → 100% volume (rotation horaire)
   * - Zone morte (au-delà de ±90°) : garde le volume actuel (butées physiques)
   *
   * @param {Object} angles - Angles Euler du capteur gauche (pour debug uniquement)
   * @param {Object} gyro - Vitesses angulaires du gyroscope {x, y, z}
   * @param {number} now - Timestamp actuel
   * @private
   */
  _updateVolumeFromLeftSensor(angles, gyro, now) {
    // ========================================
    // 1. CALCUL ANGLE CUMULATIF (GYROSCOPE)
    // ========================================

    // Calculer dt (temps écoulé depuis dernière lecture)
    let dt = 0;
    if (this.lastLeftSensorTimestamp > 0) {
      dt = (now - this.lastLeftSensorTimestamp) / 1000; // Convertir ms → s

      // Sécurité : ignorer les dt aberrants
      if (dt > 0.5 || dt <= 0) {
        console.warn(`[RotationContinue] 🔊 dt aberrant: ${dt}s, ignoré`);
        dt = 0;
      }
    }
    this.lastLeftSensorTimestamp = now;

    // Récupérer vitesse angulaire Y (°/s)
    let angularVelocity = gyro.y;

    // 🔄 Inversion pour capteur gauche (main opposée)
    if (this.config.leftSensorInverted) {
      angularVelocity = -angularVelocity;
    }

    // Calculer changement d'angle : delta = vitesse × temps
    const deltaAngle = angularVelocity * dt;

    // Ajouter au cumul (angle qui ne boucle PAS comme Euler)
    this.cumulativeVolumeAngle += deltaAngle;

    // Debug
    console.log(`[RotationContinue] 🔊 Gyro Y: ${gyro.y.toFixed(1)}°/s | dt: ${(dt * 1000).toFixed(0)}ms | Δ: ${deltaAngle.toFixed(1)}° | Cumul: ${this.cumulativeVolumeAngle.toFixed(1)}°`);

    // ========================================
    // 2. MAPPER ANGLE CUMULATIF → VOLUME
    // ========================================

    let targetVolume;
    let zone = 'MORTE';

    // 📍 Zone active DROITE (0° à 90°) : 50% → 100% volume (rotation horaire)
    if (this.cumulativeVolumeAngle >= 0 && this.cumulativeVolumeAngle <= this.config.volumeRightZoneEnd) {
      zone = 'DROITE';
      // Interpolation linéaire : 0° = 50%, 90° = 100%
      const progress = this.cumulativeVolumeAngle / this.config.volumeRightZoneEnd; // 0.0 à 1.0
      targetVolume = 0.5 + (progress * 0.5); // 0.5 à 1.0
      this.lastKnownVolume = targetVolume; // Mémoriser
      console.log(`[RotationContinue] 🔊 Zone DROITE (${this.cumulativeVolumeAngle.toFixed(1)}°) → ${(targetVolume * 100).toFixed(0)}%`);
    }

    // 📍 Zone active GAUCHE (-90° à 0°) : 0% → 50% volume (rotation antihoraire)
    else if (this.cumulativeVolumeAngle < 0 && this.cumulativeVolumeAngle >= -this.config.volumeRightZoneEnd) {
      zone = 'GAUCHE';
      // Interpolation linéaire : -90° = 0%, 0° = 50%
      const progress = (this.cumulativeVolumeAngle + this.config.volumeRightZoneEnd) / this.config.volumeRightZoneEnd; // 0.0 à 1.0
      targetVolume = progress * 0.5; // 0.0 à 0.5
      this.lastKnownVolume = targetVolume; // Mémoriser
      console.log(`[RotationContinue] 🔊 Zone GAUCHE (${this.cumulativeVolumeAngle.toFixed(1)}°) → ${(targetVolume * 100).toFixed(0)}%`);
    }

    // 📍 Zone MORTE DROITE (> 90°) : garde dernier volume (butée physique)
    else if (this.cumulativeVolumeAngle > this.config.volumeRightZoneEnd) {
      zone = 'MORTE_DROITE';
      targetVolume = this.lastKnownVolume; // Normalement 100%
      console.log(`[RotationContinue] 🔊 Zone MORTE DROITE (${this.cumulativeVolumeAngle.toFixed(1)}°) → Butée: ${(targetVolume * 100).toFixed(0)}%`);
    }

    // 📍 Zone MORTE GAUCHE (< -90°) : garde dernier volume (butée physique)
    else if (this.cumulativeVolumeAngle < -this.config.volumeRightZoneEnd) {
      zone = 'MORTE_GAUCHE';
      targetVolume = this.lastKnownVolume; // Normalement 0%
      console.log(`[RotationContinue] 🔊 Zone MORTE GAUCHE (${this.cumulativeVolumeAngle.toFixed(1)}°) → Butée: ${(targetVolume * 100).toFixed(0)}%`);
    }

    // Sécurité : fallback
    else {
      targetVolume = this.lastKnownVolume;
      console.log(`[RotationContinue] 🔊 Zone INDÉFINIE (${this.cumulativeVolumeAngle.toFixed(1)}°) → Volume maintenu: ${(targetVolume * 100).toFixed(0)}%`);
    }

    // ========================================
    // 3. LISSAGE ET ENVOI
    // ========================================

    // Clamper le volume entre 0 et 1 (sécurité)
    targetVolume = Math.max(0.0, Math.min(1.0, targetVolume));

    // Appliquer lissage pour stabilité et transitions fluides
    const smoothingFactor = this.config.volumeSmoothingFactor;
    this.smoothedVolume =
      this.smoothedVolume * (1 - smoothingFactor) +
      targetVolume * smoothingFactor;

    // Arrondir pour éviter micro-variations
    this.smoothedVolume = Math.round(this.smoothedVolume * 100) / 100;
    console.log(`[RotationContinue] 🔊 Volume final (lissé): ${(this.smoothedVolume * 100).toFixed(0)}%`);

    // Envoyer commande volume (avec déduplication)
    this._sendVolumeCommand(this.smoothedVolume, now);
  }

  /**
   * 🆕 v3.3 : Envoie commande de volume avec déduplication
   * @param {number} volume - Volume (0.0 à 1.0)
   * @param {number} now - Timestamp actuel
   * @private
   */
  _sendVolumeCommand(volume, now) {
    const volumeDiff = Math.abs(volume - this.lastVolumeCommand.volume);
    const timeSinceLastCommand = now - this.lastVolumeCommand.timestamp;

    // Déduplication : ignorer si changement < 2% et délai < 100ms
    if (volumeDiff < 0.02 && timeSinceLastCommand < 100) {
      console.log(`[RotationContinue] 🔊 Volume - DÉDUPLIQUÉ (diff: ${(volumeDiff * 100).toFixed(1)}%, délai: ${timeSinceLastCommand}ms)`);
      return;
    }

    // Appliquer le volume à l'audioOrchestrator
    if (this.audioOrchestrator && this.audioOrchestrator.setVolume) {
      console.log(`[RotationContinue] 🔊 Volume - ENVOYÉ: ${(volume * 100).toFixed(0)}%`);
      this.audioOrchestrator.setVolume(volume);

      // 🆕 v3.4 : Mise à jour affichage UI en temps réel
      if (this.audioUIController && this.audioUIController.updateVolumeDisplay) {
        // Créer un objet audioState temporaire pour l'affichage
        const tempAudioState = { volume: volume };
        this.audioUIController.updateVolumeDisplay(tempAudioState);
      }
    } else {
      console.warn(`[RotationContinue] ⚠️ audioOrchestrator ou setVolume non disponible`);
    }

    // Mémoriser dernière commande
    this.lastVolumeCommand.volume = volume;
    this.lastVolumeCommand.timestamp = now;
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
   * 🆕 v3.2 : IDÉE 1 - Calcule la variance des vitesses dans le buffer
   * Permet d'adapter le lissage : mouvement régulier → peu de lissage, mouvement irrégulier → plus de lissage
   * @returns {number} Variance en (°/s)²
   * @private
   */
  _calculateVelocityVariance() {
    if (this.velocityBuffer.length < 3) {
      return 0;
    }

    // Calculer la moyenne
    const mean = this.averageVelocity;

    // Calculer la somme des carrés des écarts
    let sumSquaredDiff = 0;
    for (const sample of this.velocityBuffer) {
      const diff = sample.velocity - mean;
      sumSquaredDiff += diff * diff;
    }

    // Variance = moyenne des carrés des écarts
    return sumSquaredDiff / this.velocityBuffer.length;
  }

  /**
   * 🆕 v3.2 : IDÉE 1 - Calcule le facteur de lissage adaptatif basé sur la variance
   * @returns {number} Facteur de lissage entre baseSmoothingFactor et maxSmoothingFactor
   * @private
   */
  _calculateAdaptiveSmoothingFactor() {
    if (!this.config.adaptiveSmoothingEnabled) {
      // Si désactivé, utiliser la logique classique zone confort
      return this.isInComfortZone
        ? this.config.comfortZoneSmoothingFactor
        : this.config.smoothingFactor;
    }

    // Calculer la variance actuelle
    this.currentVariance = this._calculateVelocityVariance();

    // Normaliser la variance entre 0 et 1
    // variance faible (mouvement régulier) → 0
    // variance élevée (mouvement irrégulier) → 1
    const normalizedVariance = Math.min(1.0, this.currentVariance / this.config.varianceThreshold);

    // Interpoler entre le lissage minimal et maximal
    const adaptiveFactor =
      this.config.baseSmoothingFactor +
      normalizedVariance * (this.config.maxSmoothingFactor - this.config.baseSmoothingFactor);

    return adaptiveFactor;
  }

  /**
   * 🆕 v3.2 : IDÉE 2 - Calcule l'accélération angulaire
   * Permet de détecter les changements de direction plus tôt
   * @param {number} currentVelocity - Vitesse angulaire actuelle (°/s)
   * @param {number} timestamp - Timestamp actuel (ms)
   * @returns {number} Accélération angulaire (°/s²)
   * @private
   */
  _calculateAngularAcceleration(currentVelocity, timestamp) {
    if (!this.config.predictiveDetectionEnabled || this.lastVelocityTimestamp === 0) {
      this.lastVelocityTimestamp = timestamp;
      return 0;
    }

    const dt = (timestamp - this.lastVelocityTimestamp) / 1000; // Convertir en secondes
    if (dt <= 0 || dt > 0.5) { // Ignorer les valeurs aberrantes
      this.lastVelocityTimestamp = timestamp;
      return 0;
    }

    // Accélération = (v_current - v_last) / dt
    const acceleration = (currentVelocity - this.lastAngularVelocity) / dt;

    // Mettre à jour pour le prochain calcul
    this.lastVelocityTimestamp = timestamp;

    return acceleration;
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