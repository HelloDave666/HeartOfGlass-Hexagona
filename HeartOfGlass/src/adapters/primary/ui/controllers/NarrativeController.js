/**
 * NarrativeController - Contrôleur pour le système narratif
 *
 * Orchestre l'affichage des dialogues, la progression narrative,
 * et la coordination avec les autres contrôleurs (exercices, audio).
 *
 * Architecture : Adapters/Primary/UI/Controllers
 */
const path = require('path');
const DialogueBox = require('../components/DialogueBox');
const JSONNarrativeRepository = require('../../../secondary/storage/JSONNarrativeRepository');
const LoadNarrativeUseCase = require('../../../../core/useCases/narrative/LoadNarrativeUseCase');

class NarrativeController {
  /**
   * @param {Object} dependencies - Dépendances
   * @param {Object} dependencies.state - État global de l'application
   * @param {Object} dependencies.exerciseController - Contrôleur des exercices (optionnel)
   * @param {Object} dependencies.audioOrchestrator - Orchestrateur audio (optionnel)
   */
  constructor({ state, exerciseController, audioOrchestrator }) {
    this.state = state;
    this.exerciseController = exerciseController;
    this.audioOrchestrator = audioOrchestrator;

    // Repository et Use Cases
    const narrativesPath = path.join(__dirname, '../../../../../narratives');
    this.repository = new JSONNarrativeRepository(narrativesPath);
    this.loadNarrativeUseCase = new LoadNarrativeUseCase(this.repository);

    // UI Components
    this.dialogueBox = new DialogueBox();

    // État narratif
    this.narrative = null;
    this.isActive = false;
    this.currentDialogue = null;

    console.log('[NarrativeController] Initialized');
  }

  /**
   * Initialise le système narratif (charge la narrative)
   * @returns {Promise<boolean>}
   */
  async initialize() {
    try {
      console.log('[NarrativeController] Loading narrative...');

      const result = await this.loadNarrativeUseCase.execute({
        validateMedia: false, // Pas de validation médias pour le proto
        resetProgress: false
      });

      if (!result.success) {
        console.error('[NarrativeController] Failed to load narrative:', result.error);
        return false;
      }

      this.narrative = result.narrative;

      console.log('[NarrativeController] Narrative loaded successfully');
      console.log('[NarrativeController] Stats:', result.stats);

      // Initialiser l'état narratif dans le state global
      this.state.narrative = {
        isActive: false,
        currentChapterId: this.narrative.state.currentChapterId,
        currentSceneId: null,
        unlockedChapters: [...this.narrative.state.unlockedChapterIds],
        completedChapters: [...this.narrative.state.completedChapterIds]
      };

      return true;

    } catch (error) {
      console.error('[NarrativeController] Initialization error:', error);
      return false;
    }
  }

  /**
   * Démarre un chapitre
   * @param {string} chapterId - ID du chapitre à démarrer
   * @returns {boolean}
   */
  startChapter(chapterId) {
    if (!this.narrative) {
      console.error('[NarrativeController] Narrative not loaded');
      return false;
    }

    try {
      this.narrative.start(chapterId);
      this.isActive = true;

      // Mettre à jour le state global
      this.state.narrative.isActive = true;
      this.state.narrative.currentChapterId = chapterId;

      console.log(`[NarrativeController] Started chapter: ${chapterId}`);

      // Afficher la première scène
      this._displayCurrentScene();

      return true;

    } catch (error) {
      console.error('[NarrativeController] Failed to start chapter:', error);
      return false;
    }
  }

  /**
   * Affiche la scène actuelle
   * @private
   */
  _displayCurrentScene() {
    const scene = this.narrative.getCurrentScene();

    if (!scene) {
      console.warn('[NarrativeController] No current scene');
      this._endNarrative();
      return;
    }

    console.log(`[NarrativeController] Displaying scene: ${scene.id} (type: ${scene.type})`);

    // Mettre à jour le state
    this.state.narrative.currentSceneId = scene.id;

    // Afficher selon le type de scène
    switch (scene.type) {
      case 'dialogue':
        this._displayDialogueScene(scene);
        break;

      case 'cinematic':
        this._displayCinematicScene(scene);
        break;

      case 'tutorial':
        this._displayTutorialScene(scene);
        break;

      case 'exercise-transition':
        this._displayExerciseTransition(scene);
        break;

      default:
        console.warn(`[NarrativeController] Unknown scene type: ${scene.type}`);
        this._advanceScene();
    }
  }

  /**
   * Affiche une scène de dialogue
   * @private
   */
  _displayDialogueScene(scene) {
    const dialogue = scene.getCurrentDialogue();

    if (!dialogue) {
      // Tous les dialogues de la scène sont terminés
      this._advanceScene();
      return;
    }

    this.currentDialogue = dialogue;

    // Obtenir le personnage
    const character = this.narrative.getCharacter(dialogue.character);
    if (!character) {
      console.error(`[NarrativeController] Character not found: ${dialogue.character}`);
      this._advanceDialogue();
      return;
    }

    // Obtenir le portrait
    const portrait = character.getPortrait(dialogue.portrait.emotion);
    if (!portrait) {
      console.warn(`[NarrativeController] Portrait not found: ${dialogue.portrait.emotion}`);
    }

    // Construire le chemin du portrait (placeholder pour l'instant)
    const portraitPath = portrait
      ? this.repository.getMediaPath(portrait.image || portrait.frames?.[0])
      : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect width="150" height="150" fill="%23667eea"/></svg>';

    // Afficher le dialogue
    this.dialogueBox.show({
      characterName: character.name,
      portraitPath,
      text: dialogue.text,
      typewriterSpeed: dialogue.typewriterSpeed,
      skippable: dialogue.skippable,
      onContinue: () => this._advanceDialogue(),
      onComplete: () => {
        console.log('[NarrativeController] Dialogue typewriter completed');
      }
    });
  }

  /**
   * Avance au dialogue suivant
   * @private
   */
  _advanceDialogue() {
    const scene = this.narrative.getCurrentScene();

    if (!scene || scene.type !== 'dialogue') {
      return;
    }

    // Avancer dans la scène
    const hasNext = scene.advanceDialogue();

    if (hasNext) {
      // Dialogue suivant dans la même scène
      this._displayDialogueScene(scene);
    } else {
      // Scène terminée
      this.dialogueBox.hide();
      this._advanceScene();
    }
  }

  /**
   * Affiche une scène cinématique (vidéo)
   * @private
   */
  _displayCinematicScene(scene) {
    console.log('[NarrativeController] Cinematic scenes not yet implemented');
    // TODO: Implémenter lecture vidéo
    // Pour l'instant, on skip
    this._advanceScene();
  }

  /**
   * Affiche une scène tutoriel
   * @private
   */
  _displayTutorialScene(scene) {
    const step = scene.getCurrentTutorialStep();

    if (!step) {
      // Tutoriel terminé
      this._advanceScene();
      return;
    }

    console.log(`[NarrativeController] Tutorial step: ${step.id}`);

    // Obtenir le personnage du dialogue
    const character = this.narrative.getCharacter(step.dialogue.character);
    const portrait = character?.getPortrait(step.dialogue.portrait.emotion);
    const portraitPath = portrait
      ? this.repository.getMediaPath(portrait.image || portrait.frames?.[0])
      : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect width="150" height="150" fill="%23667eea"/></svg>';

    // Afficher le dialogue
    this.dialogueBox.show({
      characterName: character?.name || 'Guide',
      portraitPath,
      text: step.dialogue.text,
      typewriterSpeed: step.dialogue.typewriterSpeed || 50,
      skippable: step.dialogue.skippable || false,
      onContinue: () => this._advanceTutorialStep(scene, step),
      onComplete: () => {
        // Highlight l'élément si spécifié
        if (step.highlight) {
          this.dialogueBox.highlightElement(step.highlight);
        }

        // Auto-validation si timeout
        if (step.validationCondition?.type === 'timeout') {
          setTimeout(() => {
            this._advanceTutorialStep(scene, step);
          }, step.validationCondition.duration);
        }
      }
    });

    // Backdrop optionnel pour tutoriel
    this.dialogueBox.setBackdrop(false);
  }

  /**
   * Avance à l'étape tutoriel suivante
   * @private
   */
  _advanceTutorialStep(scene, step) {
    // Clear highlight
    this.dialogueBox.clearHighlight();

    // Avancer dans le tutoriel
    const hasNext = scene.advanceTutorialStep();

    if (hasNext) {
      // Étape suivante
      this._displayTutorialScene(scene);
    } else {
      // Tutoriel terminé
      this.dialogueBox.hide();
      this.dialogueBox.setBackdrop(true); // Restore backdrop
      this._advanceScene();
    }
  }

  /**
   * Affiche une transition vers un exercice
   * @private
   */
  _displayExerciseTransition(scene) {
    console.log(`[NarrativeController] Exercise transition: ${scene.exerciseTransition.unlockExercise}`);

    // Afficher le dialogue de transition
    if (scene.exerciseTransition.dialogue) {
      const dialogue = scene.exerciseTransition.dialogue;
      const character = this.narrative.getCharacter(dialogue.character);
      const portrait = character?.getPortrait(dialogue.portrait.emotion);
      const portraitPath = portrait
        ? this.repository.getMediaPath(portrait.image || portrait.frames?.[0])
        : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect width="150" height="150" fill="%23667eea"/></svg>';

      this.dialogueBox.show({
        characterName: character?.name || 'Guide',
        portraitPath,
        text: dialogue.text,
        typewriterSpeed: dialogue.typewriterSpeed || 50,
        skippable: dialogue.skippable !== false,
        onContinue: () => {
          this.dialogueBox.hide();
          this._unlockExercise(scene.exerciseTransition.unlockExercise);
          this._advanceScene();
        }
      });
    } else {
      this._unlockExercise(scene.exerciseTransition.unlockExercise);
      this._advanceScene();
    }
  }

  /**
   * Débloque un exercice
   * @private
   */
  _unlockExercise(exerciseId) {
    console.log(`[NarrativeController] Unlocking exercise: ${exerciseId}`);

    // TODO: Intégration avec ExerciseController
    // Pour l'instant, juste un log
    if (this.exerciseController) {
      // this.exerciseController.unlockExercise(exerciseId);
      console.log('[NarrativeController] Exercise unlocked (integration pending)');
    }
  }

  /**
   * Avance à la scène suivante
   * @private
   */
  _advanceScene() {
    const chapter = this.narrative.getCurrentChapter();

    if (!chapter) {
      this._endNarrative();
      return;
    }

    const hasNext = chapter.advanceScene();

    if (hasNext) {
      // Scène suivante
      this._displayCurrentScene();
    } else {
      // Chapitre terminé
      this._endChapter();
    }
  }

  /**
   * Termine le chapitre actuel
   * @private
   */
  _endChapter() {
    const chapter = this.narrative.getCurrentChapter();

    if (chapter) {
      console.log(`[NarrativeController] Chapter completed: ${chapter.title}`);

      // Marquer comme complété
      this.state.narrative.completedChapters.push(chapter.id);

      // Sauvegarder la progression
      this._saveProgress();
    }

    // Essayer de passer au chapitre suivant
    const hasNextChapter = this.narrative.advanceChapter();

    if (hasNextChapter) {
      this._displayCurrentScene();
    } else {
      this._endNarrative();
    }
  }

  /**
   * Termine la narrative
   * @private
   */
  _endNarrative() {
    console.log('[NarrativeController] Narrative ended');

    this.dialogueBox.hide();
    this.isActive = false;
    this.state.narrative.isActive = false;

    this._saveProgress();
  }

  /**
   * Sauvegarde la progression
   * @private
   */
  async _saveProgress() {
    try {
      const narrativeState = this.narrative.exportState();
      await this.repository.saveProgress(narrativeState);
      console.log('[NarrativeController] Progress saved');
    } catch (error) {
      console.error('[NarrativeController] Failed to save progress:', error);
    }
  }

  /**
   * Obtient la liste des chapitres débloqués
   * @returns {Array}
   */
  getUnlockedChapters() {
    if (!this.narrative) {
      return [];
    }

    return this.narrative.getUnlockedChapters().map(chapter => ({
      id: chapter.id,
      title: chapter.title,
      isCompleted: this.narrative.state.completedChapterIds.includes(chapter.id),
      progress: chapter.getProgress()
    }));
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    if (this.dialogueBox) {
      this.dialogueBox.destroy();
    }
  }
}

module.exports = NarrativeController;
