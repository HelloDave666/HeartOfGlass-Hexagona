/**
 * DialogueLine - Entité représentant une ligne de dialogue
 *
 * Représente une ligne de dialogue individuelle avec son personnage,
 * son texte, son portrait, et ses paramètres d'affichage.
 *
 * Architecture : Core/Domain/Entities
 */
class DialogueLine {
  /**
   * @param {Object} config - Configuration de la ligne de dialogue
   * @param {string} config.character - ID du personnage qui parle
   * @param {string} config.text - Texte du dialogue
   * @param {Object} config.portrait - Configuration du portrait
   * @param {string} config.portrait.emotion - Émotion à afficher
   * @param {boolean} config.portrait.animated - Portrait animé ou statique
   * @param {number} config.portrait.fps - FPS pour animation
   * @param {number} config.typewriterSpeed - Vitesse effet typewriter (ms par caractère)
   * @param {Object} config.audio - Configuration audio (optionnel)
   * @param {string} config.audio.voice - Fichier voix narrateur
   * @param {string} config.audio.characterSound - Son du personnage
   * @param {boolean} config.skippable - Dialogue peut être skip
   * @param {boolean} config.autoAdvance - Avancement automatique après affichage
   * @param {number} config.autoAdvanceDelay - Délai avant auto-advance (ms)
   */
  constructor(config) {
    // Validation
    if (!config.character) {
      throw new Error('DialogueLine requires a character ID');
    }
    if (!config.text || config.text.trim() === '') {
      throw new Error('DialogueLine requires non-empty text');
    }

    // Données principales
    this.character = config.character;
    this.text = config.text;

    // Portrait
    this.portrait = {
      emotion: config.portrait?.emotion || 'neutral',
      animated: config.portrait?.animated || false,
      fps: config.portrait?.fps || 8
    };

    // Paramètres d'affichage
    this.typewriterSpeed = config.typewriterSpeed || 50; // ms par caractère
    this.skippable = config.skippable !== undefined ? config.skippable : true;
    this.autoAdvance = config.autoAdvance || false;
    this.autoAdvanceDelay = config.autoAdvanceDelay || 2000; // 2s par défaut

    // Audio (optionnel)
    this.audio = config.audio ? {
      voice: config.audio.voice || null,
      characterSound: config.audio.characterSound || null
    } : null;

    // État d'affichage (géré par le système)
    this.displayState = {
      isDisplaying: false,
      currentCharIndex: 0,
      isComplete: false,
      wasSkipped: false
    };
  }

  /**
   * Calcule la durée totale d'affichage de ce dialogue
   * @returns {number} Durée en ms
   */
  calculateDisplayDuration() {
    const typewriterDuration = this.text.length * this.typewriterSpeed;
    const totalDuration = typewriterDuration + (this.autoAdvance ? this.autoAdvanceDelay : 0);
    return totalDuration;
  }

  /**
   * Réinitialise l'état d'affichage
   */
  resetDisplayState() {
    this.displayState = {
      isDisplaying: false,
      currentCharIndex: 0,
      isComplete: false,
      wasSkipped: false
    };
  }

  /**
   * Marque le dialogue comme skip
   */
  skip() {
    if (!this.skippable) {
      return false;
    }

    this.displayState.currentCharIndex = this.text.length;
    this.displayState.isComplete = true;
    this.displayState.wasSkipped = true;
    return true;
  }

  /**
   * Obtient le texte visible jusqu'à l'index actuel
   * @returns {string}
   */
  getVisibleText() {
    return this.text.substring(0, this.displayState.currentCharIndex);
  }

  /**
   * Avance d'un caractère (effet typewriter)
   * @returns {boolean} True si il reste des caractères
   */
  advanceCharacter() {
    if (this.displayState.currentCharIndex < this.text.length) {
      this.displayState.currentCharIndex++;

      if (this.displayState.currentCharIndex >= this.text.length) {
        this.displayState.isComplete = true;
      }

      return true;
    }
    return false;
  }

  /**
   * Vérifie si le dialogue est complètement affiché
   * @returns {boolean}
   */
  isFullyDisplayed() {
    return this.displayState.isComplete;
  }
}

module.exports = DialogueLine;
