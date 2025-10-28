// @ts-nocheck
// src/core/useCases/exercise/RunExerciseUseCase.js

const SensorData = require('../../domain/valueObjects/SensorData');

/**
 * USE CASE : Exécuter un exercice avec feedback audio temps réel
 * 
 * RÔLE DANS L'ARCHITECTURE HEXAGONALE :
 * - Orchestre l'exercice entre capteurs IMU et système audio
 * - Indépendant de l'infrastructure (utilise les ports)
 * - Contient la logique métier de coordination
 */
class RunExerciseUseCase {
    /**
     * @param {ISensorService} sensorService - Service de capteurs
     * @param {IAudioService} audioService - Service audio
     * @param {EventBus} eventBus - Bus d'événements
     */
    constructor(sensorService, audioService, eventBus) {
        this.sensorService = sensorService;
        this.audioService = audioService;
        this.eventBus = eventBus;
        
        this.currentExercise = null;
        this.connectedSensor = null;
        this.isRunning = false;
        this.dataCallback = null;
    }

    /**
     * Démarre l'exercice
     * @param {Exercise} exercise - Instance de l'exercice (ex: HeartOfFrostExercise)
     * @param {Object} peripheral - Peripheral du capteur connecté
     * @param {string} audioFilePath - Chemin du fichier audio
     * @param {number} levelIndex - Index du niveau à démarrer
     */
    async start(exercise, peripheral, audioFilePath, levelIndex = 0) {
        if (this.isRunning) {
            throw new Error('Un exercice est déjà en cours');
        }

        console.log('[RunExerciseUseCase] Démarrage exercice:', exercise.id);

        try {
            // 1. Initialiser et charger l'audio
            await this.audioService.initialize();
            await this.audioService.loadAudioFile(audioFilePath);

            // 2. Stocker le capteur
            this.connectedSensor = peripheral;
            
            // 3. Démarrer l'exercice (domaine)
            this.currentExercise = exercise;
            exercise.start(levelIndex);
            
            // 4. Démarrer la lecture audio
            this.audioService.startPlayback();
            
            // 5. Configuration du listener de données capteur
            this.setupSensorListener(peripheral);
            
            this.isRunning = true;
            
            // 6. Émettre événement
            this.eventBus.emit('exercise:started', {
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                level: levelIndex,
                levelName: exercise.getCurrentLevel()?.name || 'Unknown'
            });

            console.log('[RunExerciseUseCase] ✓ Exercice démarré avec succès');
            
        } catch (error) {
            console.error('[RunExerciseUseCase] Erreur démarrage:', error);
            this.cleanup();
            throw error;
        }
    }

    /**
     * Configure le listener pour les données capteurs
     * IMPORTANT : Gère à la fois le mode Direct (données brutes) et IPC (données parsées)
     */
    setupSensorListener(peripheral) {
        // Créer le callback de données
        this.dataCallback = (rawData, address) => {
            if (!this.isRunning || !this.currentExercise) {
                return;
            }

            let parsedData = null;

            // NOUVEAU : Détecter si données IPC (déjà parsées) ou données brutes
            if (rawData && typeof rawData === 'object' && rawData._ipcMode) {
                // Mode IPC : Les données arrivent déjà parsées avec { angles, gyro, _ipcMode: true }
                // On doit créer un objet SensorData compatible
                
                if (rawData.gyro) {
                    // Créer un SensorData directement depuis les données gyro
                    parsedData = {
                        type: 'gyro',
                        isValid: true,
                        timestamp: rawData.timestamp || Date.now(),
                        raw: rawData.gyro,
                        data: {
                            x: rawData.gyro.x || 0,
                            y: rawData.gyro.y || 0,
                            z: rawData.gyro.z || 0
                        }
                    };
                    
                    console.log('[RunExerciseUseCase] Mode IPC - Gyro:', parsedData.data);
                }
            } else {
                // Mode Direct : Parser les données brutes normalement
                parsedData = SensorData.parse(rawData);
            }

            // Filtrer uniquement les données GYRO pour Heart of Frost
            if (parsedData && parsedData.type === 'gyro' && parsedData.isValid) {
                
                // Mettre à jour l'exercice avec les données gyro
                const result = this.currentExercise.update(parsedData);

                // Appliquer le feedback audio
                this.audioService.setPlaybackRate(result.playbackRate, 1);
                this.audioService.setVolume(result.volume);

                // Émettre événement pour l'UI avec toutes les métriques
                this.eventBus.emit('exercise:updated', {
                    exerciseId: this.currentExercise.id,
                    metrics: result
                });

                // Vérifier si complété
                if (result.isCompleted) {
                    this.complete();
                }
            }
        };

        // S'abonner aux notifications du capteur
        // Le callback sera appelé automatiquement par NobleBluetoothAdapter
        this.sensorService.setupNotifications(peripheral, this.dataCallback)
            .catch(error => {
                console.error('[RunExerciseUseCase] Erreur setup notifications:', error);
                this.stop();
            });
    }

    /**
     * Arrête l'exercice manuellement
     */
    stop() {
        if (!this.isRunning) {
            console.log('[RunExerciseUseCase] Exercice déjà arrêté');
            return;
        }

        console.log('[RunExerciseUseCase] Arrêt exercice');

        const stats = this.currentExercise?.getStats();
        
        this.currentExercise?.stop();
        this.audioService.stopPlayback();
        
        this.eventBus.emit('exercise:stopped', {
            exerciseId: this.currentExercise?.id,
            stats: stats
        });

        this.cleanup();
    }

    /**
     * Complète l'exercice avec succès
     */
    complete() {
        if (!this.isRunning) {
            return;
        }

        console.log('[RunExerciseUseCase] Exercice complété !');

        const stats = this.currentExercise.getStats();
        const level = this.currentExercise.getCurrentLevel();
        const isSuccess = level?.isSuccess(stats) || false;
        
        this.audioService.stopPlayback();
        
        this.eventBus.emit('exercise:completed', {
            exerciseId: this.currentExercise.id,
            exerciseName: this.currentExercise.name,
            stats: stats,
            success: isSuccess,
            stars: level?.calculateStars(stats.score) || 0,
            rewards: level?.rewards || { xp: 0, gems: 0 }
        });

        this.cleanup();
    }

    /**
     * Réinitialise l'exercice (même niveau)
     */
    reset() {
        if (!this.currentExercise) {
            return;
        }

        console.log('[RunExerciseUseCase] Reset exercice');

        this.currentExercise.reset();
        this.audioService.setPlaybackPosition(0);
        
        this.eventBus.emit('exercise:reset', {
            exerciseId: this.currentExercise.id
        });
    }

    /**
     * Met en pause l'exercice
     */
    pause() {
        if (!this.isRunning) {
            return;
        }

        this.audioService.stopPlayback();
        
        this.eventBus.emit('exercise:paused', {
            exerciseId: this.currentExercise?.id
        });
    }

    /**
     * Reprend l'exercice
     */
    resume() {
        if (!this.isRunning || !this.audioService.isAudioBufferLoaded()) {
            return;
        }

        this.audioService.startPlayback();
        
        this.eventBus.emit('exercise:resumed', {
            exerciseId: this.currentExercise?.id
        });
    }

    /**
     * Nettoie les ressources
     */
    cleanup() {
        this.isRunning = false;
        this.currentExercise = null;
        this.connectedSensor = null;
        this.dataCallback = null;
    }

    /**
     * Vérifie si un exercice est en cours
     */
    isExerciseRunning() {
        return this.isRunning;
    }

    /**
     * Récupère l'exercice actuel
     */
    getCurrentExercise() {
        return this.currentExercise;
    }

    /**
     * Récupère les statistiques actuelles
     */
    getCurrentStats() {
        return this.currentExercise?.getStats() || null;
    }
}

module.exports = RunExerciseUseCase;