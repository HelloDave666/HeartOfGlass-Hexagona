/**
 * ProcessSensorUpdateUseCase.js
 *
 * Use Case pour traiter les mises à jour des capteurs et orchestrer tous les services de domaine
 *
 * Responsabilités :
 * - Valider les données capteur
 * - Orchestrer les services de domaine (DirectionDetector, SensorAnalyzer, PlaybackCalculator)
 * - Calculer les commandes audio à exécuter
 * - Retourner les mises à jour d'état et commandes
 *
 * Architecture: Core/UseCases (Hexagonal Architecture)
 */

class ProcessSensorUpdateUseCase {
  constructor({
    directionDetector,
    sensorAnalyzer,
    playbackCalculator,
    config,
    calibrationOrchestrator
  }) {
    this.directionDetector = directionDetector;
    this.sensorAnalyzer = sensorAnalyzer;
    this.playbackCalculator = playbackCalculator;
    this.config = config;
    this.calibrationOrchestrator = calibrationOrchestrator;
  }

  /**
   * Traite une mise à jour de capteur DROIT (contrôle de vitesse)
   *
   * @param {Object} input - Données d'entrée
   * @param {Object} input.sensorData - Données capteur {angles, gyro}
   * @param {number} input.now - Timestamp actuel
   * @param {Object} input.state - État actuel de l'exercice
   * @returns {Object} Résultat {shouldSkip, commands, stateUpdates}
   */
  processRightSensor(input) {
    const { sensorData, now, state } = input;
    const angles = sensorData.angles || sensorData;
    const gyro = sensorData.gyro || { x: 0, y: 0, z: 0 };

    // 1. VALIDATION INITIALE
    // Premier échantillon - initialiser seulement
    if (state.lastTimestamp === null) {
      return {
        shouldSkip: true,
        reason: 'FIRST_SAMPLE',
        stateUpdates: {
          lastTimestamp: now,
          lastAngles: { ...angles }
        }
      };
    }

    // 2. VALIDATION DT
    const dt = (now - state.lastTimestamp) / 1000;

    if (dt < this.config.minValidDt) {
      return {
        shouldSkip: true,
        reason: 'DT_TOO_SMALL'
      };
    }

    if (dt > this.config.maxValidDt) {
      return {
        shouldSkip: true,
        reason: 'DT_ABERRANT',
        stateUpdates: {
          lastTimestamp: now,
          lastAngles: { ...angles }
        }
      };
    }

    // 3. EXTRACTION VITESSE ANGULAIRE
    let gyroY = gyro.y; // SIGNED: >0 = horaire, <0 = antihoraire
    let angularVelocity = Math.abs(gyroY);

    // 4. DEAD ZONE DYNAMIQUE
    const currentDeadZone = this.directionDetector.updateDynamicDeadZone(angularVelocity);

    if (angularVelocity < currentDeadZone) {
      gyroY = 0;
      angularVelocity = 0;
    }

    // 5. VALIDATION VITESSE ABERRANTE
    if (angularVelocity > 2000) {
      return {
        shouldSkip: true,
        reason: 'VELOCITY_ABERRANT',
        stateUpdates: {
          lastTimestamp: now,
          lastAngles: { ...angles }
        }
      };
    }

    // 6. DÉTECTION DIRECTION (délégué à l'adapter car modifie state complexe)
    // Cette partie reste dans l'adapter pour l'instant

    // 7. DÉTECTION REPOSITIONNEMENT
    const repositionResult = this._processRepositioning(angularVelocity, now, state);

    // 8. CALCUL VARIANCE (pour lissage adaptatif)
    const variance = this._calculateBufferVariance(state.velocityBuffer);

    // 9. RETOURNER LES DONNÉES PROCESSÉES
    return {
      shouldSkip: false,
      processedData: {
        gyroY,
        angularVelocity,
        currentDeadZone,
        variance
      },
      stateUpdates: {
        lastAngularVelocity: angularVelocity,
        lastTimestamp: now,
        lastAngles: { ...angles },
        currentVariance: variance,
        ...repositionResult.stateUpdates
      },
      repositionResult
    };
  }

  /**
   * Calcule les commandes audio à partir de l'état actuel
   *
   * @param {Object} input - Données d'entrée
   * @param {Object} input.state - État actuel
   * @param {number} input.now - Timestamp actuel
   * @returns {Object} Commandes audio {playbackRate, direction, context}
   */
  calculateAudioCommand(input) {
    const { state, now } = input;

    // 1. VÉRIFIER SI ASSEZ D'ÉCHANTILLONS
    if (state.velocityBuffer.length < this.config.minSamplesForDecision) {
      return {
        shouldSkip: true,
        reason: 'NOT_ENOUGH_SAMPLES'
      };
    }

    // 2. MODE REPOSITIONNEMENT
    if (state.isRepositioning && this.config.freezePlaybackDuringReposition) {
      return {
        shouldSkip: false,
        command: {
          playbackRate: state.frozenPlaybackRate,
          direction: state.frozenDirection,
          context: 'REPOSITION'
        }
      };
    }

    // 3. CALCUL TARGET PLAYBACK RATE via PlaybackCalculator
    const transitionElapsed = state.isInDirectionTransition
      ? now - state.directionTransitionStartTime
      : 0;

    const targetPlaybackRate = this.playbackCalculator.calculateTargetRate(
      state.averageVelocity,
      state.isInDirectionTransition,
      transitionElapsed
    );

    // 4. LISSAGE ADAPTATIF via PlaybackCalculator
    const smoothingFactor = this.playbackCalculator.calculateAdaptiveSmoothingFactor(
      state.currentVariance
    );

    const smoothedPlaybackRate = this.playbackCalculator.smoothPlaybackRate(
      state.smoothedPlaybackRate,
      targetPlaybackRate,
      smoothingFactor
    );

    // 5. GESTION FIN DE TRANSITION
    let transitionEnded = false;
    if (state.isInDirectionTransition) {
      const elapsed = now - state.directionTransitionStartTime;
      if (elapsed >= this.config.directionTransitionDuration) {
        transitionEnded = true;
      }
    }

    // 6. RETOURNER COMMANDE
    return {
      shouldSkip: false,
      command: {
        playbackRate: smoothedPlaybackRate,
        direction: state.currentDirection,
        context: 'PROGRESSIVE'
      },
      stateUpdates: {
        smoothedPlaybackRate,
        adaptiveSmoothingFactor: smoothingFactor,
        isInDirectionTransition: transitionEnded ? false : state.isInDirectionTransition
      },
      metrics: {
        targetPlaybackRate,
        smoothingFactor,
        transitionEnded
      }
    };
  }

  /**
   * Met à jour la détection de direction
   * Encapsule toute la logique de consensus, stabilité, et changement de direction
   *
   * @param {Object} input - Données d'entrée
   * @param {number} input.gyroY - Vitesse angulaire signée (°/s)
   * @param {number} input.now - Timestamp actuel
   * @param {Object} input.state - État actuel de direction
   * @returns {Object} Résultat {directionChanged, stateUpdates}
   */
  updateDirection(input) {
    const { gyroY, now, state } = input;

    // 1. AJOUTER AU BUFFER
    const signedDeltaBuffer = [...state.signedDeltaBuffer];
    signedDeltaBuffer.push({
      delta: gyroY,
      timestamp: now
    });

    // Garder seulement les N derniers échantillons
    if (signedDeltaBuffer.length > this.config.directionWindowSize) {
      signedDeltaBuffer.shift();
    }

    // 2. ATTENDRE ASSEZ D'ÉCHANTILLONS
    if (signedDeltaBuffer.length < this.config.directionWindowSize) {
      return {
        directionChanged: false,
        stateUpdates: {
          signedDeltaBuffer
        }
      };
    }

    // 3. VÉLOCITÉ TROP FAIBLE
    if (state.lastAngularVelocity < this.config.directionDetectionMinVelocity) {
      return {
        directionChanged: false,
        stateUpdates: {
          signedDeltaBuffer,
          directionChangeCandidate: null,
          directionCandidateStartTime: 0
        }
      };
    }

    // 4. DÉTECTION PASSAGE PAR ZÉRO
    let lastDirectionChangeTime = state.lastDirectionChangeTime;
    if (this.config.directionZeroCrossingReset &&
        state.lastAngularVelocity < this.config.directionZeroCrossingThreshold) {
      lastDirectionChangeTime = 0;
    }

    // 5. ZONE MORTE ANTI-OSCILLATION
    const timeSinceLastChange = now - lastDirectionChangeTime;
    if (timeSinceLastChange < this.config.directionChangeLockTime) {
      return {
        directionChanged: false,
        stateUpdates: {
          signedDeltaBuffer,
          directionChangeCandidate: null,
          directionCandidateStartTime: 0,
          lastDirectionChangeTime
        }
      };
    }

    // 6. DÉTECTER DIRECTION CANDIDATE
    const candidateDirection = this.directionDetector.detectDirection(
      signedDeltaBuffer,
      this.calibrationOrchestrator
    );

    // 7. VÉRIFIER CONSENSUS SI ACTIVÉ
    let directionConsensusHistory = [...state.directionConsensusHistory];
    if (this.config.directionConsensusConfirmationEnabled) {
      directionConsensusHistory.push({
        direction: candidateDirection,
        timestamp: now
      });

      const maxHistory = this.config.directionConsensusConfirmationFrames;
      if (directionConsensusHistory.length > maxHistory) {
        directionConsensusHistory.shift();
      }

      const isConsensusStable = this.directionDetector.checkConsensusStability(
        directionConsensusHistory,
        candidateDirection
      );

      if (!isConsensusStable) {
        return {
          directionChanged: false,
          stateUpdates: {
            signedDeltaBuffer,
            directionConsensusHistory,
            directionChangeCandidate: null,
            directionCandidateStartTime: 0,
            lastDirectionChangeTime
          }
        };
      }
    }

    // 8. VÉRIFIER VALIDITÉ CANDIDATE
    if (candidateDirection === null || candidateDirection === state.currentDirection) {
      return {
        directionChanged: false,
        stateUpdates: {
          signedDeltaBuffer,
          directionConsensusHistory,
          directionChangeCandidate: null,
          directionCandidateStartTime: 0,
          lastDirectionChangeTime
        }
      };
    }

    // 9. NOUVELLE CANDIDATE
    if (state.directionChangeCandidate !== candidateDirection) {
      return {
        directionChanged: false,
        stateUpdates: {
          signedDeltaBuffer,
          directionConsensusHistory,
          directionChangeCandidate: candidateDirection,
          directionCandidateStartTime: now,
          lastDirectionChangeTime
        }
      };
    }

    // 10. DÉTECTION PRÉDICTIVE PAR ACCÉLÉRATION
    let requiredStabilityTime = this.config.directionStabilityTime;
    if (this.config.predictiveDetectionEnabled) {
      const absAcceleration = Math.abs(state.currentAngularAcceleration);
      if (absAcceleration > this.config.accelerationThreshold) {
        requiredStabilityTime = Math.max(
          50,
          this.config.directionStabilityTime - this.config.earlyDetectionBonus
        );
      }
    }

    // 11. VÉRIFIER STABILITÉ
    const candidateStabilityDuration = now - state.directionCandidateStartTime;
    if (candidateStabilityDuration < requiredStabilityTime) {
      return {
        directionChanged: false,
        stateUpdates: {
          signedDeltaBuffer,
          directionConsensusHistory,
          lastDirectionChangeTime
        }
      };
    }

    // 12. CHANGER LA DIRECTION !
    const oldDirection = state.currentDirection;
    const avgGyro = signedDeltaBuffer.reduce((sum, s) => sum + s.delta, 0) / signedDeltaBuffer.length;

    return {
      directionChanged: true,
      oldDirection,
      newDirection: candidateDirection,
      stateUpdates: {
        signedDeltaBuffer,
        directionConsensusHistory,
        currentDirection: candidateDirection,
        lastDirectionChangeTime: now,
        directionChangeCandidate: null,
        directionCandidateStartTime: 0,
        isInDirectionTransition: true,
        directionTransitionStartTime: now
      },
      metrics: {
        avgGyro,
        candidateStabilityDuration,
        predictiveBonus: requiredStabilityTime < this.config.directionStabilityTime
      }
    };
  }

  /**
   * Détecte et gère le repositionnement
   * @private
   */
  _processRepositioning(angularVelocity, now, state) {
    let isRepositioning = state.isRepositioning;
    let repositionStartTime = state.repositionStartTime;
    let frozenPlaybackRate = state.frozenPlaybackRate;
    let frozenDirection = state.frozenDirection;
    let repositionEvent = null;

    // Début repositionnement
    if (!isRepositioning && angularVelocity < this.config.repositionThreshold) {
      isRepositioning = true;
      repositionStartTime = now;
      frozenPlaybackRate = state.smoothedPlaybackRate;
      frozenDirection = state.currentDirection;
      repositionEvent = 'START';
    }

    // Fin repositionnement
    if (isRepositioning && angularVelocity >= this.config.repositionThreshold) {
      const repositionDuration = now - repositionStartTime;

      if (repositionDuration >= this.config.repositionMinDuration) {
        isRepositioning = false;
        repositionStartTime = null;
        repositionEvent = 'END';
      }
    }

    // Repositionnement trop long
    if (isRepositioning && (now - repositionStartTime) > this.config.repositionMaxDuration) {
      isRepositioning = false;
      repositionStartTime = null;
      repositionEvent = 'TIMEOUT';
    }

    return {
      isRepositioning,
      repositionEvent,
      stateUpdates: {
        isRepositioning,
        repositionStartTime,
        frozenPlaybackRate,
        frozenDirection
      }
    };
  }

  /**
   * Calcule la variance du buffer de vitesses
   * @private
   */
  _calculateBufferVariance(velocityBuffer) {
    if (!velocityBuffer || velocityBuffer.length < 2) {
      return 0;
    }

    const velocities = velocityBuffer.map(s => s.velocity);
    const sum = velocities.reduce((a, b) => a + b, 0);
    const avg = sum / velocities.length;

    const squaredDiffs = velocities.map(v => Math.pow(v - avg, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / velocities.length;

    return variance;
  }
}

module.exports = ProcessSensorUpdateUseCase;
