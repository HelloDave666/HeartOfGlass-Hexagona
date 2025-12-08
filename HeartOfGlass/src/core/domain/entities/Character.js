/**
 * Character - Entité représentant un personnage narratif
 *
 * Contient les informations d'un personnage : nom, portraits animés,
 * sons associés, etc.
 *
 * Architecture : Core/Domain/Entities
 */
class Character {
  /**
   * @param {Object} config - Configuration du personnage
   * @param {string} config.id - ID unique du personnage
   * @param {string} config.name - Nom affiché du personnage
   * @param {Object} config.portraits - Map des portraits par émotion
   * @param {string} config.talkSound - Son émis quand le personnage parle (optionnel)
   * @param {Object} config.metadata - Métadonnées additionnelles (optionnel)
   */
  constructor(config) {
    // Validation
    if (!config.id) {
      throw new Error('Character requires an ID');
    }
    if (!config.name) {
      throw new Error('Character requires a name');
    }
    if (!config.portraits || Object.keys(config.portraits).length === 0) {
      throw new Error('Character requires at least one portrait');
    }

    // Données principales
    this.id = config.id;
    this.name = config.name;
    this.portraits = this._parsePortraits(config.portraits);
    this.talkSound = config.talkSound || null;
    this.metadata = config.metadata || {};
  }

  /**
   * Parse et valide les portraits
   * @private
   * @param {Object} portraitsConfig - Configuration des portraits
   * @returns {Object} Portraits parsés
   */
  _parsePortraits(portraitsConfig) {
    const portraits = {};

    for (const [emotion, portraitData] of Object.entries(portraitsConfig)) {
      if (portraitData.type === 'animated') {
        // Portrait animé (séquence d'images)
        portraits[emotion] = {
          type: 'animated',
          frames: portraitData.frames || [],
          fps: portraitData.fps || 8,
          loop: portraitData.loop !== undefined ? portraitData.loop : true
        };

        if (portraits[emotion].frames.length === 0) {
          throw new Error(`Animated portrait '${emotion}' has no frames`);
        }
      } else {
        // Portrait statique (une seule image)
        portraits[emotion] = {
          type: 'static',
          image: portraitData.image || portraitData
        };

        if (!portraits[emotion].image) {
          throw new Error(`Static portrait '${emotion}' has no image`);
        }
      }
    }

    return portraits;
  }

  /**
   * Obtient un portrait par émotion
   * @param {string} emotion - Nom de l'émotion
   * @returns {Object|null} Portrait ou null si inexistant
   */
  getPortrait(emotion) {
    return this.portraits[emotion] || this.portraits['neutral'] || null;
  }

  /**
   * Vérifie si le personnage a un portrait pour cette émotion
   * @param {string} emotion - Nom de l'émotion
   * @returns {boolean}
   */
  hasPortrait(emotion) {
    return !!this.portraits[emotion];
  }

  /**
   * Obtient la liste des émotions disponibles
   * @returns {string[]}
   */
  getAvailableEmotions() {
    return Object.keys(this.portraits);
  }

  /**
   * Vérifie si le portrait est animé
   * @param {string} emotion - Nom de l'émotion
   * @returns {boolean}
   */
  isPortraitAnimated(emotion) {
    const portrait = this.getPortrait(emotion);
    return portrait ? portrait.type === 'animated' : false;
  }

  /**
   * Obtient le nombre de frames d'un portrait animé
   * @param {string} emotion - Nom de l'émotion
   * @returns {number} Nombre de frames ou 0 si statique
   */
  getPortraitFrameCount(emotion) {
    const portrait = this.getPortrait(emotion);
    if (!portrait || portrait.type !== 'animated') {
      return 0;
    }
    return portrait.frames.length;
  }
}

module.exports = Character;
