// src/adapters/primary/ui/controllers/ExerciseController.js

class ExerciseController {
    constructor(lessonTree, exerciseRegistry, dialogueSystem, audioOrchestrator, imuController) {
        this.lessonTree = lessonTree;
        this.exerciseRegistry = exerciseRegistry;
        this.dialogueSystem = dialogueSystem;
        this.audioOrchestrator = audioOrchestrator;
        this.imuController = imuController;
        
        this.currentLesson = null;
        this.currentExercise = null;
        this.isExerciseMode = false;
    }

    /**
     * Démarre une leçon
     */
    startLesson(lessonId) {
        this.currentLesson = this.lessonTree.getLesson(lessonId);
        if (!this.currentLesson) {
            throw new Error(`Leçon ${lessonId} introuvable`);
        }

        this.currentLesson.start();
        this.showCurrentStep();
    }

    /**
     * Affiche l'étape actuelle de la leçon
     */
    showCurrentStep() {
        const step = this.currentLesson.getCurrentStep();
        
        if (step.type === 'dialogue') {
            this.showDialogue(step);
        } else if (step.type === 'exercise') {
            this.startExercise(step);
        }
    }

    /**
     * Affiche un dialogue
     */
    showDialogue(dialogueStep) {
        this.isExerciseMode = false;
        this.dialogueSystem.start(dialogueStep);
        
        // L'UI affiche la fenêtre de dialogue Rita
        // Quand l'utilisateur clique "Suivant", appeler nextStep()
    }

    /**
     * Démarre un exercice
     */
    startExercise(exerciseStep) {
        this.currentExercise = this.exerciseRegistry.get(exerciseStep.exerciseId);
        if (!this.currentExercise) {
            throw new Error(`Exercice ${exerciseStep.exerciseId} introuvable`);
        }

        this.currentExercise.start(exerciseStep.defaultLevel || 0);
        this.isExerciseMode = true;
        
        // Activer le mode exercice dans IMUController
        this.imuController.setExerciseMode(true, this.currentExercise);
    }

    /**
     * Met à jour l'exercice avec les données capteur
     * (Appelé depuis IMUController)
     */
    updateExercise(sensorData) {
        if (!this.isExerciseMode || !this.currentExercise) {
            return null;
        }

        const feedback = this.currentExercise.update(sensorData);
        
        // Appliquer le feedback audio
        this.audioOrchestrator.setPlaybackRate(feedback.playbackRate);
        this.audioOrchestrator.setVolume(feedback.volume);
        
        // Si exercice terminé, passer à l'étape suivante
        if (feedback.isCompleted) {
            this.completeExercise();
        }
        
        return feedback;
    }

    /**
     * Termine l'exercice et passe au dialogue de félicitations
     */
    completeExercise() {
        this.currentExercise.stop();
        this.isExerciseMode = false;
        
        // Calculer les étoiles
        const level = this.currentExercise.getCurrentLevel();
        const stars = level.calculateStars(this.currentExercise.score);
        
        // Compléter la leçon
        this.currentLesson.complete(stars);
        
        // Passer au dialogue de félicitations
        this.nextStep();
    }

    /**
     * Passe à l'étape suivante de la leçon
     */
    nextStep() {
        if (this.currentLesson.nextStep()) {
            this.showCurrentStep();
        } else {
            // Leçon terminée
            this.finishLesson();
        }
    }

    /**
     * Termine la leçon
     */
    finishLesson() {
        // Sauvegarder la progression
        // Retourner à la carte des leçons
        // ...
    }
}