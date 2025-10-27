// @ts-nocheck
/**
 * HeartOfFrostExercise.js - Exercice de rotation régulière
 * Chemin: src/core/domain/exercises/glass/HeartOfFrostExercise.js
 */

/**
 * @typedef {Object} ExerciseFeedback
 * @property {'success'|'warning'|'error'|'info'} type - Type de feedback
 * @property {string} message - Message de feedback
 * @property {string} color - Couleur du feedback (hex)
 */

/**
 * @typedef {Object} ExerciseUpdateResult
 * @property {number} playbackRate - Vitesse de lecture audio (0.1-2.0)
 * @property {number} volume - Volume audio (0-1)
 * @property {number} regularityScore - Score de régularité (0-100)
 * @property {number} rotationCount - Nombre de rotations effectuées
 * @property {number} targetRotations - Nombre de rotations cibles
 * @property {number} accuracy - Précision (0-1)
 * @property {ExerciseFeedback} feedback - Feedback visuel
 * @property {boolean} isCompleted - Exercice complété
 */

/**
 * Exercice "Cœur de givre" - Rotation régulière sur l'axe Y
 * @extends Exercise
 */
class HeartOfFrostExercise extends Exercise {
    constructor() {
        super('heart-of-frost', {
            name: 'Cœur de givre',
            description: 'Apprends la rotation parfaite sur l\'axe Y',
            craft: 'glass',
            levels: HeartOfFrostExercise.createLevels()
        });

        // Paramètres de l'exercice
        /** @type {number} */
        this.targetRPM = 60;                    // 1 rotation/seconde
        
        /** @type {number} */
        this.targetDegreesPerSec = 360;         // 360°/sec
        
        /** @type {number} */
        this.tolerance = 0.10;                  // ±10%
        
        /** @type {number} */
        this.smoothingFactor = 0.3;
        
        // État
        /** @type {number} */
        this.currentAngularVelocity = 0;
        
        /** @type {number} */
        this.smoothedVelocity = 0;
        
        /** @type {number} */
        this.rotationCount = 0;
        
        /** @type {number} */
        this.regularityScore = 100;
        
        /** @type {number} */
        this.totalSamples = 0;
        
        /** @type {number} */
        this.accurateSamples = 0;
    }

    /**
     * Crée les niveaux de l'exercice
     * @returns {Array<*>} - Tableau des niveaux
     * @static
     */
    static createLevels() {
        return [
            new ExerciseLevel({
                number: 1,
                name: 'Découverte',
                description: '10 rotations régulières',
                requirements: {
                    targetRotations: 10,
                    targetRPM: 60,
                    tolerance: 0.10
                },
                successCriteria: { minScore: 70, minAccuracy: 0.8 },
                rewards: { xp: 100, gems: 0 }
            }),
            new ExerciseLevel({
                number: 2,
                name: 'Pratique',
                description: '15 rotations régulières',
                requirements: {
                    targetRotations: 15,
                    targetRPM: 60,
                    tolerance: 0.10
                },
                successCriteria: { minScore: 75, minAccuracy: 0.85 },
                rewards: { xp: 150, gems: 1 }
            })
        ];
    }

    /**
     * Hook de démarrage
     * @returns {void}
     */
    onStart() {
        this.resetMetrics();
    }

    /**
     * Hook d'arrêt
     * @returns {void}
     */
    onStop() {
        this.score = this.calculateFinalScore();
    }

    /**
     * Hook de réinitialisation
     * @returns {void}
     */
    onReset() {
        this.resetMetrics();
    }

    /**
     * Réinitialise toutes les métriques
     * @returns {void}
     */
    resetMetrics() {
        this.currentAngularVelocity = 0;
        this.smoothedVelocity = 0;
        this.rotationCount = 0;
        this.regularityScore = 100;
        this.totalSamples = 0;
        this.accurateSamples = 0;
    }

    /**
     * Mise à jour avec données capteur
     * @param {Object} sensorData - Données des capteurs
     * @param {{x: number, y: number, z: number}} sensorData.gyro - Données gyroscope
     * @returns {ExerciseUpdateResult} - Résultat de la mise à jour
     */
    update(sensorData) {
        if (!this.isActive) {
            return this.getInactiveState();
        }

        const level = this.getCurrentLevel();
        if (!level) {
            throw new Error('Aucun niveau actif');
        }

        // 1. Extraire vitesse angulaire Y
        const angularVelocityY = sensorData.gyro.y;
        
        // 2. Lisser
        this.currentAngularVelocity = angularVelocityY;
        this.smoothedVelocity = this.smoothedVelocity * (1 - this.smoothingFactor) 
                              + angularVelocityY * this.smoothingFactor;
        
        // 3. Calculer ratio
        const velocityRatio = this.smoothedVelocity / this.targetDegreesPerSec;
        
        // 4. Vérifier précision
        const isAccurate = this.isVelocityAccurate(velocityRatio, level.requirements.tolerance);
        
        // 5. Mettre à jour métriques
        this.totalSamples++;
        if (isAccurate) {
            this.accurateSamples++;
        }
        
        // 6. Score de régularité
        this.updateRegularityScore(velocityRatio, level.requirements.tolerance);
        
        // 7. Compter rotations (simplifié)
        this.updateRotationCount(this.smoothedVelocity);
        
        // 8. Calculer playback rate
        const playbackRate = this.calculatePlaybackRate(velocityRatio);
        
        // 9. Volume selon régularité
        const volume = this.calculateVolume();
        
        // 10. Feedback
        const feedback = this.getFeedback(velocityRatio, level.requirements.tolerance);
        
        return {
            playbackRate,
            volume,
            regularityScore: Math.round(this.regularityScore),
            rotationCount: this.rotationCount,
            targetRotations: level.requirements.targetRotations,
            accuracy: this.getAccuracy(),
            feedback,
            isCompleted: this.isCompleted()
        };
    }

    /**
     * Met à jour le compteur de rotations
     * @param {number} angularVelocity - Vitesse angulaire
     * @returns {void}
     */
    updateRotationCount(angularVelocity) {
        // Simplification : on compte approximativement
        // En production, utiliser un intégrateur plus robuste
        if (Math.abs(angularVelocity) > 180 && this.totalSamples % 10 === 0) {
            this.rotationCount++;
        }
    }

    /**
     * Calcule la vitesse de lecture audio
     * @param {number} velocityRatio - Ratio de vitesse
     * @returns {number} - Playback rate (0.1-2.0)
     */
    calculatePlaybackRate(velocityRatio) {
        // Mauvais sens → inversion
        if (velocityRatio < -0.1) {
            return Math.max(-2.0, velocityRatio);
        }
        
        // Mapper vers 0.1 - 2.0
        return Math.max(0.1, Math.min(2.0, Math.abs(velocityRatio)));
    }

    /**
     * Vérifie si la vitesse est dans la tolérance
     * @param {number} velocityRatio - Ratio de vitesse
     * @param {number} tolerance - Tolérance (0-1)
     * @returns {boolean} - True si dans la tolérance
     */
    isVelocityAccurate(velocityRatio, tolerance) {
        const absRatio = Math.abs(velocityRatio);
        return absRatio >= (1.0 - tolerance) && absRatio <= (1.0 + tolerance);
    }

    /**
     * Met à jour le score de régularité
     * @param {number} velocityRatio - Ratio de vitesse
     * @param {number} tolerance - Tolérance
     * @returns {void}
     */
    updateRegularityScore(velocityRatio, tolerance) {
        const absRatio = Math.abs(velocityRatio);
        const deviation = Math.abs(1.0 - absRatio);
        
        if (deviation <= tolerance) {
            this.regularityScore = Math.min(100, this.regularityScore + 0.5);
        } else {
            const penalty = (deviation - tolerance) * 20;
            this.regularityScore = Math.max(0, this.regularityScore - penalty);
        }
    }

    /**
     * Calcule le volume audio en fonction de la régularité
     * @returns {number} - Volume (0-1)
     */
    calculateVolume() {
        return 0.3 + (this.regularityScore / 100) * 0.7;
    }

    /**
     * Génère un feedback visuel
     * @param {number} velocityRatio - Ratio de vitesse
     * @param {number} tolerance - Tolérance
     * @returns {ExerciseFeedback} - Feedback
     */
    getFeedback(velocityRatio, tolerance) {
        const absRatio = Math.abs(velocityRatio);
        
        if (velocityRatio < -0.1) {
            return { 
                type: 'error', 
                message: '⚠️ Sens de rotation inversé !', 
                color: '#e74c3c' 
            };
        }
        
        if (absRatio < (1.0 - tolerance)) {
            return { 
                type: 'warning', 
                message: '🐌 Trop lent', 
                color: '#3498db' 
            };
        }
        
        if (absRatio > (1.0 + tolerance)) {
            return { 
                type: 'warning', 
                message: '🚀 Trop rapide', 
                color: '#f39c12' 
            };
        }
        
        return { 
            type: 'success', 
            message: '✨ Parfait !', 
            color: '#2ecc71' 
        };
    }

    /**
     * Vérifie si l'exercice est complété
     * @returns {boolean} - True si complété
     */
    isCompleted() {
        const level = this.getCurrentLevel();
        if (!level) return false;
        return this.rotationCount >= level.requirements.targetRotations;
    }

    /**
     * Calcule la précision globale
     * @returns {number} - Précision (0-1)
     */
    getAccuracy() {
        if (this.totalSamples === 0) return 0;
        return this.accurateSamples / this.totalSamples;
    }

    /**
     * Calcule le score final
     * @returns {number} - Score (0-100)
     */
    calculateFinalScore() {
        const accuracy = this.getAccuracy();
        return Math.round((this.regularityScore * 0.5) + (accuracy * 100 * 0.5));
    }

    /**
     * Retourne l'état inactif de l'exercice
     * @returns {ExerciseUpdateResult} - État inactif
     */
    getInactiveState() {
        return {
            playbackRate: 1.0,
            volume: 0.7,
            regularityScore: 0,
            rotationCount: 0,
            targetRotations: 0,
            accuracy: 0,
            feedback: { type: 'info', message: 'Prêt à commencer ?', color: '#95a5a6' },
            isCompleted: false
        };
    }
}

// Export pour Node.js ET browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeartOfFrostExercise;
} else if (typeof window !== 'undefined') {
    window.HeartOfFrostExercise = HeartOfFrostExercise;
}