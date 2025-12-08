// src/core/ports/output/IAudioService.js

/**
 * PORT DE SORTIE (OUTPUT PORT)
 * Interface pour le service de gestion audio
 * Système de synthèse granulaire pour feedback audio temps réel
 * 
 * RÔLE DANS L'ARCHITECTURE HEXAGONALE :
 * - Définit le CONTRAT que doit respecter tout adapter audio
 * - Situé dans le CORE (logique métier pure)
 * - Indépendant de toute implémentation technique
 * - Les adapters IMPLÉMENTENT cette interface
 */
class IAudioService {
  /**
   * Initialise le système audio
   * Configure le contexte Web Audio API et prépare la chaîne de traitement
   * 
   * @returns {Promise<boolean>} true si initialisation réussie
   * @throws {Error} Si le navigateur ne supporte pas Web Audio API
   */
  async initialize() {
    throw new Error('Method not implemented');
  }

  /**
   * Charge un fichier audio depuis un chemin local
   * Supporte : MP3, WAV, OGG, FLAC
   * 
   * @param {string} filePath - Chemin absolu vers le fichier audio
   * @returns {Promise<boolean>} true si chargement réussi
   * @throws {Error} Si le fichier n'existe pas ou format non supporté
   * 
   * @example
   * await audioService.loadAudioFile('C:/Music/song.mp3');
   */
  async loadAudioFile(filePath) {
    throw new Error('Method not implemented');
  }

  /**
   * Démarre la lecture audio avec synthèse granulaire
   * Utilise les paramètres configurés (grain size, overlap, etc.)
   * 
   * @returns {boolean} true si démarrage réussi
   * @throws {Error} Si aucun fichier n'est chargé
   */
  startPlayback() {
    throw new Error('Method not implemented');
  }

  /**
   * Arrête la lecture audio immédiatement
   * Libère les ressources audio actives
   */
  stopPlayback() {
    throw new Error('Method not implemented');
  }

  /**
   * Définit la vitesse de lecture (playback rate)
   * Utilisé pour le contrôle par capteurs IMU
   * 
   * @param {number} rate - Vitesse de lecture (-3.0 à 3.0)
   *   - 0.0 = pause
   *   - 1.0 = vitesse normale
   *   - 2.0 = deux fois plus rapide
   *   - -1.0 = lecture inversée
   * @param {number} direction - Direction (1 = forward, -1 = backward)
   */
  setPlaybackRate(rate, direction) {
    throw new Error('Method not implemented');
  }

  /**
   * Définit le volume principal
   * 
   * @param {number} volume - Volume (0.0 = muet, 1.0 = 100%)
   */
  setVolume(volume) {
    throw new Error('Method not implemented');
  }

  /**
   * Définit la position de lecture dans le fichier audio
   * 
   * @param {number} position - Position en secondes (0 à durée totale)
   */
  setPlaybackPosition(position) {
    throw new Error('Method not implemented');
  }

  /**
   * Retourne la position de lecture actuelle
   * Mise à jour en temps réel pendant la lecture
   * 
   * @returns {number} Position en secondes
   */
  getPlaybackPosition() {
    throw new Error('Method not implemented');
  }

  /**
   * Vérifie si la lecture est active
   * 
   * @returns {boolean} true si en cours de lecture
   */
  isPlaybackActive() {
    throw new Error('Method not implemented');
  }

  /**
   * Vérifie si un buffer audio est chargé
   * 
   * @returns {boolean} true si audio chargé et prêt
   */
  isAudioBufferLoaded() {
    throw new Error('Method not implemented');
  }

  /**
   * Configure les paramètres de synthèse granulaire
   * 
   * @param {Object} params - Paramètres granulaires
   * @param {number} params.grainSize - Taille du grain en ms (10-500ms)
   * @param {number} params.overlap - Chevauchement en % (0-95%)
   * @param {string} params.windowType - Type de fenêtre ('hann', 'hamming', 'triangular')
   */
  setGranularParams(params) {
    throw new Error('Method not implemented');
  }

  /**
   * Configure les filtres audio (optionnel)
   * 
   * @param {Object} filterConfig - Configuration des filtres
   * @param {number} filterConfig.lowpassFreq - Fréquence du filtre passe-bas (Hz)
   * @param {number} filterConfig.highpassFreq - Fréquence du filtre passe-haut (Hz)
   */
  setAudioFilters(filterConfig) {
    // Optionnel - peut être laissé vide si non supporté
  }

  /**
   * Retourne l'état actuel du système audio
   * Utile pour le debugging et les logs
   * 
   * @returns {Object} État complet du système audio
   * @property {boolean} isInitialized - Système initialisé
   * @property {boolean} isPlaying - En cours de lecture
   * @property {boolean} hasBuffer - Buffer chargé
   * @property {number} currentPosition - Position actuelle (s)
   * @property {number} duration - Durée totale (s)
   * @property {Object} granularParams - Paramètres granulaires actuels
   */
  getState() {
    throw new Error('Method not implemented');
  }

  /**
   * Libère toutes les ressources audio
   * Appelé lors de la fermeture de l'application
   */
  dispose() {
    throw new Error('Method not implemented');
  }
}

module.exports = IAudioService;