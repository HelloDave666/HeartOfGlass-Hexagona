/**
 * Narrative - Entité représentant l'histoire narrative complète
 *
 * Conteneur principal de toute l'histoire. Contient tous les chapitres,
 * gère la progression globale et les personnages.
 *
 * Architecture : Core/Domain/Entities
 */
class Narrative {
  /**
   * @param {Object} config - Configuration de la narrative
   * @param {string} config.id - ID unique de la narrative
   * @param {string} config.title - Titre de l'histoire
   * @param {string} config.version - Version de la narrative
   * @param {Chapter[]} config.chapters - Chapitres de l'histoire
   * @param {Map<string, Character>} config.characters - Personnages (par ID)
   * @param {Object} config.metadata - Métadonnées additionnelles
   */
  constructor(config) {
    // Validation
    if (!config.id) {
      throw new Error('Narrative requires an ID');
    }
    if (!config.title) {
      throw new Error('Narrative requires a title');
    }
    if (!config.chapters || config.chapters.length === 0) {
      throw new Error('Narrative requires at least one chapter');
    }
    if (!config.characters || config.characters.size === 0) {
      throw new Error('Narrative requires at least one character');
    }

    // Données principales
    this.id = config.id;
    this.title = config.title;
    this.version = config.version || '1.0.0';
    this.chapters = config.chapters;
    this.characters = config.characters; // Map<id, Character>
    this.metadata = config.metadata || {};

    // État de la narrative
    this.state = {
      isActive: false,
      currentChapterId: null,
      completedChapterIds: [],
      unlockedChapterIds: this._getInitialUnlockedChapters(),
      startTime: null,
      lastPlayedTime: null,
      totalPlayTime: 0
    };
  }

  /**
   * Obtient les chapitres débloqués initialement (sans condition)
   * @private
   * @returns {string[]}
   */
  _getInitialUnlockedChapters() {
    return this.chapters
      .filter(chapter => chapter.unlockCondition === null || !chapter.unlockCondition)
      .map(chapter => chapter.id);
  }

  /**
   * Démarre la narrative
   * @param {string} chapterId - ID du chapitre à démarrer (optionnel, premier par défaut)
   * @returns {boolean}
   */
  start(chapterId = null) {
    const targetChapterId = chapterId || this.chapters[0]?.id;

    if (!targetChapterId) {
      throw new Error('No chapter to start');
    }

    const chapter = this.findChapterById(targetChapterId);
    if (!chapter) {
      throw new Error(`Chapter not found: ${targetChapterId}`);
    }

    if (!chapter.isUnlocked()) {
      throw new Error(`Cannot start locked chapter: ${targetChapterId}`);
    }

    this.state.isActive = true;
    this.state.currentChapterId = targetChapterId;
    this.state.startTime = Date.now();
    this.state.lastPlayedTime = Date.now();

    chapter.start();

    return true;
  }

  /**
   * Arrête la narrative
   */
  stop() {
    if (this.state.isActive && this.state.startTime) {
      const sessionTime = Date.now() - this.state.startTime;
      this.state.totalPlayTime += sessionTime;
    }

    this.state.isActive = false;
    this.state.lastPlayedTime = Date.now();

    // Arrête le chapitre actuel
    const currentChapter = this.getCurrentChapter();
    if (currentChapter && currentChapter.state.isActive) {
      const currentScene = currentChapter.getCurrentScene();
      if (currentScene && currentScene.state.isActive) {
        currentScene.complete();
      }
    }
  }

  /**
   * Obtient le chapitre actuel
   * @returns {Chapter|null}
   */
  getCurrentChapter() {
    if (!this.state.currentChapterId) {
      return null;
    }
    return this.findChapterById(this.state.currentChapterId);
  }

  /**
   * Obtient la scène actuelle
   * @returns {Scene|null}
   */
  getCurrentScene() {
    const chapter = this.getCurrentChapter();
    return chapter ? chapter.getCurrentScene() : null;
  }

  /**
   * Avance au chapitre suivant
   * @returns {boolean} True si il y a un chapitre suivant
   */
  advanceChapter() {
    const currentChapter = this.getCurrentChapter();
    if (currentChapter) {
      currentChapter.complete();

      // Marque comme complété
      if (!this.state.completedChapterIds.includes(currentChapter.id)) {
        this.state.completedChapterIds.push(currentChapter.id);
      }
    }

    // Trouve le prochain chapitre débloqué
    const currentIndex = this.chapters.findIndex(ch => ch.id === this.state.currentChapterId);

    for (let i = currentIndex + 1; i < this.chapters.length; i++) {
      const nextChapter = this.chapters[i];

      if (nextChapter.isUnlocked()) {
        this.state.currentChapterId = nextChapter.id;
        nextChapter.start();
        return true;
      }
    }

    // Aucun chapitre suivant débloqué
    this.stop();
    return false;
  }

  /**
   * Débloque un chapitre
   * @param {string} chapterId - ID du chapitre à débloquer
   * @returns {boolean} True si débloqué avec succès
   */
  unlockChapter(chapterId) {
    const chapter = this.findChapterById(chapterId);
    if (!chapter) {
      return false;
    }

    chapter.unlock();

    if (!this.state.unlockedChapterIds.includes(chapterId)) {
      this.state.unlockedChapterIds.push(chapterId);
    }

    return true;
  }

  /**
   * Vérifie si un chapitre est débloqué
   * @param {string} chapterId - ID du chapitre
   * @returns {boolean}
   */
  isChapterUnlocked(chapterId) {
    const chapter = this.findChapterById(chapterId);
    return chapter ? chapter.isUnlocked() : false;
  }

  /**
   * Obtient un personnage par ID
   * @param {string} characterId - ID du personnage
   * @returns {Character|null}
   */
  getCharacter(characterId) {
    return this.characters.get(characterId) || null;
  }

  /**
   * Trouve un chapitre par ID
   * @param {string} chapterId - ID du chapitre
   * @returns {Chapter|null}
   */
  findChapterById(chapterId) {
    return this.chapters.find(ch => ch.id === chapterId) || null;
  }

  /**
   * Obtient tous les chapitres débloqués
   * @returns {Chapter[]}
   */
  getUnlockedChapters() {
    return this.chapters.filter(ch => ch.isUnlocked());
  }

  /**
   * Obtient tous les chapitres complétés
   * @returns {Chapter[]}
   */
  getCompletedChapters() {
    return this.chapters.filter(ch =>
      this.state.completedChapterIds.includes(ch.id)
    );
  }

  /**
   * Obtient le pourcentage de progression globale
   * @returns {number} Progression entre 0 et 100
   */
  getOverallProgress() {
    const completedCount = this.state.completedChapterIds.length;
    const totalCount = this.chapters.length;
    return Math.floor((completedCount / totalCount) * 100);
  }

  /**
   * Vérifie si toute l'histoire est terminée
   * @returns {boolean}
   */
  isComplete() {
    return this.state.completedChapterIds.length === this.chapters.length;
  }

  /**
   * Exporte l'état de progression pour sauvegarde
   * @returns {Object}
   */
  exportState() {
    return {
      currentChapterId: this.state.currentChapterId,
      completedChapterIds: [...this.state.completedChapterIds],
      unlockedChapterIds: [...this.state.unlockedChapterIds],
      lastPlayedTime: this.state.lastPlayedTime,
      totalPlayTime: this.state.totalPlayTime,
      version: this.version
    };
  }

  /**
   * Importe un état de progression sauvegardé
   * @param {Object} savedState - État sauvegardé
   */
  importState(savedState) {
    if (savedState.version !== this.version) {
      console.warn(`Version mismatch: save is ${savedState.version}, narrative is ${this.version}`);
    }

    this.state.currentChapterId = savedState.currentChapterId || null;
    this.state.completedChapterIds = savedState.completedChapterIds || [];
    this.state.unlockedChapterIds = savedState.unlockedChapterIds || this._getInitialUnlockedChapters();
    this.state.lastPlayedTime = savedState.lastPlayedTime || null;
    this.state.totalPlayTime = savedState.totalPlayTime || 0;

    // Applique les déblocages aux chapitres
    this.state.unlockedChapterIds.forEach(chapterId => {
      const chapter = this.findChapterById(chapterId);
      if (chapter) {
        chapter.unlock();
      }
    });
  }
}

module.exports = Narrative;
