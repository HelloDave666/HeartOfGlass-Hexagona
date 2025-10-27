/**
 * ExerciseLevel.js - Définition d'un niveau d'exercice
 * Chemin: src/core/domain/exercises/base/ExerciseLevel.js
 */

/**
 * @typedef {Object} ExerciseLevelConfig
 * @property {number} [number] - Numéro du niveau
 * @property {string} [name] - Nom du niveau
 * @property {string} [description] - Description du niveau
 * @property {Object.<string, *>} [requirements] - Exigences du niveau
 * @property {SuccessCriteria} [successCriteria] - Critères de succès
 * @property {StarThresholds} [starThresholds] - Seuils pour les étoiles
 * @property {Rewards} [rewards] - Récompenses du niveau
 */

/**
 * @typedef {Object} SuccessCriteria
 * @property {number} minScore - Score minimum requis
 * @property {number} minAccuracy - Précision minimum requise
 */

/**
 * @typedef {Object} StarThresholds
 * @property {number} bronze - Seuil pour étoile bronze
 * @property {number} silver - Seuil pour étoile argent
 * @property {number} gold - Seuil pour étoile or
 */

/**
 * @typedef {Object} Rewards
 * @property {number} xp - Points d'expérience gagnés
 * @property {number} gems - Gemmes gagnées
 */

/**
 * Représente un niveau d'exercice
 */
class ExerciseLevel {
    /**
     * @param {ExerciseLevelConfig} [config={}] - Configuration du niveau
     */
    constructor(config = {}) {
        /** @type {number} */
        this.number = config.number || 1;
        
        /** @type {string} */
        this.name = config.name || `Niveau ${this.number}`;
        
        /** @type {string} */
        this.description = config.description || '';
        
        /** @type {Object.<string, *>} */
        this.requirements = config.requirements || {};
        
        /** @type {SuccessCriteria} */
        this.successCriteria = config.successCriteria || {
            minScore: 80,
            minAccuracy: 0.9
        };
        
        /** @type {StarThresholds} */
        this.starThresholds = config.starThresholds || {
            bronze: 60,
            silver: 80,
            gold: 95
        };
        
        /** @type {Rewards} */
        this.rewards = config.rewards || {
            xp: 100,
            gems: 0
        };
    }

    /**
     * Calcule le nombre d'étoiles en fonction du score
     * @param {number} score - Score obtenu
     * @returns {number} - Nombre d'étoiles (0-3)
     */
    calculateStars(score) {
        if (score >= this.starThresholds.gold) return 3;
        if (score >= this.starThresholds.silver) return 2;
        if (score >= this.starThresholds.bronze) return 1;
        return 0;
    }

    /**
     * Vérifie si les statistiques correspondent à un succès
     * @param {Object} stats - Statistiques de l'exercice
     * @returns {boolean} - True si succès
     */
    isSuccess(stats) {
        return stats.score >= this.successCriteria.minScore;
    }
}

// Export pour Node.js ET browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExerciseLevel;
} else if (typeof window !== 'undefined') {
    window.ExerciseLevel = ExerciseLevel;
}