/**
 * FoolOfCraftUIController - Interface pour les explorations sonores
 *
 * Affiche les explorations sonores disponibles (mappings geste-son)
 * organisées par catégories d'artisanat, sans système de progression.
 *
 * Architecture : Adapters/Primary/UI/Controllers
 */
class FoolOfCraftUIController {
  /**
   * @param {Object} dependencies - Dépendances
   * @param {ExerciseController} dependencies.exerciseController - Contrôleur d'exercices (optionnel)
   * @param {StateManager} dependencies.state - Gestionnaire d'état (optionnel)
   * @param {TabController} dependencies.tabController - Contrôleur d'onglets (optionnel)
   */
  constructor({ exerciseController = null, state = null, tabController = null }) {
    this.exerciseController = exerciseController;
    this.state = state;
    this.tabController = tabController;
    this.container = null;
    this.isInitialized = false;
    this.tutorialModal = null;

    // Progression du tutoriel interactif
    this.tutorialProgress = {
      step1_sensorsConnected: false,
      step2_calibrated: false,
      step3_audioLoaded: false,
      step4_exerciseLaunched: false, // MODIFIÉ: indique si l'exercice a été lancé
      currentStep: 1
    };

    // Système de progression et déblocage
    this.userProgress = this._loadProgress();

    // Tracker l'exercice et durée courants (pour la complétion)
    this.currentExercise = null;
    this.currentDuration = null;

    // Exposer commandes de développement pour prototypage
    if (typeof window !== 'undefined') {
      window.unlockAll = () => this._unlockAll();
      window.resetProgress = () => this._resetProgress();
      window.showProgress = () => this._showProgress();
      console.log('[FoolOfCraft] 🔧 Commandes développement:');
      console.log('  window.unlockAll() - Débloque tous les exercices');
      console.log('  window.resetProgress() - Réinitialise la progression');
      console.log('  window.showProgress() - Affiche la progression actuelle');
    }

    console.log('[FoolOfCraft] Controller created');
  }

  /**
   * Initialise l'interface dans le container spécifié
   * @param {string} containerId - ID du container HTML
   * @returns {boolean}
   */
  initialize(containerId = 'explorationsContent') {
    console.log(`[FoolOfCraft] Initializing in container: ${containerId}`);

    this.container = document.getElementById(containerId);

    if (!this.container) {
      console.error(`[FoolOfCraft] Container not found: ${containerId}`);
      return false;
    }

    this._renderInterface();
    this._setupEventListeners();
    this.isInitialized = true;

    return true;
  }

  /**
   * Configure les écouteurs d'événements pour le tutoriel interactif
   * @private
   */
  _setupEventListeners() {
    if (!this.state || !this.tabController) {
      console.warn('[FoolOfCraft] State ou TabController non disponible, tutoriel non interactif');
      return;
    }

    // Vérifier périodiquement les états de l'application
    setInterval(() => {
      this._checkTutorialProgress();
    }, 1000);

    // ✨ NOUVEAU: Écouter les événements d'exercice pour détecter les complétions
    if (typeof window !== 'undefined') {
      window.addEventListener('exercise-event', (event) => {
        this._handleExerciseEvent(event);
      });
      console.log('[FoolOfCraft] Event listener pour exercices configuré');
    }

    console.log('[FoolOfCraft] Event listeners configurés');
  }

  /**
   * Gère les événements d'exercice (démarrage, mise à jour, fin)
   * @param {CustomEvent} event - Événement d'exercice
   * @private
   */
  _handleExerciseEvent(event) {
    const { type, data } = event.detail;

    switch (type) {
      case 'EXERCISE_STARTED':
        console.log('[FoolOfCraft] Exercice démarré:', data.exerciseName);
        break;

      case 'EXERCISE_ENDED':
        this._handleExerciseEnded(data);
        break;

      case 'EXERCISE_PROGRESS':
        // Optionnel: afficher la progression quelque part
        break;

      default:
        // Ignorer les autres types d'événements
        break;
    }
  }

  /**
   * Gère la fin d'un exercice
   * @param {Object} data - Données de l'événement
   * @private
   */
  _handleExerciseEnded(data) {
    const { exerciseName, stats, completed, reason } = data;

    console.log(`[FoolOfCraft] Exercice terminé: ${exerciseName} (${completed ? 'COMPLÉTÉ' : 'ANNULÉ'})`);

    // Si l'exercice a été complété (pas juste arrêté), marquer comme terminé
    if (completed && reason === 'completed') {
      // Vérifier qu'on a bien un exercice et une durée trackés
      if (this.currentExercise && this.currentDuration) {
        const exerciseId = this.currentExercise;
        const duration = this.currentDuration;

        // Vérifier si cette durée n'est pas déjà complétée
        if (!this.isDurationCompleted(exerciseId, duration)) {
          // Marquer la durée comme complétée (débloque automatiquement la suivante)
          this.completeExerciseDuration(exerciseId, duration);

          // Afficher un message de félicitations
          this._showCompletionCelebration(exerciseName, stats, duration);

          // Rafraîchir l'affichage des cartes d'exploration
          this._renderInterface();
        }

        // Réinitialiser le tracking
        this.currentExercise = null;
        this.currentDuration = null;
      }
    } else {
      // Si annulé, réinitialiser le tracking
      this.currentExercise = null;
      this.currentDuration = null;
    }
  }

  /**
   * Vérifie la progression du tutoriel
   * @private
   */
  _checkTutorialProgress() {
    if (!this.tutorialModal) return;

    const wasSensorsConnected = this.tutorialProgress.step1_sensorsConnected;
    const wasAudioLoaded = this.tutorialProgress.step3_audioLoaded;
    const wasCalibrated = this.tutorialProgress.step2_calibrated;
    const previousStep = this.tutorialProgress.currentStep;

    // Vérifier si les capteurs sont connectés
    this.tutorialProgress.step1_sensorsConnected = this._checkSensorsConnected();

    // Vérifier si l'audio est chargé
    this.tutorialProgress.step3_audioLoaded = this._checkAudioLoaded();

    // Vérifier si la calibration est faite
    this.tutorialProgress.step2_calibrated = this._checkCalibrated();

    // Vérifier si l'exercice est lancé
    this.tutorialProgress.step4_exerciseLaunched = this._checkExerciseLaunched();

    // Déterminer l'étape courante
    this._determineCurrentStep();

    // Si l'étape a changé ou si un état a changé, mettre à jour l'UI
    const stateChanged =
      wasSensorsConnected !== this.tutorialProgress.step1_sensorsConnected ||
      wasAudioLoaded !== this.tutorialProgress.step3_audioLoaded ||
      wasCalibrated !== this.tutorialProgress.step2_calibrated;

    const stepChanged = previousStep !== this.tutorialProgress.currentStep;

    if (stateChanged || stepChanged) {
      console.log(`[FoolOfCraft] Progression mise à jour - Étape ${this.tutorialProgress.currentStep}/4`);
      this._renderCurrentStep();

      // Si une étape vient d'être complétée, attendre 2 secondes avant de passer à la suivante
      if (stepChanged && this.tutorialProgress.currentStep > previousStep && this.tutorialProgress.currentStep <= 4) {
        setTimeout(() => {
          if (this.tutorialModal) {
            this._renderCurrentStep();
          }
        }, 2000);
      }
    }
  }

  /**
   * Vérifie si les capteurs sont connectés
   * @private
   * @returns {boolean}
   */
  _checkSensorsConnected() {
    if (!this.state) return false;
    const connectedDevices = this.state.getConnectedDevices();
    return connectedDevices && connectedDevices.size >= 2;
  }

  /**
   * Vérifie si l'audio est chargé
   * @private
   * @returns {boolean}
   */
  _checkAudioLoaded() {
    if (!this.state) return false;
    return this.state.getCurrentAudioFile() !== null;
  }

  /**
   * Vérifie si la calibration est COMPLÈTE ET FRAÎCHE
   * @private
   * @returns {boolean}
   */
  _checkCalibrated() {
    // IMPORTANT: Vérifier calibration FRAÎCHE (faite dans cette session)
    // et non depuis localStorage (peut être obsolète)

    if (!this.exerciseController) {
      console.log('[FoolOfCraft] ExerciseController non disponible');
      return false;
    }

    const calibrationOrchestrator = this.exerciseController.calibrationOrchestrator;
    if (!calibrationOrchestrator) {
      console.log('[FoolOfCraft] CalibrationOrchestrator non disponible');
      return false;
    }

    const calibrationModel = calibrationOrchestrator.getCalibrationModel();

    if (!calibrationModel || !calibrationModel.isComplete) {
      console.log('[FoolOfCraft] Calibration non complète');
      return false;
    }

    // VÉRIFICATION FRAÎCHEUR: Calibration doit avoir moins de 1 heure
    const now = Date.now();
    const calibrationAge = now - (calibrationModel.timestamp || 0);
    const maxAge = 60 * 60 * 1000; // 1 heure en millisecondes

    if (calibrationAge > maxAge) {
      console.log('[FoolOfCraft] Calibration trop ancienne (' + Math.round(calibrationAge / 1000 / 60) + ' minutes)');
      console.log('[FoolOfCraft] → Recalibration requise pour garantir précision');
      return false;
    }

    // VÉRIFICATION QUALITÉ: Séparation entre horaire et antihoraire
    const cwAvg = calibrationModel.clockwise?.avg || 0;
    const ccwAvg = calibrationModel.counterclockwise?.avg || 0;
    const separation = Math.abs(cwAvg - ccwAvg);

    if (separation < 10) {
      console.warn('[FoolOfCraft] Calibration de mauvaise qualité (séparation: ' + separation.toFixed(1) + '°)');
      console.warn('[FoolOfCraft] → Recalibration recommandée');
      return false;
    }

    console.log('[FoolOfCraft] ✓ Calibration valide et fraîche');
    console.log('[FoolOfCraft]   Horaire: ' + cwAvg.toFixed(1) + '° | Antihoraire: ' + ccwAvg.toFixed(1) + '° | Séparation: ' + separation.toFixed(1) + '°');
    return true;
  }

  /**
   * Vérifie si un exercice est actif
   * @private
   */
  _checkExerciseLaunched() {
    if (!this.exerciseController) return false;
    return this.exerciseController.currentExercise !== null;
  }

  /**
   * Met à jour l'interface du tutoriel (obsolète - remplacé par _renderCurrentStep)
   * @private
   */
  _updateTutorialUI() {
    // Cette méthode est maintenant obsolète
    // La mise à jour se fait via _renderCurrentStep()
    if (this.tutorialModal) {
      this._renderCurrentStep();
    }
  }

  /**
   * Met à jour le statut visuel d'une étape
   * @private
   */
  _updateStepStatus(stepElement, isCompleted) {
    if (!stepElement) return;

    const statusIndicator = stepElement.querySelector('.step-status');
    const stepLabel = stepElement.querySelector('.step-label');

    if (isCompleted) {
      stepElement.classList.add('step-completed');

      if (statusIndicator) {
        statusIndicator.textContent = '✓';
        statusIndicator.style.color = '#4CAF50';
        statusIndicator.style.fontSize = '24px';
        statusIndicator.style.fontWeight = 'bold';
      }

      if (stepLabel) {
        stepLabel.textContent = stepLabel.getAttribute('data-completed') || 'Complété';
        stepLabel.style.color = '#4CAF50';
      }
    } else {
      stepElement.classList.remove('step-completed');

      if (statusIndicator) {
        statusIndicator.textContent = '';
      }

      if (stepLabel) {
        stepLabel.textContent = stepLabel.getAttribute('data-pending') || 'En attente...';
        stepLabel.style.color = 'rgba(255, 255, 255, 0.5)';
      }
    }
  }

  /**
   * Navigue vers un onglet spécifique
   * @private
   */
  _navigateToTab(tabId) {
    if (!this.tabController) {
      console.warn('[FoolOfCraft] TabController non disponible');
      return;
    }

    this.tabController.activateTab(tabId);
    console.log(`[FoolOfCraft] Navigation vers onglet: ${tabId}`);
  }

  /**
   * Rend l'interface complète
   * @private
   */
  _renderInterface() {
    console.log('[FoolOfCraft] Rendering interface...');

    this.container.innerHTML = `
      <div class="fool-of-craft-ui">
        <!-- Header -->
        <div class="explorations-header">
          <h2>Fool of Craft</h2>
          <p class="explorations-subtitle">The Sound from Gesture</p>
          <p class="explorations-description">
            Explorez les possibilités sonores à travers les gestes des métiers d'art
          </p>
        </div>

        <!-- Carte tutoriel -->
        <div class="tutorial-card" id="tutorialCard">
          <div class="tutorial-icon">📚</div>
          <div class="tutorial-content">
            <h3>Tutoriel : Configuration des capteurs</h3>
            <p class="tutorial-description">
              Apprenez à connecter, calibrer et utiliser vos capteurs IMU pour explorer les sons
            </p>
            <button class="tutorial-button" id="tutorialButton">Voir le tutoriel</button>
          </div>
        </div>

        <!-- Catégories d'artisanat -->
        <div class="craft-categories" id="craftCategories">
          <!-- Les catégories seront injectées ici -->
        </div>
      </div>
    `;

    this._injectStyles();
    this._renderCategories();
    this._setupTutorialButton();

    console.log('[FoolOfCraft] Interface rendered');
  }

  /**
   * Configure le bouton tutoriel
   * @private
   */
  _setupTutorialButton() {
    const tutorialButton = document.getElementById('tutorialButton');
    if (!tutorialButton) return;

    tutorialButton.addEventListener('click', () => {
      this._showTutorial();
    });
  }

  /**
   * Affiche le tutoriel de configuration
   * @private
   */
  _showTutorial() {
    console.log('[FoolOfCraft] Affichage assistant pas à pas');

    // Vérifier l'état initial et déterminer l'étape de départ
    this._checkTutorialProgress();
    this._determineCurrentStep();

    const tutorialHTML = `
      <div class="tutorial-assistant" id="tutorialAssistant">
        <div class="assistant-header">
          <div class="assistant-title">
            <span class="assistant-icon">🎓</span>
            <span class="assistant-text">Assistant de Configuration</span>
          </div>
          <div class="assistant-controls">
            <button class="assistant-minimize" id="assistantMinimize" title="Réduire">_</button>
            <button class="assistant-close" id="assistantClose" title="Fermer">✕</button>
          </div>
        </div>

        <div class="assistant-body" id="assistantBody">
          <div class="assistant-progress">
            <span class="progress-text">Étape <span id="currentStepNumber">1</span> / 4</span>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" id="progressBarFill" style="width: 25%"></div>
            </div>
          </div>

          <div class="assistant-step-container" id="stepContainer">
            <!-- L'étape courante sera affichée ici -->
          </div>

          <div class="assistant-footer">
            <button class="btn-previous" id="btnPrevious" style="display: none;">← Précédent</button>
            <button class="btn-next" id="btnNext" style="display: none;">Suivant →</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', tutorialHTML);

    // Stocker la référence à l'assistant
    this.tutorialModal = document.getElementById('tutorialAssistant');
    this.assistantBody = document.getElementById('assistantBody');
    this.isMinimized = false;

    if (!this.tutorialModal) {
      console.error('[FoolOfCraft] Assistant tutoriel non trouvé');
      return;
    }

    // Configuration des boutons de contrôle
    const minimizeBtn = document.getElementById('assistantMinimize');
    const closeBtn = document.getElementById('assistantClose');

    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        this._toggleMinimize();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.tutorialModal.remove();
        this.tutorialModal = null;
      });
    }

    // Afficher l'étape courante
    this._renderCurrentStep();

    console.log('[FoolOfCraft] Assistant pas à pas affiché');
  }

  /**
   * Détermine l'étape courante basée sur la progression
   * @private
   */
  _determineCurrentStep() {
    if (!this.tutorialProgress.step1_sensorsConnected) {
      this.tutorialProgress.currentStep = 1;
    } else if (!this.tutorialProgress.step3_audioLoaded) {
      this.tutorialProgress.currentStep = 2;
    } else if (!this.tutorialProgress.step2_calibrated) {
      this.tutorialProgress.currentStep = 3;
    } else {
      this.tutorialProgress.currentStep = 4;
    }
  }

  /**
   * Affiche l'étape courante dans l'assistant
   * @private
   */
  _renderCurrentStep() {
    if (!this.tutorialModal) return;

    const stepContainer = document.getElementById('stepContainer');
    const stepNumber = document.getElementById('currentStepNumber');
    const progressBar = document.getElementById('progressBarFill');

    if (!stepContainer) return;

    // Mettre à jour le numéro d'étape et la barre de progression
    const currentStep = this.tutorialProgress.currentStep;
    if (stepNumber) stepNumber.textContent = currentStep;
    if (progressBar) progressBar.style.width = `${(currentStep / 4) * 100}%`;

    // Définir le contenu de chaque étape
    const steps = {
      1: {
        icon: '📡',
        iconClass: 'step-icon-bluetooth',
        title: 'Connexion Bluetooth',
        instructions: [
          'Cliquez sur "Rechercher les capteurs" dans l\'onglet Principal',
          'Attendez la détection automatique des capteurs IMU',
          'Vérifiez que les deux capteurs sont connectés (gauche et droit)'
        ],
        actionTab: 'mainTab',
        actionText: 'Aller à l\'onglet Principal',
        completed: this.tutorialProgress.step1_sensorsConnected
      },
      2: {
        icon: '🔊',
        iconClass: 'step-icon-audio',
        title: 'Chargement Audio',
        instructions: [
          'Sélectionnez un fichier audio à manipuler (WAV, MP3, etc.)',
          'Ajustez les paramètres de synthèse granulaire si souhaité',
          'Testez la lecture pour vérifier le chargement'
        ],
        actionTab: 'soundTab',
        actionText: 'Aller à l\'onglet Sound Control',
        completed: this.tutorialProgress.step3_audioLoaded
      },
      3: {
        icon: '🎯',
        iconClass: 'step-icon-calibration',
        title: 'Calibration',
        instructions: [
          'Suivez les instructions pour calibrer chaque capteur',
          'Effectuez les mouvements demandés avec précision',
          'La calibration optimise la détection des mouvements'
        ],
        actionTab: 'calibrationTab',
        actionText: 'Aller à l\'onglet Calibration',
        completed: this.tutorialProgress.step2_calibrated
      },
      4: {
        icon: '🎭',
        iconClass: 'step-icon-explore',
        title: 'Lancer l\'Exploration Rotation Continue',
        instructions: [
          'Tout est prêt! Vous pouvez maintenant lancer l\'exercice',
          'Tenez un capteur dans chaque main',
          'Effectuez des rotations fluides pour contrôler le son',
          'La vitesse de rotation contrôle la vitesse de lecture',
          'L\'angle du poignet contrôle le volume'
        ],
        actionTab: 'explorationsTab',
        actionText: 'Lancer Rotation Continue',
        actionType: 'launch-exercise', // Type spécial pour lancer l'exercice
        completed: this.tutorialProgress.step4_exerciseLaunched
      }
    };

    const step = steps[currentStep];

    stepContainer.innerHTML = `
      <div class="current-step ${step.completed ? 'step-completed' : ''}">
        <div class="step-header-inline">
          <div class="step-icon-placeholder ${step.iconClass}">
            <span class="icon-temp">${step.icon}</span>
          </div>
          <div class="step-title-status">
            <h3>${step.title}</h3>
            <span class="step-status-badge ${step.completed ? 'status-completed' : 'status-pending'}">
              ${step.completed ? '✓ Complété' : 'En attente...'}
            </span>
          </div>
        </div>

        <ul class="step-instructions">
          ${step.instructions.map(instruction => `<li>${instruction}</li>`).join('')}
        </ul>

        ${!step.completed ? `
          <button class="step-action-btn ${step.actionType === 'launch-exercise' ? 'btn-launch-exercise' : ''}"
                  data-tab="${step.actionTab}"
                  data-action-type="${step.actionType || 'navigate'}">
            ${step.actionText} ${step.actionType === 'launch-exercise' ? '🚀' : '→'}
          </button>
        ` : `
          <div class="step-completed-message">
            <span class="completed-icon">✓</span>
            <span>Étape complétée! Passage automatique à la suivante...</span>
          </div>
        `}
      </div>
    `;

    // Configurer le bouton d'action
    const actionBtn = stepContainer.querySelector('.step-action-btn');
    if (actionBtn) {
      actionBtn.addEventListener('click', (e) => {
        const actionType = e.target.getAttribute('data-action-type');

        if (actionType === 'launch-exercise') {
          // Lancer l'exercice Rotation Continue
          this._launchRotationContinueExercise();
        } else {
          // Navigation normale vers un onglet
          const tabId = e.target.getAttribute('data-tab');
          if (tabId) {
            this._navigateToTab(tabId);
          }
        }
      });
    }
  }

  /**
   * Minimise/Maximise l'assistant
   * @private
   */
  _toggleMinimize() {
    if (!this.tutorialModal || !this.assistantBody) return;

    this.isMinimized = !this.isMinimized;

    if (this.isMinimized) {
      this.assistantBody.style.display = 'none';
      this.tutorialModal.classList.add('minimized');
    } else {
      this.assistantBody.style.display = 'block';
      this.tutorialModal.classList.remove('minimized');
    }
  }

  /**
   * Lance l'exercice Rotation Continue de manière interactive
   * @private
   */
  _launchRotationContinueExercise() {
    console.log('[FoolOfCraft] Tentative lancement exercice Rotation Continue');

    if (!this.exerciseController) {
      alert('ExerciseController non disponible. Vérifiez la configuration.');
      return;
    }

    // VÉRIFICATION OBLIGATOIRE : Calibration doit être complétée
    if (!this._checkCalibrated()) {
      alert('⚠️ Calibration requise\n\nVous devez calibrer les capteurs avant de lancer l\'exercice.\n\nAllez dans l\'onglet "Calibration" et suivez les instructions.');

      // Naviguer vers l'onglet Calibration
      if (this.tabController) {
        this.tabController.activateTab('calibrationTab');
      }

      // Mettre à jour le tutoriel pour montrer l'étape calibration
      this._checkTutorialProgress();
      this._renderCurrentStep();

      return;
    }

    // VÉRIFICATION : Capteurs connectés
    if (!this._checkSensorsConnected()) {
      alert('⚠️ Capteurs non connectés\n\nVous devez connecter les 2 capteurs IMU avant de lancer l\'exercice.\n\nAllez dans l\'onglet "Principal" et cliquez sur "Rechercher les capteurs".');

      if (this.tabController) {
        this.tabController.activateTab('mainTab');
      }

      return;
    }

    // VÉRIFICATION : Audio chargé
    if (!this._checkAudioLoaded()) {
      alert('⚠️ Fichier audio requis\n\nVous devez charger un fichier audio avant de lancer l\'exercice.\n\nAllez dans l\'onglet "Sound Control" et sélectionnez un fichier audio.');

      if (this.tabController) {
        this.tabController.activateTab('soundTab');
      }

      return;
    }

    try {
      // IMPORTANT: Tracker l'exercice et la durée pour la complétion
      // Le tutoriel lance toujours en mode 3min
      this.currentExercise = 'rotationContinue';
      this.currentDuration = '3min';

      // Lancer l'exercice avec la durée 3min (tutoriel)
      const started = this.exerciseController.startExercise('rotationContinue', '3min');

      if (!started) {
        alert('❌ Impossible de lancer l\'exercice\n\nVérifiez que:\n- Les capteurs sont connectés\n- Un fichier audio est chargé\n- La calibration est complétée');
        this.currentExercise = null;
        this.currentDuration = null;
        return;
      }

      // Marquer l'exercice comme lancé
      this.tutorialProgress.step4_exerciseLaunched = true;

      // ✨ PROGRESSION: Marquer le tutoriel comme complété
      if (!this.userProgress.tutorialCompleted) {
        this.completeTutorial();
        console.log('[FoolOfCraft] 🎉 Tutoriel complété! Premier exercice débloqué (3min)');
      }

      // Naviguer vers l'onglet Explorations
      if (this.tabController) {
        this.tabController.activateTab('explorationsTab');
      }

      // Transformer l'assistant en mode "Exercice actif"
      this._showExerciseActiveMode();

      console.log('[FoolOfCraft] ✓ Exercice Rotation Continue lancé avec succès (3min via tutoriel)');
    } catch (error) {
      console.error('[FoolOfCraft] Erreur lancement exercice:', error);
      alert('❌ Erreur lors du lancement de l\'exercice:\n\n' + error.message);
      this.currentExercise = null;
      this.currentDuration = null;
    }
  }

  /**
   * Affiche l'assistant en mode "Exercice actif"
   * @private
   */
  _showExerciseActiveMode() {
    if (!this.tutorialModal) return;

    const stepContainer = document.getElementById('stepContainer');
    const stepNumber = document.getElementById('currentStepNumber');
    const progressBar = document.getElementById('progressBarFill');

    if (!stepContainer) return;

    // Mettre à jour la progression à 100%
    if (stepNumber) stepNumber.textContent = '4';
    if (progressBar) progressBar.style.width = '100%';

    // Afficher l'interface d'exercice actif
    stepContainer.innerHTML = `
      <div class="exercise-active">
        <div class="exercise-header">
          <div class="exercise-icon">🎵</div>
          <div class="exercise-status">
            <h3>Rotation Continue en cours</h3>
            <span class="status-active">● En cours</span>
          </div>
        </div>

        <div class="exercise-instructions">
          <h4>Comment jouer :</h4>
          <ul>
            <li><strong>Rotation des mains</strong> : Contrôle la vitesse de lecture</li>
            <li><strong>Angle des poignets</strong> : Contrôle le volume</li>
            <li><strong>Mouvement fluide</strong> : Pour un son continu</li>
          </ul>
        </div>

        <div class="exercise-tips">
          <div class="tip-icon">💡</div>
          <div class="tip-text">
            <strong>Astuce :</strong> Commencez par des rotations lentes pour comprendre comment le son réagit à vos mouvements.
          </div>
        </div>

        <div class="exercise-actions">
          <button class="btn-stop-exercise" id="btnStopExercise">
            ⏹ Arrêter l'exercice
          </button>
        </div>
      </div>
    `;

    // Configurer le bouton d'arrêt
    const stopBtn = document.getElementById('btnStopExercise');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        this._stopExercise();
      });
    }
  }

  /**
   * Arrête l'exercice en cours ET la lecture audio
   * @private
   */
  _stopExercise() {
    console.log('[FoolOfCraft] Arrêt de l\'exercice et de l\'audio');

    // Arrêter l'exercice via le contrôleur
    if (this.exerciseController) {
      this.exerciseController.stopCurrentExercise();

      // IMPORTANT: Arrêter complètement la lecture audio
      // (sinon la lecture continue en vitesse normale)
      const audioOrchestrator = this.exerciseController.audioOrchestrator;
      if (audioOrchestrator) {
        const audioState = audioOrchestrator.state?.getAudioState();

        // Arrêter seulement si l'audio est en lecture
        if (audioState && audioState.isPlaying) {
          console.log('[FoolOfCraft] Arrêt de la lecture audio');
          audioOrchestrator.togglePlayPause(); // Stop audio
        }
      }
    }

    // Réinitialiser le flag
    this.tutorialProgress.step4_exerciseLaunched = false;

    // Retourner à l'étape 4 du tutoriel
    this._renderCurrentStep();

    console.log('[FoolOfCraft] Exercice et audio arrêtés');
  }

  /**
   * Affiche un message de félicitations lors de la complétion d'un exercice
   * @param {string} exerciseName - Nom de l'exercice complété
   * @param {Object} stats - Statistiques de l'exercice
   * @param {string} duration - Durée complétée ('3min', '5min', 'free')
   * @private
   */
  _showCompletionCelebration(exerciseName, stats, duration = '5min') {
    // Messages adaptés selon la durée
    let unlockMessage = '';
    let durationLabel = '';

    switch(duration) {
      case '3min':
        unlockMessage = '✨ Durée 5 minutes débloquée !';
        durationLabel = '3 minutes';
        break;
      case '5min':
        unlockMessage = '✨ Mode Free (temps infini) débloqué !';
        durationLabel = '5 minutes';
        break;
      case 'free':
        unlockMessage = '🎉 Prochain exercice débloqué !';
        durationLabel = 'Free (temps infini)';
        break;
    }
    // Créer un modal de célébration
    const celebration = document.createElement('div');
    celebration.className = 'completion-celebration';
    celebration.innerHTML = `
      <div class="celebration-content">
        <div class="celebration-icon">🎉</div>
        <h2 class="celebration-title">Félicitations !</h2>
        <p class="celebration-message">
          Vous avez terminé l'exercice<br>
          <strong>${exerciseName}</strong><br>
          <span class="duration-label">Durée: ${durationLabel}</span>
        </p>
        <div class="celebration-stats">
          <div class="stat-item">
            <span class="stat-label">Vitesse moyenne</span>
            <span class="stat-value">${stats.avgVelocity}°/s</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Commandes envoyées</span>
            <span class="stat-value">${stats.audioCommandCount}</span>
          </div>
        </div>
        <div class="celebration-unlock">
          <p>${unlockMessage}</p>
        </div>
        <button class="btn-celebration-close">Continuer</button>
      </div>
    `;

    document.body.appendChild(celebration);

    // Ajouter animation d'entrée
    setTimeout(() => {
      celebration.classList.add('show');
    }, 10);

    // Gérer la fermeture
    const closeBtn = celebration.querySelector('.btn-celebration-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        celebration.classList.remove('show');
        setTimeout(() => {
          celebration.remove();
        }, 300);
      });
    }

    // Fermeture automatique après 8 secondes
    setTimeout(() => {
      if (celebration.parentElement) {
        celebration.classList.remove('show');
        setTimeout(() => {
          celebration.remove();
        }, 300);
      }
    }, 8000);

    console.log('[FoolOfCraft] Message de félicitations affiché');
  }

  /**
   * Rend les catégories d'artisanat et leurs explorations
   * @private
   */
  _renderCategories() {
    const categoriesContainer = document.getElementById('craftCategories');
    if (!categoriesContainer) return;

    const categories = [
      {
        id: 'verrerie',
        name: 'Verrerie Scientifique',
        description: 'Gestes du soufflage et manipulation du verre',
        icon: '🔬',
        explorations: [
          {
            id: 'rotationContinue',
            name: 'Rotation Continue',
            description: 'Contrôlez vitesse et volume par rotation fluide des mains',
            available: true
          },
          {
            id: 'synchronisationMains',
            name: 'Synchronisation des Mains',
            description: 'Coordination bimanuelle pour le contrôle stéréo',
            available: false
          },
          {
            id: 'etiragePoin te',
            name: 'Étirage de Pointe',
            description: 'Modulez le pitch par étirement progressif',
            available: false
          },
          {
            id: 'soufflageRythmique',
            name: 'Soufflage Rythmique',
            description: 'Patterns rythmiques par gestes de soufflage',
            available: false
          },
          {
            id: 'torsionTube',
            name: 'Torsion de Tube',
            description: 'Effets de filtrage par torsion contrôlée',
            available: false
          }
        ]
      },
      {
        id: 'ceramique',
        name: 'Céramique Tournée',
        description: 'Gestes du tour de potier',
        icon: '🏺',
        explorations: [
          {
            id: 'centrageArgile',
            name: 'Centrage d\'Argile',
            description: 'Stabilisation sonore par gestes circulaires',
            available: false
          },
          {
            id: 'monteeParois',
            name: 'Montée des Parois',
            description: 'Évolution du timbre par élévation progressive',
            available: false
          },
          {
            id: 'modelageForme',
            name: 'Modelage de Forme',
            description: 'Sculpture sonore en temps réel',
            available: false
          },
          {
            id: 'pressionDoigt',
            name: 'Pression des Doigts',
            description: 'Contrôle fin par variation de pression',
            available: false
          }
        ]
      },
      {
        id: 'tapisserie',
        name: 'Tapisserie & Tissage',
        description: 'Gestes du métier à tisser',
        icon: '🧵',
        explorations: [
          {
            id: 'passageNavette',
            name: 'Passage de Navette',
            description: 'Patterns alternés par gestes de va-et-vient',
            available: false
          },
          {
            id: 'tensionFils',
            name: 'Tension des Fils',
            description: 'Contrôle de résonance par tension variable',
            available: false
          },
          {
            id: 'tissageCroise',
            name: 'Tissage Croisé',
            description: 'Harmonies par entrecroisements gestuels',
            available: false
          },
          {
            id: 'nouageMain',
            name: 'Nouage à la Main',
            description: 'Micro-textures par gestes précis',
            available: false
          }
        ]
      }
    ];

    categories.forEach(category => {
      const categorySection = this._createCategorySection(category);
      categoriesContainer.appendChild(categorySection);
    });
  }

  /**
   * Crée une section de catégorie
   * @private
   */
  _createCategorySection(category) {
    const section = document.createElement('div');
    section.className = 'craft-category';

    section.innerHTML = `
      <div class="category-header">
        <div class="category-icon">${category.icon}</div>
        <div class="category-info">
          <h3 class="category-name">${category.name}</h3>
          <p class="category-description">${category.description}</p>
        </div>
      </div>
      <div class="explorations-grid" data-category="${category.id}">
        <!-- Les explorations seront injectées ici -->
      </div>
    `;

    const explorationsGrid = section.querySelector('.explorations-grid');
    category.explorations.forEach(exploration => {
      const card = this._createExplorationCard(exploration, category.id);
      explorationsGrid.appendChild(card);
    });

    return section;
  }

  /**
   * Crée une card d'exploration avec système de déblocage par durée
   * @private
   */
  _createExplorationCard(exploration, categoryId) {
    const card = document.createElement('div');

    // Vérifier si l'exercice est débloqué (au moins une durée disponible)
    const isUnlocked = this.isExerciseUnlocked(exploration.id);

    // États des durées
    const duration3min = {
      unlocked: this.isDurationUnlocked(exploration.id, '3min'),
      completed: this.isDurationCompleted(exploration.id, '3min')
    };
    const duration5min = {
      unlocked: this.isDurationUnlocked(exploration.id, '5min'),
      completed: this.isDurationCompleted(exploration.id, '5min')
    };
    const durationFree = {
      unlocked: this.isDurationUnlocked(exploration.id, 'free'),
      completed: this.isDurationCompleted(exploration.id, 'free')
    };

    card.className = `exploration-card ${isUnlocked ? 'available' : 'locked'}`;

    // Helper pour générer le HTML d'un bouton de durée
    const createDurationButton = (duration, label, icon, state) => {
      let statusIcon = '';
      let statusText = '';
      let btnClass = 'duration-btn';

      if (!state.unlocked) {
        statusIcon = '🔒';
        statusText = 'Verrouillé';
        btnClass += ' locked';
      } else if (state.completed) {
        statusIcon = '✓';
        statusText = 'Complété';
        btnClass += ' completed';
      } else {
        statusIcon = '▶';
        statusText = 'Disponible';
        btnClass += ' available';
      }

      return `
        <button class="${btnClass}" data-duration="${duration}" data-exploration-id="${exploration.id}" data-category="${categoryId}" ${!state.unlocked ? 'disabled' : ''}>
          <div class="duration-content">
            <span class="duration-icon">${icon}</span>
            <span class="duration-label">${label}</span>
          </div>
          <span class="duration-status">${statusIcon} ${statusText}</span>
        </button>
      `;
    };

    card.innerHTML = `
      <div class="exploration-header">
        <h4 class="exploration-name">
          ${!isUnlocked ? '🔒 ' : ''}${exploration.name}
        </h4>
        ${isUnlocked ? `
          <button class="btn-rec-card" data-exploration-id="${exploration.id}" title="Enregistrer cette session">
            <span class="rec-icon">●</span>
            <span class="rec-label">REC</span>
          </button>
        ` : ''}
      </div>
      <p class="exploration-description">${exploration.description}</p>

      ${isUnlocked ? `
        <div class="duration-buttons">
          ${createDurationButton('3min', '3 minutes', '⏱️', duration3min)}
          ${createDurationButton('5min', '5 minutes', '⏲️', duration5min)}
          ${createDurationButton('free', 'Free', '∞', durationFree)}
        </div>
      ` : `
        <div class="locked-message">
          Complétez le tutoriel pour débloquer cet exercice
        </div>
      `}
    `;

    // Attacher les événements pour les boutons de durée
    if (isUnlocked) {
      const durationBtns = card.querySelectorAll('.duration-btn:not(.locked)');
      durationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const duration = btn.getAttribute('data-duration');
          const explId = btn.getAttribute('data-exploration-id');
          const catId = btn.getAttribute('data-category');
          this._launchExploration(explId, catId, duration);
        });
      });

      // Événement pour le bouton REC
      const recBtn = card.querySelector('.btn-rec-card');
      if (recBtn) {
        recBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._toggleRecording(exploration.id);
        });
      }
    }

    return card;
  }

  /**
   * Lance une exploration avec vérifications complètes
   * @private
   * @param {string} explorationId - ID de l'exercice
   * @param {string} categoryId - ID de la catégorie
   * @param {string} duration - Durée sélectionnée ('3min', '5min', 'free')
   */
  _launchExploration(explorationId, categoryId, duration = '3min') {
    console.log(`[FoolOfCraft] Tentative lancement exploration: ${explorationId} from ${categoryId} (${duration})`);

    if (!this.exerciseController) {
      alert('ExerciseController non disponible. Vérifiez la configuration.');
      return;
    }

    // ========================================
    // VÉRIFICATIONS OBLIGATOIRES
    // ========================================

    // 1. Vérifier capteurs connectés
    if (!this._checkSensorsConnected()) {
      alert('⚠️ Capteurs non connectés\n\nÉtape 1/3: Connectez les 2 capteurs IMU\n\n→ Onglet "Principal" > "Rechercher les capteurs"\n\nOuvrez le tutoriel pour être guidé étape par étape.');

      // Ouvrir le tutoriel si pas déjà ouvert
      if (!this.tutorialModal) {
        this._showTutorial();
      } else if (this.tabController) {
        this.tabController.activateTab('mainTab');
      }

      return;
    }

    // 2. Vérifier audio chargé
    if (!this._checkAudioLoaded()) {
      alert('⚠️ Fichier audio requis\n\nÉtape 2/3: Chargez un fichier audio\n\n→ Onglet "Sound Control" > Sélectionner fichier\n\nOuvrez le tutoriel pour être guidé étape par étape.');

      if (!this.tutorialModal) {
        this._showTutorial();
      } else if (this.tabController) {
        this.tabController.activateTab('soundTab');
      }

      return;
    }

    // 3. Vérifier calibration OBLIGATOIRE
    if (!this._checkCalibrated()) {
      alert('⚠️ Calibration OBLIGATOIRE\n\nÉtape 3/3: Calibrez vos capteurs\n\nLa calibration est essentielle pour:\n• Détecter la direction de rotation\n• Assurer la réactivité de l\'exercice\n• Permettre la lecture avant/arrière\n\n→ Onglet "Calibration" > Suivre instructions\n\nOuvrez le tutoriel pour être guidé étape par étape.');

      if (!this.tutorialModal) {
        this._showTutorial();
      } else if (this.tabController) {
        this.tabController.activateTab('calibrationTab');
      }

      return;
    }

    // ========================================
    // LANCEMENT EXERCICE
    // ========================================

    const explorationMap = {
      'rotationContinue': 'rotationContinue'
    };

    const exerciseId = explorationMap[explorationId];
    if (!exerciseId) {
      alert(`Exploration "${explorationId}" pas encore implémentée`);
      return;
    }

    try {
      // Tracker l'exercice et la durée pour la complétion
      this.currentExercise = explorationId;
      this.currentDuration = duration;

      // Lancer l'exercice avec la durée spécifiée
      const started = this.exerciseController.startExercise(exerciseId, duration);

      if (!started) {
        alert('❌ Impossible de lancer l\'exercice\n\nVérifiez que tous les prérequis sont remplis.');
        this.currentExercise = null;
        this.currentDuration = null;
        return;
      }

      console.log(`[FoolOfCraft] ✓ Exploration "${explorationId}" lancée avec succès (${duration})`);

      // Message adapté selon la durée
      let durationLabel = '';
      if (duration === '3min') durationLabel = '3 minutes';
      else if (duration === '5min') durationLabel = '5 minutes';
      else if (duration === 'free') durationLabel = 'Temps infini';

      alert(`✓ Exploration lancée!\n\nCatégorie: ${categoryId}\nExploration: ${explorationId}\nDurée: ${durationLabel}\n\n🎮 Instructions:\n• Rotation des mains → Vitesse\n• Angle des poignets → Volume\n• Mouvement fluide → Son continu\n\n⏹ Arrêt: Bouton dans l'assistant tutoriel`);

      // Si tutoriel ouvert, le transformer en mode exercice actif
      if (this.tutorialModal) {
        this.tutorialProgress.step4_exerciseLaunched = true;
        this._showExerciseActiveMode();
      }
    } catch (error) {
      console.error('[FoolOfCraft] Erreur lancement exploration:', error);
      alert('❌ Erreur lors du lancement:\n\n' + error.message);
      this.currentExercise = null;
      this.currentDuration = null;
    }
  }

  /**
   * Active/désactive l'enregistrement audio
   * @private
   * @param {string} exerciseId - ID de l'exercice
   */
  _toggleRecording(exerciseId) {
    // Obtenir le bouton d'enregistrement global
    const globalRecBtn = document.getElementById('recordButton');

    if (!globalRecBtn) {
      console.warn('[FoolOfCraft] Bouton d\'enregistrement non trouvé');
      return;
    }

    // Simuler un clic sur le bouton global
    globalRecBtn.click();

    console.log(`[FoolOfCraft] Enregistrement togglé pour ${exerciseId}`);
  }

  /**
   * Injecte les styles CSS
   * @private
   */
  _injectStyles() {
    const styleId = 'fool-of-craft-ui-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .fool-of-craft-ui {
        padding: 40px;
        max-width: 1600px;
        margin: 0 auto;
      }

      .explorations-header {
        text-align: center;
        margin-bottom: 40px;
      }

      .explorations-header h2 {
        margin: 0;
        font-size: 48px;
        color: #fff;
        background: linear-gradient(135deg, #FFB74D 0%, #667eea 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .explorations-subtitle {
        color: rgba(255, 255, 255, 0.8);
        margin: 10px 0;
        font-size: 18px;
        font-style: italic;
      }

      .explorations-description {
        color: rgba(255, 255, 255, 0.6);
        margin-top: 15px;
        font-size: 14px;
      }

      /* Carte tutoriel */
      .tutorial-card {
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
        border: 2px solid rgba(102, 126, 234, 0.3);
        border-radius: 16px;
        padding: 30px;
        margin-bottom: 50px;
        display: flex;
        gap: 25px;
        align-items: center;
        transition: all 0.3s ease;
      }

      .tutorial-card:hover {
        border-color: rgba(102, 126, 234, 0.6);
        box-shadow: 0 8px 30px rgba(102, 126, 234, 0.2);
      }

      .tutorial-icon {
        font-size: 72px;
        flex-shrink: 0;
      }

      .tutorial-content {
        flex: 1;
      }

      .tutorial-content h3 {
        margin: 0 0 10px 0;
        font-size: 24px;
        color: #fff;
      }

      .tutorial-description {
        margin: 0 0 20px 0;
        color: rgba(255, 255, 255, 0.7);
        line-height: 1.5;
      }

      .tutorial-button {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        border: none;
        padding: 12px 30px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .tutorial-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
      }

      /* Assistant Tutoriel Flottant */
      .tutorial-assistant {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 400px;
        background: #1a1a2e;
        border: 2px solid rgba(102, 126, 234, 0.4);
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        z-index: 9999;
        animation: slideInRight 0.3s ease;
        overflow: hidden;
      }

      .tutorial-assistant.minimized {
        width: 300px;
      }

      .assistant-header {
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
        padding: 15px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(102, 126, 234, 0.3);
        cursor: move;
      }

      .assistant-title {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .assistant-icon {
        font-size: 24px;
      }

      .assistant-text {
        font-size: 16px;
        font-weight: 600;
        color: #fff;
      }

      .assistant-controls {
        display: flex;
        gap: 8px;
      }

      .assistant-minimize,
      .assistant-close {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: #fff;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .assistant-minimize:hover,
      .assistant-close:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .assistant-body {
        padding: 20px;
        max-height: 500px;
        overflow-y: auto;
      }

      .assistant-progress {
        margin-bottom: 20px;
      }

      .progress-text {
        display: block;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .progress-bar-container {
        width: 100%;
        height: 6px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        overflow: hidden;
      }

      .progress-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #FFB74D 0%, #667eea 100%);
        transition: width 0.5s ease;
      }

      .assistant-step-container {
        margin-bottom: 15px;
      }

      .current-step {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 20px;
        border-left: 4px solid rgba(255, 183, 77, 0.5);
      }

      .current-step.step-completed {
        border-left-color: #4CAF50;
        background: rgba(76, 175, 80, 0.08);
      }

      .step-header-inline {
        display: flex;
        gap: 15px;
        align-items: flex-start;
        margin-bottom: 15px;
      }

      .step-title-status {
        flex: 1;
      }

      .step-title-status h3 {
        margin: 0 0 5px 0;
        font-size: 18px;
        color: #FFB74D;
      }

      .step-status-badge {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 4px 8px;
        border-radius: 8px;
        display: inline-block;
      }

      .status-completed {
        background: rgba(76, 175, 80, 0.2);
        color: #4CAF50;
      }

      .status-pending {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.5);
      }

      .step-completed-message {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 15px;
        background: rgba(76, 175, 80, 0.1);
        border-radius: 8px;
        margin-top: 15px;
        color: #4CAF50;
        font-size: 14px;
      }

      .completed-icon {
        font-size: 24px;
      }

      .assistant-footer {
        padding: 15px 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: space-between;
        gap: 10px;
      }

      .btn-previous,
      .btn-next {
        flex: 1;
        padding: 10px 15px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        transition: all 0.2s ease;
      }

      .btn-previous {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }

      .btn-previous:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .btn-next {
        background: linear-gradient(135deg, #FFB74D 0%, #FF9800 100%);
        color: #000;
      }

      .btn-next:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(255, 183, 77, 0.4);
      }

      /* Bouton de lancement d'exercice */
      .btn-launch-exercise {
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%) !important;
        font-size: 14px !important;
        padding: 12px 24px !important;
      }

      .btn-launch-exercise:hover {
        transform: translateY(-3px) !important;
        box-shadow: 0 6px 20px rgba(76, 175, 80, 0.5) !important;
      }

      /* Mode Exercice Actif */
      .exercise-active {
        background: linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(102, 126, 234, 0.1) 100%);
        border-radius: 12px;
        padding: 20px;
        border: 2px solid rgba(76, 175, 80, 0.3);
      }

      .exercise-header {
        display: flex;
        gap: 15px;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 2px solid rgba(76, 175, 80, 0.2);
      }

      .exercise-icon {
        font-size: 48px;
        animation: pulse 2s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }

      .exercise-status {
        flex: 1;
      }

      .exercise-status h3 {
        margin: 0 0 5px 0;
        font-size: 18px;
        color: #4CAF50;
      }

      .status-active {
        font-size: 12px;
        color: #4CAF50;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .exercise-instructions {
        margin-bottom: 20px;
      }

      .exercise-instructions h4 {
        margin: 0 0 10px 0;
        font-size: 14px;
        color: #FFB74D;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .exercise-instructions ul {
        margin: 0;
        padding-left: 20px;
        list-style: none;
      }

      .exercise-instructions li {
        margin-bottom: 8px;
        padding-left: 20px;
        position: relative;
        color: rgba(255, 255, 255, 0.8);
        font-size: 13px;
        line-height: 1.6;
      }

      .exercise-instructions li:before {
        content: '▶';
        position: absolute;
        left: 0;
        color: #4CAF50;
      }

      .exercise-instructions strong {
        color: #FFB74D;
        font-weight: 600;
      }

      .exercise-tips {
        display: flex;
        gap: 12px;
        padding: 15px;
        background: rgba(255, 183, 77, 0.1);
        border-left: 3px solid #FFB74D;
        border-radius: 8px;
        margin-bottom: 20px;
      }

      .tip-icon {
        font-size: 24px;
        flex-shrink: 0;
      }

      .tip-text {
        color: rgba(255, 255, 255, 0.8);
        font-size: 13px;
        line-height: 1.5;
      }

      .tip-text strong {
        color: #FFB74D;
      }

      .exercise-actions {
        display: flex;
        justify-content: center;
      }

      .btn-stop-exercise {
        background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
        color: #fff;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s ease;
        width: 100%;
      }

      .btn-stop-exercise:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(244, 67, 54, 0.4);
      }

      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      /* Placeholders pour icônes personnalisées */
      .tutorial-icon-placeholder,
      .step-icon-placeholder,
      .footer-icon-placeholder {
        width: 80px;
        height: 80px;
        background: linear-gradient(135deg, rgba(255, 183, 77, 0.2) 0%, rgba(102, 126, 234, 0.2) 100%);
        border: 2px solid rgba(255, 183, 77, 0.3);
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }

      .step-icon-placeholder {
        width: 60px;
        height: 60px;
        border-radius: 12px;
      }

      .footer-icon-placeholder {
        width: 50px;
        height: 50px;
        border-radius: 10px;
        flex-shrink: 0;
      }

      /* Icônes temporaires (emojis) - cachables quand remplacées */
      .icon-temp {
        font-size: 40px;
        opacity: 0.7;
      }

      .step-icon-placeholder .icon-temp {
        font-size: 30px;
      }

      .footer-icon-placeholder .icon-temp {
        font-size: 24px;
      }

      /* Classes spécifiques pour différentes icônes (pour ciblage futur) */
      .tutorial-icon-main {
        /* Icône principale du tutoriel */
      }

      .step-icon-bluetooth {
        /* Icône Bluetooth/Connexion */
        border-color: rgba(33, 150, 243, 0.5);
      }

      .step-icon-calibration {
        /* Icône Calibration */
        border-color: rgba(255, 152, 0, 0.5);
      }

      .step-icon-audio {
        /* Icône Audio */
        border-color: rgba(156, 39, 176, 0.5);
      }

      .step-icon-explore {
        /* Icône Exploration */
        border-color: rgba(76, 175, 80, 0.5);
      }

      .tutorial-steps {
        display: flex;
        flex-direction: column;
        gap: 25px;
      }

      .tutorial-step {
        display: flex;
        gap: 25px;
        padding: 25px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        border-left: 4px solid transparent;
        transition: all 0.3s ease;
      }

      .tutorial-step:hover {
        background: rgba(255, 255, 255, 0.08);
        border-left-color: rgba(255, 183, 77, 0.5);
      }

      .step-icon-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 15px;
        flex-shrink: 0;
      }

      .step-number {
        flex-shrink: 0;
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #FFB74D 0%, #667eea 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: bold;
        color: #000;
      }

      .step-content {
        flex: 1;
      }

      .step-content h3 {
        margin: 0 0 15px 0;
        font-size: 20px;
        color: #FFB74D;
      }

      .step-instructions {
        margin: 0;
        padding-left: 20px;
        color: rgba(255, 255, 255, 0.8);
        line-height: 1.8;
      }

      .step-instructions li {
        margin-bottom: 8px;
      }

      .step-instructions strong {
        color: #FFB74D;
        font-weight: 600;
      }

      /* Indicateurs de statut */
      .step-status {
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 10px;
      }

      .step-label {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-left: 10px;
        transition: color 0.3s ease;
      }

      /* Boutons d'action pour naviguer vers les onglets */
      .step-action-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-top: 15px;
        width: auto;
        display: inline-block;
      }

      .step-action-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      }

      /* Étape complétée */
      .step-completed {
        border-left-color: #4CAF50 !important;
        background: rgba(76, 175, 80, 0.08) !important;
      }

      .step-completed .step-number {
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
      }

      .step-completed .step-icon-placeholder {
        border-color: rgba(76, 175, 80, 0.6) !important;
      }

      .tutorial-footer {
        margin-top: 30px;
        padding: 20px 25px;
        background: rgba(255, 183, 77, 0.1);
        border-left: 4px solid #FFB74D;
        border-radius: 8px;
        display: flex;
        gap: 20px;
        align-items: flex-start;
      }

      .footer-content {
        flex: 1;
        color: rgba(255, 255, 255, 0.8);
        line-height: 1.6;
      }

      .footer-content strong {
        color: #FFB74D;
      }

      /* Catégories d'artisanat */
      .craft-categories {
        display: flex;
        flex-direction: column;
        gap: 50px;
      }

      .craft-category {
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        padding: 35px;
      }

      .category-header {
        display: flex;
        gap: 25px;
        align-items: center;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 2px solid rgba(255, 183, 77, 0.2);
      }

      .category-icon {
        font-size: 64px;
        flex-shrink: 0;
      }

      .category-info {
        flex: 1;
      }

      .category-name {
        margin: 0 0 8px 0;
        font-size: 28px;
        color: #FFB74D;
      }

      .category-description {
        margin: 0;
        color: rgba(255, 255, 255, 0.6);
        font-size: 14px;
      }

      .explorations-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 20px;
      }

      .exploration-card {
        background: rgba(255, 255, 255, 0.05);
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 20px;
        transition: all 0.3s ease;
      }

      .exploration-card.available {
        border-color: rgba(255, 183, 77, 0.3);
      }

      .exploration-card.available:hover {
        transform: translateY(-3px);
        border-color: rgba(255, 183, 77, 0.6);
        box-shadow: 0 6px 25px rgba(255, 183, 77, 0.2);
      }

      .exploration-card.coming-soon {
        opacity: 0.5;
      }

      .exploration-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
        gap: 10px;
      }

      .exploration-name {
        margin: 0;
        font-size: 16px;
        color: #fff;
        flex: 1;
      }

      .status-badge {
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        flex-shrink: 0;
      }

      .available-badge {
        background: rgba(76, 175, 80, 0.2);
        color: #4CAF50;
        border: 1px solid rgba(76, 175, 80, 0.3);
      }

      .completed-badge {
        background: rgba(33, 150, 243, 0.2);
        color: #2196F3;
        border: 1px solid rgba(33, 150, 243, 0.3);
      }

      .locked-badge {
        background: rgba(158, 158, 158, 0.2);
        color: #9e9e9e;
        border: 1px solid rgba(158, 158, 158, 0.3);
      }

      .coming-badge {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.5);
      }

      .exploration-description {
        margin: 0 0 15px 0;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.6);
        line-height: 1.4;
      }

      .exploration-launch-btn {
        background: linear-gradient(135deg, #FFB74D 0%, #FF9800 100%);
        color: #000;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s ease;
        width: 100%;
      }

      .exploration-launch-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(255, 183, 77, 0.4);
      }

      .exploration-card.locked {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .locked-message {
        padding: 12px;
        background: rgba(158, 158, 158, 0.1);
        border: 1px dashed rgba(158, 158, 158, 0.3);
        border-radius: 6px;
        color: rgba(255, 255, 255, 0.5);
        font-size: 12px;
        text-align: center;
        font-style: italic;
      }

      /* ========================================
         BOUTON REC SUR LES CARTES
         ======================================== */

      .btn-rec-card {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        background: linear-gradient(135deg, #2a2a2a, #1a1a1a);
        border: 2px solid #444;
        border-radius: 6px;
        color: #e0e0e0;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
      }

      .btn-rec-card:hover {
        border-color: #dc3545;
        background: linear-gradient(135deg, #3a2a2a, #2a1a1a);
        transform: scale(1.05);
      }

      .btn-rec-card.recording {
        border-color: #dc3545;
        background: linear-gradient(135deg, #4a2a2a, #3a1a1a);
        animation: pulse-rec 1.5s ease-in-out infinite;
      }

      .btn-rec-card .rec-icon {
        color: #dc3545;
        font-size: 1rem;
      }

      .btn-rec-card.recording .rec-icon {
        animation: blink-rec 1s ease-in-out infinite;
      }

      @keyframes pulse-rec {
        0%, 100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.4); }
        50% { box-shadow: 0 0 0 6px rgba(220, 53, 69, 0); }
      }

      @keyframes blink-rec {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }

      /* ========================================
         BOUTONS DE DURÉE
         ======================================== */

      .duration-buttons {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 15px;
      }

      .duration-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-radius: 8px;
        border: 2px solid transparent;
        background: rgba(255, 255, 255, 0.03);
        cursor: pointer;
        transition: all 0.3s ease;
        font-family: inherit;
        width: 100%;
      }

      .duration-content {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .duration-icon {
        font-size: 1.2rem;
      }

      .duration-label {
        font-size: 0.95rem;
        font-weight: 600;
        color: #e0e0e0;
      }

      .duration-status {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.6);
        display: flex;
        align-items: center;
        gap: 4px;
      }

      /* État: Disponible */
      .duration-btn.available {
        border-color: rgba(76, 175, 80, 0.3);
        background: linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.05));
      }

      .duration-btn.available:hover {
        border-color: rgba(76, 175, 80, 0.6);
        background: linear-gradient(135deg, rgba(76, 175, 80, 0.15), rgba(76, 175, 80, 0.1));
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
      }

      .duration-btn.available .duration-status {
        color: #4CAF50;
      }

      /* État: Complété */
      .duration-btn.completed {
        border-color: rgba(33, 150, 243, 0.3);
        background: linear-gradient(135deg, rgba(33, 150, 243, 0.1), rgba(33, 150, 243, 0.05));
      }

      .duration-btn.completed:hover {
        border-color: rgba(33, 150, 243, 0.6);
        background: linear-gradient(135deg, rgba(33, 150, 243, 0.15), rgba(33, 150, 243, 0.1));
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(33, 150, 243, 0.3);
      }

      .duration-btn.completed .duration-status {
        color: #2196F3;
      }

      /* État: Verrouillé */
      .duration-btn.locked {
        opacity: 0.4;
        cursor: not-allowed;
        border-color: rgba(158, 158, 158, 0.2);
        background: rgba(255, 255, 255, 0.02);
      }

      .duration-btn.locked:hover {
        transform: none;
        box-shadow: none;
      }

      .duration-btn.locked .duration-status {
        color: rgba(255, 255, 255, 0.4);
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * ==================================================
   * SYSTÈME DE PROGRESSION ET DÉBLOCAGE
   * ==================================================
   */

  /**
   * Charge la progression depuis localStorage
   * @private
   * @returns {Object}
   */
  _loadProgress() {
    try {
      const saved = localStorage.getItem('fool-of-craft-progress');
      if (!saved) {
        return this._getDefaultProgress();
      }

      let progress = JSON.parse(saved);

      // Migration de l'ancien format (v1.0.0) vers le nouveau (v2.0.0)
      if (!progress.version || progress.version === '1.0.0') {
        console.log('[FoolOfCraft] Migration progression v1.0.0 → v2.0.0');
        progress = this._migrateProgressToV2(progress);
      }

      console.log('[FoolOfCraft] Progression chargée:', progress);
      return progress;
    } catch (error) {
      console.error('[FoolOfCraft] Erreur chargement progression:', error);
      return this._getDefaultProgress();
    }
  }

  /**
   * Migre la progression de v1.0.0 vers v2.0.0
   * @private
   * @param {Object} oldProgress - Ancienne progression
   * @returns {Object} - Nouvelle progression
   */
  _migrateProgressToV2(oldProgress) {
    const newProgress = this._getDefaultProgress();

    // Conserver le statut du tutoriel
    newProgress.tutorialCompleted = oldProgress.tutorialCompleted || false;
    newProgress.lastPlayedDate = oldProgress.lastPlayedDate || null;

    // Migrer les exercices débloqués
    if (oldProgress.exercisesUnlocked && Array.isArray(oldProgress.exercisesUnlocked)) {
      oldProgress.exercisesUnlocked.forEach(exerciseId => {
        if (newProgress.exercises[exerciseId]) {
          newProgress.exercises[exerciseId].unlocked = true;
          // Débloquer 3min par défaut pour les exercices débloqués
          newProgress.exercises[exerciseId].durations['3min'].unlocked = true;
        }
      });
    }

    // Migrer les exercices complétés (considérés comme 5min complétés)
    if (oldProgress.exercisesCompleted && Array.isArray(oldProgress.exercisesCompleted)) {
      oldProgress.exercisesCompleted.forEach(exerciseId => {
        if (newProgress.exercises[exerciseId]) {
          newProgress.exercises[exerciseId].unlocked = true;
          // Marquer 3min et 5min comme complétés
          newProgress.exercises[exerciseId].durations['3min'].completed = true;
          newProgress.exercises[exerciseId].durations['3min'].unlocked = true;
          newProgress.exercises[exerciseId].durations['5min'].completed = true;
          newProgress.exercises[exerciseId].durations['5min'].unlocked = true;
          // Débloquer free
          newProgress.exercises[exerciseId].durations['free'].unlocked = true;
        }
      });
    }

    console.log('[FoolOfCraft] Migration terminée:', newProgress);
    return newProgress;
  }

  /**
   * Progression par défaut (première utilisation)
   * @private
   * @returns {Object}
   */
  _getDefaultProgress() {
    return {
      tutorialCompleted: false,
      exercises: {
        // Chaque exercice a 3 durées : 3min, 5min, free
        rotationContinue: {
          unlocked: false,
          durations: {
            '3min': { completed: false, unlocked: false },
            '5min': { completed: false, unlocked: false },
            'free': { completed: false, unlocked: false }
          }
        },
        synchronisationMains: {
          unlocked: false,
          durations: {
            '3min': { completed: false, unlocked: false },
            '5min': { completed: false, unlocked: false },
            'free': { completed: false, unlocked: false }
          }
        },
        etiragePointe: {
          unlocked: false,
          durations: {
            '3min': { completed: false, unlocked: false },
            '5min': { completed: false, unlocked: false },
            'free': { completed: false, unlocked: false }
          }
        },
        soufflageRythmique: {
          unlocked: false,
          durations: {
            '3min': { completed: false, unlocked: false },
            '5min': { completed: false, unlocked: false },
            'free': { completed: false, unlocked: false }
          }
        },
        torsionTube: {
          unlocked: false,
          durations: {
            '3min': { completed: false, unlocked: false },
            '5min': { completed: false, unlocked: false },
            'free': { completed: false, unlocked: false }
          }
        }
      },
      lastPlayedDate: null,
      version: '2.0.0' // Nouvelle version pour la progression par durée
    };
  }

  /**
   * Sauvegarde la progression dans localStorage
   * @private
   */
  _saveProgress() {
    try {
      localStorage.setItem('fool-of-craft-progress', JSON.stringify(this.userProgress));
      console.log('[FoolOfCraft] Progression sauvegardée');
    } catch (error) {
      console.error('[FoolOfCraft] Erreur sauvegarde progression:', error);
    }
  }

  /**
   * Vérifie si un exercice est débloqué (au moins une durée débloquée)
   * @param {string} exerciseId - ID de l'exercice
   * @returns {boolean}
   */
  isExerciseUnlocked(exerciseId) {
    // Tutoriel toujours disponible
    if (exerciseId === 'tutorial') {
      return true;
    }

    // Premier exercice (rotationContinue) débloqué quand tutoriel terminé
    if (exerciseId === 'rotationContinue') {
      return this.userProgress.tutorialCompleted;
    }

    // Autres exercices débloqués selon progression
    const exercise = this.userProgress.exercises[exerciseId];
    return exercise && exercise.unlocked;
  }

  /**
   * Vérifie si une durée spécifique est débloquée pour un exercice
   * @param {string} exerciseId - ID de l'exercice
   * @param {string} duration - Durée ('3min', '5min', 'free')
   * @returns {boolean}
   */
  isDurationUnlocked(exerciseId, duration) {
    const exercise = this.userProgress.exercises[exerciseId];
    if (!exercise) return false;

    return exercise.durations[duration] && exercise.durations[duration].unlocked;
  }

  /**
   * Vérifie si une durée a été complétée
   * @param {string} exerciseId - ID de l'exercice
   * @param {string} duration - Durée ('3min', '5min', 'free')
   * @returns {boolean}
   */
  isDurationCompleted(exerciseId, duration) {
    const exercise = this.userProgress.exercises[exerciseId];
    if (!exercise) return false;

    return exercise.durations[duration] && exercise.durations[duration].completed;
  }

  /**
   * Débloque un exercice (débloque la durée 3min par défaut)
   * @param {string} exerciseId - ID de l'exercice à débloquer
   */
  unlockExercise(exerciseId) {
    const exercise = this.userProgress.exercises[exerciseId];
    if (!exercise) {
      console.warn(`[FoolOfCraft] Exercice inconnu: ${exerciseId}`);
      return;
    }

    if (!exercise.unlocked) {
      exercise.unlocked = true;
      // Débloquer automatiquement la durée 3min
      exercise.durations['3min'].unlocked = true;
      this._saveProgress();
      console.log(`[FoolOfCraft] ✓ Exercice débloqué: ${exerciseId} (3min disponible)`);
    }
  }

  /**
   * Marque le tutoriel comme terminé
   */
  completeTutorial() {
    this.userProgress.tutorialCompleted = true;
    this.unlockExercise('rotationContinue'); // Débloque le premier exercice (3min)
    this._saveProgress();
    console.log('[FoolOfCraft] ✓ Tutoriel terminé - Rotation Continue 3min débloqué');
  }

  /**
   * Marque une durée d'exercice comme complétée
   * @param {string} exerciseId - ID de l'exercice
   * @param {string} duration - Durée complétée ('3min', '5min', 'free')
   */
  completeExerciseDuration(exerciseId, duration) {
    const exercise = this.userProgress.exercises[exerciseId];
    if (!exercise) {
      console.warn(`[FoolOfCraft] Exercice inconnu: ${exerciseId}`);
      return;
    }

    const durationData = exercise.durations[duration];
    if (!durationData) {
      console.warn(`[FoolOfCraft] Durée invalide: ${duration}`);
      return;
    }

    if (!durationData.completed) {
      // Marquer comme complété
      durationData.completed = true;

      // Débloquer la durée suivante selon la progression
      if (duration === '3min') {
        // Compléter 3min → débloquer 5min
        exercise.durations['5min'].unlocked = true;
        console.log(`[FoolOfCraft] ✓ ${exerciseId} 3min complété → 5min débloqué`);
      } else if (duration === '5min') {
        // Compléter 5min → débloquer free
        exercise.durations['free'].unlocked = true;
        console.log(`[FoolOfCraft] ✓ ${exerciseId} 5min complété → Free débloqué`);
      } else if (duration === 'free') {
        // Compléter free → débloquer le prochain exercice
        this._unlockNextExercise(exerciseId);
        console.log(`[FoolOfCraft] ✓ ${exerciseId} Free complété → Prochain exercice débloqué`);
      }

      this._saveProgress();
    }
  }

  /**
   * Débloque le prochain exercice selon ordre de progression
   * @private
   * @param {string} completedExerciseId - ID de l'exercice complété
   */
  _unlockNextExercise(completedExerciseId) {
    const progressionOrder = [
      'rotationContinue',
      'synchronisationMains',
      'etiragePoin te',
      'soufflageRythmique',
      'torsionTube'
    ];

    const currentIndex = progressionOrder.indexOf(completedExerciseId);
    if (currentIndex >= 0 && currentIndex < progressionOrder.length - 1) {
      const nextExercise = progressionOrder[currentIndex + 1];
      this.unlockExercise(nextExercise);
      console.log(`[FoolOfCraft] 🎉 Prochain exercice débloqué: ${nextExercise}`);
    }
  }

  /**
   * DÉVELOPPEMENT: Débloque tous les exercices et toutes les durées
   * @private
   */
  _unlockAll() {
    this.userProgress.tutorialCompleted = true;

    // Débloquer tous les exercices et toutes leurs durées
    Object.keys(this.userProgress.exercises).forEach(exerciseId => {
      const exercise = this.userProgress.exercises[exerciseId];
      exercise.unlocked = true;
      exercise.durations['3min'].unlocked = true;
      exercise.durations['5min'].unlocked = true;
      exercise.durations['free'].unlocked = true;
    });

    this._saveProgress();
    console.log('[FoolOfCraft] 🔓 TOUS LES EXERCICES ET DURÉES DÉBLOQUÉS (mode développement)');
    console.log('[FoolOfCraft] Rechargez la page pour voir les changements');
    return 'Tous les exercices et durées débloqués! Rechargez la page.';
  }

  /**
   * DÉVELOPPEMENT: Réinitialise la progression
   * @private
   */
  _resetProgress() {
    this.userProgress = this._getDefaultProgress();
    this._saveProgress();
    console.log('[FoolOfCraft] 🔄 Progression réinitialisée');
    console.log('[FoolOfCraft] Rechargez la page pour voir les changements');
    return 'Progression réinitialisée! Rechargez la page.';
  }

  /**
   * DÉVELOPPEMENT: Affiche la progression actuelle
   * @private
   */
  _showProgress() {
    console.log('='.repeat(60));
    console.log('PROGRESSION FOOL OF CRAFT');
    console.log('='.repeat(60));
    console.log('Tutoriel complété:', this.userProgress.tutorialCompleted);
    console.log('Exercices débloqués:', this.userProgress.exercisesUnlocked);
    console.log('Exercices complétés:', this.userProgress.exercisesCompleted);
    console.log('='.repeat(60));
    return this.userProgress;
  }
}

module.exports = FoolOfCraftUIController;
