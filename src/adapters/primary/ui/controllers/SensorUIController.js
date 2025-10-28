// src/adapters/primary/ui/controllers/SensorUIController.js
/**
 * SensorUIController - Gestion de l'interface utilisateur des capteurs
 * 
 * Responsabilités :
 * - Création et mise à jour de l'affichage des capteurs
 * - Gestion du bouton de scan
 * - Affichage des statuts de connexion
 * - Mise à jour des angles en temps réel
 * 
 * Architecture : Adapter PRIMARY (UI)
 * - Ne contient AUCUNE logique métier Bluetooth
 * - Transforme l'état des capteurs en affichage visuel
 * - Émet des événements pour les interactions utilisateur
 */

class SensorUIController {
  /**
   * @param {Object} config - Configuration des capteurs
   * @param {Object} config.sensors - Configuration des adresses et couleurs
   * @param {Function} config.onScanToggle - Callback pour le toggle du scan
   */
  constructor(config) {
    // FIX TypeScript : Définition explicite avec fallback
    const defaultConfig = {
      sensors: {
        leftAddress: '',
        rightAddress: '',
        leftColor: 'blue',
        rightColor: 'green'
      },
      onScanToggle: null
    };
    
    const mergedConfig = config || defaultConfig;
    
    this.config = mergedConfig.sensors || defaultConfig.sensors;
    this.onScanToggleCallback = mergedConfig.onScanToggle || null;
    
    // Références DOM
    this.containerElement = null;
    this.scanButton = null;
    this.statusElement = null;
    this.deviceListElement = null;
    
    // Stockage du handler pour le cleanup
    this.scanButtonHandler = null;
    
    console.log('[SensorUIController] Initialisé');
  }

  /**
   * Initialise l'interface des capteurs
   * @param {string} containerId - ID du conteneur DOM
   * @returns {boolean} - Succès de l'initialisation
   */
  initialize(containerId = 'sensorContainer') {
    this.containerElement = document.getElementById(containerId);
    
    if (!this.containerElement) {
      console.error(`[SensorUIController] Conteneur "${containerId}" introuvable`);
      return false;
    }
    
    this.createInterface();
    this.setupEventListeners();
    
    console.log('[SensorUIController] Interface créée');
    return true;
  }

  /**
   * Crée la structure HTML de l'interface
   * @private
   */
  createInterface() {
    this.containerElement.innerHTML = `
      <div class="sensor-controls">
        <button id="scanButton" class="scan-button">
          Rechercher les capteurs
        </button>
        <div id="connectionStatus" class="connection-status"></div>
      </div>
      <div id="deviceList" class="device-list"></div>
    `;
    
    // Récupérer les références
    this.scanButton = document.getElementById('scanButton');
    this.statusElement = document.getElementById('connectionStatus');
    this.deviceListElement = document.getElementById('deviceList');
    
    // Créer les affichages pour chaque capteur
    this.createDeviceDisplays();
  }

  /**
   * Crée les cartes d'affichage pour chaque capteur
   * @private
   */
  createDeviceDisplays() {
    const positions = [
      { name: 'GAUCHE', color: this.config.leftColor },
      { name: 'DROIT', color: this.config.rightColor }
    ];
    
    positions.forEach(({ name, color }) => {
      const element = document.createElement('div');
      element.className = 'device-info';
      element.dataset.position = name;
      element.innerHTML = `
        <div class="status-indicator status-disconnected"></div>
        <div class="info-basic">
          <h3 style="color: ${color}">Capteur ${name}</h3>
          <p class="state">État: déconnecté</p>
          <p class="address">Adresse: --</p>
          <p class="rssi">Signal: --</p>
        </div>
        <div class="info-sensor">
          <h3>Données</h3>
          <p class="roll" style="color: ${color}">Roll (X): --°</p>
          <p class="pitch" style="color: ${color}">Pitch (Y): --°</p>
          <p class="yaw" style="color: ${color}">Yaw (Z): --°</p>
        </div>
      `;
      
      this.deviceListElement.appendChild(element);
    });
    
    console.log('[SensorUIController] Affichages capteurs créés');
  }

  /**
   * Configure les écouteurs d'événements
   * @private
   */
  setupEventListeners() {
    if (this.scanButton && this.onScanToggleCallback) {
      // FIX TypeScript : Créer une fonction arrow explicite
      this.scanButtonHandler = () => {
        if (this.onScanToggleCallback) {
          this.onScanToggleCallback();
        }
      };
      
      this.scanButton.addEventListener('click', this.scanButtonHandler);
    }
  }

  /**
   * Met à jour l'état du bouton de scan
   * @param {string} text - Texte du bouton
   * @param {string} color - Couleur de fond
   * @param {boolean} enabled - Bouton actif ou non
   * @public
   */
  updateScanButton(text, color, enabled) {
    if (!this.scanButton) return;
    
    this.scanButton.textContent = text;
    this.scanButton.style.backgroundColor = color;
    
    if (this.scanButton instanceof HTMLButtonElement) {
      this.scanButton.disabled = !enabled;
    } else {
      if (enabled) {
        this.scanButton.removeAttribute('aria-disabled');
      } else {
        this.scanButton.setAttribute('aria-disabled', 'true');
      }
    }
    
    this.scanButton.style.cursor = enabled ? 'pointer' : 'not-allowed';
  }

  /**
   * Met à jour le message de statut
   * @param {string} message - Message à afficher
   * @public
   */
  updateStatus(message) {
    if (this.statusElement) {
      this.statusElement.textContent = message;
    }
  }

  /**
   * Met à jour l'affichage d'un capteur
   * @param {string} position - 'GAUCHE' ou 'DROIT'
   * @param {Object} info - Informations du capteur
   * @param {boolean} info.connected - État de connexion
   * @param {string} [info.address] - Adresse Bluetooth
   * @param {number} [info.rssi] - Signal RSSI
   * @public
   */
  updateDeviceDisplay(position, info) {
    const display = this.deviceListElement.querySelector(
      `[data-position="${position}"]`
    );
    
    if (!display) {
      console.warn(`[SensorUIController] Affichage "${position}" introuvable`);
      return;
    }
    
    // Mise à jour indicateur de statut
    const indicator = display.querySelector('.status-indicator');
    indicator.className = `status-indicator ${
      info.connected ? 'status-connected' : 'status-disconnected'
    }`;
    
    // Mise à jour état de connexion
    const stateElement = display.querySelector('.state');
    stateElement.textContent = `État: ${
      info.connected ? 'connecté' : 'déconnecté'
    }`;
    
    if (info.connected) {
      // Mise à jour adresse
      if (info.address) {
        display.querySelector('.address').textContent = `Adresse: ${info.address}`;
      }
      
      // Mise à jour signal
      if (info.rssi !== undefined) {
        const signalPercent = Math.max(0, Math.min(100, 100 + info.rssi));
        display.querySelector('.rssi').textContent = 
          `Signal: ${info.rssi}dBm (${signalPercent}%)`;
      }
    } else {
      // Réinitialisation si déconnecté
      display.querySelector('.address').textContent = 'Adresse: --';
      display.querySelector('.rssi').textContent = 'Signal: --';
      this.updateAngles(position, { x: null, y: null, z: null });
    }
  }

  /**
   * Met à jour l'affichage des angles d'un capteur
   * @param {string} position - 'GAUCHE' ou 'DROIT'
   * @param {Object} angles - Angles Euler
   * @param {number|null} angles.x - Roll (X)
   * @param {number|null} angles.y - Pitch (Y)
   * @param {number|null} angles.z - Yaw (Z)
   * @public
   */
  updateAngles(position, angles) {
    const display = this.deviceListElement.querySelector(
      `[data-position="${position}"]`
    );
    
    if (!display) return;
    
    const formatAngle = (value) => {
      return value !== null && value !== undefined
        ? `${value.toFixed(1)}°`
        : '--°';
    };
    
    display.querySelector('.roll').textContent = 
      `Roll (X): ${formatAngle(angles.x)}`;
    display.querySelector('.pitch').textContent = 
      `Pitch (Y): ${formatAngle(angles.y)}`;
    display.querySelector('.yaw').textContent = 
      `Yaw (Z): ${formatAngle(angles.z)}`;
  }

  /**
   * Réinitialise l'affichage d'un capteur
   * @param {string} position - 'GAUCHE' ou 'DROIT'
   * @public
   */
  resetDevice(position) {
    this.updateDeviceDisplay(position, { connected: false });
  }

  /**
   * Réinitialise tous les affichages
   * @public
   */
  resetAll() {
    this.resetDevice('GAUCHE');
    this.resetDevice('DROIT');
    this.updateStatus('');
    this.updateScanButton('Rechercher les capteurs', '#4CAF50', true);
  }

  /**
   * Retourne les états actuels des affichages
   * @returns {Object} - États des capteurs
   * @public
   */
  getDisplayStates() {
    const displays = this.deviceListElement.querySelectorAll('.device-info');
    const states = {};
    
    displays.forEach((display) => {
      // FIX TypeScript : Cast explicite en HTMLElement
      const htmlDisplay = /** @type {HTMLElement} */ (display);
      const position = htmlDisplay.dataset.position;
      const indicator = htmlDisplay.querySelector('.status-indicator');
      const connected = indicator.classList.contains('status-connected');
      
      states[position] = {
        connected,
        address: htmlDisplay.querySelector('.address').textContent,
        rssi: htmlDisplay.querySelector('.rssi').textContent,
        roll: htmlDisplay.querySelector('.roll').textContent,
        pitch: htmlDisplay.querySelector('.pitch').textContent,
        yaw: htmlDisplay.querySelector('.yaw').textContent
      };
    });
    
    return states;
  }

  // ========================================
  // NOUVELLES MÉTHODES POUR BluetoothOrchestrator
  // ========================================

  /**
   * Ajoute un capteur découvert à l'interface
   * @param {string} address - Adresse du capteur
   * @param {string} position - 'GAUCHE' ou 'DROIT'
   * @param {string} color - Couleur d'affichage
   * @public
   */
  addSensor(address, position, color) {
    console.log(`[SensorUIController] Ajout capteur: ${position} (${address})`);
    // Les affichages sont déjà créés par createDeviceDisplays()
    // On met juste à jour l'adresse
    const display = this.deviceListElement.querySelector(
      `[data-position="${position}"]`
    );
    
    if (display) {
      display.querySelector('.address').textContent = `Adresse: ${address}`;
    }
  }

  /**
   * Met à jour le statut d'un capteur
   * @param {string} address - Adresse du capteur
   * @param {string} position - 'GAUCHE' ou 'DROIT'
   * @param {string} status - 'connecting' | 'connected' | 'disconnected' | 'error'
   * @public
   */
  updateSensorStatus(address, position, status) {
    console.log(`[SensorUIController] Statut ${position}: ${status}`);
    
    const display = this.deviceListElement.querySelector(
      `[data-position="${position}"]`
    );
    
    if (!display) return;
    
    const indicator = display.querySelector('.status-indicator');
    const stateElement = display.querySelector('.state');
    
    switch (status) {
      case 'connecting':
        indicator.className = 'status-indicator status-connecting';
        stateElement.textContent = 'État: connexion...';
        break;
        
      case 'connected':
        indicator.className = 'status-indicator status-connected';
        stateElement.textContent = 'État: connecté';
        display.querySelector('.address').textContent = `Adresse: ${address}`;
        break;
        
      case 'disconnected':
        indicator.className = 'status-indicator status-disconnected';
        stateElement.textContent = 'État: déconnecté';
        display.querySelector('.address').textContent = 'Adresse: --';
        display.querySelector('.rssi').textContent = 'Signal: --';
        this.updateAngles(position, { x: null, y: null, z: null });
        break;
        
      case 'error':
        indicator.className = 'status-indicator status-error';
        stateElement.textContent = 'État: erreur';
        break;
        
      default:
        console.warn(`[SensorUIController] Statut inconnu: ${status}`);
    }
  }

  /**
   * Efface tous les capteurs découverts (réinitialise l'affichage)
   * @public
   */
  clearSensors() {
    console.log('[SensorUIController] Effacement capteurs');
    this.resetAll();
  }

  /**
   * Nettoie les ressources
   * @public
   */
  dispose() {
    console.log('[SensorUIController] Nettoyage...');
    
    // FIX TypeScript : Utiliser le handler stocké
    if (this.scanButton && this.scanButtonHandler) {
      this.scanButton.removeEventListener('click', this.scanButtonHandler);
    }
    
    this.containerElement = null;
    this.scanButton = null;
    this.statusElement = null;
    this.deviceListElement = null;
    this.onScanToggleCallback = null;
    this.scanButtonHandler = null;
    
    console.log('[SensorUIController] Nettoyé');
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SensorUIController;
}