// src/adapters/primary/ui/orchestrators/AudioOrchestrator.js
// Phase 6 - Step 9 : Orchestrateur Audio
// Extrait toute la logique audio depuis app.js

const path = require('path');

class AudioOrchestrator {
  /**
   * @param {Object} config
   * @param {Object} config.state - Gestionnaire d'état
   * @param {Object} config.audioUIController - Contrôleur UI audio
   * @param {Object} config.timelineController - Contrôleur timeline
   * @param {Object} config.recordingController - Contrôleur enregistrement
   * @param {Object} config.imuController - Contrôleur IMU
   * @param {Object} config.audioConfig - Configuration audio (grainSize, overlap, etc.)
   */
  constructor({ state, audioUIController, timelineController, recordingController, imuController, audioConfig }) {
    this.state = state;
    this.audioUIController = audioUIController;
    this.timelineController = timelineController;
    this.recordingController = recordingController;
    this.imuController = imuController;
    this.audioConfig = audioConfig;
    
    this.projectRoot = process.cwd();
    this.GranularSynthesisAdapter = null;
    this.AudioRecorder = null;
  }

  /**
   * Initialise le système audio
   */
  async initialize() {
    console.log('[AudioOrchestrator] Initialisation système audio...');
    
    try {
      // Chargement des classes nécessaires
      const audioAdapterPath = path.join(this.projectRoot, 'src', 'adapters', 'secondary', 'audio', 'granular', 'GranularSynthesisAdapter.js');
      this.GranularSynthesisAdapter = require(audioAdapterPath);
      
      const audioRecorderPath = path.join(this.projectRoot, 'src', 'adapters', 'primary', 'ui', 'services', 'AudioRecorder.js');
      this.AudioRecorder = require(audioRecorderPath);
      
      // Création du système audio
      const audioSystem = new this.GranularSynthesisAdapter();
      this.state.setAudioSystem(audioSystem);
      
      await this.state.getAudioSystem().initialize();
      
      // Configuration initiale des paramètres
      this.state.getAudioSystem().setGranularParams({
        grainSize: this.state.getAudioParameters().grainSize,
        overlap: this.state.getAudioParameters().overlap,
        windowType: this.state.getAudioParameters().windowType
      });
      
      this.state.getAudioSystem().setVolume(this.state.getAudioState().volume);
      
      console.log('[AudioOrchestrator] Système audio initialisé');
      return true;
      
    } catch (error) {
      console.error('[AudioOrchestrator] Erreur initialisation:', error);
      return false;
    }
  }

  /**
   * Charge un fichier audio
   */
  async loadFile(file) {
    if (!file) return;
    
    console.log('[AudioOrchestrator] Fichier sélectionné:', file.name);
    
    try {
      if (this.state.getAudioState().isPlaying) {
        await this.stop();
      }
      
      const fileBuffer = await file.arrayBuffer();
      const audioContext = this.state.getAudioSystem().audioContext;
      const audioBuffer = await audioContext.decodeAudioData(fileBuffer);
      
      this.state.getAudioSystem().audioBuffer = audioBuffer;
      this.state.getAudioSystem().currentPosition = 0;
      
      this.state.setCurrentAudioFile(file);
      this.state.setAudioState(this.state.getAudioState().with({
        duration: audioBuffer.duration,
        currentPosition: 0
      }));
      
      console.log('[AudioOrchestrator] Fichier chargé:', audioBuffer.duration.toFixed(2), 'secondes');
      
      this._updateUI();
      
    } catch (error) {
      console.error('[AudioOrchestrator] Erreur chargement fichier:', error);
      throw new Error('Erreur lors du chargement du fichier audio');
    }
  }

  /**
   * Bascule lecture/pause
   */
  async togglePlayPause() {
    if (!this.state.getCurrentAudioFile() || !this.state.getAudioSystem()) return;
    
    try {
      if (this.state.getAudioState().isPlaying) {
        this.state.getAudioSystem().stopPlayback();
        this.state.setAudioState(this.state.getAudioState().with({ isPlaying: false }));
        this.timelineController.stopUpdates();
        console.log('[AudioOrchestrator] Arrêt');
      } else {
        this.state.getAudioSystem().startPlayback();
        this.state.setAudioState(this.state.getAudioState().with({ isPlaying: true }));
        this.timelineController.startUpdates(this.state.getAudioSystem(), this.state.getAudioState());
        console.log('[AudioOrchestrator] Lecture - État:', this.state.getAudioState().isPlaying);
      }
      
      this._updateUI();
      
    } catch (error) {
      console.error('[AudioOrchestrator] Erreur play/pause:', error);
    }
  }

  /**
   * Arrête la lecture
   */
  async stop() {
    if (!this.state.getAudioSystem()) return;
    
    try {
      this.state.getAudioSystem().stopPlayback();
      this.state.setAudioState(this.state.getAudioState().with({
        isPlaying: false,
        currentPosition: 0
      }));
      
      this.timelineController.stopUpdates();
      this._updateUI();
      
      console.log('[AudioOrchestrator] Stop');
      
    } catch (error) {
      console.error('[AudioOrchestrator] Erreur stop:', error);
    }
  }

  /**
   * Déplace la position de lecture (seek)
   */
  seek(percent) {
    if (!this.state.getCurrentAudioFile() || !this.state.getAudioSystem()) return;
    
    const newPosition = (percent / 100) * this.state.getAudioState().duration;
    
    this.state.getAudioSystem().setPlaybackPosition(newPosition);
    this.state.setAudioState(this.state.getAudioState().with({ currentPosition: newPosition }));
    
    this._updateUI();
    console.log(`[AudioOrchestrator] Seek to ${newPosition.toFixed(2)}s (${percent.toFixed(1)}%)`);
  }

  /**
   * Modifie la taille des grains
   */
  setGrainSize(grainSize) {
    let value = parseInt(grainSize);
    
    if (value < this.audioConfig.minGrainSize) value = this.audioConfig.minGrainSize;
    if (value > this.audioConfig.maxGrainSize) value = this.audioConfig.maxGrainSize;
    
    this.audioUIController.updateGrainSizeDisplay(value);
    
    try {
      this.state.setAudioParameters(this.state.getAudioParameters().with({ grainSize: value }));
      
      if (this.state.getAudioSystem()) {
        this.state.getAudioSystem().setGranularParams({ grainSize: value });
      }
      
      console.log('[AudioOrchestrator] Grain size:', value, 'ms');
      
    } catch (error) {
      console.error('[AudioOrchestrator] Erreur grain size:', error);
    }
  }

  /**
   * Modifie le chevauchement (overlap)
   */
  setOverlap(overlap) {
    let value = parseInt(overlap);
    
    if (isNaN(value)) {
      console.warn('[AudioOrchestrator] Valeur overlap invalide:', overlap);
      value = this.audioConfig.defaultOverlap;
    }
    
    if (value < this.audioConfig.minOverlap) value = this.audioConfig.minOverlap;
    if (value > this.audioConfig.maxOverlap) value = this.audioConfig.maxOverlap;
    
    this.audioUIController.updateOverlapDisplay(value);
    
    try {
      this.state.setAudioParameters(this.state.getAudioParameters().with({ overlap: value }));
      
      if (this.state.getAudioSystem()) {
        this.state.getAudioSystem().setGranularParams({ overlap: value });
      }
      
      console.log('[AudioOrchestrator] Overlap:', value, '%');
      
    } catch (error) {
      console.error('[AudioOrchestrator] Erreur overlap:', error);
    }
  }

  /**
   * Modifie le type de fenêtre (window)
   */
  setWindowType(windowType) {
    try {
      this.state.setAudioParameters(this.state.getAudioParameters().with({ windowType }));
      
      if (this.state.getAudioSystem()) {
        this.state.getAudioSystem().setGranularParams({ windowType });
      }
      
      console.log('[AudioOrchestrator] Window type:', windowType);
      
    } catch (error) {
      console.error('[AudioOrchestrator] Erreur window type:', error);
    }
  }

  /**
   * Active/désactive le contrôle IMU
   */
  toggleIMU(enabled) {
    this.state.setIMUToAudioEnabled(enabled);
    
    this.imuController.setEnabled(enabled, this.state.getAudioSystem());
    
    if (enabled) {
      const now = Date.now();
      this.state.getLastAngles().left.timestamp = now;
      this.state.getLastAngles().right.timestamp = now;
    }
    
    console.log('[AudioOrchestrator] IMU control:', enabled ? 'activé' : 'désactivé');
  }

  /**
   * Bascule l'enregistrement audio
   */
  async toggleRecording() {
    // Vérifications préalables
    const canRecordCheck = this.recordingController.canRecord(
      this.state.getAudioSystem(), 
      this.state.getAudioState().isPlaying
    );
    
    if (!canRecordCheck.canRecord) {
      console.warn('[AudioOrchestrator]', canRecordCheck.reason);
      return;
    }

    try {
      await this.recordingController.toggleRecording(
        this.state.getAudioSystem(),
        this.state.getAudioRecorder() || new this.AudioRecorder()
      );
      
      // Synchroniser l'état local avec le controller
      this.state.setIsRecording(this.recordingController.getRecordingState());
      
      // Si on vient de démarrer et que le recorder n'existait pas encore
      if (this.recordingController.getRecordingState() && !this.state.getAudioRecorder()) {
        this.state.setAudioRecorder(this.recordingController.audioRecorder);
      }
      
      this._updateUI();
      
    } catch (error) {
      console.error('[AudioOrchestrator] Erreur toggle recording:', error);
      throw error;
    }
  }

  /**
   * Applique les données IMU à l'audio
   */
  applyIMUToAudio(position, angles, angularVelocity) {
    const audioUI = this.audioUIController.getUIReferences();
    if (!audioUI.imuSensitivity || !this.state.getAudioSystem()) return;
    
    const sensitivity = parseFloat(audioUI.imuSensitivity.value);
    
    this.imuController.applyToAudio(position, angles, angularVelocity, this.state.getAudioSystem(), sensitivity);
  }

  /**
   * Nettoyage avant fermeture
   */
  async cleanup() {
    console.log('[AudioOrchestrator] Nettoyage...');
    
    if (this.timelineController) {
      this.timelineController.stopUpdates();
    }
    
    if (this.state.getAudioRecorder()) {
      this.state.getAudioRecorder().dispose();
      this.state.setAudioRecorder(null);
    }
    
    if (this.state.getAudioSystem()) {
      this.state.getAudioSystem().dispose();
    }
  }

  /**
   * Libération des ressources
   */
  dispose() {
    console.log('[AudioOrchestrator] Dispose');
    this.cleanup();
    this.state = null;
    this.audioUIController = null;
    this.timelineController = null;
    this.recordingController = null;
    this.imuController = null;
    this.GranularSynthesisAdapter = null;
    this.AudioRecorder = null;
  }

  // ========================================
  // FONCTIONS UTILITAIRES PRIVÉES
  // ========================================

  /**
   * Met à jour l'interface utilisateur
   * @private
   */
  _updateUI() {
    this.audioUIController.updateUI({
      audioState: this.state.getAudioState(),
      currentFile: this.state.getCurrentAudioFile(),
      isRecording: this.state.getIsRecording()
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioOrchestrator;
}