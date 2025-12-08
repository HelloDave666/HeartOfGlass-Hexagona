/**
 * FONCTIONS DE FENÊTRAGE AUDIO
 * Fichier: src/adapters/secondary/audio/granular/WindowFunctions.js
 * 
 * Ces fonctions mathématiques créent des "enveloppes" pour façonner
 * les grains audio et éliminer les artefacts de clic.
 */

class WindowFunctions {
  /**
   * Fenêtre de Hann (aussi appelée "Hanning")
   * 
   * Forme : Cloche douce, symétrique
   * Usage : Standard pour la synthèse granulaire
   * Avantages : Pas d'artefacts, transition très douce
   * 
   * @param {number} length - Longueur du grain en échantillons
   * @returns {Float32Array} Tableau de coefficients (0.0 à 1.0)
   */
  static hann(length) {
    const window = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1)));
    }
    
    return window;
  }

  /**
   * Fenêtre de Hamming
   * 
   * Forme : Similaire à Hann, mais avec une base non nulle
   * Usage : Analyse spectrale, réduction d'artefacts
   * Avantages : Meilleure atténuation des lobes latéraux
   * 
   * @param {number} length - Longutre du grain en échantillons
   * @returns {Float32Array} Tableau de coefficients
   */
  static hamming(length) {
    const window = new Float32Array(length);
    
    for (let i = 0; i < length; i++) {
      window[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (length - 1));
    }
    
    return window;
  }

  /**
   * Fenêtre triangulaire (aussi appelée "Bartlett")
   * 
   * Forme : Triangle symétrique
   * Usage : Cas simples, besoins CPU réduits
   * Avantages : Calcul très rapide, prévisible
   * 
   * @param {number} length - Longueur du grain en échantillons
   * @returns {Float32Array} Tableau de coefficients
   */
  static triangular(length) {
    const window = new Float32Array(length);
    const halfLength = length / 2;
    
    for (let i = 0; i < length; i++) {
      if (i < halfLength) {
        window[i] = i / halfLength;
      } else {
        window[i] = 2 - (i / halfLength);
      }
    }
    
    return window;
  }

  /**
   * Fenêtre rectangulaire (aucune enveloppe)
   * 
   * Forme : Plat (tous les coefficients = 1)
   * Usage : Debug, tests, ou effets spéciaux
   * Inconvénient : Produit des clics audibles
   * 
   * @param {number} length - Longueur du grain en échantillons
   * @returns {Float32Array} Tableau de coefficients (tous à 1.0)
   */
  static rectangular(length) {
    return new Float32Array(length).fill(1.0);
  }

  /**
   * Obtient une fonction de fenêtrage par son nom
   * 
   * @param {string} type - Type de fenêtre
   * @param {number} length - Longueur du grain en échantillons
   * @returns {Float32Array} Fenêtre calculée
   * @throws {Error} Si le type n'est pas reconnu
   */
  static getWindow(type, length) {
    switch (type.toLowerCase()) {
      case 'hann':
      case 'hanning':
        return this.hann(length);
        
      case 'hamming':
        return this.hamming(length);
        
      case 'triangular':
      case 'bartlett':
        return this.triangular(length);
        
      case 'rectangular':
      case 'none':
        return this.rectangular(length);
        
      default:
        throw new Error(`Type de fenêtre inconnu: ${type}`);
    }
  }

  /**
   * Applique une fenêtre à un buffer audio
   * 
   * @param {Float32Array} buffer - Buffer audio à fenêtrer
   * @param {string} windowType - Type de fenêtre
   * @returns {Float32Array} Buffer fenêtré (nouveau tableau)
   */
  static applyWindow(buffer, windowType) {
    const window = this.getWindow(windowType, buffer.length);
    const windowed = new Float32Array(buffer.length);
    
    for (let i = 0; i < buffer.length; i++) {
      windowed[i] = buffer[i] * window[i];
    }
    
    return windowed;
  }

  /**
   * Retourne la liste des types de fenêtres disponibles
   * 
   * @returns {Array<Object>} Liste des fenêtres avec métadonnées
   */
  static getAvailableWindows() {
    return [
      {
        id: 'hann',
        name: 'Hann (Hanning)',
        description: 'Standard - Transition très douce',
        recommended: true
      },
      {
        id: 'hamming',
        name: 'Hamming',
        description: 'Analyse spectrale - Réduit les artefacts',
        recommended: false
      },
      {
        id: 'triangular',
        name: 'Triangulaire',
        description: 'Simple et rapide',
        recommended: false
      },
      {
        id: 'rectangular',
        name: 'Rectangulaire',
        description: 'Aucun fenêtrage (debug)',
        recommended: false
      }
    ];
  }
}

module.exports = WindowFunctions;