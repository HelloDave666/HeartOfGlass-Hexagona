/**
 * NarrativeState - Value Object représentant l'état de la narrative
 *
 * Objet immuable contenant l'état complet de progression narrative.
 * Utilisé pour sérialisation/désérialisation et sauvegarde.
 *
 * Architecture : Core/Domain/ValueObjects
 */
class NarrativeState {
  /**
   * @param {Object} config - État de la narrative
   * @param {string} config.narrativeId - ID de la narrative
   * @param {string} config.currentChapterId - ID du chapitre actuel
   * @param {string} config.currentSceneId - ID de la scène actuelle
   * @param {string[]} config.completedChapterIds - IDs des chapitres complétés
   * @param {string[]} config.unlockedChapterIds - IDs des chapitres débloqués
   * @param {Object} config.exerciseCompletions - État de completion des exercices
   * @param {number} config.lastPlayedTime - Timestamp dernière session
   * @param {number} config.totalPlayTime - Temps de jeu total (ms)
   * @param {string} config.version - Version de la narrative
   */
  constructor(config = {}) {
    this.narrativeId = config.narrativeId || null;
    this.currentChapterId = config.currentChapterId || null;
    this.currentSceneId = config.currentSceneId || null;
    this.completedChapterIds = config.completedChapterIds || [];
    this.unlockedChapterIds = config.unlockedChapterIds || [];
    this.exerciseCompletions = config.exerciseCompletions || {};
    this.lastPlayedTime = config.lastPlayedTime || null;
    this.totalPlayTime = config.totalPlayTime || 0;
    this.version = config.version || '1.0.0';

    // Rendre immuable
    Object.freeze(this);
  }

  /**
   * Crée un nouvel état avec des modifications
   * @param {Object} updates - Propriétés à modifier
   * @returns {NarrativeState} Nouvel état
   */
  update(updates) {
    return new NarrativeState({
      narrativeId: updates.narrativeId !== undefined ? updates.narrativeId : this.narrativeId,
      currentChapterId: updates.currentChapterId !== undefined ? updates.currentChapterId : this.currentChapterId,
      currentSceneId: updates.currentSceneId !== undefined ? updates.currentSceneId : this.currentSceneId,
      completedChapterIds: updates.completedChapterIds !== undefined ? updates.completedChapterIds : [...this.completedChapterIds],
      unlockedChapterIds: updates.unlockedChapterIds !== undefined ? updates.unlockedChapterIds : [...this.unlockedChapterIds],
      exerciseCompletions: updates.exerciseCompletions !== undefined ? updates.exerciseCompletions : { ...this.exerciseCompletions },
      lastPlayedTime: updates.lastPlayedTime !== undefined ? updates.lastPlayedTime : this.lastPlayedTime,
      totalPlayTime: updates.totalPlayTime !== undefined ? updates.totalPlayTime : this.totalPlayTime,
      version: updates.version !== undefined ? updates.version : this.version
    });
  }

  /**
   * Marque un chapitre comme complété
   * @param {string} chapterId - ID du chapitre
   * @returns {NarrativeState} Nouvel état
   */
  completeChapter(chapterId) {
    if (this.completedChapterIds.includes(chapterId)) {
      return this; // Déjà complété
    }

    return this.update({
      completedChapterIds: [...this.completedChapterIds, chapterId]
    });
  }

  /**
   * Débloque un chapitre
   * @param {string} chapterId - ID du chapitre
   * @returns {NarrativeState} Nouvel état
   */
  unlockChapter(chapterId) {
    if (this.unlockedChapterIds.includes(chapterId)) {
      return this; // Déjà débloqué
    }

    return this.update({
      unlockedChapterIds: [...this.unlockedChapterIds, chapterId]
    });
  }

  /**
   * Marque un exercice comme complété
   * @param {string} exerciseId - ID de l'exercice
   * @param {Object} metadata - Métadonnées (score, date, etc.)
   * @returns {NarrativeState} Nouvel état
   */
  completeExercise(exerciseId, metadata = {}) {
    const completions = { ...this.exerciseCompletions };

    if (!completions[exerciseId]) {
      completions[exerciseId] = {
        firstCompletedAt: Date.now(),
        completions: []
      };
    }

    completions[exerciseId].completions.push({
      timestamp: Date.now(),
      ...metadata
    });

    return this.update({
      exerciseCompletions: completions
    });
  }

  /**
   * Vérifie si un chapitre est débloqué
   * @param {string} chapterId - ID du chapitre
   * @returns {boolean}
   */
  isChapterUnlocked(chapterId) {
    return this.unlockedChapterIds.includes(chapterId);
  }

  /**
   * Vérifie si un chapitre est complété
   * @param {string} chapterId - ID du chapitre
   * @returns {boolean}
   */
  isChapterCompleted(chapterId) {
    return this.completedChapterIds.includes(chapterId);
  }

  /**
   * Vérifie si un exercice a été complété au moins une fois
   * @param {string} exerciseId - ID de l'exercice
   * @returns {boolean}
   */
  isExerciseCompleted(exerciseId) {
    return !!this.exerciseCompletions[exerciseId];
  }

  /**
   * Obtient le nombre de fois qu'un exercice a été complété
   * @param {string} exerciseId - ID de l'exercice
   * @returns {number}
   */
  getExerciseCompletionCount(exerciseId) {
    return this.exerciseCompletions[exerciseId]?.completions.length || 0;
  }

  /**
   * Sérialise l'état pour sauvegarde
   * @returns {Object}
   */
  toJSON() {
    return {
      narrativeId: this.narrativeId,
      currentChapterId: this.currentChapterId,
      currentSceneId: this.currentSceneId,
      completedChapterIds: this.completedChapterIds,
      unlockedChapterIds: this.unlockedChapterIds,
      exerciseCompletions: this.exerciseCompletions,
      lastPlayedTime: this.lastPlayedTime,
      totalPlayTime: this.totalPlayTime,
      version: this.version
    };
  }

  /**
   * Désérialise un état sauvegardé
   * @param {Object} json - État sérialisé
   * @returns {NarrativeState}
   */
  static fromJSON(json) {
    return new NarrativeState(json);
  }

  /**
   * Crée un état initial vide
   * @param {string} narrativeId - ID de la narrative
   * @param {string} version - Version
   * @returns {NarrativeState}
   */
  static createInitial(narrativeId, version = '1.0.0') {
    return new NarrativeState({
      narrativeId,
      currentChapterId: null,
      currentSceneId: null,
      completedChapterIds: [],
      unlockedChapterIds: [],
      exerciseCompletions: {},
      lastPlayedTime: null,
      totalPlayTime: 0,
      version
    });
  }
}

module.exports = NarrativeState;
