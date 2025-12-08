/**
 * DialogueBox - Composant UI pour afficher les dialogues narratifs
 *
 * Système d'overlay qui peut apparaître par-dessus n'importe quelle vue.
 * Affiche un portrait, le nom du personnage, et le texte avec effet typewriter.
 *
 * Architecture : Adapters/Primary/UI/Components
 */
class DialogueBox {
  constructor() {
    this.container = null;
    this.isVisible = false;
    this.typewriterInterval = null;
    this.onContinueCallback = null;
    this.onSkipCallback = null;

    this._createDOM();
  }

  /**
   * Crée la structure DOM de la dialogue box
   * @private
   */
  _createDOM() {
    // Container principal (overlay)
    this.container = document.createElement('div');
    this.container.id = 'narrative-overlay';
    this.container.className = 'narrative-overlay hidden';

    this.container.innerHTML = `
      <!-- Backdrop semi-transparent -->
      <div class="narrative-backdrop"></div>

      <!-- Dialogue Box -->
      <div class="dialogue-box">
        <!-- Portrait du personnage -->
        <div class="dialogue-portrait-container">
          <img class="dialogue-portrait" src="" alt="Character">
          <div class="dialogue-character-name"></div>
        </div>

        <!-- Contenu du dialogue -->
        <div class="dialogue-content">
          <!-- Texte avec effet typewriter -->
          <div class="dialogue-text"></div>

          <!-- Boutons d'action -->
          <div class="dialogue-actions">
            <button class="dialogue-skip-btn" title="Afficher tout le texte">Skip</button>
            <button class="dialogue-continue-btn">Continuer</button>
          </div>
        </div>
      </div>

      <!-- Highlight pour tutoriel (optionnel) -->
      <div class="tutorial-highlight hidden">
        <div class="tutorial-spotlight"></div>
      </div>
    `;

    // Ajouter les styles
    this._injectStyles();

    // Attacher les event listeners
    this._attachEventListeners();

    // Ajouter au DOM (mais caché)
    document.body.appendChild(this.container);
  }

  /**
   * Injecte les styles CSS
   * @private
   */
  _injectStyles() {
    const styleId = 'narrative-overlay-styles';

    // Éviter de réinjecter
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Overlay principal */
      .narrative-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        pointer-events: none;
        transition: opacity 0.3s ease;
      }

      .narrative-overlay.hidden {
        opacity: 0;
        pointer-events: none;
      }

      .narrative-overlay:not(.hidden) {
        opacity: 1;
        pointer-events: auto;
      }

      /* Backdrop */
      .narrative-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        transition: opacity 0.3s ease;
      }

      .narrative-overlay.no-backdrop .narrative-backdrop {
        opacity: 0;
      }

      /* Dialogue Box */
      .dialogue-box {
        position: relative;
        display: flex;
        width: 90%;
        max-width: 1000px;
        margin-bottom: 40px;
        background: rgba(20, 20, 30, 0.95);
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        overflow: hidden;
        transform: translateY(20px);
        transition: transform 0.3s ease;
      }

      .narrative-overlay:not(.hidden) .dialogue-box {
        transform: translateY(0);
      }

      /* Portrait */
      .dialogue-portrait-container {
        flex-shrink: 0;
        width: 200px;
        background: rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px;
        border-right: 2px solid rgba(255, 255, 255, 0.1);
      }

      .dialogue-portrait {
        width: 150px;
        height: 150px;
        border-radius: 50%;
        border: 3px solid rgba(255, 255, 255, 0.3);
        object-fit: cover;
        margin-bottom: 15px;
        background: rgba(255, 255, 255, 0.1);
      }

      .dialogue-character-name {
        color: #fff;
        font-size: 16px;
        font-weight: bold;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      /* Contenu */
      .dialogue-content {
        flex: 1;
        padding: 30px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      .dialogue-text {
        color: #fff;
        font-size: 18px;
        line-height: 1.6;
        min-height: 100px;
        margin-bottom: 20px;
      }

      /* Actions */
      .dialogue-actions {
        display: flex;
        justify-content: flex-end;
        gap: 15px;
      }

      .dialogue-skip-btn,
      .dialogue-continue-btn {
        padding: 10px 25px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .dialogue-skip-btn {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.2);
      }

      .dialogue-skip-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.9);
      }

      .dialogue-continue-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      }

      .dialogue-continue-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
      }

      .dialogue-continue-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Tutorial Highlight */
      .tutorial-highlight {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }

      .tutorial-highlight.hidden {
        display: none;
      }

      .tutorial-spotlight {
        position: absolute;
        border: 3px solid #667eea;
        border-radius: 8px;
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7), 0 0 30px rgba(102, 126, 234, 0.8);
        transition: all 0.3s ease;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Attache les event listeners
   * @private
   */
  _attachEventListeners() {
    const continueBtn = this.container.querySelector('.dialogue-continue-btn');
    const skipBtn = this.container.querySelector('.dialogue-skip-btn');

    continueBtn.addEventListener('click', () => {
      if (this.onContinueCallback) {
        this.onContinueCallback();
      }
    });

    skipBtn.addEventListener('click', () => {
      if (this.onSkipCallback) {
        this.onSkipCallback();
      }
    });

    // Raccourci clavier : Espace ou Entrée pour continuer
    document.addEventListener('keydown', (e) => {
      if (!this.isVisible) return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (this.onContinueCallback) {
          this.onContinueCallback();
        }
      }
    });
  }

  /**
   * Affiche un dialogue
   * @param {Object} options - Options d'affichage
   * @param {string} options.characterName - Nom du personnage
   * @param {string} options.portraitPath - Chemin du portrait
   * @param {string} options.text - Texte à afficher
   * @param {number} options.typewriterSpeed - Vitesse typewriter (ms par caractère)
   * @param {boolean} options.skippable - Peut skip le typewriter
   * @param {Function} options.onContinue - Callback quand on clique Continuer
   * @param {Function} options.onComplete - Callback quand le typewriter est terminé
   */
  show(options) {
    const {
      characterName,
      portraitPath,
      text,
      typewriterSpeed = 50,
      skippable = true,
      onContinue,
      onComplete
    } = options;

    // Sauvegarder callbacks
    this.onContinueCallback = onContinue;
    this.onSkipCallback = () => this._skipTypewriter();

    // Remplir le contenu
    this.container.querySelector('.dialogue-character-name').textContent = characterName;
    this.container.querySelector('.dialogue-portrait').src = portraitPath;
    this.container.querySelector('.dialogue-text').textContent = '';

    // Gérer bouton skip
    const skipBtn = this.container.querySelector('.dialogue-skip-btn');
    skipBtn.style.display = skippable ? 'block' : 'none';

    // Désactiver bouton continuer pendant le typewriter
    const continueBtn = this.container.querySelector('.dialogue-continue-btn');
    continueBtn.disabled = true;

    // Afficher l'overlay
    this.container.classList.remove('hidden');
    this.isVisible = true;

    // Démarrer l'effet typewriter
    this._startTypewriter(text, typewriterSpeed, () => {
      // Typewriter terminé
      continueBtn.disabled = false;
      if (onComplete) {
        onComplete();
      }
    });
  }

  /**
   * Cache la dialogue box
   */
  hide() {
    this.container.classList.add('hidden');
    this.isVisible = false;
    this._stopTypewriter();
  }

  /**
   * Démarre l'effet typewriter
   * @private
   */
  _startTypewriter(text, speed, onComplete) {
    this._stopTypewriter();

    const textElement = this.container.querySelector('.dialogue-text');
    let currentIndex = 0;

    this.typewriterInterval = setInterval(() => {
      if (currentIndex < text.length) {
        textElement.textContent = text.substring(0, currentIndex + 1);
        currentIndex++;
      } else {
        this._stopTypewriter();
        if (onComplete) {
          onComplete();
        }
      }
    }, speed);
  }

  /**
   * Arrête l'effet typewriter
   * @private
   */
  _stopTypewriter() {
    if (this.typewriterInterval) {
      clearInterval(this.typewriterInterval);
      this.typewriterInterval = null;
    }
  }

  /**
   * Skip le typewriter (affiche tout le texte immédiatement)
   * @private
   */
  _skipTypewriter() {
    this._stopTypewriter();
    const textElement = this.container.querySelector('.dialogue-text');
    // Le texte complet est déjà stocké, on force juste l'affichage
    const continueBtn = this.container.querySelector('.dialogue-continue-btn');
    continueBtn.disabled = false;
  }

  /**
   * Active/désactive le backdrop
   * @param {boolean} enabled
   */
  setBackdrop(enabled) {
    if (enabled) {
      this.container.classList.remove('no-backdrop');
    } else {
      this.container.classList.add('no-backdrop');
    }
  }

  /**
   * Highlight un élément UI (pour tutoriel)
   * @param {string} selector - Sélecteur CSS de l'élément
   */
  highlightElement(selector) {
    const element = document.querySelector(selector);
    if (!element) {
      console.warn(`[DialogueBox] Element not found for highlight: ${selector}`);
      return;
    }

    const highlight = this.container.querySelector('.tutorial-highlight');
    const spotlight = this.container.querySelector('.tutorial-spotlight');

    const rect = element.getBoundingClientRect();

    spotlight.style.top = `${rect.top - 10}px`;
    spotlight.style.left = `${rect.left - 10}px`;
    spotlight.style.width = `${rect.width + 20}px`;
    spotlight.style.height = `${rect.height + 20}px`;

    highlight.classList.remove('hidden');
  }

  /**
   * Retire le highlight
   */
  clearHighlight() {
    const highlight = this.container.querySelector('.tutorial-highlight');
    highlight.classList.add('hidden');
  }

  /**
   * Détruit le composant
   */
  destroy() {
    this._stopTypewriter();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

module.exports = DialogueBox;
