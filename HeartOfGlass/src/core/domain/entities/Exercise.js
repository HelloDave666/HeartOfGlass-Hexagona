/**
 * Exercise - Classe abstraite de base pour tous les exercices
 *
 * Définit le contrat commun que tous les exercices doivent respecter.
 * Cette classe ne doit pas être instanciée directement.
 *
 * Architecture : Core/Domain/Entities
 *
 * @abstract
 */
class Exercise {
  /**
   * Constructeur de la classe Exercise
   * @param {Object} config - Configuration de l'exercice
   * @param {string} config.name - Nom de l'exercice
   * @param {number} config.duration - Durée de l'exercice en ms
   */
  constructor(config) {
    if (new.target === Exercise) {
      throw new Error('Exercise est une classe abstraite et ne peut pas être instanciée directement');
    }

    this.name = config.name || 'Exercise';
    this.duration = config.duration || 300000; // 5 minutes par défaut

    // État de l'exercice
    this.isActive = false;
    this.startTime = null;
    this.updateCount = 0;
  }

  /**
   * Démarre l'exercice
   * @abstract
   * @throws {Error} Si la méthode n'est pas implémentée
   */
  start() {
    throw new Error('La méthode start() doit être implémentée par la classe dérivée');
  }

  /**
   * Arrête l'exercice
   * @abstract
   * @throws {Error} Si la méthode n'est pas implémentée
   */
  stop() {
    throw new Error('La méthode stop() doit être implémentée par la classe dérivée');
  }

  /**
   * Met à jour l'exercice avec les données des capteurs
   * @abstract
   * @param {Object} sensorData - Données des capteurs
   * @param {*} position - Position actuelle dans l'audio (optionnel, type variable selon l'exercice)
   * @throws {Error} Si la méthode n'est pas implémentée
   */
  update(sensorData, position) {
    throw new Error('La méthode update() doit être implémentée par la classe dérivée');
  }

  /**
   * Récupère les statistiques de l'exercice
   * @abstract
   * @returns {Object} Statistiques de l'exercice
   * @throws {Error} Si la méthode n'est pas implémentée
   */
  getStats() {
    throw new Error('La méthode getStats() doit être implémentée par la classe dérivée');
  }

  /**
   * Vérifie si l'exercice est terminé
   * @returns {boolean} True si l'exercice est terminé
   */
  isCompleted() {
    if (!this.isActive || !this.startTime) {
      return false;
    }

    const elapsed = Date.now() - this.startTime;
    return elapsed >= this.duration;
  }

  /**
   * Obtient le temps écoulé depuis le début de l'exercice
   * @returns {number} Temps écoulé en ms (0 si pas démarré)
   */
  getElapsedTime() {
    if (!this.isActive || !this.startTime) {
      return 0;
    }

    return Date.now() - this.startTime;
  }

  /**
   * Obtient le temps restant avant la fin de l'exercice
   * @returns {number} Temps restant en ms (0 si terminé ou pas démarré)
   */
  getRemainingTime() {
    const elapsed = this.getElapsedTime();
    const remaining = this.duration - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Obtient le pourcentage de progression de l'exercice
   * @returns {number} Progression entre 0 et 100
   */
  getProgress() {
    if (!this.isActive || !this.startTime) {
      return 0;
    }

    const elapsed = this.getElapsedTime();
    const progress = (elapsed / this.duration) * 100;
    return Math.min(100, Math.max(0, progress));
  }
}

module.exports = Exercise;
