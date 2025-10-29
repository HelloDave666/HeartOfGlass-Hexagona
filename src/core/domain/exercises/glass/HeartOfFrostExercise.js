// @ts-nocheck
/**
 * HeartOfFrostExercise.js - Exercice de rotation régulière (v5.1)
 * Chemin: src/core/domain/exercises/glass/HeartOfFrostExercise.js
 * 
 * CORRECTIONS v5.1 :
 * - Tolérance élargie à 40% pour zone de régularité plus confortable
 * - Durée d'exercice augmentée à 2 minutes pour tests approfondis
 */

// ========================================
// IMPORTS
// ========================================
const path = require('path');
const projectRoot = process.cwd();

const Exercise = require(path.join(projectRoot, 'src', 'core', 'domain', 'exercises', 'base', 'Exercise.js'));
const ExerciseLevel = require(path.join(projectRoot, 'src', 'core', 'domain', 'exercises', 'base', 'ExerciseLevel.js'));

// ========================================
// TYPES JSDoc
// ========================================

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
 * @property {number} elapsedTime - Temps écoulé en secondes
 * @property {number} targetDuration - Durée cible en secondes
 * @property {number} accuracy - Précision (0-1)
 * @property {ExerciseFeedback} feedback - Feedback visuel
 * @property {boolean} isCompleted - Exercice complété
 */

// ========================================
// CLASSE PRINCIPALE
// ========================================

/**
 * Exercice "Cœur de givre" - Rotation régulière sur l'axe Y pendant 2 minutes
 * @extends Exercise
 */
class HeartOfFrostExercise extends Exercise {
    constructor() {
        super('heart-of-frost', {
            name: 'Cœur de givre',
            description: 'Maintiens une rotation régulière pendant 2 minutes',
            craft: 'glass',
            levels: HeartOfFrostExercise.createLevels()
        });

        // Paramètres de l'exercice
        this.targetRPM = 60;
        this.targetDegreesPerSec = 360;
        this.tolerance = 0.40;
        this.smoothingFactor = 0.3;
        
        // NOUVEAU : Détection automatique du facteur de conversion
        this.conversionFactor = 1.0;
        this.autoDetectConversion = true;
        this.samplesForDetection = [];
        this.maxSamplesForDetection = 20;
        
        // Filtre anti-aberrations adaptatif
        this.maxValidGyroValue = 2000;
        
        // État
        this.currentAngularVelocity = 0;
        this.smoothedVelocity = 0;
        this.regularityScore = 100;
        this.totalSamples = 0;
        this.accurateSamples = 0;
        this.startTime = null;
        this.elapsedTime = 0;
        this.sampleCount = 0;
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
                description: 'Maintiens une rotation régulière pendant 2 minutes',
                requirements: {
                    targetDuration: 120,
                    targetRPM: 60,
                    tolerance: 0.40
                },
                successCriteria: { minScore: 60, minAccuracy: 0.6 },
                rewards: { xp: 100, gems: 0 }
            }),
            new ExerciseLevel({
                number: 2,
                name: 'Pratique',
                description: 'Maintiens une rotation régulière pendant 2 minutes avec plus de précision',
                requirements: {
                    targetDuration: 120,
                    targetRPM: 60,
                    tolerance: 0.30
                },
                successCriteria: { minScore: 70, minAccuracy: 0.7 },
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
        this.startTime = Date.now();
        console.log('[HeartOfFrostExercise] Démarrage chronométrage - Durée: 2 minutes');
    }

    /**
     * Hook d'arrêt
     * @returns {void}
     */
    onStop() {
        this.score = this.calculateFinalScore();
        console.log('[HeartOfFrostExercise] Score final:', this.score);
    }

    /**
     * Hook de réinitialisation
     * @returns {void}
     */
    onReset() {
        this.resetMetrics();
        this.startTime = Date.now();
    }

    /**
     * Réinitialise toutes les métriques
     * @returns {void}
     */
    resetMetrics() {
        this.currentAngularVelocity = 0;
        this.smoothedVelocity = 0;
        this.regularityScore = 100;
        this.totalSamples = 0;
        this.accurateSamples = 0;
        this.startTime = null;
        this.elapsedTime = 0;
        this.sampleCount = 0;
        this.samplesForDetection = [];
        this.conversionFactor = 1.0;
        this.autoDetectConversion = true;
    }

    /**
     * NOUVEAU : Détecte automatiquement le facteur de conversion des données gyro
     * Les capteurs WITMOTION peuvent envoyer des valeurs brutes qui nécessitent une conversion
     * @param {number} rawValue - Valeur brute du gyroscope
     * @returns {void}
     */
    detectConversionFactor(rawValue) {
        if (!this.autoDetectConversion) return;
        
        // Collecter des échantillons
        if (Math.abs(rawValue) > 100 && this.samplesForDetection.length < this.maxSamplesForDetection) {
            this.samplesForDetection.push(Math.abs(rawValue));
        }
        
        // Analyser après avoir collecté suffisamment d'échantillons
        if (this.samplesForDetection.length >= this.maxSamplesForDetection) {
            const avgValue = this.samplesForDetection.reduce((a, b) => a + b, 0) / this.samplesForDetection.length;
            
            // Si les valeurs sont autour de 4000, c'est probablement des raw data
            // Les capteurs WITMOTION BWT901 ont souvent un facteur ~16 ou 32
            if (avgValue > 2000) {
                // Détection du facteur : on cherche à ramener vers 360°/s
                this.conversionFactor = avgValue / 360;
                console.log(`[HeartOfFrostExercise] Facteur de conversion détecté: ${this.conversionFactor.toFixed(2)} (avg: ${avgValue.toFixed(0)})`);
            }
            
            this.autoDetectConversion = false;
        }
    }

    /**
     * Mise à jour avec données capteur
     * 
     * @param {Object} sensorData - Données des capteurs depuis RunExerciseUseCase
     * @param {string} sensorData.type - Type de données ('gyro')
     * @param {{x: number, y: number, z: number}} sensorData.data - Données gyroscope
     * @param {boolean} sensorData.isValid - Validité des données
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

        // Calculer le temps écoulé
        if (this.startTime) {
            this.elapsedTime = (Date.now() - this.startTime) / 1000;
        }

        // Extraire la valeur brute
        let rawAngularVelocityY = sensorData.data.y;
        
        // NOUVEAU : Détection automatique du facteur de conversion
        this.detectConversionFactor(rawAngularVelocityY);
        
        // Appliquer le facteur de conversion
        let angularVelocityY = rawAngularVelocityY / this.conversionFactor;
        
        // Filtre anti-aberrations
        if (Math.abs(angularVelocityY) > this.maxValidGyroValue) {
            console.warn(`[HeartOfFrostExercise] Valeur aberrante filtrée: ${angularVelocityY.toFixed(2)}°/s (raw: ${rawAngularVelocityY.toFixed(2)})`);
            return this.getCurrentState(level);
        }
        
        // Incrémenter le compteur de samples
        this.sampleCount++;
        
        // Logs de debug tous les 50 samples
        if (this.sampleCount % 50 === 0) {
            console.log(`[HeartOfFrostExercise] État:`, {
                temps: `${this.elapsedTime.toFixed(1)}s / ${level.requirements.targetDuration}s`,
                gyroY_raw: `${rawAngularVelocityY.toFixed(2)}`,
                gyroY_converted: `${angularVelocityY.toFixed(2)}°/s`,
                conversion: `x${this.conversionFactor.toFixed(2)}`,
                smoothed: `${this.smoothedVelocity.toFixed(2)}°/s`,
                ratio: (this.smoothedVelocity / this.targetDegreesPerSec).toFixed(2),
                score: Math.round(this.regularityScore)
            });
        }
        
        // Lisser
        this.currentAngularVelocity = angularVelocityY;
        this.smoothedVelocity = this.smoothedVelocity * (1 - this.smoothingFactor) 
                              + angularVelocityY * this.smoothingFactor;
        
        // Calculer ratio
        const velocityRatio = this.smoothedVelocity / this.targetDegreesPerSec;
        
        // Vérifier précision
        const isAccurate = this.isVelocityAccurate(velocityRatio, level.requirements.tolerance);
        
        // Mettre à jour métriques
        this.totalSamples++;
        if (isAccurate) {
            this.accurateSamples++;
        }
        
        // Score de régularité
        this.updateRegularityScore(velocityRatio, level.requirements.tolerance);
        
        // Calculer playback rate
        const playbackRate = this.calculatePlaybackRate(velocityRatio);
        
        // Volume selon régularité
        const volume = this.calculateVolume();
        
        // Feedback
        const feedback = this.getFeedback(velocityRatio, level.requirements.tolerance);
        
        // Vérifier si temps écoulé
        const isCompleted = this.elapsedTime >= level.requirements.targetDuration;
        
        return {
            playbackRate,
            volume,
            regularityScore: Math.round(this.regularityScore),
            elapsedTime: Math.round(this.elapsedTime),
            targetDuration: level.requirements.targetDuration,
            accuracy: this.getAccuracy(),
            feedback,
            isCompleted
        };
    }

    /**
     * Retourne l'état actuel sans mise à jour (pour filtrage aberrations)
     * @param {*} level - Niveau actuel
     * @returns {ExerciseUpdateResult}
     */
    getCurrentState(level) {
        const velocityRatio = this.smoothedVelocity / this.targetDegreesPerSec;
        
        return {
            playbackRate: this.calculatePlaybackRate(velocityRatio),
            volume: this.calculateVolume(),
            regularityScore: Math.round(this.regularityScore),
            elapsedTime: Math.round(this.elapsedTime),
            targetDuration: level.requirements.targetDuration,
            accuracy: this.getAccuracy(),
            feedback: this.getFeedback(velocityRatio, level.requirements.tolerance),
            isCompleted: this.elapsedTime >= level.requirements.targetDuration
        };
    }

    /**
     * Calcule la vitesse de lecture audio
     * @param {number} velocityRatio - Ratio de vitesse
     * @returns {number} - Playback rate (0.1-2.0)
     */
    calculatePlaybackRate(velocityRatio) {
        // Mauvais sens -> inversion
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
                message: 'Sens de rotation inversé', 
                color: '#e74c3c' 
            };
        }
        
        if (absRatio < (1.0 - tolerance)) {
            return { 
                type: 'warning', 
                message: 'Trop lent', 
                color: '#3498db' 
            };
        }
        
        if (absRatio > (1.0 + tolerance)) {
            return { 
                type: 'warning', 
                message: 'Trop rapide', 
                color: '#f39c12' 
            };
        }
        
        return { 
            type: 'success', 
            message: 'Parfait', 
            color: '#2ecc71' 
        };
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
     * CORRECTION CRITIQUE : Méthode isCompleted() manquante
     * Vérifie si l'exercice est complété
     * @returns {boolean} - True si complété
     */
    isCompleted() {
        const level = this.getCurrentLevel();
        if (!level) return false;
        return this.elapsedTime >= level.requirements.targetDuration;
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
            elapsedTime: 0,
            targetDuration: 120,
            accuracy: 0,
            feedback: { type: 'info', message: 'Prêt à commencer ?', color: '#95a5a6' },
            isCompleted: false
        };
    }
}

// ========================================
// EXPORT
// ========================================

// Export pour Node.js ET browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeartOfFrostExercise;
} else if (typeof window !== 'undefined') {
    window.HeartOfFrostExercise = HeartOfFrostExercise;
}