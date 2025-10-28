// @ts-nocheck
// src/adapters/primary/ExerciseController.js

/**
 * ⚠️ CE FICHIER N'EST PAS UTILISÉ DANS L'APPLICATION ELECTRON
 * 
 * Il sert de RÉFÉRENCE pour l'architecture hexagonale pure.
 * 
 * Pour l'application Electron, utiliser plutôt :
 * → src/adapters/primary/ui/orchestrators/ExerciseOrchestrator.js
 * 
 * Ce controller peut être utilisé pour :
 * - Application Node.js standalone
 * - API REST
 * - CLI
 * - Tests unitaires des use cases
 */
class ExerciseController {
    /**
     * @param {RunExerciseUseCase} runExerciseUseCase - Use case d'exécution d'exercice
     * @param {EventBus} eventBus - Bus d'événements
     */
    constructor(runExerciseUseCase, eventBus) {
        this.runExerciseUseCase = runExerciseUseCase;
        this.eventBus = eventBus;
        this.uiCallbacks = new Map();
        
        this.setupEventListeners();
        
        console.log('[ExerciseController] Contrôleur initialisé');
    }

    /**
     * Configure les listeners d'événements du use case
     */
    setupEventListeners() {
        // Exercice démarré
        this.eventBus.on('exercise:started', (data) => {
            this.notifyUI('onExerciseStarted', data);
        });

        // Exercice mis à jour (données en temps réel)
        this.eventBus.on('exercise:updated', (data) => {
            this.notifyUI('onExerciseUpdated', data);
        });

        // Exercice complété
        this.eventBus.on('exercise:completed', (data) => {
            this.notifyUI('onExerciseCompleted', data);
        });

        // Exercice arrêté
        this.eventBus.on('exercise:stopped', (data) => {
            this.notifyUI('onExerciseStopped', data);
        });

        // Exercice réinitialisé
        this.eventBus.on('exercise:reset', (data) => {
            this.notifyUI('onExerciseReset', data);
        });

        // Exercice en pause
        this.eventBus.on('exercise:paused', (data) => {
            this.notifyUI('onExercisePaused', data);
        });

        // Exercice repris
        this.eventBus.on('exercise:resumed', (data) => {
            this.notifyUI('onExerciseResumed', data);
        });
    }

    /**
     * Démarre un exercice
     * @param {Exercise} exercise - Instance de l'exercice
     * @param {Object} peripheral - Capteur connecté
     * @param {string} audioFilePath - Chemin du fichier audio
     * @param {number} levelIndex - Index du niveau
     */
    async startExercise(exercise, peripheral, audioFilePath, levelIndex = 0) {
        try {
            await this.runExerciseUseCase.start(exercise, peripheral, audioFilePath, levelIndex);
            return { success: true };
        } catch (error) {
            console.error('[ExerciseController] Erreur démarrage:', error);
            this.notifyUI('onError', {
                type: 'start_failed',
                message: error.message
            });
            return { success: false, error: error.message };
        }
    }

    /**
     * Arrête l'exercice en cours
     */
    stopExercise() {
        this.runExerciseUseCase.stop();
    }

    /**
     * Réinitialise l'exercice
     */
    resetExercise() {
        this.runExerciseUseCase.reset();
    }

    /**
     * Met en pause l'exercice
     */
    pauseExercise() {
        this.runExerciseUseCase.pause();
    }

    /**
     * Reprend l'exercice
     */
    resumeExercise() {
        this.runExerciseUseCase.resume();
    }

    /**
     * Vérifie si un exercice est en cours
     */
    isRunning() {
        return this.runExerciseUseCase.isExerciseRunning();
    }

    /**
     * Récupère l'exercice actuel
     */
    getCurrentExercise() {
        return this.runExerciseUseCase.getCurrentExercise();
    }

    /**
     * Récupère les statistiques actuelles
     */
    getCurrentStats() {
        return this.runExerciseUseCase.getCurrentStats();
    }

    /**
     * Enregistre un callback pour l'UI
     * @param {string} eventName - Nom de l'événement
     * @param {Function} callback - Fonction à appeler
     */
    on(eventName, callback) {
        if (!this.uiCallbacks.has(eventName)) {
            this.uiCallbacks.set(eventName, []);
        }
        this.uiCallbacks.get(eventName).push(callback);
    }

    /**
     * Retire un callback
     */
    off(eventName, callback) {
        if (this.uiCallbacks.has(eventName)) {
            const callbacks = this.uiCallbacks.get(eventName);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Notifie l'UI via les callbacks enregistrés
     */
    notifyUI(eventName, data) {
        if (this.uiCallbacks.has(eventName)) {
            this.uiCallbacks.get(eventName).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[ExerciseController] Erreur callback ${eventName}:`, error);
                }
            });
        }
    }

    /**
     * Nettoie les ressources
     */
    dispose() {
        this.uiCallbacks.clear();
        // Note: Les listeners EventBus restent actifs pour d'autres contrôleurs
    }
}

module.exports = ExerciseController;