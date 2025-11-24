// src/adapters/primary/ui/orchestrators/BluetoothOrchestrator.js
// Phase 6 - Step 8 : Orchestrateur Bluetooth
// Extrait toute la logique Bluetooth depuis app.js
// Phase 6 - Step 10 : Utilisation de SensorUtils

const path = require('path');

class BluetoothOrchestrator {
  /**
   * @param {Object} config
   * @param {Object} config.state - Gestionnaire d'état
   * @param {Object} config.sensorUIController - Contrôleur UI capteurs
   * @param {Object} config.sensorConfig - Configuration capteurs (leftAddress, rightAddress, etc.)
   * @param {boolean} config.useIPCMode - Mode IPC (true) ou Direct (false)
   * @param {Function} config.onAnglesUpdate - Callback pour mise à jour angles (position, angles)
   */
  constructor({ state, sensorUIController, sensorConfig, useIPCMode, onAnglesUpdate }) {
    this.state = state;
    this.sensorUIController = sensorUIController;
    this.sensorConfig = sensorConfig;
    this.useIPCMode = useIPCMode;
    this.onAnglesUpdate = onAnglesUpdate;
    
    this.projectRoot = process.cwd();
    this.bluetoothAdapterClass = null;
    this.ipcRenderer = null;
    
    // Chargement de SensorUtils
    const SensorUtils = require(path.join(this.projectRoot, 'src', 'adapters', 'primary', 'ui', 'utils', 'SensorUtils.js'));
    this.SensorUtils = SensorUtils;
  }

  /**
   * Initialise le système Bluetooth
   */
  async initialize() {
    const modeText = this.useIPCMode ? 'IPC' : 'DIRECT';
    console.log('[BluetoothOrchestrator] Initialisation (mode ' + modeText + ')...');
    
    try {
      // Chargement de l'adaptateur selon le mode
      await this._loadBluetoothAdapter();
      
      // Création de l'instance adapter
      const adapter = new this.bluetoothAdapterClass();
      this.state.setBluetoothAdapter(adapter);
      
      // Vérification disponibilité
      const availability = await this.state.getBluetoothAdapter().checkBluetoothAvailability();
      
      if (!availability.available) {
        throw new Error(availability.error || 'Bluetooth non disponible');
      }
      
      console.log('[BluetoothOrchestrator] Bluetooth prêt, état:', availability.state);
      
      // Configuration des callbacks
      this.state.getBluetoothAdapter().onDiscover(this._handleDiscovery.bind(this));
      this.state.getBluetoothAdapter().onStateChange(this._handleStateChange.bind(this));
      
      // Configuration IPC si nécessaire
      if (this.useIPCMode) {
        this._setupIPCListeners();
      }
      
      return true;
      
    } catch (error) {
      console.error('[BluetoothOrchestrator] Erreur initialisation:', error);
      this.sensorUIController.updateStatus(`Erreur Bluetooth: ${error.message}`);
      this.sensorUIController.updateScanButton('Bluetooth indisponible', '#e74c3c', false);
      return false;
    }
  }

  /**
   * Charge la classe d'adaptateur Bluetooth selon le mode
   * @private
   */
  async _loadBluetoothAdapter() {
    if (this.useIPCMode) {
      const SensorIPCClient = require(path.join(this.projectRoot, 'src', 'adapters', 'primary', 'ui', 'services', 'SensorIPCClient.js'));
      this.bluetoothAdapterClass = SensorIPCClient;
      console.log('[BluetoothOrchestrator] Mode IPC : SensorIPCClient chargé');
    } else {
      const adapterPath = path.join(this.projectRoot, 'src', 'adapters', 'secondary', 'sensors', 'bluetooth', 'NobleBluetoothAdapter.js');
      this.bluetoothAdapterClass = require(adapterPath);
      console.log('[BluetoothOrchestrator] Mode DIRECT : NobleBluetoothAdapter chargé');
    }
  }

  /**
   * Configure les listeners IPC pour la communication avec le main process
   * @private
   */
  _setupIPCListeners() {
    if (!window.require) {
      console.warn('[BluetoothOrchestrator] window.require non disponible, IPC désactivé');
      return;
    }
    
    const { ipcRenderer } = window.require('electron');
    this.ipcRenderer = ipcRenderer;
    
    console.log('[BluetoothOrchestrator] Configuration listeners IPC...');
    
    ipcRenderer.on('sensor:connected', (event, data) => {
      console.log('[BluetoothOrchestrator] IPC - Capteur connecté:', data);
      
      const address = data.address.toLowerCase();
      this.state.getConnectedDevices().add(address);
      
      const sensorInfo = this._getSensorInfo(address);
      if (sensorInfo) {
        this.sensorUIController.updateDeviceDisplay(sensorInfo.position, {
          connected: true,
          address: address
        });
        
        this._checkIfReady();
      }
    });
    
    ipcRenderer.on('sensor:disconnected', (event, data) => {
      console.log('[BluetoothOrchestrator] IPC - Capteur déconnecté:', data);
      
      const address = data.address.toLowerCase();
      this.state.getConnectedDevices().delete(address);
      this.state.getSensorsWithData().delete(address);
      this.state.getCalibrationOffsets().delete(address);
      
      const sensorInfo = this._getSensorInfo(address);
      if (sensorInfo) {
        this.sensorUIController.updateDeviceDisplay(sensorInfo.position, {
          connected: false
        });
        
        this._checkIfReady();
      }
    });
    
    ipcRenderer.on('sensor:data', (event, data) => {
      const address = data.address.toLowerCase();
      const sensorInfo = this._getSensorInfo(address);

      if (!sensorInfo) return;

      if (!this.state.getSensorsWithData().has(address)) {
        console.log('[BluetoothOrchestrator] IPC - Premières données:', sensorInfo.position);
        this.state.getSensorsWithData().add(address);
        this._checkIfReady();
      }

      if (!this.state.getCalibrationOffsets().has(address)) {
        this.state.getCalibrationOffsets().set(address, {
          x: data.angles.x,
          y: data.angles.y,
          z: data.angles.z
        });
      }

      const offsets = this.state.getCalibrationOffsets().get(address);
      const normalizedAngles = this.SensorUtils.normalizeAnglesWithOffset(data.angles, offsets);

      // ✅ Passer toutes les données (angles normalisés + gyro + accel)
      const fullSensorData = {
        angles: normalizedAngles,
        gyro: data.gyro || { x: 0, y: 0, z: 0 },    // Fallback pour compatibilité
        accel: data.accel || { x: 0, y: 0, z: 0 }   // Fallback pour compatibilité
      };

      this._updateAngles(sensorInfo.position, fullSensorData);
    });
    
    ipcRenderer.on('sensors:ready', () => {
      console.log('[BluetoothOrchestrator] IPC - Les deux capteurs sont prêts');
      this.sensorUIController.updateScanButton('Capteurs connectés', '#27ae60', false);
      this.sensorUIController.updateStatus('Deux capteurs connectés et fonctionnels');
    });
    
    console.log('[BluetoothOrchestrator] ✓ Listeners IPC configurés');
  }

  /**
   * Gère les changements d'état Bluetooth
   * @private
   */
  _handleStateChange(stateValue) {
    console.log('[BluetoothOrchestrator] État Bluetooth changé:', stateValue);
    
    if (stateValue === 'poweredOff') {
      this.sensorUIController.updateStatus('Bluetooth désactivé');
      this.sensorUIController.updateScanButton('Bluetooth désactivé', '#e74c3c', false);
    } else if (stateValue === 'poweredOn') {
      this.sensorUIController.updateStatus('Bluetooth activé');
      if (!this.state.getBluetoothAdapter().getScanStatus().isScanning) {
        this.sensorUIController.updateScanButton('Rechercher les capteurs', '#4CAF50', true);
      }
    }
  }

  /**
   * Gère la découverte d'un périphérique Bluetooth
   * @private
   */
  async _handleDiscovery(peripheral) {
    const address = peripheral.address.toLowerCase();
    const sensorInfo = this._getSensorInfo(address);
    
    if (!sensorInfo) {
      return;
    }
    
    console.log(`[BluetoothOrchestrator] Capteur ${sensorInfo.position} trouvé`);
    console.log(`[BluetoothOrchestrator] Adresse: ${address}`);
    console.log(`[BluetoothOrchestrator] Signal: ${peripheral.rssi}dBm`);
    
    this.sensorUIController.updateDeviceDisplay(sensorInfo.position, {
      connected: false,
      address: address,
      rssi: peripheral.rssi
    });
    
    try {
      console.log(`[BluetoothOrchestrator] Connexion à ${sensorInfo.position}...`);
      this.sensorUIController.updateStatus(`Connexion au capteur ${sensorInfo.position}...`);
      
      await this.state.getBluetoothAdapter().connectSensor(peripheral, () => {
        this._handleDisconnection(address, sensorInfo.position);
      });
      
      this.state.getPeripheralRefs().set(address, peripheral);
      await this._handleConnection(address, sensorInfo.position, sensorInfo.color, peripheral);
      
    } catch (error) {
      console.error(`[BluetoothOrchestrator] Erreur connexion ${sensorInfo.position}:`, error);
      this.sensorUIController.updateStatus(`Erreur: ${error.message}`);
    }
  }

  /**
   * Gère la connexion réussie d'un capteur
   * @private
   */
  async _handleConnection(address, position, color, peripheral) {
    console.log(`[BluetoothOrchestrator] ${position} connecté`);
    
    this.state.getConnectedDevices().add(address);
    
    this.sensorUIController.updateDeviceDisplay(position, {
      connected: true,
      address: address
    });
    
    await this.state.getBluetoothAdapter().setupNotifications(peripheral, (data, deviceAddress) => {
      if (deviceAddress === address) {
        this._handleSensorData(data, address, position, color);
      }
    });
    
    this._checkIfReady();
  }

  /**
   * Gère la déconnexion d'un capteur
   * @private
   */
  _handleDisconnection(address, position) {
    console.log(`[BluetoothOrchestrator] Déconnexion ${position}`);
    
    this.state.getConnectedDevices().delete(address);
    this.state.getSensorsWithData().delete(address);
    this.state.getCalibrationOffsets().delete(address);
    this.state.getPeripheralRefs().delete(address);
    
    this.sensorUIController.updateDeviceDisplay(position, {
      connected: false
    });
    
    if (this.state.getConnectedDevices().size === 0) {
      console.log('[BluetoothOrchestrator] Aucun capteur connecté');
      
      if (!this.state.getBluetoothAdapter().getScanStatus().isScanning) {
        this.sensorUIController.updateScanButton('Rechercher les capteurs', '#4CAF50', true);
        this.sensorUIController.updateStatus('Aucun capteur connecté');
      }
    }
    else {
      console.log('[BluetoothOrchestrator] Un capteur reste connecté');
      
      if (!this.state.getBluetoothAdapter().getScanStatus().isScanning) {
        this.sensorUIController.updateScanButton('Reconnecter les capteurs', '#f39c12', true);
        this.sensorUIController.updateStatus(`Capteur ${position} déconnecté - Cliquez pour reconnecter`);
      }
    }
  }

  /**
   * Gère les données reçues d'un capteur
   * @private
   */
  _handleSensorData(data, address, position, color) {
    if (!data || data.length < 1) return;
    
    // Parse les données BWT901BLECL5.0 avec SensorUtils
    const angles = this.SensorUtils.parseBWT901Data(data);
    
    if (!angles) return;
    
    if (!this.state.getSensorsWithData().has(address)) {
      console.log('[BluetoothOrchestrator] Premières données:', position);
      this.state.getSensorsWithData().add(address);
      this._checkIfReady();
    }
    
    if (!this.state.getCalibrationOffsets().has(address)) {
      this.state.getCalibrationOffsets().set(address, { x: angles.x, y: angles.y, z: angles.z });
    }
    
    const offsets = this.state.getCalibrationOffsets().get(address);
    const normalized = this.SensorUtils.normalizeAnglesWithOffset(angles, offsets);
    
    this._updateAngles(position, normalized);
  }

  /**
   * Vérifie si les deux capteurs sont prêts et met à jour l'UI
   * @private
   */
  _checkIfReady() {
    const leftConnected = this.state.getConnectedDevices().has(this.sensorConfig.leftAddress.toLowerCase());
    const rightConnected = this.state.getConnectedDevices().has(this.sensorConfig.rightAddress.toLowerCase());
    const leftHasData = this.state.getSensorsWithData().has(this.sensorConfig.leftAddress.toLowerCase());
    const rightHasData = this.state.getSensorsWithData().has(this.sensorConfig.rightAddress.toLowerCase());

    if (leftConnected && rightConnected && leftHasData && rightHasData) {
      console.log('[BluetoothOrchestrator] Les deux capteurs fonctionnent');
      
      if (this.state.getBluetoothAdapter().getScanStatus().isScanning) {
        this.stopScan();
      }
      
      this.sensorUIController.updateScanButton('Capteurs connectés', '#27ae60', false);
      this.sensorUIController.updateStatus('Deux capteurs connectés et fonctionnels');
    }
    else if ((leftConnected && !rightConnected) || (!leftConnected && rightConnected)) {
      console.log('[BluetoothOrchestrator] Un capteur manque');
      
      if (!this.state.getBluetoothAdapter().getScanStatus().isScanning) {
        const missingSensor = !leftConnected ? 'GAUCHE' : 'DROIT';
        this.sensorUIController.updateScanButton('Reconnecter les capteurs', '#f39c12', true);
        this.sensorUIController.updateStatus(`Capteur ${missingSensor} déconnecté - Cliquez pour reconnecter`);
      }
    }
    else if (!leftConnected && !rightConnected) {
      console.log('[BluetoothOrchestrator] Aucun capteur connecté');
      
      if (!this.state.getBluetoothAdapter().getScanStatus().isScanning) {
        this.sensorUIController.updateScanButton('Rechercher les capteurs', '#4CAF50', true);
        this.sensorUIController.updateStatus('Aucun capteur connecté - Cliquez pour rechercher');
      }
    }
  }

  /**
   * Bascule l'état du scan (start/stop)
   */
  async toggleScan() {
    const status = this.state.getBluetoothAdapter().getScanStatus();
    
    if (status.isScanning) {
      await this.stopScan();
    } else {
      await this.startScan();
    }
  }

  /**
   * Démarre le scan Bluetooth
   */
  async startScan() {
    try {
      console.log('[BluetoothOrchestrator] Démarrage scan...');
      
      const leftConnected = this.state.getConnectedDevices().has(this.sensorConfig.leftAddress.toLowerCase());
      const rightConnected = this.state.getConnectedDevices().has(this.sensorConfig.rightAddress.toLowerCase());
      const leftHasData = this.state.getSensorsWithData().has(this.sensorConfig.leftAddress.toLowerCase());
      const rightHasData = this.state.getSensorsWithData().has(this.sensorConfig.rightAddress.toLowerCase());
      
      if (leftConnected && rightConnected && leftHasData && rightHasData) {
        console.log('[BluetoothOrchestrator] Les deux capteurs sont déjà connectés et fonctionnels');
        this.sensorUIController.updateStatus('Les deux capteurs fonctionnent déjà');
        return;
      }
      
      this.sensorUIController.updateScanButton('Recherche...', '#e74c3c', false);
      this.sensorUIController.updateStatus('Recherche des capteurs...');
      
      await this.state.getBluetoothAdapter().startScanning();
      
      console.log('[BluetoothOrchestrator] Scan démarré');
      this.sensorUIController.updateStatus('Scan actif - Recherche des capteurs...');
      
      const timeout = setTimeout(() => {
        const leftNowConnected = this.state.getConnectedDevices().has(this.sensorConfig.leftAddress.toLowerCase());
        const rightNowConnected = this.state.getConnectedDevices().has(this.sensorConfig.rightAddress.toLowerCase());
        
        if (!leftNowConnected || !rightNowConnected) {
          console.log('[BluetoothOrchestrator] Timeout scan');
          const missing = [];
          if (!leftNowConnected) missing.push('GAUCHE');
          if (!rightNowConnected) missing.push('DROIT');
          this.sensorUIController.updateStatus(`Timeout - ${missing.join(' et ')} non trouvé(s)`);
          this.stopScan();
        }
      }, 45000);
      
      this.state.setScanTimeout(timeout);
      
    } catch (error) {
      console.error('[BluetoothOrchestrator] Erreur démarrage scan:', error);
      this.sensorUIController.updateStatus('Erreur de scan');
      this.sensorUIController.updateScanButton('Réessayer', '#e74c3c', true);
    }
  }

  /**
   * Arrête le scan Bluetooth
   */
  async stopScan() {
    try {
      console.log('[BluetoothOrchestrator] Arrêt scan...');
      
      this.state.clearScanTimeout();
      
      await this.state.getBluetoothAdapter().stopScanning();
      
      console.log('[BluetoothOrchestrator] Scan arrêté');
      
      this.sensorUIController.updateScanButton('Stabilisation...', '#95a5a6', false);
      
      setTimeout(() => {
        const leftConnected = this.state.getConnectedDevices().has(this.sensorConfig.leftAddress.toLowerCase());
        const rightConnected = this.state.getConnectedDevices().has(this.sensorConfig.rightAddress.toLowerCase());
        const leftHasData = this.state.getSensorsWithData().has(this.sensorConfig.leftAddress.toLowerCase());
        const rightHasData = this.state.getSensorsWithData().has(this.sensorConfig.rightAddress.toLowerCase());
        
        if (leftConnected && rightConnected && leftHasData && rightHasData) {
          this.sensorUIController.updateScanButton('Capteurs connectés', '#27ae60', false);
          this.sensorUIController.updateStatus('Deux capteurs connectés et fonctionnels');
        }
        else if (leftConnected || rightConnected) {
          const missingSensor = !leftConnected ? 'GAUCHE' : 'DROIT';
          this.sensorUIController.updateScanButton('Reconnecter les capteurs', '#f39c12', true);
          this.sensorUIController.updateStatus(`Capteur ${missingSensor} manquant - Cliquez pour reconnecter`);
        }
        else {
          this.sensorUIController.updateScanButton('Rechercher les capteurs', '#4CAF50', true);
          this.sensorUIController.updateStatus('Prêt pour nouveau scan');
        }
      }, 3000);
      
    } catch (error) {
      console.error('[BluetoothOrchestrator] Arrêt scan erreur:', error);
    }
  }

  /**
   * Nettoyage avant fermeture
   */
  async cleanup() {
    console.log('[BluetoothOrchestrator] Nettoyage...');
    
    this.state.clearScanTimeout();
    
    if (this.state.getBluetoothAdapter()) {
      await this.state.getBluetoothAdapter().cleanup();
    }
  }

  /**
   * Libération des ressources
   */
  dispose() {
    console.log('[BluetoothOrchestrator] Dispose');
    this.cleanup();
    this.state = null;
    this.sensorUIController = null;
    this.bluetoothAdapterClass = null;
    this.ipcRenderer = null;
  }

  // ========================================
  // FONCTIONS UTILITAIRES PRIVÉES
  // ========================================

  /**
   * Obtient les informations d'un capteur depuis son adresse
   * @private
   */
  _getSensorInfo(address) {
    return this.SensorUtils.getSensorInfo(address, this.sensorConfig);
  }

  /**
   * Normalise un angle dans [-180, 180]
   * @private
   */
  _normalizeAngle(angle) {
    return this.SensorUtils.normalizeAngle(angle);
  }

  /**
   * Met à jour les angles et appelle le callback externe
   * @private
   */
  _updateAngles(position, angles) {
    // Mise à jour UI via SensorUIController
    this.sensorUIController.updateAngles(position, angles);
    
    // Callback externe pour la logique métier (IMU → Audio)
    if (this.onAnglesUpdate) {
      this.onAnglesUpdate(position, angles);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BluetoothOrchestrator;
}