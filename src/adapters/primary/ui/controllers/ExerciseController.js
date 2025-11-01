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
      targetRotationSpeed: 30, // Vitesse de rotation cible (°/s)
      speedTolerance: 10, // Tolérance ±10°/s
      minSpeed: 0.1,
      maxSpeed: 3.0,
      speedMultiplier: 0.05, // Facteur de conversion vitesse angulaire → playback rate
      smoothingFactor: 0.3
    };

    // État de la rotation
    this.rotationState = {
      isRegular: false,
      currentSpeed: 0,
      direction: 1,
      playbackRate: 1.0
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
    const currentFile = this.state.getCurrentFile();

    if (!currentFile) {
      this.updateStatus('❌ Chargez d\'abord un fichier audio !', 'error');
      return;
    }

    if (!this.state.getSensors().left || !this.state.getSensors().right) {
      this.updateStatus('❌ Connectez les capteurs !', 'error');
      return;
    }

    // Activation de l'exercice
    this.isExerciseActive = true;
    this.currentExercise = 'heartOfFrost';

    // Démarrer la lecture audio si nécessaire
    if (!audioState.isPlaying && this.audioOrchestrator) {
      this.audioOrchestrator.playPause();
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
      isRegular: false,
      currentSpeed: 0,
      direction: 1,
      playbackRate: 1.0
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
   * @param {string} position - "GAUCHE" ou "DROIT"
   * @param {Object} angles - Angles du capteur
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

    // Calculer la vitesse de lecture basée sur la vitesse angulaire
    const absVelocity = Math.abs(angularVelocity);
    const direction = angularVelocity >= 0 ? 1 : -1;

    // Déterminer si la rotation est régulière (proche de la vitesse cible)
    const targetSpeed = this.frostConfig.targetRotationSpeed;
    const tolerance = this.frostConfig.speedTolerance;
    const isRegular = absVelocity >= (targetSpeed - tolerance) &&
                      absVelocity <= (targetSpeed + tolerance);

    // Calculer le playback rate
    let playbackRate;

    if (isRegular) {
      // Rotation régulière = vitesse normale
      playbackRate = 1.0;
    } else {
      // Mapper la vitesse angulaire au playback rate
      // Plus on tourne vite, plus ça accélère
      playbackRate = Math.abs(angularVelocity * this.frostConfig.speedMultiplier);

      // Limiter entre min et max
      playbackRate = Math.max(this.frostConfig.minSpeed,
                             Math.min(this.frostConfig.maxSpeed, playbackRate));
    }

    // Lissage du playback rate pour éviter les variations brusques
    this.rotationState.playbackRate =
      this.rotationState.playbackRate * (1 - this.frostConfig.smoothingFactor) +
      playbackRate * this.frostConfig.smoothingFactor;

    this.rotationState.isRegular = isRegular;
    this.rotationState.currentSpeed = absVelocity;
    this.rotationState.direction = direction;

    // Appliquer à l'audio
    if (this.audioOrchestrator) {
      this.audioOrchestrator.setPlaybackRate(
        this.rotationState.playbackRate,
        this.rotationState.direction
      );
    }

    // Mettre à jour le feedback (toutes les 100ms environ)
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
    const speed = this.rotationState.currentSpeed;
    const rate = this.rotationState.playbackRate;
    const direction = this.rotationState.direction;
    const isRegular = this.rotationState.isRegular;

    let feedback = '';
    let emoji = '';

    if (isRegular) {
      emoji = '✅';
      feedback = `PARFAIT ! Vitesse normale (1.0x) | Rotation: ${speed.toFixed(1)}°/s`;
    } else if (rate > 1.0 && direction > 0) {
      emoji = '⚡';
      feedback = `Accélération ! (${rate.toFixed(2)}x) | Rotation: ${speed.toFixed(1)}°/s`;
    } else if (rate < 1.0 && direction > 0) {
      emoji = '🐌';
      feedback = `Ralentissement (${rate.toFixed(2)}x) | Rotation: ${speed.toFixed(1)}°/s`;
    } else if (direction < 0) {
      emoji = '↩️';
      feedback = `Lecture INVERSE (${rate.toFixed(2)}x) | Rotation: ${speed.toFixed(1)}°/s`;
    } else {
      emoji = '⏸️';
      feedback = `En attente de rotation...`;
    }

    this.updateFeedback(`${emoji} ${feedback}`);
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
