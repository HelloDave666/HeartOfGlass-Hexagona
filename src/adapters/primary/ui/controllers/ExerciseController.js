/**
 * ExerciseController.js
 * 
 * Contrôleur principal pour gérer les exercices
 * 
 * Architecture: Primary Adapter - Orchestration des exercices
 */

const path = require('path');

class ExerciseController {
  constructor({ audioOrchestrator, state }) {
    this.audioOrchestrator = audioOrchestrator;
    this.state = state;
    
    // Exercice actif
    this.currentExercise = null;
    this.currentExerciseName = null;
    
    // Catalogue des exercices disponibles
    this.availableExercises = {
      rotationContinue: {
        name: 'Rotation Continue',
        description: 'Maintenir une rotation constante',
        class: null // Chargé à l'initialisation
      }
    };
    
    console.log('[ExerciseController] Controller créé');
  }
  
  /**
   * Initialise le contrôleur et charge les exercices
   */
  initialize() {
    console.log('[ExerciseController] Initialisation...');
    
    try {
      // Charger l'exercice RotationContinue avec chemin RELATIF
      // ExerciseController est dans: src/adapters/primary/ui/controllers/
      // RotationContinue est dans: src/adapters/primary/ui/exercises/
      // Donc: ../exercises/RotationContinueExercise.js
      const RotationContinueExercise = require(
        path.join(__dirname, '..', 'exercises', 'RotationContinueExercise.js')
      );
      
      this.availableExercises.rotationContinue.class = RotationContinueExercise;
      
      console.log('[ExerciseController] ✓ Exercices chargés:', Object.keys(this.availableExercises));
    } catch (error) {
      console.error('[ExerciseController] Erreur chargement exercices:', error);
      throw error;
    }
  }
  
  /**
   * Démarre un exercice
   * @param {string} exerciseName - Nom de l'exercice (rotationContinue, etc.)
   */
  startExercise(exerciseName) {
    console.log('[ExerciseController] Démarrage exercice:', exerciseName);
    
    // Vérifier si un exercice est déjà actif
    if (this.currentExercise) {
      console.warn('[ExerciseController] Un exercice est déjà actif, arrêt...');
      this.stopCurrentExercise();
    }
    
    // Vérifier si l'exercice existe
    const exerciseConfig = this.availableExercises[exerciseName];
    if (!exerciseConfig || !exerciseConfig.class) {
      console.error('[ExerciseController] Exercice inconnu:', exerciseName);
      return false;
    }
    
    try {
      // Créer l'instance de l'exercice
      const ExerciseClass = exerciseConfig.class;
      this.currentExercise = new ExerciseClass({
        audioOrchestrator: this.audioOrchestrator,
        state: this.state
      });
      
      this.currentExerciseName = exerciseName;
      
      // Démarrer l'exercice
      const started = this.currentExercise.start();
      
      if (started) {
        console.log('[ExerciseController] ✓ Exercice démarré:', exerciseName);
        return true;
      } else {
        console.error('[ExerciseController] Échec démarrage exercice');
        this.currentExercise = null;
        this.currentExerciseName = null;
        return false;
      }
    } catch (error) {
      console.error('[ExerciseController] Erreur démarrage exercice:', error);
      this.currentExercise = null;
      this.currentExerciseName = null;
      return false;
    }
  }
  
  /**
   * Arrête l'exercice en cours
   */
  stopCurrentExercise() {
    if (!this.currentExercise) {
      console.warn('[ExerciseController] Aucun exercice actif');
      return false;
    }
    
    console.log('[ExerciseController] Arrêt exercice:', this.currentExerciseName);
    
    try {
      this.currentExercise.stop();
      this.currentExercise.dispose();
      
      this.currentExercise = null;
      this.currentExerciseName = null;
      
      console.log('[ExerciseController] ✓ Exercice arrêté');
      return true;
    } catch (error) {
      console.error('[ExerciseController] Erreur arrêt exercice:', error);
      return false;
    }
  }
  
  /**
   * Met à jour les angles depuis les capteurs
   * À appeler depuis app.js quand les angles changent
   * @param {Object} angles - {x, y, z}
   */
  updateAngles(angles) {
    if (this.currentExercise && this.currentExercise.updateAngles) {
      this.currentExercise.updateAngles(angles);
    }
  }
  
  /**
   * Retourne l'état actuel
   */
  getStatus() {
    return {
      hasActiveExercise: this.currentExercise !== null,
      currentExerciseName: this.currentExerciseName,
      availableExercises: Object.keys(this.availableExercises),
      exerciseStatus: this.currentExercise ? this.currentExercise.getStatus() : null
    };
  }
  
  /**
   * Nettoyage
   */
  dispose() {
    console.log('[ExerciseController] Dispose...');
    
    if (this.currentExercise) {
      this.stopCurrentExercise();
    }
    
    console.log('[ExerciseController] ✓ Disposed');
  }
}

module.exports = ExerciseController;