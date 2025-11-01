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
      neutralZone: 5, // Zone neutre autour de 0° (±5°)
      maxAngle: 45, // Angle maximal pour atteindre la vitesse max (45°)
      minSpeed: 0.1,
      maxSpeed: 3.0,
      smoothingFactor: 0.3
    };

    // État de la rotation
    this.rotationState = {
      currentAngle: 0,
      direction: 1,
      playbackRate: 1.0,
      isInNeutralZone: true
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
      currentAngle: 0,
      direction: 1,
      playbackRate: 1.0,
      isInNeutralZone: true
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
   * LOGIQUE LINÉAIRE : Basée sur la POSITION angulaire, pas la vitesse
   * @param {string} position - "GAUCHE" ou "DROIT"
   * @param {Object} angles - Angles du capteur { x, y, z }
   * @param {number} angularVelocity - Vitesse angulaire (°/s) - non utilisée
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

    // Récupérer l'angle Y (inclinaison avant/arrière)
    const currentAngle = angles.y;
    this.rotationState.currentAngle = currentAngle;

    // Déterminer si on est dans la zone neutre
    const neutralZone = this.frostConfig.neutralZone;
    const isInNeutralZone = Math.abs(currentAngle) <= neutralZone;
    this.rotationState.isInNeutralZone = isInNeutralZone;

    // Calculer le playback rate et la direction
    let playbackRate;
    let direction;

    if (isInNeutralZone) {
      // Zone neutre : vitesse normale
      playbackRate = 1.0;
      direction = 1;
    } else {
      // Hors zone neutre : mapper linéairement l'angle vers le playback rate
      const angleFromNeutral = Math.abs(currentAngle) - neutralZone;
      const maxAngle = this.frostConfig.maxAngle;

      // Mapper linéairement de neutralZone à maxAngle → 1.0x à 3.0x
      const normalizedAngle = Math.min(angleFromNeutral / maxAngle, 1.0);
      playbackRate = 1.0 + (normalizedAngle * (this.frostConfig.maxSpeed - 1.0));

      // Limiter entre min et max
      playbackRate = Math.max(this.frostConfig.minSpeed,
                             Math.min(this.frostConfig.maxSpeed, playbackRate));

      // Direction : positif = avant, négatif = arrière
      direction = currentAngle >= 0 ? 1 : -1;
    }

    // Lissage du playback rate pour éviter les variations brusques
    this.rotationState.playbackRate =
      this.rotationState.playbackRate * (1 - this.frostConfig.smoothingFactor) +
      playbackRate * this.frostConfig.smoothingFactor;

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
    const angle = this.rotationState.currentAngle;
    const rate = this.rotationState.playbackRate;
    const direction = this.rotationState.direction;
    const isInNeutralZone = this.rotationState.isInNeutralZone;

    let feedback = '';
    let emoji = '';

    if (isInNeutralZone) {
      emoji = '✅';
      feedback = `ZONE NEUTRE ! Vitesse normale (1.0x) | Angle: ${angle.toFixed(1)}°`;
    } else if (direction > 0) {
      // Inclinaison vers l'avant (positif)
      if (rate > 2.0) {
        emoji = '⚡⚡';
        feedback = `Accélération RAPIDE ! (${rate.toFixed(2)}x) | Angle: ${angle.toFixed(1)}°`;
      } else if (rate > 1.5) {
        emoji = '⚡';
        feedback = `Accélération ! (${rate.toFixed(2)}x) | Angle: ${angle.toFixed(1)}°`;
      } else {
        emoji = '→';
        feedback = `Accélération légère (${rate.toFixed(2)}x) | Angle: ${angle.toFixed(1)}°`;
      }
    } else {
      // Inclinaison vers l'arrière (négatif)
      if (rate > 2.0) {
        emoji = '↩️↩️';
        feedback = `Lecture INVERSE RAPIDE ! (${rate.toFixed(2)}x) | Angle: ${angle.toFixed(1)}°`;
      } else if (rate > 1.5) {
        emoji = '↩️';
        feedback = `Lecture INVERSE ! (${rate.toFixed(2)}x) | Angle: ${angle.toFixed(1)}°`;
      } else {
        emoji = '←';
        feedback = `Lecture inverse légère (${rate.toFixed(2)}x) | Angle: ${angle.toFixed(1)}°`;
      }
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
