const WindowFunctions = require('./WindowFunctions.js');

/**
 * GRAIN PLAYER
 * Lecteur de grains audio pour synthèse granulaire
 * 
 * Un grain = petit fragment audio (10-500ms) avec enveloppe
 * Joue les grains avec chevauchement pour lecture continue fluide
 */
class GrainPlayer {
  /**
   * @param {AudioContext} audioContext - Contexte Web Audio API
   */
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.activeGrains = [];
    this.maxActiveGrains = 50;
  }

  /**
   * Joue un grain audio
   * 
   * @param {AudioBuffer} audioBuffer - Buffer audio source
   * @param {number} startTime - Position de départ dans le buffer (secondes)
   * @param {number} grainDuration - Durée du grain (secondes)
   * @param {number} playbackRate - Vitesse de lecture (1.0 = normal)
   * @param {number} volume - Volume (0.0 à 1.0)
   * @param {string} windowType - Type de fenêtre ('hann', 'hamming', etc.)
   * @param {AudioNode} destination - Destination audio (généralement audioContext.destination)
   * @param {number} direction - Direction de lecture (1 = avant, -1 = arrière)
   * @returns {Object} Référence au grain joué (pour nettoyage)
   */
  playGrain(audioBuffer, startTime, grainDuration, playbackRate, volume, windowType, destination, direction = 1) {
    const now = this.audioContext.currentTime;
    
    // ═══════════════════════════════════════════════════════════
    // LECTURE INVERSÉE : Créer un buffer inversé pour ce grain
    // ═══════════════════════════════════════════════════════════
    let bufferToPlay = audioBuffer;
    let offset = Math.max(0, Math.min(startTime, audioBuffer.duration - grainDuration));
    
    if (direction === -1) {
      // Créer un mini-buffer inversé pour ce grain uniquement
      bufferToPlay = this._createReversedGrainBuffer(audioBuffer, offset, grainDuration);
      offset = 0; // Le buffer inversé commence à 0
    }
    
    // Créer le source node
    const source = this.audioContext.createBufferSource();
    source.buffer = bufferToPlay;
    source.playbackRate.value = Math.abs(playbackRate); // Toujours positif
    
    // Créer le gain node pour l'enveloppe
    const gainNode = this.audioContext.createGain();
    
    // Calculer la fenêtre d'enveloppe
    const sampleRate = audioBuffer.sampleRate;
    const grainLengthSamples = Math.floor(grainDuration * sampleRate);
    const envelope = WindowFunctions.getWindow(windowType, grainLengthSamples);
    
    // Appliquer l'enveloppe via automation
    this.applyEnvelope(gainNode.gain, envelope, now, grainDuration, volume);
    
    // Connecter : source → gain → destination
    source.connect(gainNode);
    gainNode.connect(destination);
    
    // Démarrer la lecture
    source.start(now, offset, grainDuration);
    
    // Arrêter et nettoyer après la durée du grain
    const stopTime = now + grainDuration;
    source.stop(stopTime);
    
    // Référence du grain pour nettoyage
    const grain = {
      source,
      gainNode,
      stopTime
    };
    
    this.activeGrains.push(grain);
    
    // Auto-nettoyage
    source.onended = () => {
      this.cleanupGrain(grain);
    };
    
    // Sécurité : limiter le nombre de grains actifs
    this.limitActiveGrains();
    
    return grain;
  }

  /**
   * Crée un buffer audio inversé pour un grain spécifique
   * @private
   * @param {AudioBuffer} sourceBuffer - Buffer source
   * @param {number} startTime - Position de départ (secondes)
   * @param {number} duration - Durée du grain (secondes)
   * @returns {AudioBuffer} Buffer inversé
   */
  _createReversedGrainBuffer(sourceBuffer, startTime, duration) {
    const sampleRate = sourceBuffer.sampleRate;
    const startSample = Math.floor(startTime * sampleRate);
    const lengthSamples = Math.floor(duration * sampleRate);
    const numChannels = sourceBuffer.numberOfChannels;
    
    // Créer un nouveau buffer pour le grain inversé
    const reversedBuffer = this.audioContext.createBuffer(
      numChannels,
      lengthSamples,
      sampleRate
    );
    
    // Pour chaque canal
    for (let channel = 0; channel < numChannels; channel++) {
      const sourceData = sourceBuffer.getChannelData(channel);
      const reversedData = reversedBuffer.getChannelData(channel);
      
      // Copier et inverser les échantillons
      for (let i = 0; i < lengthSamples; i++) {
        const sourceIndex = startSample + i;
        const reversedIndex = lengthSamples - 1 - i;
        
        if (sourceIndex < sourceData.length) {
          reversedData[reversedIndex] = sourceData[sourceIndex];
        } else {
          reversedData[reversedIndex] = 0; // Silence si dépassement
        }
      }
    }
    
    return reversedBuffer;
  }

  /**
   * Applique l'enveloppe (fenêtre) au gain via automation
   * 
   * @param {AudioParam} gainParam - Paramètre de gain à automatiser
   * @param {Float32Array} envelope - Enveloppe (valeurs 0.0 à 1.0)
   * @param {number} startTime - Temps de départ
   * @param {number} duration - Durée totale
   * @param {number} volume - Volume de base
   */
  applyEnvelope(gainParam, envelope, startTime, duration, volume) {
    gainParam.cancelScheduledValues(startTime);
    gainParam.setValueAtTime(0, startTime);
    
    // Simplification : approximation linéaire de l'enveloppe
    // Pour une meilleure qualité, on pourrait utiliser setValueCurveAtTime
    // mais cela nécessite un traitement plus complexe
    
    const numPoints = Math.min(envelope.length, 32); // Limiter pour performance
    const step = envelope.length / numPoints;
    const timeStep = duration / numPoints;
    
    for (let i = 0; i < numPoints; i++) {
      const envelopeIndex = Math.floor(i * step);
      const time = startTime + (i * timeStep);
      const value = envelope[envelopeIndex] * volume;
      
      gainParam.linearRampToValueAtTime(value, time);
    }
    
    // Fin du grain
    gainParam.linearRampToValueAtTime(0, startTime + duration);
  }

  /**
   * Nettoie un grain terminé
   * @param {Object} grain - Référence du grain
   */
  cleanupGrain(grain) {
    try {
      grain.source.disconnect();
      grain.gainNode.disconnect();
    } catch (e) {
      // Déjà déconnecté
    }
    
    const index = this.activeGrains.indexOf(grain);
    if (index > -1) {
      this.activeGrains.splice(index, 1);
    }
  }

  /**
   * Limite le nombre de grains actifs pour éviter surcharge CPU
   */
  limitActiveGrains() {
    while (this.activeGrains.length > this.maxActiveGrains) {
      const oldestGrain = this.activeGrains[0];
      
      try {
        oldestGrain.source.stop();
      } catch (e) {
        // Déjà arrêté
      }
      
      this.cleanupGrain(oldestGrain);
    }
  }

  /**
   * Arrête tous les grains actifs
   */
  stopAllGrains() {
    const grains = [...this.activeGrains];
    
    grains.forEach(grain => {
      try {
        grain.source.stop();
      } catch (e) {
        // Déjà arrêté
      }
      this.cleanupGrain(grain);
    });
    
    this.activeGrains = [];
  }

  /**
   * Retourne le nombre de grains actifs
   * @returns {number}
   */
  getActiveGrainCount() {
    return this.activeGrains.length;
  }

  /**
   * Définit le nombre maximum de grains simultanés
   * @param {number} max - Nombre maximum (recommandé: 20-50)
   */
  setMaxActiveGrains(max) {
    this.maxActiveGrains = Math.max(1, Math.min(max, 100));
  }
}

module.exports = GrainPlayer;