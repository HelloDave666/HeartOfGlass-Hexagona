/**
 * JSONNarrativeRepository - Implémentation JSON du repository narratif
 *
 * Charge la narrative depuis des fichiers JSON stockés dans /narratives
 * et sauvegarde la progression dans localStorage (Electron).
 *
 * Architecture : Adapters/Secondary/Storage
 */
const fs = require('fs').promises;
const path = require('path');
const NarrativeRepository = require('../../../core/ports/NarrativeRepository');
const Narrative = require('../../../core/domain/entities/Narrative');
const Chapter = require('../../../core/domain/entities/Chapter');
const Scene = require('../../../core/domain/entities/Scene');
const DialogueLine = require('../../../core/domain/entities/DialogueLine');
const Character = require('../../../core/domain/entities/Character');
const NarrativeState = require('../../../core/domain/valueObjects/NarrativeState');

class JSONNarrativeRepository extends NarrativeRepository {
  /**
   * @param {string} narrativesPath - Chemin absolu vers le dossier /narratives
   */
  constructor(narrativesPath) {
    super();
    this.narrativesPath = narrativesPath;
    this.progressFilePath = path.join(narrativesPath, '.progress.json');
  }

  /**
   * Charge la narrative complète
   * @returns {Promise<Narrative>}
   */
  async loadNarrative() {
    try {
      // 1. Charger le fichier principal narrative.json
      const narrativeJsonPath = path.join(this.narrativesPath, 'narrative.json');
      const narrativeData = await this._readJSON(narrativeJsonPath);

      // 2. Charger tous les personnages
      const characters = await this.loadCharacters();

      // 3. Charger tous les chapitres
      const chapters = [];
      for (const chapterRef of narrativeData.chapters) {
        const chapter = await this.loadChapter(chapterRef.id, chapterRef.file);
        chapters.push(chapter);
      }

      // 4. Créer l'entité Narrative
      const narrative = new Narrative({
        id: narrativeData.id,
        title: narrativeData.title,
        version: narrativeData.version,
        chapters,
        characters,
        metadata: narrativeData.metadata || {}
      });

      // 5. Charger et appliquer la progression sauvegardée
      const savedProgress = await this.loadProgress();
      if (savedProgress) {
        narrative.importState(savedProgress.toJSON());
      }

      return narrative;

    } catch (error) {
      throw new Error(`Failed to load narrative: ${error.message}`);
    }
  }

  /**
   * Charge un chapitre depuis son fichier
   * @param {string} chapterId - ID du chapitre
   * @param {string} filePath - Chemin relatif du fichier
   * @returns {Promise<Chapter>}
   */
  async loadChapter(chapterId, filePath) {
    try {
      const fullPath = path.join(this.narrativesPath, filePath);
      const chapterData = await this._readJSON(fullPath);

      // Parser les scènes
      const scenes = chapterData.scenes.map(sceneData =>
        this._parseScene(sceneData)
      );

      // Créer l'entité Chapter
      return new Chapter({
        id: chapterData.id,
        title: chapterData.title,
        scenes,
        unlockCondition: chapterData.unlockCondition,
        metadata: chapterData.metadata || {}
      });

    } catch (error) {
      throw new Error(`Failed to load chapter ${chapterId}: ${error.message}`);
    }
  }

  /**
   * Charge tous les personnages
   * @returns {Promise<Map<string, Character>>}
   */
  async loadCharacters() {
    try {
      const charactersPath = path.join(this.narrativesPath, 'characters.json');
      const charactersData = await this._readJSON(charactersPath);

      const charactersMap = new Map();

      for (const charData of charactersData.characters) {
        const character = new Character({
          id: charData.id,
          name: charData.name,
          portraits: charData.portraits,
          talkSound: charData.talkSound,
          metadata: charData.metadata || {}
        });

        charactersMap.set(character.id, character);
      }

      return charactersMap;

    } catch (error) {
      throw new Error(`Failed to load characters: ${error.message}`);
    }
  }

  /**
   * Sauvegarde l'état de progression
   * @param {NarrativeState|Object} state - État (instance ou objet plain)
   * @returns {Promise<void>}
   */
  async saveProgress(state) {
    try {
      // Accepte à la fois un NarrativeState ou un objet plain
      const json = state.toJSON ? state.toJSON() : state;
      await this._writeJSON(this.progressFilePath, json);
    } catch (error) {
      throw new Error(`Failed to save progress: ${error.message}`);
    }
  }

  /**
   * Charge l'état de progression sauvegardé
   * @returns {Promise<NarrativeState|null>}
   */
  async loadProgress() {
    try {
      const exists = await this._fileExists(this.progressFilePath);
      if (!exists) {
        return null;
      }

      const progressData = await this._readJSON(this.progressFilePath);
      return NarrativeState.fromJSON(progressData);

    } catch (error) {
      console.warn(`Failed to load progress: ${error.message}`);
      return null;
    }
  }

  /**
   * Vérifie si un fichier média existe
   * @param {string} mediaPath - Chemin relatif
   * @returns {Promise<boolean>}
   */
  async mediaExists(mediaPath) {
    const fullPath = path.join(this.narrativesPath, mediaPath);
    return this._fileExists(fullPath);
  }

  /**
   * Obtient le chemin absolu d'un média
   * @param {string} mediaPath - Chemin relatif
   * @returns {string}
   */
  getMediaPath(mediaPath) {
    return path.join(this.narrativesPath, mediaPath);
  }

  // === MÉTHODES PRIVÉES DE PARSING ===

  /**
   * Parse une scène depuis les données JSON
   * @private
   * @param {Object} sceneData - Données brutes de la scène
   * @returns {Scene}
   */
  _parseScene(sceneData) {
    const config = {
      id: sceneData.id,
      type: sceneData.type,
      background: sceneData.background
    };

    // Parse selon le type de scène
    switch (sceneData.type) {
      case 'dialogue':
        config.dialogues = sceneData.dialogues.map(d =>
          this._parseDialogueLine(d)
        );
        break;

      case 'cinematic':
        config.video = sceneData.video;
        break;

      case 'tutorial':
        config.tutorialSteps = sceneData.tutorialSteps;
        break;

      case 'exercise-transition':
        config.exerciseTransition = sceneData.exerciseTransition;
        config.dialogue = sceneData.dialogue;
        config.unlockExercise = sceneData.unlockExercise;
        config.autoLaunchExercise = sceneData.autoLaunchExercise;
        break;
    }

    return new Scene(config);
  }

  /**
   * Parse une ligne de dialogue
   * @private
   * @param {Object} dialogueData - Données brutes du dialogue
   * @returns {DialogueLine}
   */
  _parseDialogueLine(dialogueData) {
    return new DialogueLine({
      character: dialogueData.character,
      text: dialogueData.text,
      portrait: dialogueData.portrait,
      typewriterSpeed: dialogueData.typewriterSpeed,
      audio: dialogueData.audio,
      skippable: dialogueData.skippable,
      autoAdvance: dialogueData.autoAdvance,
      autoAdvanceDelay: dialogueData.autoAdvanceDelay
    });
  }

  // === MÉTHODES UTILITAIRES FICHIERS ===

  /**
   * Lit et parse un fichier JSON
   * @private
   * @param {string} filePath - Chemin absolu
   * @returns {Promise<Object>}
   */
  async _readJSON(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Écrit un objet en JSON
   * @private
   * @param {string} filePath - Chemin absolu
   * @param {Object} data - Données à écrire
   * @returns {Promise<void>}
   */
  async _writeJSON(filePath, data) {
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, content, 'utf8');
  }

  /**
   * Vérifie si un fichier existe
   * @private
   * @param {string} filePath - Chemin absolu
   * @returns {Promise<boolean>}
   */
  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = JSONNarrativeRepository;
