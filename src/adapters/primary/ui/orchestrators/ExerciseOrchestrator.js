// @ts-nocheck
// src/adapters/primary/ui/orchestrators/ExerciseOrchestrator.js

const path = require('path');
const projectRoot = process.cwd();

const RunExerciseUseCase = require(path.join(projectRoot, 'src', 'core', 'useCases', 'exercise', 'RunExerciseUseCase.js'));
const HeartOfFrostExercise = require(path.join(projectRoot, 'src', 'core', 'domain', 'exercises', 'glass', 'HeartOfFrostExercise.js'));
const SensorData = require(path.join(projectRoot, 'src', 'core', 'domain', 'valueObjects', 'SensorData.js'));
const { EventEmitter } = require('events');

/**
 * ORCHESTRATEUR D'EXERCICES
 * Coordonne les exercices entre capteurs et audio
 * S'intègre avec BluetoothOrchestrator et AudioOrchestrator existants
 * 
 * GESTION DES CONFLITS AUDIO (v7.0) :
 * - Désactive l'IMUController en mode exercice
 * - Réactive l'IMUController après l'exercice
 * - Assure un contrôle exclusif de l'audio par l'exercice
 */
class ExerciseOrchestrator {
    constructor({
        state,
        bluetoothOrchestrator,
        audioOrchestrator,
        exerciseUIController // À créer pour l'UI des exercices
    }) {
        this.state = state;
        this.bluetoothOrchestrator = bluetoothOrchestrator;
        this.audioOrchestrator = audioOrchestrator;
        this.exerciseUIController = exerciseUIController;
        
        // Event bus local pour les exercices
        this.eventBus = new EventEmitter();
        
        // Use case
        this.runExerciseUseCase = null;
        
        // État
        this.currentExercise = null;
        this.isRunning = false;
        this.connectedSensor = null;
        
        // NOUVEAU : Sauvegarde de l'état IMU avant exercice
        this.imuWasEnabled = false;
        
        console.log('[ExerciseOrchestrator] Créé');
    }

    /**
     * Initialise l'orchestrateur
     */
    async initialize() {
        try {
            // Récupérer les services depuis les orchestrators existants
            const sensorService = this.bluetoothOrchestrator.getSensorService();
            const audioService = this.audioOrchestrator.getAudioService();

            // DEBUG : Afficher ce qui est retourné
            console.log('[ExerciseOrchestrator] Services récupérés:', {
                sensorService: sensorService ? '✓' : '✗',
                audioService: audioService ? '✓' : '✗',
                sensorServiceType: sensorService ? sensorService.constructor.name : 'undefined',
                audioServiceType: audioService ? audioService.constructor.name : 'undefined'
            });

            if (!sensorService || !audioService) {
                throw new Error('Services audio ou capteur non disponibles');
            }

            // Créer le use case
            this.runExerciseUseCase = new RunExerciseUseCase(
                sensorService,
                audioService,
                this.eventBus
            );

            // Configurer les listeners d'événements
            this.setupEventListeners();

            console.log('[ExerciseOrchestrator] ✓ Initialisé');
            return true;

        } catch (error) {
            console.error('[ExerciseOrchestrator] Erreur initialisation:', error);
            return false;
        }
    }

    /**
     * Configure les listeners d'événements
     */
    setupEventListeners() {
        // Exercice démarré
        this.eventBus.on('exercise:started', (data) => {
            console.log('[ExerciseOrchestrator] Exercice démarré:', data);
            if (this.exerciseUIController) {
                this.exerciseUIController.showExerciseStarted(data);
            }
        });

        // Mise à jour en temps réel
        this.eventBus.on('exercise:updated', (data) => {
            const metrics = data.metrics;
            
            // Mettre à jour l'UI avec les métriques
            if (this.exerciseUIController) {
                this.exerciseUIController.updateMetrics(metrics);
            }
            
            // Log occasionnel toutes les 5 secondes
            const shouldLog = metrics.elapsedTime && 
                             (metrics.elapsedTime % 5 === 0 || metrics.elapsedTime % 5 === 1);

            if (shouldLog) {
                console.log('[ExerciseOrchestrator] Progress:', {
                    temps: `${metrics.elapsedTime}s / ${metrics.targetDuration}s`,
                    score: metrics.regularityScore,
                    feedback: metrics.feedback.message
                });
            }
        });

        // Exercice complété
        this.eventBus.on('exercise:completed', (data) => {
            console.log('[ExerciseOrchestrator] 🎉 Exercice complété !', data);
            this.isRunning = false;
            
            // NOUVEAU : Restaurer l'état IMU
            this._restoreIMUMode();
            
            if (this.exerciseUIController) {
                this.exerciseUIController.showExerciseCompleted(data);
            }
        });

        // Exercice arrêté
        this.eventBus.on('exercise:stopped', (data) => {
            console.log('[ExerciseOrchestrator] Exercice arrêté');
            this.isRunning = false;
            
            // NOUVEAU : Restaurer l'état IMU
            this._restoreIMUMode();
            
            if (this.exerciseUIController) {
                this.exerciseUIController.showExerciseStopped();
            }
        });
    }

    /**
     * NOUVEAU : Passe en mode exercice (désactive l'IMU)
     * @private
     */
    _enterExerciseMode() {
        console.log('[ExerciseOrchestrator] === PASSAGE EN MODE EXERCICE ===');
        
        // Sauvegarder l'état actuel de l'IMU
        this.imuWasEnabled = this.state.getIMUToAudioEnabled() || false;
        
        console.log('[ExerciseOrchestrator] IMU était:', this.imuWasEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ');
        
        // Désactiver l'IMU pour éviter les conflits
        if (this.imuWasEnabled) {
            console.log('[ExerciseOrchestrator] 🔒 Désactivation IMU pour mode exercice');
            this.audioOrchestrator.toggleIMU(false);
        }
        
        console.log('[ExerciseOrchestrator] ✓ Mode exercice actif - L\'exercice a le contrôle exclusif de l\'audio');
    }

    /**
     * NOUVEAU : Restaure le mode libre (réactive l'IMU si nécessaire)
     * @private
     */
    _restoreIMUMode() {
        console.log('[ExerciseOrchestrator] === RETOUR EN MODE LIBRE ===');
        
        // Réactiver l'IMU s'il était activé avant
        if (this.imuWasEnabled) {
            console.log('[ExerciseOrchestrator] 🔓 Réactivation IMU');
            this.audioOrchestrator.toggleIMU(true);
        } else {
            console.log('[ExerciseOrchestrator] IMU reste désactivé (était désactivé avant)');
        }
        
        console.log('[ExerciseOrchestrator] ✓ Mode libre restauré');
    }

    /**
     * Démarre l'exercice Heart of Frost
     * @param {number} levelIndex - Index du niveau (0 ou 1)
     */
    async startHeartOfFrost(levelIndex = 0) {
        if (this.isRunning) {
            console.warn('[ExerciseOrchestrator] Un exercice est déjà en cours');
            return false;
        }

        // Vérifier qu'un capteur est connecté
        const connectedSensors = this.bluetoothOrchestrator.getConnectedSensors();
        if (connectedSensors.length === 0) {
            alert('Aucun capteur connecté ! Connectez un capteur d\'abord.');
            return false;
        }

        // Utiliser le premier capteur connecté (ou le capteur droit si disponible)
        const peripheral = this.bluetoothOrchestrator.getPeripheralForExercise();
        if (!peripheral) {
            alert('Impossible de récupérer le capteur');
            return false;
        }

        // Vérifier qu'un fichier audio est chargé
        const audioFile = this.state.getCurrentAudioFile();
        if (!audioFile) {
            alert('Aucun fichier audio chargé ! Chargez un fichier d\'abord.');
            return false;
        }

        try {
            console.log('[ExerciseOrchestrator] Démarrage Heart of Frost - Niveau', levelIndex + 1);

            // NOUVEAU : Passer en mode exercice
            this._enterExerciseMode();

            // 1. Créer l'instance de l'exercice
            const exercise = new HeartOfFrostExercise();
            this.currentExercise = exercise;

            // 2. Obtenir le chemin du fichier audio
            const audioFilePath = audioFile.path;

            // 3. Démarrer l'exercice via le use case
            await this.runExerciseUseCase.start(
                exercise,
                peripheral,
                audioFilePath,
                levelIndex
            );

            this.isRunning = true;
            this.connectedSensor = peripheral;

            console.log('[ExerciseOrchestrator] ✓ Exercice démarré');
            return true;

        } catch (error) {
            console.error('[ExerciseOrchestrator] Erreur démarrage exercice:', error);
            
            // NOUVEAU : Restaurer l'IMU en cas d'erreur
            this._restoreIMUMode();
            
            alert('Erreur : ' + error.message);
            return false;
        }
    }

    /**
     * Arrête l'exercice en cours
     */
    stopExercise() {
        if (!this.isRunning) {
            return;
        }

        console.log('[ExerciseOrchestrator] Arrêt exercice');
        this.runExerciseUseCase.stop();
        this.isRunning = false;
        this.currentExercise = null;
        
        // NOUVEAU : Restaurer l'IMU
        this._restoreIMUMode();
    }

    /**
     * Réinitialise l'exercice
     */
    resetExercise() {
        if (!this.isRunning) {
            return;
        }

        console.log('[ExerciseOrchestrator] Reset exercice');
        this.runExerciseUseCase.reset();
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
     * Nettoyage
     */
    async cleanup() {
        if (this.isRunning) {
            this.stopExercise();
        }
        
        this.eventBus.removeAllListeners();
    }

    /**
     * Dispose des ressources
     */
    dispose() {
        this.cleanup();
    }
}

module.exports = ExerciseOrchestrator;