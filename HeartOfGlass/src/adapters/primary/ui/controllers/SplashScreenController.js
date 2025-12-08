/**
 * SplashScreenController - Contrôleur pour l'écran d'introduction
 *
 * Gère l'affichage du splash screen au lancement de l'application.
 *
 * Architecture : Adapters/Primary/UI/Controllers
 */
const path = require('path');
const SplashScreen = require('../components/SplashScreen');

class SplashScreenController {
  /**
   * @param {Object} config - Configuration
   * @param {string} config.imagePath - Chemin de l'image d'intro
   * @param {number} config.duration - Durée d'affichage (ms)
   * @param {boolean} config.skippable - Peut être skip
   */
  constructor(config = {}) {
    this.config = {
      imagePath: config.imagePath || null,
      duration: config.duration || 3000,
      skippable: config.skippable !== false
    };

    this.splashScreen = new SplashScreen();
    this.isShowing = false;

    console.log('[SplashScreenController] Initialized', this.config);
  }

  /**
   * Affiche le splash screen
   * @param {Function} onComplete - Callback quand terminé
   * @returns {Promise<void>}
   */
  async show(onComplete) {
    if (this.isShowing) {
      console.warn('[SplashScreenController] Already showing');
      return;
    }

    this.isShowing = true;

    return new Promise((resolve) => {
      // Afficher le splash
      this.splashScreen.show({
        imagePath: this.config.imagePath,
        duration: this.config.duration,
        onComplete: () => {
          this.isShowing = false;

          if (onComplete) {
            onComplete();
          }

          resolve();
        }
      });

      // Activer le skip si configuré
      if (this.config.skippable) {
        this.splashScreen.enableSkip(() => {
          this.isShowing = false;

          if (onComplete) {
            onComplete();
          }

          resolve();
        });
      }
    });
  }

  /**
   * Cache le splash screen
   */
  hide() {
    if (this.splashScreen) {
      this.splashScreen.hideImmediately();
      this.isShowing = false;
    }
  }

  /**
   * Définit le chemin de l'image
   * @param {string} imagePath - Chemin relatif ou absolu
   */
  setImagePath(imagePath) {
    this.config.imagePath = imagePath;
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    if (this.splashScreen) {
      this.splashScreen.destroy();
      this.splashScreen = null;
    }
  }
}

module.exports = SplashScreenController;
