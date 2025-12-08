/**
 * Chapter - Entité représentant un chapitre narratif
 *
 * Un chapitre contient plusieurs scènes et peut avoir une condition
 * de déblocage (ex: exercice complété).
 *
 * Architecture : Core/Domain/Entities
 */
class Chapter {
  /**
   * @param {Object} config - Configuration du chapitre
   * @param {string} config.id - ID unique du chapitre
   * @param {string} config.title - Titre du chapitre
   * @param {Scene[]} config.scenes - Scènes du chapitre
   * @param {Object} config.unlockCondition - Condition de déblocage (optionnel)
   * @param {Object} config.metadata - Métadonnées additionnelles (optionnel)
   */
  constructor(config) {
    // Validation
    if (!config.id) {
      throw new Error('Chapter requires an ID');
    }
    if (!config.title) {
      throw new Error('Chapter requires a title');
    }
    if (!config.scenes || config.scenes.length === 0) {
      throw new Error('Chapter requires at least one scene');
    }

    // Données principales
    this.id = config.id;
    this.title = config.title;
    this.scenes = config.scenes;
    this.unlockCondition = this._parseUnlockCondition(config.unlockCondition);
    this.metadata = config.metadata || {};

    // État du chapitre
    this.state = {
      isUnlocked: this.unlockCondition === null, // Auto-unlock si pas de condition
      isActive: false,
      isComplete: false,
      currentSceneIndex: 0,
      startTime: null,
      completionTime: null,
      playCount: 0
    };
  }

  /**
   * Parse la condition de déblocage
   * @private
   * @param {Object|string|null} unlockCondition - Condition brute
   * @returns {Object|null} Condition parsée
   */
  _parseUnlockCondition(unlockCondition) {
    if (!unlockCondition || unlockCondition === 'none') {
      return null;
    }

    // Si c'est déjà un objet structuré
    if (typeof unlockCondition === 'object') {
      const condition = {
        type: unlockCondition.type || 'exercise_completed',
        exerciseId: unlockCondition.exerciseId || null,
        requiredScore: unlockCondition.requiredScore || null,
        metadata: unlockCondition.metadata || {}
      };

      // Validation selon le type
      if (condition.type === 'exercise_completed' && !condition.exerciseId) {
        throw new Error('Unlock condition of type "exercise_completed" requires exerciseId');
      }

      return condition;
    }

    // Si c'est un string (ID d'exercice directement)
    if (typeof unlockCondition === 'string') {
      return {
        type: 'exercise_completed',
        exerciseId: unlockCondition,
        requiredScore: null
      };
    }

    return null;
  }

  /**
   * Débloque le chapitre
   */
  unlock() {
    this.state.isUnlocked = true;
  }

  /**
   * Vérifie si le chapitre est débloqué
   * @returns {boolean}
   */
  isUnlocked() {
    return this.state.isUnlocked;
  }

  /**
   * Démarre le chapitre
   * @returns {boolean} True si démarré avec succès
   */
  start() {
    if (!this.state.isUnlocked) {
      throw new Error(`Cannot start locked chapter: ${this.id}`);
    }

    if (this.state.isActive) {
      return false;
    }

    this.state.isActive = true;
    this.state.isComplete = false;
    this.state.currentSceneIndex = 0;
    this.state.startTime = Date.now();
    this.state.playCount++;

    // Démarre la première scène
    const firstScene = this.getCurrentScene();
    if (firstScene && firstScene.start) {
      firstScene.start();
    }

    return true;
  }

  /**
   * Obtient la scène actuelle
   * @returns {Scene|null}
   */
  getCurrentScene() {
    return this.scenes[this.state.currentSceneIndex] || null;
  }

  /**
   * Avance à la scène suivante
   * @returns {boolean} True si il y a une scène suivante, false si chapitre terminé
   */
  advanceScene() {
    // Complète la scène actuelle
    const currentScene = this.getCurrentScene();
    if (currentScene && !currentScene.isCompleted()) {
      currentScene.complete();
    }

    // Avance à la suivante
    this.state.currentSceneIndex++;

    // Vérifie si le chapitre est terminé
    if (this.state.currentSceneIndex >= this.scenes.length) {
      this.complete();
      return false;
    }

    // Démarre la nouvelle scène
    const nextScene = this.getCurrentScene();
    if (nextScene && nextScene.start) {
      nextScene.start();
    }

    return true;
  }

  /**
   * Termine le chapitre
   */
  complete() {
    this.state.isActive = false;
    this.state.isComplete = true;
    this.state.completionTime = Date.now();
  }

  /**
   * Vérifie si le chapitre est terminé
   * @returns {boolean}
   */
  isCompleted() {
    return this.state.isComplete;
  }

  /**
   * Obtient le nombre total de scènes
   * @returns {number}
   */
  getTotalScenes() {
    return this.scenes.length;
  }

  /**
   * Obtient le pourcentage de progression du chapitre
   * @returns {number} Progression entre 0 et 100
   */
  getProgress() {
    if (!this.state.isActive) {
      return this.state.isComplete ? 100 : 0;
    }

    return Math.floor((this.state.currentSceneIndex / this.scenes.length) * 100);
  }

  /**
   * Obtient le temps écoulé depuis le début du chapitre
   * @returns {number} Temps en ms
   */
  getElapsedTime() {
    if (!this.state.startTime) {
      return 0;
    }

    const endTime = this.state.completionTime || Date.now();
    return endTime - this.state.startTime;
  }

  /**
   * Réinitialise le chapitre pour un nouveau playthrough
   */
  reset() {
    this.state.isActive = false;
    this.state.isComplete = false;
    this.state.currentSceneIndex = 0;
    this.state.startTime = null;
    this.state.completionTime = null;

    // Reset toutes les scènes
    this.scenes.forEach(scene => {
      if (scene.reset) {
        scene.reset();
      }
    });
  }

  /**
   * Trouve une scène par ID
   * @param {string} sceneId - ID de la scène
   * @returns {Scene|null}
   */
  findSceneById(sceneId) {
    return this.scenes.find(scene => scene.id === sceneId) || null;
  }
}

module.exports = Chapter;
