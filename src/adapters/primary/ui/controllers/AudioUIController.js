// src/adapters/primary/ui/controllers/AudioUIController.js
/**
 * AudioUIController - Gestion de l'interface utilisateur audio
 * 
 * Responsabilités :
 * - Configuration de l'interface audio
 * - Mise à jour de l'affichage (play/pause, timeline, volumes, paramètres)
 * - Gestion des événements UI audio (fichier, contrôles, paramètres)
 * - Formatage du temps
 * 
 * Architecture : Adapter PRIMARY (UI)
 * - Ne contient AUCUNE logique métier audio
 * - Transforme l'état audio en affichage visuel
 * - Émet des événements pour les interactions utilisateur
 */

class AudioUIController {
  /**
   * @param {Object} config - Configuration
   * @param {Object} config.audioConfig - Configuration audio par défaut
   * @param {Function} config.onFileSelect - Callback sélection fichier
   * @param {Function} config.onPlayPauseToggle - Callback play/pause
   * @param {Function} config.onTimelineClick - Callback click timeline
   * @param {Function} config.onGrainSizeChange - Callback changement grain size
   * @param {Function} config.onOverlapChange - Callback changement overlap
   * @param {Function} config.onWindowChange - Callback changement window
   * @param {Function} config.onRecordToggle - Callback toggle recording
   */
  constructor(config) {
    this.config = config || {};
    
    // Callbacks
    this.onFileSelect = config.onFileSelect || null;
    this.onPlayPauseToggle = config.onPlayPauseToggle || null;
    this.onTimelineClick = config.onTimelineClick || null;
    this.onGrainSizeChange = config.onGrainSizeChange || null;
    this.onOverlapChange = config.onOverlapChange || null;
    this.onWindowChange = config.onWindowChange || null;
    this.onRecordToggle = config.onRecordToggle || null;
    
    // Références DOM - Fichier et contrôles
    this.fileInput = null;
    this.playPauseButton = null;
    
    // Références DOM - Timeline
    this.timeline = null;
    this.timelineProgress = null;
    this.timelineHandle = null;
    this.positionDisplay = null;
    
    // Références DOM - Status et affichages
    this.audioStatus = null;
    this.speedDisplay = null;
    this.volumeDisplay = null;
    
    // Références DOM - Paramètres granulaires
    this.grainSizeInput = null;
    this.overlapInput = null;
    this.windowSelect = null;

    // Références DOM - Enregistrement
    this.recordButton = null;
    
    // Stockage des handlers pour cleanup
    this.handlers = new Map();
    
    console.log('[AudioUIController] Initialisé');
  }

  /**
   * Initialise l'interface audio
   * @returns {boolean} - Succès de l'initialisation
   */
  initialize() {
    console.log('[AudioUIController] Initialisation...');
    
    // Récupération des éléments DOM
    this.fileInput = document.getElementById('audioFile');
    this.playPauseButton = document.getElementById('playPauseButton');
    
    this.timeline = document.getElementById('timelineContainer');
    this.timelineProgress = document.getElementById('timelineProgress');
    this.timelineHandle = document.getElementById('timelineHandle');
    this.positionDisplay = document.getElementById('positionDisplay');
    
    this.audioStatus = document.getElementById('audioStatus');
    this.speedDisplay = document.getElementById('speedDisplay');
    this.volumeDisplay = document.getElementById('volumeDisplay');
    
    this.grainSizeInput = document.getElementById('grainSizeInput');
    this.overlapInput = document.getElementById('overlapInput');
    this.windowSelect = document.getElementById('windowTypeSelect');

    this.recordButton = document.getElementById('recordButton');
    
    // Vérification des éléments essentiels
    if (!this.fileInput || !this.playPauseButton) {
      console.error('[AudioUIController] Éléments UI audio essentiels manquants');
      return false;
    }
    
    // Configuration des événements
    this.setupEventListeners();
    
    console.log('[AudioUIController] Interface audio configurée');
    return true;
  }

  /**
   * Configure tous les écouteurs d'événements
   * @private
   */
  setupEventListeners() {
    // Fichier audio
    if (this.fileInput && this.onFileSelect) {
      const handler = (event) => this.onFileSelect(event);
      this.handlers.set(this.fileInput, { event: 'change', handler });
      this.fileInput.addEventListener('change', handler);
    }
    
    // Play/Pause
    if (this.playPauseButton && this.onPlayPauseToggle) {
      const handler = () => this.onPlayPauseToggle();
      this.handlers.set(this.playPauseButton, { event: 'click', handler });
      this.playPauseButton.addEventListener('click', handler);
    }
    
    // Timeline
    if (this.timeline && this.onTimelineClick) {
      const handler = (event) => this.onTimelineClick(event);
      this.handlers.set(this.timeline, { event: 'click', handler });
      this.timeline.addEventListener('click', handler);
    }
    
    // Grain size
    if (this.grainSizeInput && this.onGrainSizeChange) {
      const handler = (event) => this.onGrainSizeChange(event);
      this.handlers.set(this.grainSizeInput, { event: 'input', handler });
      this.grainSizeInput.addEventListener('input', handler);
    }
    
    // Overlap
    if (this.overlapInput && this.onOverlapChange) {
      const handler = (event) => this.onOverlapChange(event);
      this.handlers.set(this.overlapInput, { event: 'input', handler });
      this.overlapInput.addEventListener('input', handler);
    }
    
    // Window type
    if (this.windowSelect && this.onWindowChange) {
      const handler = (event) => this.onWindowChange(event);
      this.handlers.set(this.windowSelect, { event: 'change', handler });
      this.windowSelect.addEventListener('change', handler);
    }

    // Record button
    if (this.recordButton && this.onRecordToggle) {
      const handler = () => this.onRecordToggle();
      this.handlers.set(this.recordButton, { event: 'click', handler });
      this.recordButton.addEventListener('click', handler);
    }
  }

  /**
   * Met à jour l'affichage complet de l'interface audio
   * @param {Object} state - État audio
   * @param {Object} state.audioState - État de lecture
   * @param {Object} state.currentFile - Fichier audio actuel
   * @param {boolean} state.isRecording - État enregistrement
   * @public
   */
  updateUI(state) {
    this.updatePlayPauseButton(state.audioState, state.currentFile);
    this.updateRecordButton(state.audioState, state.currentFile, state.isRecording);
    this.updateTimeline(state.audioState);
    this.updatePosition(state.audioState);
    this.updateStatus(state.audioState);
    this.updateVolumeDisplay(state.audioState);
  }

  /**
   * Met à jour le bouton play/pause
   * @param {Object} audioState - État audio
   * @param {Object} currentFile - Fichier actuel
   * @private
   */
  updatePlayPauseButton(audioState, currentFile) {
    if (!this.playPauseButton) return;
    
    const playIcon = this.playPauseButton.querySelector('.play-icon');
    const pauseIcon = this.playPauseButton.querySelector('.pause-icon');
    
    // FIX TypeScript: Cast en HTMLButtonElement pour accéder à disabled
    const button = /** @type {HTMLButtonElement} */ (this.playPauseButton);
    
    if (!currentFile) {
      button.disabled = true;
      if (playIcon) {
        const playEl = /** @type {HTMLElement} */ (playIcon);
        playEl.style.display = 'inline';
      }
      if (pauseIcon) {
        const pauseEl = /** @type {HTMLElement} */ (pauseIcon);
        pauseEl.style.display = 'none';
      }
    } else {
      button.disabled = false;
      if (audioState.isPlaying) {
        if (playIcon) {
          const playEl = /** @type {HTMLElement} */ (playIcon);
          playEl.style.display = 'none';
        }
        if (pauseIcon) {
          const pauseEl = /** @type {HTMLElement} */ (pauseIcon);
          pauseEl.style.display = 'inline';
        }
      } else {
        if (playIcon) {
          const playEl = /** @type {HTMLElement} */ (playIcon);
          playEl.style.display = 'inline';
        }
        if (pauseIcon) {
          const pauseEl = /** @type {HTMLElement} */ (pauseIcon);
          pauseEl.style.display = 'none';
        }
      }
    }
  }

  /**
   * Met à jour le bouton d'enregistrement
   * @param {Object} audioState - État audio
   * @param {Object} currentFile - Fichier actuel
   * @param {boolean} isRecording - En cours d'enregistrement
   * @private
   */
  updateRecordButton(audioState, currentFile, isRecording) {
    if (!this.recordButton) return;
    
    // FIX TypeScript: Cast en HTMLButtonElement
    const button = /** @type {HTMLButtonElement} */ (this.recordButton);
    
    if (currentFile && audioState.isPlaying) {
      button.disabled = false;
      button.style.backgroundColor = isRecording ? '#e74c3c' : '#f39c12';
      button.title = isRecording 
        ? 'Arrêter l\'enregistrement' 
        : 'Démarrer l\'enregistrement';
    } else {
      button.disabled = true;
      button.style.backgroundColor = '#95a5a6';
      button.title = 'Démarrez la lecture pour enregistrer';
    }
  }

  /**
   * Met à jour la timeline (barre de progression)
   * @param {Object} audioState - État audio
   * @private
   */
  updateTimeline(audioState) {
    if (!this.timelineProgress || audioState.duration === 0) return;
    
    const percent = (audioState.currentPosition / audioState.duration) * 100;
    
    // FIX TypeScript: Cast en HTMLElement
    const progressEl = /** @type {HTMLElement} */ (this.timelineProgress);
    progressEl.style.width = `${percent}%`;
    
    if (this.timelineHandle) {
      const handleEl = /** @type {HTMLElement} */ (this.timelineHandle);
      handleEl.style.left = `${percent}%`;
    }
  }

  /**
   * Met à jour l'affichage de la position temporelle
   * @param {Object} audioState - État audio
   * @private
   */
  updatePosition(audioState) {
    if (!this.positionDisplay) return;
    
    const current = this.formatTime(audioState.currentPosition);
    const total = this.formatTime(audioState.duration);
    this.positionDisplay.textContent = `${current} / ${total}`;
  }

  /**
   * Met à jour le statut de lecture
   * @param {Object} audioState - État audio
   * @private
   */
  updateStatus(audioState) {
    if (!this.audioStatus) return;
    
    this.audioStatus.textContent = `État: ${audioState.isPlaying ? 'Lecture' : 'Arrêté'}`;
  }

  /**
   * Met à jour l'affichage du volume
   * @param {Object} audioState - État audio
   * @public
   */
  updateVolumeDisplay(audioState) {
    if (!this.volumeDisplay) return;
    
    this.volumeDisplay.textContent = `Volume: ${Math.round(audioState.volume * 100)}%`;
  }

  /**
   * Met à jour l'affichage de la vitesse de lecture
   * @param {number} rate - Vitesse de lecture
   * @param {number} direction - Direction (1=avant, -1=arrière)
   * @param {boolean} isNeutral - En zone neutre
   * @public
   */
  updateSpeedDisplay(rate, direction, isNeutral = false) {
    if (!this.speedDisplay) return;
    
    const arrow = direction >= 0 ? '→' : '←';
    this.speedDisplay.textContent = `Vitesse: ${rate.toFixed(2)}x ${arrow}`;
    
    // FIX TypeScript: Cast en HTMLElement
    const displayEl = /** @type {HTMLElement} */ (this.speedDisplay);
    
    // Couleur selon l'état
    if (isNeutral) {
      displayEl.style.color = '#2ecc71'; // Vert pour zone neutre
    } else if (direction >= 0) {
      displayEl.style.color = '#3498db'; // Bleu pour avant
    } else {
      displayEl.style.color = '#e74c3c'; // Rouge pour arrière
    }
  }

  /**
   * Met à jour l'affichage de la valeur grain size
   * @param {number} value - Valeur en ms
   * @public
   */
  updateGrainSizeDisplay(value) {
    const display = document.getElementById('grainSizeValue');
    if (display) {
      display.textContent = `${value} ms`;
    }
  }

  /**
   * Met à jour l'affichage de la valeur overlap
   * @param {number} value - Valeur en %
   * @public
   */
  updateOverlapDisplay(value) {
    const display = document.getElementById('overlapValue');
    if (display) {
      display.textContent = `${value}%`;
    }
  }

  /**
   * Formate un temps en secondes vers MM:SS
   * @param {number} seconds - Temps en secondes
   * @returns {string} - Temps formaté
   * @public
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Récupère la position du clic sur la timeline en pourcentage
   * @param {MouseEvent} event - Événement click
   * @returns {number} - Position en pourcentage (0-100)
   * @public
   */
  getTimelineClickPosition(event) {
    if (!this.timeline) return 0;
    
    const rect = this.timeline.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    return (clickX / rect.width) * 100;
  }

  /**
   * Récupère toutes les références DOM
   * @returns {Object} - Objet contenant toutes les références
   * @public
   */
  getUIReferences() {
    return {
      fileInput: this.fileInput,
      playPauseButton: this.playPauseButton,
      timeline: this.timeline,
      timelineProgress: this.timelineProgress,
      timelineHandle: this.timelineHandle,
      positionDisplay: this.positionDisplay,
      audioStatus: this.audioStatus,
      speedDisplay: this.speedDisplay,
      volumeDisplay: this.volumeDisplay,
      grainSizeInput: this.grainSizeInput,
      overlapInput: this.overlapInput,
      windowSelect: this.windowSelect,
      recordButton: this.recordButton
    };
  }

  /**
   * Réinitialise l'interface audio
   * @public
   */
  reset() {
    if (this.positionDisplay) {
      this.positionDisplay.textContent = '0:00 / 0:00';
    }
    
    if (this.timelineProgress) {
      const progressEl = /** @type {HTMLElement} */ (this.timelineProgress);
      progressEl.style.width = '0%';
    }
    
    if (this.timelineHandle) {
      const handleEl = /** @type {HTMLElement} */ (this.timelineHandle);
      handleEl.style.left = '0%';
    }
    
    if (this.audioStatus) {
      this.audioStatus.textContent = 'État: Arrêté';
    }
    
    if (this.speedDisplay) {
      const displayEl = /** @type {HTMLElement} */ (this.speedDisplay);
      this.speedDisplay.textContent = 'Vitesse: 1.0x →';
      displayEl.style.color = '#2ecc71';
    }
    
    if (this.volumeDisplay) {
      this.volumeDisplay.textContent = 'Volume: 80%';
    }
  }

  /**
   * Nettoie les ressources
   * @public
   */
  dispose() {
    console.log('[AudioUIController] Nettoyage...');
    
    // Suppression des event listeners
    this.handlers.forEach((data, element) => {
      element.removeEventListener(data.event, data.handler);
    });
    this.handlers.clear();
    
    // Nettoyage des références
    this.fileInput = null;
    this.playPauseButton = null;
    this.timeline = null;
    this.timelineProgress = null;
    this.timelineHandle = null;
    this.positionDisplay = null;
    this.audioStatus = null;
    this.speedDisplay = null;
    this.volumeDisplay = null;
    this.grainSizeInput = null;
    this.overlapInput = null;
    this.windowSelect = null;
    this.recordButton = null;

    // Nettoyage des callbacks
    this.onFileSelect = null;
    this.onPlayPauseToggle = null;
    this.onTimelineClick = null;
    this.onGrainSizeChange = null;
    this.onOverlapChange = null;
    this.onWindowChange = null;
    this.onRecordToggle = null;
    
    console.log('[AudioUIController] Nettoyé');
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioUIController;
}