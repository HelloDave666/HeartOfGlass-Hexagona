// src/core/ports/output/ISensorService.js

/**
 * Interface pour le service de gestion des capteurs Bluetooth
 */
class ISensorService {
  /**
   * Démarre le scan Bluetooth pour trouver les capteurs
   */
  async startScanning() {
    throw new Error('Method not implemented');
  }

  /**
   * Arrête le scan Bluetooth
   */
  async stopScanning() {
    throw new Error('Method not implemented');
  }

  /**
   * Connecte à un capteur spécifique
   * @param {Object} peripheral - L'objet peripheral Noble
   * @returns {Promise<Object>} Informations de connexion
   */
  async connectSensor(peripheral) {
    throw new Error('Method not implemented');
  }

  /**
   * Déconnecte un capteur
   * @param {string} address - Adresse MAC du capteur
   */
  async disconnectSensor(address) {
    throw new Error('Method not implemented');
  }

  /**
   * Configure les notifications pour recevoir les données
   * @param {Object} peripheral - L'objet peripheral Noble
   * @param {Function} onDataCallback - Callback pour les données reçues
   */
  async setupNotifications(peripheral, onDataCallback) {
    throw new Error('Method not implemented');
  }

  /**
   * Envoie une commande au capteur
   * @param {Object} peripheral - L'objet peripheral Noble
   * @param {Buffer} command - Commande à envoyer
   */
  async sendCommand(peripheral, command) {
    throw new Error('Method not implemented');
  }

  /**
   * Callback pour la découverte de capteurs
   * @param {Function} callback - Fonction à appeler lors de la découverte
   */
  onDiscover(callback) {
    throw new Error('Method not implemented');
  }

  /**
   * Callback pour les changements d'état Bluetooth
   * @param {Function} callback - Fonction à appeler lors des changements
   */
  onStateChange(callback) {
    throw new Error('Method not implemented');
  }
}

module.exports = ISensorService;
