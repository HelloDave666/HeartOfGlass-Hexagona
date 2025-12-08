/**
 * RepositioningDetector.js
 *
 * Service de détection du repositionnement de la main
 *
 * Responsabilités :
 * - Détecter quand l'utilisateur repositionne sa main (vélocité < seuil)
 * - Geler les paramètres audio pendant le repositionnement
 * - Gérer les transitions entrée/sortie de repositionnement
 * - Timeout si repositionnement trop long
 *
 * Architecture: Core/Domain/Services
 */

class RepositioningDetector {
  constructor(config) {
    this.config = config;
  }

  /**
   * Détecte et gère le repositionnement
   *
   * @param {number} angularVelocity - Vélocité angulaire actuelle
   * @param {number} now - Timestamp actuel
   * @param {Object} state - État actuel {isRepositioning, repositionStartTime, smoothedPlaybackRate, currentDirection}
   * @returns {Object} {isRepositioning, stateUpdates, event}
   */
  detectRepositioning(angularVelocity, now, state) {
    const {
      isRepositioning,
      repositionStartTime,
      smoothedPlaybackRate,
      currentDirection
    } = state;

    // CAS 1: ENTRÉE EN REPOSITIONNEMENT
    if (!isRepositioning && angularVelocity < this.config.repositionThreshold) {
      return {
        isRepositioning: true,
        stateUpdates: {
          isRepositioning: true,
          repositionStartTime: now,
          frozenPlaybackRate: smoothedPlaybackRate,
          frozenDirection: currentDirection
        },
        event: {
          type: 'REPOSITION_START',
          frozenPlaybackRate: smoothedPlaybackRate,
          frozenDirection: currentDirection
        }
      };
    }

    // CAS 2: SORTIE DE REPOSITIONNEMENT (vélocité revenue)
    if (isRepositioning && angularVelocity >= this.config.repositionThreshold) {
      const repositionDuration = now - repositionStartTime;

      // Repositionnement trop court → annuler
      if (repositionDuration < this.config.repositionMinDuration) {
        return {
          isRepositioning: false,
          stateUpdates: {
            isRepositioning: false,
            repositionStartTime: null
          },
          event: {
            type: 'REPOSITION_CANCELLED',
            duration: repositionDuration
          }
        };
      }

      // Repositionnement valide → fin
      return {
        isRepositioning: false,
        stateUpdates: {
          isRepositioning: false,
          repositionStartTime: null
        },
        event: {
          type: 'REPOSITION_END',
          duration: repositionDuration
        }
      };
    }

    // CAS 3: REPOSITIONNEMENT TROP LONG (timeout)
    if (isRepositioning && (now - repositionStartTime) > this.config.repositionMaxDuration) {
      return {
        isRepositioning: false,
        stateUpdates: {
          isRepositioning: false,
          repositionStartTime: null
        },
        event: {
          type: 'REPOSITION_TIMEOUT',
          duration: now - repositionStartTime
        }
      };
    }

    // CAS 4: PAS DE CHANGEMENT
    return {
      isRepositioning,
      stateUpdates: {},
      event: null
    };
  }
}

module.exports = RepositioningDetector;
