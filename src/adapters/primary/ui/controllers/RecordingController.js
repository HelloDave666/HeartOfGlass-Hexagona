// src/adapters/primary/ui/controllers/RecordingController.js
// Phase 5 - Step 5 : Controller pour l'enregistrement audio MP3

/**
 * RecordingController
 * Gère l'enregistrement audio MP3 avec lamejs
 * 
 * Responsabilités :
 * - Initialisation du système d'enregistrement
 * - Démarrage/arrêt de l'enregistrement
 * - Sauvegarde du fichier MP3
 * 
 * Note : L'interface utilisateur du bouton d'enregistrement est gérée
 * par AudioUIController. Ce controller se concentre uniquement sur
 * la logique métier de l'enregistrement.
 */
class RecordingController {
  constructor(config = {}) {
    this.audioRecorder = null;
    this.isRecording = false;
    
    // Callbacks
    this.onRecordingStart = config.onRecordingStart || (() => {});
    this.onRecordingStop = config.onRecordingStop || (() => {});
    this.onError = config.onError || ((error) => console.error('[RecordingController] Error:', error));
    
    console.log('[RecordingController] Instancié');
  }
  
  /**
   * Initialise le controller
   * Note : L'UI du bouton est gérée par AudioUIController
   * @returns {boolean} - Succès de l'initialisation
   */
  initialize() {
    console.log('[RecordingController] Initialisation...');
    
    try {
      console.log('[RecordingController] ✓ Initialisé (logique métier uniquement)');
      return true;
      
    } catch (error) {
      console.error('[RecordingController] Erreur initialisation:', error);
      return false;
    }
  }
  
  /**
   * Initialise l'AudioRecorder si nécessaire
   * @param {Object} audioRecorder - Instance d'AudioRecorder
   * @param {AudioContext} audioContext - Contexte audio
   * @param {AudioNode} sourceNode - Node source audio
   */
  async initializeRecorder(audioRecorder, audioContext, sourceNode) {
    if (!this.audioRecorder) {
      this.audioRecorder = audioRecorder;
      await this.audioRecorder.initialize(audioContext, sourceNode);
      console.log('[RecordingController] AudioRecorder initialisé');
    }
  }
  
  /**
   * Démarre l'enregistrement
   * @param {Object} audioSystem - Système audio pour créer le node source
   * @param {Object} audioRecorder - Instance d'AudioRecorder
   * @returns {Promise<boolean>} - Succès du démarrage
   */
  async startRecording(audioSystem, audioRecorder) {
    if (this.isRecording) {
      console.warn('[RecordingController] Enregistrement déjà en cours');
      return false;
    }
    
    try {
      console.log('[RecordingController] Démarrage enregistrement...');
      
      // Initialiser le recorder si nécessaire
      if (!this.audioRecorder) {
        const sourceNode = audioSystem.createOutputNode();
        await this.initializeRecorder(audioRecorder, audioSystem.audioContext, sourceNode);
      }
      
      // Démarrer l'enregistrement
      this.audioRecorder.startRecording();
      this.isRecording = true;
      
      // Callback
      this.onRecordingStart();
      
      console.log('[RecordingController] ✓ Enregistrement en cours');
      return true;
      
    } catch (error) {
      console.error('[RecordingController] Erreur démarrage:', error);
      this.onError(error);
      this.isRecording = false;
      return false;
    }
  }
  
  /**
   * Arrête l'enregistrement et sauvegarde le fichier
   * @returns {Promise<Blob|null>} - Blob du fichier MP3 ou null si erreur
   */
  async stopRecording() {
    if (!this.isRecording) {
      console.warn('[RecordingController] Aucun enregistrement en cours');
      return null;
    }
    
    try {
      console.log('[RecordingController] Arrêt enregistrement...');
      
      // Arrêter l'enregistrement et récupérer le blob
      const blob = this.audioRecorder.stopRecording();
      this.isRecording = false;
      
      // Télécharger le fichier si blob valide
      if (blob) {
        this.audioRecorder.downloadRecording(blob);
        console.log('[RecordingController] ✓ Enregistrement sauvegardé');
      }
      
      // Callback
      this.onRecordingStop(blob);
      
      return blob;
      
    } catch (error) {
      console.error('[RecordingController] Erreur arrêt:', error);
      this.onError(error);
      this.isRecording = false;
      return null;
    }
  }
  
  /**
   * Toggle enregistrement (start/stop)
   * @param {Object} audioSystem - Système audio
   * @param {Object} audioRecorder - Instance d'AudioRecorder
   * @returns {Promise<boolean>} - Succès de l'opération
   */
  async toggleRecording(audioSystem, audioRecorder) {
    if (this.isRecording) {
      await this.stopRecording();
      return false; // Maintenant arrêté
    } else {
      await this.startRecording(audioSystem, audioRecorder);
      return true; // Maintenant en cours
    }
  }
  
  /**
   * Obtient l'état actuel de l'enregistrement
   * @returns {boolean}
   */
  getRecordingState() {
    return this.isRecording;
  }
  
  /**
   * Vérifie si l'enregistrement est possible
   * @param {Object} audioSystem - Système audio
   * @param {boolean} isPlaying - État de lecture
   * @returns {Object} - { canRecord, reason }
   */
  canRecord(audioSystem, isPlaying) {
    if (!audioSystem) {
      return { 
        canRecord: false, 
        reason: 'Système audio non initialisé' 
      };
    }
    
    if (!isPlaying) {
      return { 
        canRecord: false, 
        reason: 'La lecture doit être active pour enregistrer' 
      };
    }
    
    return { 
      canRecord: true, 
      reason: null 
    };
  }
  
  /**
   * Nettoie les ressources
   */
  dispose() {
    console.log('[RecordingController] Nettoyage...');
    
    if (this.isRecording && this.audioRecorder) {
      this.audioRecorder.stopRecording();
    }
    
    if (this.audioRecorder) {
      this.audioRecorder.dispose();
      this.audioRecorder = null;
    }
    
    this.isRecording = false;
    
    console.log('[RecordingController] ✓ Nettoyé');
  }
}

module.exports = RecordingController;