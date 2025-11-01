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
      targetSpeed: 90, // Vitesse de rotation cible en MAGNITUDE (°/s) - sans direction
      speedTolerance: 20, // Tolérance pour zone régulière (±20°/s)
      sampleWindow: 10, // Nombre d'échantillons pour calculer la régularité
      minPlaybackRate: 0.1,
      maxPlaybackRate: 3.0,
      smoothingFactor: 0.15, // Lissage réactif
      accelerationFactor: 0.015 // Facteur pour mapper écart de vitesse → playback rate
    };

    // État de la rotation - Basé sur la VITESSE ABSOLUE
    this.rotationState = {
      speedSamples: [], // Historique des vitesses (magnitude)
      averageSpeed: 0,
      isRegular: false,
      playbackRate: 1.0,
      direction: 1 // Direction actuelle (1 ou -1)
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
      speedSamples: [],
      averageSpeed: 0,
      isRegular: false,
      playbackRate: 1.0,
      direction: 1
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
   * SOLUTION 1+2 : Mode exclusif + Vitesse ABSOLUE (magnitude sans direction)
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

    // ✅ SOLUTION 2 : Utiliser la VITESSE ABSOLUE (magnitude)
    const speedMagnitude = Math.abs(angularVelocity);
    const direction = angularVelocity >= 0 ? 1 : -1;

    // Stocker la direction actuelle
    this.rotationState.direction = direction;

    // Ajouter cet échantillon à l'historique
    this.rotationState.speedSamples.push(speedMagnitude);

    // Garder seulement les N derniers échantillons
    if (this.rotationState.speedSamples.length > this.frostConfig.sampleWindow) {
      this.rotationState.speedSamples.shift();
    }

    // Calculer la vitesse moyenne
    const sum = this.rotationState.speedSamples.reduce((a, b) => a + b, 0);
    this.rotationState.averageSpeed = sum / this.rotationState.speedSamples.length;

    // Déterminer si la vitesse est régulière
    const targetSpeed = this.frostConfig.targetSpeed;
    const tolerance = this.frostConfig.speedTolerance;
    const avgSpeed = this.rotationState.averageSpeed;

    this.rotationState.isRegular =
      avgSpeed >= (targetSpeed - tolerance) &&
      avgSpeed <= (targetSpeed + tolerance);

    // Calculer le playback rate basé sur la vitesse moyenne
    let playbackRate = 1.0;

    if (this.rotationState.speedSamples.length >= 3) {
      // On a assez d'échantillons
      if (this.rotationState.isRegular) {
        // RÉGULIER : Vitesse normale
        playbackRate = 1.0;
      } else if (avgSpeed > (targetSpeed + tolerance)) {
        // TROP RAPIDE : Accélération
        const speedExcess = avgSpeed - targetSpeed;
        playbackRate = 1.0 + (speedExcess * this.frostConfig.accelerationFactor);
        playbackRate = Math.min(this.frostConfig.maxPlaybackRate, playbackRate);
      } else if (avgSpeed < (targetSpeed - tolerance)) {
        // TROP LENT : Ralentissement
        const speedDeficit = targetSpeed - avgSpeed;
        playbackRate = 1.0 - (speedDeficit * this.frostConfig.accelerationFactor * 0.8);
        playbackRate = Math.max(this.frostConfig.minPlaybackRate, playbackRate);
      }
    }

    // Lissage du playback rate
    this.rotationState.playbackRate =
      this.rotationState.playbackRate * (1 - this.frostConfig.smoothingFactor) +
      playbackRate * this.frostConfig.smoothingFactor;

    // ✅ SOLUTION 1 : L'exercice contrôle DIRECTEMENT l'audio (mode exclusif)
    if (this.audioOrchestrator) {
      this.audioOrchestrator.setPlaybackRate(
        this.rotationState.playbackRate,
        direction
      );
    }

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
    const avgSpeed = this.rotationState.averageSpeed;
    const rate = this.rotationState.playbackRate;
    const isRegular = this.rotationState.isRegular;
    const targetSpeed = this.frostConfig.targetSpeed;
    const direction = this.rotationState.direction;
    const directionArrow = direction > 0 ? '→' : '←';

    let feedback = '';
    let emoji = '';
    let status = '';

    // Déterminer le statut
    if (this.rotationState.speedSamples.length < 3) {
      // Pas assez de données
      emoji = '🔄';
      status = 'Calibration en cours...';
      feedback = `${emoji} ${status}`;
    } else {
      // Assez de données pour évaluer
      if (isRegular) {
        // RÉGULIER !
        emoji = '✅';
        status = 'PARFAIT ! Vitesse régulière';
      } else if (avgSpeed > (targetSpeed + this.frostConfig.speedTolerance)) {
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

      feedback = `${emoji} ${status} | Vitesse: ${avgSpeed.toFixed(1)}°/s (cible: ${targetSpeed}°/s) ${directionArrow} | Audio: ${rate.toFixed(2)}x`;
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
