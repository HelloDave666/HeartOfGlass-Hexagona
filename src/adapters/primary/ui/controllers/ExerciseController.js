// src/adapters/primary/ui/controllers/ExerciseController.js
/**
 * ExerciseController - Gestion des exercices audio interactifs
 *
 * Responsabilités :
 * - Gestion de l'interface des exercices
 * - Logique de l'exercice "Heart Of Frost"
 * - Détection de rotation régulière du capteur
 * - Feedback utilisateur en temps réel
 *
 * Architecture : Adapter PRIMARY (UI)
 */

class ExerciseController {
  /**
   * @param {Object} config - Configuration
   * @param {Function} config.onStartExercise - Callback démarrage exercice
   * @param {Function} config.onStopExercise - Callback arrêt exercice
   * @param {Object} config.audioOrchestrator - Référence à l'orchestrateur audio
   * @param {Object} config.state - Référence au StateManager
   */
  constructor(config) {
    this.config = config || {};

    // Callbacks
    this.onStartExercise = config.onStartExercise || null;
    this.onStopExercise = config.onStopExercise || null;

    // Références externes
    this.audioOrchestrator = config.audioOrchestrator || null;
    this.state = config.state || null;

    // Références DOM
    this.heartOfFrostButton = null;
    this.stopExerciseButton = null;
    this.frostStatus = null;
    this.frostFeedback = null;

    // État de l'exercice
    this.isExerciseActive = false;
    this.currentExercise = null;

    // Configuration Heart Of Frost
    this.frostConfig = {
      targetRotationTime: 3.0, // Temps cible pour une rotation complète (secondes)
      rotationTimeWindow: 5, // Nombre de rotations pour calculer la moyenne
      timeTolerance: 0.5, // Tolérance (±0.5s)
      minSpeed: 0.1,
      maxSpeed: 3.0,
      smoothingFactor: 0.15 // Lissage très réactif
    };

    // État de la rotation - Détection de rotations complètes
    this.rotationState = {
      previousAngle: 0,
      currentAngle: 0,
      rotationCount: 0, // Nombre de rotations complètes
      rotationStartTime: Date.now(),
      rotationTimes: [], // Historique des temps de rotation (en secondes)
      averageRotationTime: 0,
      currentDirection: 1, // 1 = positif, -1 = négatif
      previousDirection: 1,
      playbackRate: 1.0,
      accumulatedAngle: 0 // Angle cumulé pour détecter les 360°
    };

    // Stockage des handlers pour cleanup
    this.handlers = new Map();

    console.log('[ExerciseController] Initialisé');
  }

  /**
   * Initialise le controller
   * @returns {boolean} - Succès de l'initialisation
   */
  initialize() {
    console.log('[ExerciseController] Initialisation...');

    // Récupération des éléments DOM
    this.heartOfFrostButton = document.getElementById('heartOfFrostButton');
    this.stopExerciseButton = document.getElementById('stopExerciseButton');
    this.frostStatus = document.getElementById('frostStatus');
    this.frostFeedback = document.getElementById('frostFeedback');

    // Vérification des éléments essentiels
    if (!this.heartOfFrostButton || !this.frostStatus) {
      console.error('[ExerciseController] Éléments UI essentiels manquants');
      return false;
    }

    // Configuration des événements
    this.setupEventListeners();

    console.log('[ExerciseController] Interface exercices configurée');
    return true;
  }

  /**
   * Configure les écouteurs d'événements
   * @private
   */
  setupEventListeners() {
    // Bouton Heart Of Frost
    if (this.heartOfFrostButton) {
      const handler = () => this.startHeartOfFrost();
      this.handlers.set(this.heartOfFrostButton, { event: 'click', handler });
      this.heartOfFrostButton.addEventListener('click', handler);
    }

    // Bouton Stop
    if (this.stopExerciseButton) {
      const handler = () => this.stopExercise();
      this.handlers.set(this.stopExerciseButton, { event: 'click', handler });
      this.stopExerciseButton.addEventListener('click', handler);
    }
  }

  /**
   * Démarre l'exercice Heart Of Frost
   * @public
   */
  startHeartOfFrost() {
    console.log('[ExerciseController] Démarrage Heart Of Frost...');

    // Vérifications préalables
    if (!this.state) {
      this.updateStatus('Erreur: État non disponible', 'error');
      return;
    }

    const audioState = this.state.getAudioState();
    const currentFile = this.state.getCurrentAudioFile();

    if (!currentFile) {
      this.updateStatus('❌ Chargez d\'abord un fichier audio !', 'error');
      return;
    }

    // Note: On ne vérifie pas explicitement les capteurs car ils peuvent se connecter pendant l'exercice
    // L'utilisateur verra le feedback en temps réel s'ils sont connectés ou non

    // Activation de l'exercice
    this.isExerciseActive = true;
    this.currentExercise = 'heartOfFrost';

    // Démarrer la lecture audio si nécessaire
    if (!audioState.isPlaying && this.audioOrchestrator) {
      this.audioOrchestrator.togglePlayPause();
    }

    // Mise à jour de l'interface
    this.heartOfFrostButton.style.display = 'none';
    this.stopExerciseButton.style.display = 'block';

    this.updateStatus('🎵 Exercice actif - Tournez régulièrement le capteur droit', 'active');
    this.updateFeedback('Rotation: En attente...');

    console.log('[ExerciseController] Heart Of Frost actif');

    // Callback
    if (this.onStartExercise) {
      this.onStartExercise('heartOfFrost');
    }
  }

  /**
   * Arrête l'exercice en cours
   * @public
   */
  stopExercise() {
    console.log('[ExerciseController] Arrêt de l\'exercice...');

    this.isExerciseActive = false;
    this.currentExercise = null;

    // Réinitialiser l'état de rotation
    this.rotationState = {
      previousAngle: 0,
      currentAngle: 0,
      rotationCount: 0,
      rotationStartTime: Date.now(),
      rotationTimes: [],
      averageRotationTime: 0,
      currentDirection: 1,
      previousDirection: 1,
      playbackRate: 1.0,
      accumulatedAngle: 0
    };

    // Réinitialiser la vitesse audio à 1x
    if (this.audioOrchestrator) {
      this.audioOrchestrator.setPlaybackRate(1.0, 1);
    }

    // Mise à jour de l'interface
    this.heartOfFrostButton.style.display = 'block';
    this.stopExerciseButton.style.display = 'none';

    this.updateStatus('✅ Exercice terminé', 'completed');
    this.updateFeedback('');

    // Callback
    if (this.onStopExercise) {
      this.onStopExercise();
    }
  }

  /**
   * Traite les données IMU pour l'exercice Heart Of Frost
   * LOGIQUE : Détecte les rotations complètes et ajuste l'audio selon la régularité sur plusieurs tours
   * @param {string} position - "GAUCHE" ou "DROIT"
   * @param {Object} angles - Angles du capteur { x, y, z }
   * @param {number} angularVelocity - Vitesse angulaire (°/s)
   * @public
   */
  processIMUData(position, angles, angularVelocity) {
    // Ne traiter que si l'exercice Heart Of Frost est actif
    if (!this.isExerciseActive || this.currentExercise !== 'heartOfFrost') {
      return;
    }

    // Ne traiter que le capteur droit
    if (position !== 'DROIT') {
      return;
    }

    // Récupérer l'angle Y actuel
    const currentAngle = angles.y;
    const previousAngle = this.rotationState.previousAngle;

    // Calculer le changement d'angle depuis la dernière mesure
    let deltaAngle = currentAngle - previousAngle;

    // Gérer le passage par 180° / -180° (wrap around)
    if (deltaAngle > 180) {
      deltaAngle -= 360;
    } else if (deltaAngle < -180) {
      deltaAngle += 360;
    }

    // Accumuler l'angle parcouru
    this.rotationState.accumulatedAngle += deltaAngle;

    // Déterminer le sens de rotation
    const currentDirection = angularVelocity >= 0 ? 1 : -1;
    const hasDirectionChanged = (currentDirection !== this.rotationState.previousDirection);

    // Si inversion de sens, réinitialiser l'accumulation
    if (hasDirectionChanged) {
      console.log('[HeartOfFrost] Inversion de sens détectée !');
      this.rotationState.accumulatedAngle = 0;
      this.rotationState.rotationStartTime = Date.now();
      this.rotationState.previousDirection = currentDirection;
    }

    // Détecter une rotation complète (360° parcourus)
    const absAccumulatedAngle = Math.abs(this.rotationState.accumulatedAngle);
    if (absAccumulatedAngle >= 360) {
      // Rotation complète détectée !
      const now = Date.now();
      const rotationTime = (now - this.rotationState.rotationStartTime) / 1000; // en secondes

      // Ajouter ce temps à l'historique
      this.rotationState.rotationTimes.push(rotationTime);

      // Garder seulement les N dernières rotations
      if (this.rotationState.rotationTimes.length > this.frostConfig.rotationTimeWindow) {
        this.rotationState.rotationTimes.shift();
      }

      // Calculer le temps moyen
      const sum = this.rotationState.rotationTimes.reduce((a, b) => a + b, 0);
      this.rotationState.averageRotationTime = sum / this.rotationState.rotationTimes.length;

      // Incrémenter le compteur
      this.rotationState.rotationCount++;

      console.log(`[HeartOfFrost] Rotation ${this.rotationState.rotationCount} complétée en ${rotationTime.toFixed(2)}s | Moyenne: ${this.rotationState.averageRotationTime.toFixed(2)}s`);

      // Réinitialiser pour la prochaine rotation
      this.rotationState.accumulatedAngle = 0;
      this.rotationState.rotationStartTime = now;
    }

    // Calculer le playback rate basé sur la moyenne des rotations
    let playbackRate = 1.0;
    let playbackDirection = currentDirection;

    if (this.rotationState.rotationTimes.length >= 2) {
      // On a assez de données pour calculer
      const avgTime = this.rotationState.averageRotationTime;
      const targetTime = this.frostConfig.targetRotationTime;
      const tolerance = this.frostConfig.timeTolerance;

      if (avgTime < (targetTime - tolerance)) {
        // TROP RAPIDE : Accélération
        const timeDiff = targetTime - avgTime;
        playbackRate = 1.0 + (timeDiff * 0.5); // Facteur d'accélération
        playbackRate = Math.min(this.frostConfig.maxSpeed, playbackRate);
      } else if (avgTime > (targetTime + tolerance)) {
        // TROP LENT : Ralentissement
        const timeDiff = avgTime - targetTime;
        playbackRate = 1.0 - (timeDiff * 0.3); // Facteur de ralentissement
        playbackRate = Math.max(this.frostConfig.minSpeed, playbackRate);
      } else {
        // RÉGULIER : Vitesse normale
        playbackRate = 1.0;
      }
    }

    // Lissage du playback rate
    this.rotationState.playbackRate =
      this.rotationState.playbackRate * (1 - this.frostConfig.smoothingFactor) +
      playbackRate * this.frostConfig.smoothingFactor;

    // Appliquer à l'audio
    if (this.audioOrchestrator) {
      this.audioOrchestrator.setPlaybackRate(
        this.rotationState.playbackRate,
        playbackDirection
      );
    }

    // Mettre à jour les variables pour la prochaine itération
    this.rotationState.previousAngle = currentAngle;
    this.rotationState.currentAngle = currentAngle;
    this.rotationState.currentDirection = currentDirection;

    // Mettre à jour le feedback
    if (!this.lastFeedbackUpdate || Date.now() - this.lastFeedbackUpdate > 100) {
      this.updateExerciseFeedback();
      this.lastFeedbackUpdate = Date.now();
    }
  }

  /**
   * Met à jour le feedback de l'exercice
   * @private
   */
  updateExerciseFeedback() {
    const rotationCount = this.rotationState.rotationCount;
    const avgTime = this.rotationState.averageRotationTime;
    const rate = this.rotationState.playbackRate;
    const targetTime = this.frostConfig.targetRotationTime;
    const tolerance = this.frostConfig.timeTolerance;

    let feedback = '';
    let emoji = '';
    let status = '';

    // Déterminer le statut
    if (this.rotationState.rotationTimes.length < 2) {
      // Pas assez de données
      emoji = '🔄';
      status = 'En cours de calibration...';
      feedback = `${emoji} ${status} | Rotations: ${rotationCount} | En rotation...`;
    } else {
      // Assez de données pour évaluer
      if (avgTime >= (targetTime - tolerance) && avgTime <= (targetTime + tolerance)) {
        // RÉGULIER !
        emoji = '✅';
        status = 'PARFAIT ! Rythme régulier';
      } else if (avgTime < (targetTime - tolerance)) {
        // TROP RAPIDE
        if (rate >= 2.5) {
          emoji = '⚡⚡⚡';
          status = 'BEAUCOUP TROP RAPIDE !';
        } else if (rate >= 1.5) {
          emoji = '⚡⚡';
          status = 'TROP RAPIDE !';
        } else {
          emoji = '⚡';
          status = 'Un peu trop rapide';
        }
      } else {
        // TROP LENT
        if (rate <= 0.5) {
          emoji = '🐌🐌';
          status = 'BEAUCOUP TROP LENT !';
        } else {
          emoji = '🐌';
          status = 'Trop lent';
        }
      }

      feedback = `${emoji} ${status} | Rotations: ${rotationCount} | Temps moyen: ${avgTime.toFixed(2)}s (cible: ${targetTime}s) | Audio: ${rate.toFixed(2)}x`;
    }

    this.updateFeedback(feedback);
  }

  /**
   * Met à jour le statut de l'exercice
   * @param {string} message - Message à afficher
   * @param {string} type - Type de statut ('active', 'error', 'completed')
   * @private
   */
  updateStatus(message, type = 'info') {
    if (!this.frostStatus) return;

    this.frostStatus.textContent = message;

    // Couleurs selon le type
    const colors = {
      active: '#00bfff',
      error: '#e74c3c',
      completed: '#2ecc71',
      info: '#95a5a6'
    };

    this.frostStatus.style.color = colors[type] || colors.info;
  }

  /**
   * Met à jour le feedback en temps réel
   * @param {string} message - Message de feedback
   * @private
   */
  updateFeedback(message) {
    if (!this.frostFeedback) return;
    this.frostFeedback.textContent = message;
  }

  /**
   * Vérifie si un exercice est actif
   * @returns {boolean}
   * @public
   */
  isActive() {
    return this.isExerciseActive;
  }

  /**
   * Obtient l'exercice actuel
   * @returns {string|null}
   * @public
   */
  getCurrentExercise() {
    return this.currentExercise;
  }

  /**
   * Nettoie les ressources
   * @public
   */
  dispose() {
    console.log('[ExerciseController] Nettoyage...');

    // Arrêter l'exercice si actif
    if (this.isExerciseActive) {
      this.stopExercise();
    }

    // Suppression des event listeners
    this.handlers.forEach((data, element) => {
      element.removeEventListener(data.event, data.handler);
    });
    this.handlers.clear();

    // Nettoyage des références
    this.heartOfFrostButton = null;
    this.stopExerciseButton = null;
    this.frostStatus = null;
    this.frostFeedback = null;
    this.audioOrchestrator = null;
    this.state = null;

    console.log('[ExerciseController] Nettoyé');
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExerciseController;
}
