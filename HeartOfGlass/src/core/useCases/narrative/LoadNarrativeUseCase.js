/**
 * LoadNarrativeUseCase - Cas d'utilisation pour charger la narrative
 *
 * Orchestre le chargement de la narrative complète depuis le repository,
 * vérifie l'intégrité, et prépare l'état initial.
 *
 * Architecture : Core/UseCases
 */
class LoadNarrativeUseCase {
  /**
   * @param {NarrativeRepository} narrativeRepository - Repository narratif
   */
  constructor(narrativeRepository) {
    if (!narrativeRepository) {
      throw new Error('LoadNarrativeUseCase requires a NarrativeRepository');
    }

    this.narrativeRepository = narrativeRepository;
  }

  /**
   * Exécute le chargement de la narrative
   * @param {Object} options - Options de chargement
   * @param {boolean} options.validateMedia - Valider l'existence des médias (défaut: false)
   * @param {boolean} options.resetProgress - Ignorer la progression sauvegardée (défaut: false)
   * @returns {Promise<Object>} Résultat du chargement
   */
  async execute(options = {}) {
    const {
      validateMedia = false,
      resetProgress = false
    } = options;

    try {
      console.log('[LoadNarrativeUseCase] Starting narrative load...');

      // 1. Charger la narrative depuis le repository
      const narrative = await this.narrativeRepository.loadNarrative();

      console.log(`[LoadNarrativeUseCase] Loaded narrative: ${narrative.title}`);
      console.log(`[LoadNarrativeUseCase] Chapters: ${narrative.chapters.length}`);
      console.log(`[LoadNarrativeUseCase] Characters: ${narrative.characters.size}`);

      // 2. Valider la structure
      this._validateNarrative(narrative);

      // 3. Optionnel : Valider les médias
      if (validateMedia) {
        await this._validateMedia(narrative);
      }

      // 4. Gérer la progression
      let progressState = null;

      if (!resetProgress) {
        progressState = await this.narrativeRepository.loadProgress();

        if (progressState) {
          console.log('[LoadNarrativeUseCase] Progress loaded:', {
            currentChapter: progressState.currentChapterId,
            completed: progressState.completedChapterIds.length,
            unlocked: progressState.unlockedChapterIds.length
          });
        }
      }

      // 5. Calculer statistiques
      const stats = this._calculateStats(narrative);

      // 6. Résultat
      return {
        success: true,
        narrative,
        progressState,
        stats,
        warnings: []
      };

    } catch (error) {
      console.error('[LoadNarrativeUseCase] Load failed:', error);

      return {
        success: false,
        narrative: null,
        progressState: null,
        stats: null,
        error: error.message,
        warnings: []
      };
    }
  }

  /**
   * Valide la structure de la narrative
   * @private
   * @param {Narrative} narrative
   * @throws {Error} Si la validation échoue
   */
  _validateNarrative(narrative) {
    // Vérifier qu'il y a au moins un chapitre
    if (narrative.chapters.length === 0) {
      throw new Error('Narrative must have at least one chapter');
    }

    // Vérifier qu'il y a au moins un personnage
    if (narrative.characters.size === 0) {
      throw new Error('Narrative must have at least one character');
    }

    // Vérifier que chaque chapitre a au moins une scène
    for (const chapter of narrative.chapters) {
      if (chapter.scenes.length === 0) {
        throw new Error(`Chapter ${chapter.id} has no scenes`);
      }

      // Vérifier que chaque scène dialogue référence des personnages existants
      for (const scene of chapter.scenes) {
        if (scene.type === 'dialogue') {
          for (const dialogue of scene.dialogues) {
            if (!narrative.characters.has(dialogue.character)) {
              throw new Error(
                `Dialogue in scene ${scene.id} references unknown character: ${dialogue.character}`
              );
            }

            // Vérifier que le portrait existe
            const character = narrative.characters.get(dialogue.character);
            const portrait = character.getPortrait(dialogue.portrait.emotion);
            if (!portrait) {
              throw new Error(
                `Character ${dialogue.character} has no portrait for emotion: ${dialogue.portrait.emotion}`
              );
            }
          }
        }
      }
    }

    console.log('[LoadNarrativeUseCase] Narrative structure validated');
  }

  /**
   * Valide l'existence des fichiers médias
   * @private
   * @param {Narrative} narrative
   * @returns {Promise<void>}
   */
  async _validateMedia(narrative) {
    const missingMedia = [];

    // Vérifier portraits
    for (const [charId, character] of narrative.characters) {
      for (const [emotion, portrait] of Object.entries(character.portraits)) {
        if (portrait.type === 'animated') {
          for (const framePath of portrait.frames) {
            const exists = await this.narrativeRepository.mediaExists(framePath);
            if (!exists) {
              missingMedia.push(`Portrait ${charId}/${emotion}: ${framePath}`);
            }
          }
        } else {
          const exists = await this.narrativeRepository.mediaExists(portrait.image);
          if (!exists) {
            missingMedia.push(`Portrait ${charId}/${emotion}: ${portrait.image}`);
          }
        }
      }
    }

    // Vérifier vidéos
    for (const chapter of narrative.chapters) {
      for (const scene of chapter.scenes) {
        if (scene.type === 'cinematic' && scene.video.file) {
          const exists = await this.narrativeRepository.mediaExists(scene.video.file);
          if (!exists) {
            missingMedia.push(`Video: ${scene.video.file}`);
          }
        }
      }
    }

    if (missingMedia.length > 0) {
      console.warn('[LoadNarrativeUseCase] Missing media files:', missingMedia);
      throw new Error(`Missing ${missingMedia.length} media file(s)`);
    }

    console.log('[LoadNarrativeUseCase] All media files validated');
  }

  /**
   * Calcule les statistiques de la narrative
   * @private
   * @param {Narrative} narrative
   * @returns {Object}
   */
  _calculateStats(narrative) {
    let totalScenes = 0;
    let totalDialogues = 0;
    let totalWords = 0;
    let estimatedDuration = 0; // en minutes

    for (const chapter of narrative.chapters) {
      totalScenes += chapter.scenes.length;

      for (const scene of chapter.scenes) {
        if (scene.type === 'dialogue') {
          totalDialogues += scene.dialogues.length;

          for (const dialogue of scene.dialogues) {
            const words = dialogue.text.split(/\s+/).length;
            totalWords += words;

            // Estimation durée (typewriter + auto-advance)
            const duration = dialogue.calculateDisplayDuration();
            estimatedDuration += duration;
          }
        }

        if (scene.type === 'cinematic') {
          // Estimation 2 minutes par vidéo (ajustable)
          estimatedDuration += 120000;
        }

        if (scene.type === 'tutorial') {
          // Estimation 1 minute par étape tutoriel
          estimatedDuration += scene.tutorialSteps.length * 60000;
        }
      }
    }

    return {
      totalChapters: narrative.chapters.length,
      totalScenes,
      totalDialogues,
      totalWords,
      totalCharacters: narrative.characters.size,
      estimatedDurationMinutes: Math.ceil(estimatedDuration / 60000)
    };
  }
}

module.exports = LoadNarrativeUseCase;
