/**
 * ExerciseStateManager.js
 *
 * Service de gestion de l'état de l'exercice RotationContinue
 *
 * Responsabilités :
 * - Créer l'état initial de l'exercice
 * - Réinitialiser l'état lors du start()
 * - Centraliser la définition de l'état par défaut
 *
 * Architecture: Core/Domain/Services
 */

class ExerciseStateManager {
  constructor(config) {
    this.config = config;
  }

  /**
   * Crée l'état initial complet de l'exercice
   *
   * @returns {Object} État initial
   */
  createInitialState() {
    return {
      // Historique et buffers
      lastAngles: { x: 0, y: 0, z: 0 },
      lastTimestamp: null,
      rotationHistory: [],
      velocityBuffer: [],

      // Vélocité et playback
      lastAngularVelocity: 0,
      lastPlaybackRate: 1.0,
      smoothedPlaybackRate: 1.0,
      averageVelocity: 0,
      isInComfortZone: false,

      // Lissage adaptatif
      currentVariance: 0,
      adaptiveSmoothingFactor: this.config.smoothingFactor,

      // Détection prédictive
      currentAngularAcceleration: 0,
      lastVelocityTimestamp: 0,

      // Détection direction
      signedDeltaBuffer: [],
      currentDirection: 1,
      lastDirectionChangeTime: Date.now(),
      directionChangeCandidate: null,
      directionCandidateStartTime: 0,
      directionConsensusHistory: [],

      // Transition direction
      isInDirectionTransition: false,
      directionTransitionStartTime: 0,

      // Repositionnement
      isRepositioning: false,
      repositionStartTime: null,
      frozenPlaybackRate: 1.0,
      frozenDirection: 1,

      // Volume (capteur gauche)
      cumulativeVolumeAngle: 0,
      lastLeftSensorTimestamp: 0,
      leftSensorAngle: 0,
      currentVolume: this.config.volumeInitialValue,
      smoothedVolume: this.config.volumeInitialValue,
      lastVolumeCommand: {
        volume: this.config.volumeInitialValue,
        timestamp: 0
      },

      // Compteurs
      updateCount: 0,
      audioCommandCount: 0,
      lastAudioCommand: {
        rate: 1.0,
        direction: 1,
        timestamp: 0
      }
    };
  }

  /**
   * Réinitialise l'état pour un nouveau démarrage
   * (utilisé dans start())
   *
   * @returns {Object} État réinitialisé
   */
  resetState() {
    const now = Date.now();

    return {
      // Historique et buffers
      lastTimestamp: null,
      rotationHistory: [],
      lastAngles: { x: 0, y: 0, z: 0 },
      velocityBuffer: [],
      averageVelocity: 0,
      isInComfortZone: false,

      // Lissage adaptatif et détection prédictive
      currentVariance: 0,
      adaptiveSmoothingFactor: this.config.smoothingFactor,
      currentAngularAcceleration: 0,
      lastVelocityTimestamp: 0,
      smoothedPlaybackRate: 1.0,

      // Détection direction
      signedDeltaBuffer: [],
      currentDirection: 1,
      lastDirectionChangeTime: now,
      directionChangeCandidate: null,
      directionCandidateStartTime: 0,
      directionConsensusHistory: [],

      // Transition direction
      isInDirectionTransition: false,
      directionTransitionStartTime: 0,

      // Repositionnement
      isRepositioning: false,
      repositionStartTime: null,
      frozenPlaybackRate: 1.0,
      frozenDirection: 1,

      // Volume (position centrale)
      leftSensorAngle: 0,
      currentVolume: this.config.volumeInitialValue,
      smoothedVolume: this.config.volumeInitialValue,
      lastVolumeCommand: {
        volume: this.config.volumeInitialValue,
        timestamp: 0
      },

      // Compteurs
      updateCount: 0,
      audioCommandCount: 0,
      lastAudioCommand: {
        rate: 1.0,
        direction: 1,
        timestamp: 0
      }
    };
  }

  /**
   * Applique un état réinitialisé à un objet cible (l'adapter)
   *
   * @param {Object} target - L'objet adapter à mettre à jour
   */
  applyResetState(target) {
    const resetState = this.resetState();

    Object.keys(resetState).forEach(key => {
      target[key] = resetState[key];
    });
  }

  /**
   * Applique l'état initial à un objet cible (l'adapter)
   *
   * @param {Object} target - L'objet adapter à initialiser
   */
  applyInitialState(target) {
    const initialState = this.createInitialState();

    Object.keys(initialState).forEach(key => {
      target[key] = initialState[key];
    });
  }
}

module.exports = ExerciseStateManager;
