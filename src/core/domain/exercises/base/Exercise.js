/**
 * Exercise.js - Classe abstraite de base
 * Chemin: src/core/domain/exercises/base/Exercise.js
 */

/**
 * @typedef {Object} ExerciseConfig
 * @property {string} [name] - Nom de l'exercice
 * @property {string} [description] - Description de l'exercice
 * @property {string} [craft] - Type de métier (glass, wood, etc.)
 * @property {Array<*>} [levels] - Niveaux de l'exercice
 */

/**
 * @typedef {Object} SensorData
 * @property {{x: number, y: number, z: number}} gyro - Données gyroscope
 * @property {{x: number, y: number, z: number}} [accel] - Données accéléromètre
 */

/**
 * @typedef {Object} ExerciseStats
 * @property {string} exerciseId - ID de l'exercice
 * @property {number} level - Niveau actuel
 * @property {number} score - Score actuel
 * @property {number} duration - Durée en millisecondes
 * @property {boolean} completed - Exercice complété
 */

/**
 * Classe abstraite de base pour tous les exercices
 * @abstract
 */
class Exercise {
    /**
     * @param {string} id - Identifiant unique de l'exercice
     * @param {ExerciseConfig} [config={}] - Configuration de l'exercice
     */
    constructor(id, config = {}) {
        if (new.target === Exercise) {
            throw new Error('Exercise est une classe abstraite');
        }

        /** @type {string} */
        this.id = id;
        
        /** @type {string} */
        this.name = config.name || '';
        
        /** @type {string} */
        this.description = config.description || '';
        
        /** @type {string} */
        this.craft = config.craft || 'generic';
        
        /** @type {Array<*>} */
        this.levels = config.levels || [];
        
        /** @type {number} */
        this.currentLevel = 0;
        
        /** @type {boolean} */
        this.isActive = false;
        
        /** @type {number|null} */
        this.startTime = null;
        
        /** @type {number} */
        this.score = 0;
    }

    /**
     * Démarre l'exercice à un niveau donné
     * @param {number} [levelIndex=0] - Index du niveau à démarrer
     * @returns {void}
     */
    start(levelIndex = 0) {
        this.currentLevel = levelIndex;
        this.isActive = true;
        this.startTime = Date.now();
        this.score = 0;
        this.onStart();
    }

    /**
     * Arrête l'exercice
     * @returns {void}
     */
    stop() {
        this.isActive = false;
        this.onStop();
    }

    /**
     * Réinitialise l'exercice
     * @returns {void}
     */
    reset() {
        this.isActive = false;
        this.startTime = null;
        this.score = 0;
        this.onReset();
    }

    /**
     * Met à jour l'exercice avec les données des capteurs
     * @abstract
     * @param {SensorData} sensorData - Données des capteurs
     * @returns {*} - Résultat de la mise à jour
     * @throws {Error} Si la méthode n'est pas implémentée
     */
    update(sensorData) {
        throw new Error('La méthode update() doit être implémentée');
    }

    /**
     * Vérifie si l'exercice est complété
     * @abstract
     * @returns {boolean}
     * @throws {Error} Si la méthode n'est pas implémentée
     */
    isCompleted() {
        throw new Error('La méthode isCompleted() doit être implémentée');
    }

    /**
     * Récupère le niveau actuel
     * @returns {*|null} - Le niveau actuel ou null
     */
    getCurrentLevel() {
        return this.levels[this.currentLevel] || null;
    }

    /**
     * Récupère les statistiques de l'exercice
     * @returns {ExerciseStats} - Statistiques complètes
     */
    getStats() {
        const duration = this.startTime ? Date.now() - this.startTime : 0;
        return {
            exerciseId: this.id,
            level: this.currentLevel,
            score: this.score,
            duration: duration,
            completed: this.isCompleted()
        };
    }

    /**
     * Hook appelé au démarrage
     * @returns {void}
     */
    onStart() {}
    
    /**
     * Hook appelé à l'arrêt
     * @returns {void}
     */
    onStop() {}
    
    /**
     * Hook appelé à la réinitialisation
     * @returns {void}
     */
    onReset() {}
}

// Export pour Node.js ET browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Exercise;
} else if (typeof window !== 'undefined') {
    window.Exercise = Exercise;
}