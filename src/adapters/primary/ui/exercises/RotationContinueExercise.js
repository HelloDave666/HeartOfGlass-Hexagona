/**
 * RotationContinueExercise.js - VERSION 3.6.1
 *
 * 🆕 v3.6.1 : REFACTORING - Extraction configuration
 * - Configuration externalisée dans configs/RotationContinueConfig.js
 *
 * 🆕 v3.6.0 : SIMPLIFICATION RADICALE - Suppression zone de confort
 * - Mapping linéaire universel : vitesse angulaire → playback rate proportionnel
 * - Pas de traitement spécial selon les zones
 * - Rotation progressive naturelle dans les deux sens
 * - Garde ce qui fonctionne : réactivité, détection direction horaire/antihoraire
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

const { exerciseConfig, audioSettings } = require('./configs/RotationContinueConfig');

class RotationContinueExercise {
  constructor({ audioOrchestrator, state, calibrationOrchestrator, audioUIController }) {
    this.audioOrchestrator = audioOrchestrator;
    this.state = state;
    this.calibrationOrchestrator = calibrationOrchestrator;
    this.audioUIController = audioUIController;

    // 🆕 v3.6.1 : Configuration externalisée
    this.config = exerciseConfig;
    this.audioSettings = audioSettings;
    
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

    // 🆕 v3.5.5 : SOLUTION 3 - Buffer de confirmation consensus
    this.directionConsensusHistory = [];  // Historique des consensus (pour détecter stabilité temporelle)

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
    this.volumeRestStartTime = 0;        // 🆕 v3.4.1 : Début période de repos (pour reset auto)

    // 🚀 v3.5 : AMÉLIORATION #1 - Dead zone gyro dynamique
    this.recentVelocityBuffer = [];      // Buffer des vitesses récentes pour calcul dead zone dynamique
    this.currentDeadZone = this.config.gyroDeadZoneRest;  // Dead zone actuelle (commence au repos)

    // 🚀 v3.5 : AMÉLIORATION #6 - Méthode hybride avec hystérésis
    this.usingDirectSignMethod = true;   // Commence avec méthode directe (vitesses basses)

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

    // 🆕 v3.5.4 : Diagnostic snap 1.00x
    this.snapDiagnostics = {
      enabled: true,
      lastRate: 1.0,
      snapCount: 0,
      snapThreshold: 0.15  // Considérer un snap si changement > 0.15
    };
    
    console.log('[RotationContinueExercise] VERSION 3.6.0 - SIMPLIFICATION RADICALE');
    console.log('[RotationContinueExercise] 🎯 Mapping linéaire universel : vitesse → playback rate proportionnel');
    console.log('[RotationContinueExercise] 📐 Référence: 360°/s = 1.0x | Limites: 0.25x-2.0x');
    console.log('[RotationContinueExercise] ⚙️ Pas de zone de confort - Rotation progressive naturelle');
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

    // 🆕 v3.5.5 : Réinitialiser buffer de confirmation consensus
    this.directionConsensusHistory = [];

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

    // 🆕 v3.4.2 : Réinitialiser contrôle volume (position centrale = 50%)
    this.leftSensorAngle = 0;
    this.currentVolume = this.config.volumeInitialValue;  // 0.5 = 50%
    this.smoothedVolume = this.config.volumeInitialValue;
    this.lastVolumeCommand = {
      volume: this.config.volumeInitialValue,
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
    let gyroY = gyro.y;  // SIGNED: >0 = horaire, <0 = antihoraire
    let angularVelocity = Math.abs(gyroY);

    // 🚀 v3.5 : AMÉLIORATION #1 - Dead zone gyro DYNAMIQUE
    // Calcule dead zone adaptative (large au repos, étroite en mouvement)
    const currentDeadZone = this._updateDynamicDeadZone(angularVelocity);

    // Appliquer la dead zone dynamique
    if (angularVelocity < currentDeadZone) {
      gyroY = 0;
      angularVelocity = 0;
    }

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
      const playbackSpeed = (angularVelocity / this.config.targetSpeed).toFixed(2);
      console.log(`[DEBUG #${this.updateCount}] GY:${gyroY.toFixed(1)}°/s (${gyroDirection}) | Det:${dirArrow} | V:${angularVelocity.toFixed(0)}°/s (${playbackSpeed}x) | DZ:${currentDeadZone.toFixed(2)}°/s`);
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
      isInRange: true,  // 🆕 v3.6.0 : Plus de notion de zone - toujours valide
      isInComfortZone: false,  // 🆕 v3.6.0 : Zone de confort supprimée
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

    // 🚀 v3.5 : AMÉLIORATION #2 - Seuil réduit pour micro-mouvements
    // Ne PAS détecter changement si vélocité trop faible (évite bruit au repos)
    if (this.lastAngularVelocity < this.config.directionDetectionMinVelocity) {
      // Capteur probablement immobile ou mouvement trop lent - garder direction actuelle
      this.directionChangeCandidate = null;
      this.directionCandidateStartTime = 0;
      return;
    }

    // 🚀 v3.5 : AMÉLIORATION #5 - Détection passage par ZÉRO
    // Si vitesse très faible (< 10°/s), probable changement de direction en cours
    // → Réinitialiser le lock pour permettre détection immédiate
    if (this.config.directionZeroCrossingReset &&
        this.lastAngularVelocity < this.config.directionZeroCrossingThreshold) {
      // Passage par zéro détecté → Autoriser nouvelle détection
      this.lastDirectionChangeTime = 0;
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

    // 🆕 v3.5.5 : SOLUTION 3 - Buffer de confirmation consensus
    // Ajouter le consensus actuel à l'historique
    if (this.config.directionConsensusConfirmationEnabled) {
      this.directionConsensusHistory.push({
        direction: candidateDirection,
        timestamp: now
      });

      // Garder seulement les N dernières frames
      const maxHistory = this.config.directionConsensusConfirmationFrames;
      if (this.directionConsensusHistory.length > maxHistory) {
        this.directionConsensusHistory.shift();
      }

      // Vérifier si le consensus est STABLE sur les N dernières frames
      const isConsensusStable = this._checkConsensusStability(candidateDirection);

      // Si le consensus n'est pas stable, annuler toute candidature
      if (!isConsensusStable) {
        this.directionChangeCandidate = null;
        this.directionCandidateStartTime = 0;
        return;
      }
    }

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

      // 🆕 v3.5.4 : Log diagnostic pour corrélation avec snap
      console.log(`   └─ Playback: ${this.smoothedPlaybackRate.toFixed(2)}x | Vitesse: ${this.averageVelocity.toFixed(1)}°/s`);
    }
  }
  
  /**
   * 🆕 v3.5.5 : SOLUTION 3 - Vérifie la stabilité du consensus sur N frames
   * @param {number|null} candidateDirection - Direction candidate à vérifier
   * @returns {boolean} True si le consensus est stable (toutes les frames récentes ont la même direction)
   * @private
   */
  _checkConsensusStability(candidateDirection) {
    if (!this.config.directionConsensusConfirmationEnabled) {
      return true; // Si désactivé, toujours considérer stable
    }

    // Pas assez d'historique encore
    if (this.directionConsensusHistory.length < this.config.directionConsensusConfirmationFrames) {
      return false;
    }

    // Vérifier que TOUTES les frames récentes ont la même direction
    for (const entry of this.directionConsensusHistory) {
      if (entry.direction !== candidateDirection) {
        return false; // Une frame différente → consensus instable
      }
    }

    return true; // Toutes les frames concordent → consensus stable
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
    const absAvgGyro = Math.abs(avgGyro);

    // 🚀 v3.5 : AMÉLIORATION #6 - Méthode HYBRIDE avec HYSTÉRÉSIS
    // Décider quelle méthode utiliser avec zone tampon (évite oscillations à la frontière)
    if (this.config.directionHybridMethod) {
      // Hystérésis : Changer de méthode uniquement si on dépasse clairement les seuils
      if (this.usingDirectSignMethod && absAvgGyro >= this.config.directionDirectSignThresholdHigh) {
        // On monte au-dessus de 220°/s → Passer à méthode calibrée
        this.usingDirectSignMethod = false;
      } else if (!this.usingDirectSignMethod && absAvgGyro <= this.config.directionDirectSignThresholdLow) {
        // On descend en-dessous de 180°/s → Passer à méthode directe
        this.usingDirectSignMethod = true;
      }
      // Entre 180-220°/s → Garder la méthode actuelle (zone d'hystérésis)
    }

    // Appliquer la méthode choisie
    if (this.config.directionHybridMethod && this.usingDirectSignMethod) {
      // Méthode DIRECTE : Signe du gyroscope
      // Positif → Horaire (direction -1), Négatif → Antihoraire (direction 1)
      // Note: Le mapping dépend de l'orientation physique du capteur (défini lors de la calibration)

      // Calculer le ratio de valeurs positives dans le buffer
      const positiveCount = gyroValues.filter(v => v > 0).length;
      const positiveRatio = positiveCount / gyroValues.length;

      // 🔴 REVENU À 85% - Plus stable que 70%
      if (positiveRatio > 0.85) {
        // Majorité forte positive → Horaire
        return -1;
      } else if (positiveRatio < 0.15) {
        // Majorité forte négative → Antihoraire
        return 1;
      } else {
        // Pas de consensus clair (entre 15% et 85%)
        return null;
      }
    }

    // Méthode CLASSIQUE : Plages calibrées (pour haute vitesse > 200°/s)
    // Calculer distance aux deux plages (noter le mapping: clockwise = horaire, counterclockwise = antihoraire)
    const distHoraire = this._distanceToRange(avgGyro, calibrationModel.clockwise);
    const distAntihoraire = this._distanceToRange(avgGyro, calibrationModel.counterclockwise);

    // Choisir la direction la plus proche
    // Si les distances sont trop similaires, pas de consensus clair
    const minDist = Math.min(distHoraire, distAntihoraire);
    const maxDist = Math.max(distHoraire, distAntihoraire);

    // 🚀 v3.5 : AMÉLIORATION #4 - Ratio de séparation ADAPTATIF
    // Ratio plus permissif aux vitesses moyennes (0.30-0.50x) pour meilleure détection
    let requiredRatio = 2.0; // Valeur par défaut (mode classique)

    if (this.config.directionSeparationRatioAdaptive) {
      const absAvgGyro = Math.abs(avgGyro);

      if (absAvgGyro < this.config.directionSeparationVelocityLow) {
        // Basse vitesse (< 50°/s) → Ratio permissif 1.5
        requiredRatio = this.config.directionSeparationRatioLow;
      } else if (absAvgGyro < this.config.directionSeparationVelocityHigh) {
        // Moyenne vitesse (50-200°/s) → Ratio moyen 1.8 🎯 ZONE CRITIQUE 0.30-0.50x
        requiredRatio = this.config.directionSeparationRatioMid;
      } else {
        // Haute vitesse (> 200°/s) → Ratio strict 2.5
        requiredRatio = this.config.directionSeparationRatioHigh;
      }
    }

    // Besoin d'une séparation claire selon le ratio adaptatif
    if (maxDist / Math.max(0.1, minDist) < requiredRatio) {
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
   * 🆕 v3.6.0 : Fenêtre glissante simple et universelle
   * @private
   */
  _addToVelocityBuffer(sample) {
    const now = Date.now();

    this.velocityBuffer.push(sample);

    // Fenêtre glissante fixe (pas de fenêtre adaptative)
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
   * 🆕 v3.6.0 : Contrôle audio SIMPLIFIÉ - Mapping linéaire universel
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

    // 🆕 v3.6.0 : MAPPING LINÉAIRE UNIVERSEL
    // Pas de zones spéciales - juste un ratio proportionnel
    // 360°/s (1 tour/sec) = 1.0x playback rate (référence)
    // Plus rapide → playback plus rapide, plus lent → playback plus lent
    const ratio = this.averageVelocity / this.config.targetSpeed;
    let targetPlaybackRate = ratio;

    // Clamper entre les limites configurées
    targetPlaybackRate = Math.max(
      this.config.minPlaybackRate,
      Math.min(this.config.maxPlaybackRate, targetPlaybackRate)
    );

    // Log périodique pour debug
    if (this.updateCount % 50 === 0) {
      console.log(`[Playback] Vitesse:${this.averageVelocity.toFixed(0)}°/s → Rate:${targetPlaybackRate.toFixed(2)}x (ratio:${ratio.toFixed(2)})`);
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

    // Arrondir à 2 décimales
    this.smoothedPlaybackRate = Math.round(this.smoothedPlaybackRate * 100) / 100;

    // 🆕 v3.5.4 : DIAGNOSTIC SNAP (gardé pour surveillance)
    // Détecter les sauts brusques
    if (this.snapDiagnostics.enabled) {
      const rateDelta = Math.abs(this.smoothedPlaybackRate - this.snapDiagnostics.lastRate);

      // Détecter snap (changement brusque)
      if (rateDelta > this.snapDiagnostics.snapThreshold) {
        this.snapDiagnostics.snapCount++;
        console.warn(`🚨 [SNAP #${this.snapDiagnostics.snapCount}] Détecté: ${this.snapDiagnostics.lastRate.toFixed(2)}x → ${this.smoothedPlaybackRate.toFixed(2)}x`);
        console.warn(`   ├─ Vitesse: ${this.averageVelocity.toFixed(1)}°/s | Target: ${targetPlaybackRate.toFixed(2)}x`);
        console.warn(`   ├─ Repositionnement: ${this.isRepositioning ? 'OUI' : 'NON'}`);
        console.warn(`   ├─ Direction: ${this.currentDirection === 1 ? '↻ Horaire' : '↺ Antihoraire'} | Transition: ${this.isInDirectionTransition ? 'OUI' : 'NON'}`);
        console.warn(`   └─ Smoothing: ${smoothingFactor.toFixed(2)} | Variance: ${this.currentVariance.toFixed(1)}`);
      }

      this.snapDiagnostics.lastRate = this.smoothedPlaybackRate;
    }

    // Envoyer commande
    this._sendAudioCommand(this.smoothedPlaybackRate, this.currentDirection, 'PROGRESSIVE');
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
      // 🆕 v3.6.0 : Plus de zone neutre - affichage toujours actif
      const isNeutral = false;
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

    // 🆕 v3.4.1 : Zone morte gyroscope (ignorer micro-mouvements < 3°/s)
    const absVelocity = Math.abs(angularVelocity);
    if (absVelocity < this.config.volumeGyroDeadZone) {
      angularVelocity = 0;
    }

    // Calculer changement d'angle : delta = vitesse × temps
    const deltaAngle = angularVelocity * dt;

    // Ajouter au cumul (angle qui ne boucle PAS comme Euler)
    this.cumulativeVolumeAngle += deltaAngle;

    // 🆕 v3.4.3 : BUTÉES STRICTES - Clamper l'angle entre -90° et +90° (potentiomètre physique)
    // Cela empêche la dérive de l'angle au-delà des limites
    const maxAngle = this.config.volumeRightZoneEnd; // 90°
    this.cumulativeVolumeAngle = Math.max(-maxAngle, Math.min(maxAngle, this.cumulativeVolumeAngle));

    // ========================================
    // 2. MAPPER ANGLE CUMULATIF → VOLUME
    // ========================================

    let targetVolume;

    // 📍 Zone active DROITE (0° à 90°) : 50% → 100% volume (rotation horaire)
    if (this.cumulativeVolumeAngle >= 0 && this.cumulativeVolumeAngle <= maxAngle) {
      // Interpolation linéaire : 0° = 50%, 90° = 100%
      const progress = this.cumulativeVolumeAngle / maxAngle; // 0.0 à 1.0
      targetVolume = 0.5 + (progress * 0.5); // 0.5 à 1.0
      this.lastKnownVolume = targetVolume; // Mémoriser
    }

    // 📍 Zone active GAUCHE (-90° à 0°) : 0% → 50% volume (rotation antihoraire)
    else if (this.cumulativeVolumeAngle < 0 && this.cumulativeVolumeAngle >= -maxAngle) {
      // Interpolation linéaire : -90° = 0%, 0° = 50%
      const progress = (this.cumulativeVolumeAngle + maxAngle) / maxAngle; // 0.0 à 1.0
      targetVolume = progress * 0.5; // 0.0 à 0.5
      this.lastKnownVolume = targetVolume; // Mémoriser
    }

    // 📍 Zones MORTES (théoriquement inaccessibles avec butées, mais sécurité)
    else {
      targetVolume = this.lastKnownVolume;
    }

    // ========================================
    // 3. LISSAGE ET ENVOI
    // ========================================

    // Clamper le volume entre 0 et 1 (sécurité)
    targetVolume = Math.max(0.0, Math.min(1.0, targetVolume));

    // 🆕 v3.4.1 : Lissage augmenté pour affichage UI stable
    const smoothingFactor = this.config.volumeSmoothingFactor;
    this.smoothedVolume =
      this.smoothedVolume * (1 - smoothingFactor) +
      targetVolume * smoothingFactor;

    // 🆕 v3.4.3 : SNAP TO EDGE - Forcer les limites exactes quand aux butées
    // Si l'angle est à ±90° (butées), forcer 0% ou 100% exactement
    const edgeThreshold = 2; // Seuil en degrés pour considérer qu'on est à la butée
    if (Math.abs(this.cumulativeVolumeAngle - maxAngle) < edgeThreshold) {
      // Butée droite → 100%
      this.smoothedVolume = 1.0;
    } else if (Math.abs(this.cumulativeVolumeAngle + maxAngle) < edgeThreshold) {
      // Butée gauche → 0%
      this.smoothedVolume = 0.0;
    }

    // Arrondir pour éviter micro-variations
    this.smoothedVolume = Math.round(this.smoothedVolume * 100) / 100;

    // Envoyer commande volume (avec déduplication améliorée)
    this._sendVolumeCommand(this.smoothedVolume, now);
  }

  /**
   * 🆕 v3.4.2 : Envoie commande de volume avec déduplication
   * @param {number} volume - Volume (0.0 à 1.0)
   * @param {number} now - Timestamp actuel
   * @private
   */
  _sendVolumeCommand(volume, now) {
    const volumeDiff = Math.abs(volume - this.lastVolumeCommand.volume);
    const timeSinceLastCommand = now - this.lastVolumeCommand.timestamp;

    // Déduplication : ignorer si changement < 2% et délai < 100ms
    if (volumeDiff < 0.02 && timeSinceLastCommand < 100) {
      return;
    }

    // 🆕 v3.4.2 : Appliquer le volume via audioOrchestrator
    // Cela met à jour le state ET l'UI automatiquement
    if (this.audioOrchestrator && this.audioOrchestrator.setVolume) {
      this.audioOrchestrator.setVolume(volume);
    }

    // Mémoriser dernière commande
    this.lastVolumeCommand.volume = volume;
    this.lastVolumeCommand.timestamp = now;
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
   * 🚀 v3.5 : AMÉLIORATION #1 - Calcule et applique la dead zone gyro DYNAMIQUE
   * Dead zone large au repos (3°/s) → ignore bruit
   * Dead zone étroite en mouvement (0.5°/s) → capture micro-mouvements
   * @param {number} angularVelocity - Vitesse angulaire absolue (°/s)
   * @returns {number} Dead zone actuelle à appliquer (°/s)
   * @private
   */
  _updateDynamicDeadZone(angularVelocity) {
    if (!this.config.gyroDeadZoneDynamic) {
      return this.config.gyroDeadZoneRest; // Mode classique
    }

    // Ajouter vitesse actuelle au buffer récent
    this.recentVelocityBuffer.push(angularVelocity);

    // Garder seulement les N derniers échantillons
    if (this.recentVelocityBuffer.length > this.config.gyroRecentVelocityWindow) {
      this.recentVelocityBuffer.shift();
    }

    // Calculer vitesse moyenne récente
    if (this.recentVelocityBuffer.length === 0) {
      return this.config.gyroDeadZoneRest;
    }

    const avgRecentVelocity = this.recentVelocityBuffer.reduce((sum, v) => sum + v, 0) / this.recentVelocityBuffer.length;

    // Interpolation linéaire entre dead zone repos et mouvement
    const transitionStart = this.config.gyroDeadZoneTransitionStart;
    const transitionEnd = this.config.gyroDeadZoneTransitionEnd;

    if (avgRecentVelocity <= transitionStart) {
      // Au repos → dead zone large
      this.currentDeadZone = this.config.gyroDeadZoneRest;
    } else if (avgRecentVelocity >= transitionEnd) {
      // En mouvement → dead zone étroite
      this.currentDeadZone = this.config.gyroDeadZoneMoving;
    } else {
      // Transition progressive
      const progress = (avgRecentVelocity - transitionStart) / (transitionEnd - transitionStart);
      this.currentDeadZone = this.config.gyroDeadZoneRest +
        (this.config.gyroDeadZoneMoving - this.config.gyroDeadZoneRest) * progress;
    }

    return this.currentDeadZone;
  }

  /**
   * 🆕 v3.2 : IDÉE 1 - Calcule le facteur de lissage adaptatif basé sur la variance
   * @returns {number} Facteur de lissage entre baseSmoothingFactor et maxSmoothingFactor
   * @private
   */
  _calculateAdaptiveSmoothingFactor() {
    if (!this.config.adaptiveSmoothingEnabled) {
      // Si désactivé, utiliser le smoothing factor standard
      return this.config.smoothingFactor;
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

    // 🆕 v3.6.0 : Plus de notion de zone - tous les échantillons sont valides
    const samplesInRange = this.rotationHistory.length;
    const consistency = 100;  // Toujours 100% sans zone de confort
    
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