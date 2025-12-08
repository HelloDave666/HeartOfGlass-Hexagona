/**
 * Scene - Entité représentant une scène narrative
 *
 * Une scène peut être de plusieurs types :
 * - dialogue : Suite de dialogues avec portraits
 * - cinematic : Vidéo ou séquence cinématique
 * - tutorial : Tutoriel interactif avec étapes
 * - exercise-transition : Transition vers un exercice
 *
 * Architecture : Core/Domain/Entities
 */
class Scene {
  /**
   * @param {Object} config - Configuration de la scène
   * @param {string} config.id - ID unique de la scène
   * @param {string} config.type - Type de scène (dialogue|cinematic|tutorial|exercise-transition)
   * @param {string} config.background - Image de fond (optionnel)
   * @param {DialogueLine[]} config.dialogues - Lignes de dialogue (pour type 'dialogue')
   * @param {Object} config.video - Config vidéo (pour type 'cinematic')
   * @param {Object[]} config.tutorialSteps - Étapes tutoriel (pour type 'tutorial')
   * @param {Object} config.exerciseTransition - Config transition (pour type 'exercise-transition')
   */
  constructor(config) {
    // Validation
    if (!config.id) {
      throw new Error('Scene requires an ID');
    }
    if (!config.type) {
      throw new Error('Scene requires a type');
    }

    const validTypes = ['dialogue', 'cinematic', 'tutorial', 'exercise-transition'];
    if (!validTypes.includes(config.type)) {
      throw new Error(`Invalid scene type: ${config.type}. Must be one of: ${validTypes.join(', ')}`);
    }

    // Données principales
    this.id = config.id;
    this.type = config.type;
    this.background = config.background || null;

    // Type-specific data
    this.dialogues = [];
    this.video = null;
    this.tutorialSteps = [];
    this.exerciseTransition = null;

    // Parse selon le type
    this._parseTypeSpecificData(config);

    // État de la scène
    this.state = {
      isActive: false,
      isComplete: false,
      currentDialogueIndex: 0,
      currentTutorialStepIndex: 0,
      startTime: null,
      endTime: null
    };
  }

  /**
   * Parse les données spécifiques au type de scène
   * @private
   */
  _parseTypeSpecificData(config) {
    switch (this.type) {
      case 'dialogue':
        this.dialogues = config.dialogues || [];
        if (this.dialogues.length === 0) {
          throw new Error('Dialogue scene requires at least one dialogue line');
        }
        break;

      case 'cinematic':
        this.video = {
          file: config.video?.file || null,
          skippable: config.video?.skippable !== undefined ? config.video.skippable : true,
          onComplete: config.video?.onComplete || 'next'
        };
        if (!this.video.file) {
          throw new Error('Cinematic scene requires a video file');
        }
        break;

      case 'tutorial':
        this.tutorialSteps = config.tutorialSteps || [];
        if (this.tutorialSteps.length === 0) {
          throw new Error('Tutorial scene requires at least one tutorial step');
        }
        // Chaque step doit avoir un dialogue et une condition de validation
        this.tutorialSteps.forEach((step, idx) => {
          if (!step.id) {
            throw new Error(`Tutorial step ${idx} requires an ID`);
          }
          if (!step.dialogue) {
            throw new Error(`Tutorial step ${step.id} requires a dialogue`);
          }
          if (!step.validationCondition) {
            throw new Error(`Tutorial step ${step.id} requires a validation condition`);
          }
        });
        break;

      case 'exercise-transition':
        this.exerciseTransition = {
          dialogue: config.exerciseTransition?.dialogue || config.dialogue || null,
          unlockExercise: config.exerciseTransition?.unlockExercise || config.unlockExercise || null,
          autoLaunchExercise: config.exerciseTransition?.autoLaunchExercise || config.autoLaunchExercise || false
        };
        if (!this.exerciseTransition.unlockExercise) {
          throw new Error('Exercise-transition scene requires an exercise ID to unlock');
        }
        break;
    }
  }

  /**
   * Démarre la scène
   */
  start() {
    if (this.state.isActive) {
      return false;
    }

    this.state.isActive = true;
    this.state.isComplete = false;
    this.state.currentDialogueIndex = 0;
    this.state.currentTutorialStepIndex = 0;
    this.state.startTime = Date.now();
    this.state.endTime = null;

    return true;
  }

  /**
   * Termine la scène
   */
  complete() {
    this.state.isActive = false;
    this.state.isComplete = true;
    this.state.endTime = Date.now();
  }

  /**
   * Obtient le dialogue actuel (pour scène de type 'dialogue')
   * @returns {DialogueLine|null}
   */
  getCurrentDialogue() {
    if (this.type !== 'dialogue') {
      return null;
    }

    const index = this.state.currentDialogueIndex;
    return this.dialogues[index] || null;
  }

  /**
   * Avance au dialogue suivant
   * @returns {boolean} True si il y a un dialogue suivant, false si terminé
   */
  advanceDialogue() {
    if (this.type !== 'dialogue') {
      return false;
    }

    this.state.currentDialogueIndex++;

    if (this.state.currentDialogueIndex >= this.dialogues.length) {
      this.complete();
      return false;
    }

    return true;
  }

  /**
   * Obtient l'étape tutoriel actuelle (pour scène de type 'tutorial')
   * @returns {Object|null}
   */
  getCurrentTutorialStep() {
    if (this.type !== 'tutorial') {
      return null;
    }

    const index = this.state.currentTutorialStepIndex;
    return this.tutorialSteps[index] || null;
  }

  /**
   * Avance à l'étape tutoriel suivante
   * @returns {boolean} True si il y a une étape suivante, false si terminé
   */
  advanceTutorialStep() {
    if (this.type !== 'tutorial') {
      return false;
    }

    this.state.currentTutorialStepIndex++;

    if (this.state.currentTutorialStepIndex >= this.tutorialSteps.length) {
      this.complete();
      return false;
    }

    return true;
  }

  /**
   * Vérifie si la scène est terminée
   * @returns {boolean}
   */
  isCompleted() {
    return this.state.isComplete;
  }

  /**
   * Obtient le temps écoulé depuis le début de la scène
   * @returns {number} Temps en ms
   */
  getElapsedTime() {
    if (!this.state.startTime) {
      return 0;
    }

    const endTime = this.state.endTime || Date.now();
    return endTime - this.state.startTime;
  }

  /**
   * Réinitialise la scène
   */
  reset() {
    this.state = {
      isActive: false,
      isComplete: false,
      currentDialogueIndex: 0,
      currentTutorialStepIndex: 0,
      startTime: null,
      endTime: null
    };

    // Reset dialogues display state
    if (this.type === 'dialogue') {
      this.dialogues.forEach(dialogue => {
        if (dialogue.resetDisplayState) {
          dialogue.resetDisplayState();
        }
      });
    }
  }
}

module.exports = Scene;
