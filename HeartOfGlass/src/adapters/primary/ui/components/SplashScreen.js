/**
 * SplashScreen - Composant pour l'écran d'introduction
 *
 * Affiche une image/animation d'introduction au lancement de l'application.
 * Disparaît automatiquement après un délai configurable.
 *
 * Architecture : Adapters/Primary/UI/Components
 */
class SplashScreen {
  constructor() {
    this.container = null;
    this.isVisible = false;
    this.hideTimeout = null;
  }

  /**
   * Crée la structure DOM du splash screen
   * @private
   */
  _createDOM() {
    this.container = document.createElement('div');
    this.container.id = 'splash-screen';
    this.container.className = 'splash-screen';

    this.container.innerHTML = `
      <div class="splash-content">
        <img class="splash-image" src="" alt="Heart of Glass">
      </div>
    `;

    // Injecter les styles
    this._injectStyles();

    // Ajouter au DOM
    document.body.appendChild(this.container);
  }

  /**
   * Injecte les styles CSS
   * @private
   */
  _injectStyles() {
    const styleId = 'splash-screen-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .splash-screen {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: #000;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 1;
        transition: opacity 0.8s ease;
      }

      .splash-screen.fade-out {
        opacity: 0;
        pointer-events: none;
      }

      .splash-content {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .splash-image {
        max-width: 1920px;
        max-height: 1080px;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Affiche le splash screen
   * @param {Object} options - Options d'affichage
   * @param {string} options.imagePath - Chemin de l'image (peut être .gif animé)
   * @param {number} options.duration - Durée d'affichage en ms (défaut: 3000)
   * @param {Function} options.onComplete - Callback quand le splash disparaît
   */
  show({ imagePath, duration = 3000, onComplete } = {}) {
    if (this.isVisible) {
      console.warn('[SplashScreen] Already visible');
      return;
    }

    // Créer le DOM si pas encore fait
    if (!this.container) {
      this._createDOM();
    }

    // Définir l'image
    const img = this.container.querySelector('.splash-image');
    if (imagePath) {
      img.src = imagePath;
    }

    // Afficher
    this.container.classList.remove('fade-out');
    this.isVisible = true;

    console.log(`[SplashScreen] Showing for ${duration}ms`);

    // Programmer la disparition
    this.hideTimeout = setTimeout(() => {
      this.hide(onComplete);
    }, duration);
  }

  /**
   * Cache le splash screen
   * @param {Function} onComplete - Callback optionnel
   */
  hide(onComplete) {
    if (!this.isVisible) return;

    console.log('[SplashScreen] Hiding...');

    // Fade out
    this.container.classList.add('fade-out');

    // Attendre la fin de la transition
    setTimeout(() => {
      this.isVisible = false;

      // Callback
      if (onComplete) {
        onComplete();
      }

      console.log('[SplashScreen] Hidden');
    }, 800); // Durée de la transition CSS
  }

  /**
   * Cache immédiatement (sans transition)
   */
  hideImmediately() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    if (this.container) {
      this.container.style.display = 'none';
      this.isVisible = false;
    }
  }

  /**
   * Permet de skip le splash screen (click ou touche)
   */
  enableSkip(onSkip) {
    const skipHandler = (e) => {
      // Skip sur click ou Espace/Enter
      if (e.type === 'click' || e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();

        if (this.hideTimeout) {
          clearTimeout(this.hideTimeout);
          this.hideTimeout = null;
        }

        this.hide(onSkip);

        // Retirer les listeners
        document.removeEventListener('click', skipHandler);
        document.removeEventListener('keydown', skipHandler);
      }
    };

    document.addEventListener('click', skipHandler);
    document.addEventListener('keydown', skipHandler);
  }

  /**
   * Détruit le composant
   */
  destroy() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.container = null;
    this.isVisible = false;
  }
}

module.exports = SplashScreen;
