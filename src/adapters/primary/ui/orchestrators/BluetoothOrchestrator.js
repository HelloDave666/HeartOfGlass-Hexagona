// @ts-nocheck
// src/adapters/primary/ui/orchestrators/BluetoothOrchestrator.js
// Phase 6 - Step 10 : Orchestrateur Bluetooth
// Gère toute la logique Bluetooth (IPC ou Direct) de manière transparente

const path = require('path');

class BluetoothOrchestrator {
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
    
    // NOUVEAU : Callbacks pour les exercices (mode IPC)
    this.exerciseDataCallbacks = new Map(); // Map<address, callback>
  }

  async initialize() {
    console.log('[BluetoothOrchestrator] Initialisation...');
    
    try {
      if (this.useIPCMode) {
        await this._initializeIPCMode();
      } else {
        await this._initializeDirectMode();
      }
      
      console.log('[BluetoothOrchestrator] ✓ Initialisé');
      return true;
      
    } catch (error) {
      console.error('[BluetoothOrchestrator] Erreur initialisation:', error);
      return false;
    }
  }

  async _initializeIPCMode() {
    console.log('[BluetoothOrchestrator] Mode IPC');
    
    const { ipcRenderer } = window.require('electron');
    this.ipcRenderer = ipcRenderer;
    
    this._setupIPCListeners();
  }

  async _initializeDirectMode() {
    console.log('[BluetoothOrchestrator] Mode Direct');
    
    const adapterPath = path.join(this.projectRoot, 'src', 'adapters', 'secondary', 'bluetooth', 'noble', 'NobleBluetoothAdapter.js');
    this.bluetoothAdapterClass = require(adapterPath);
    
    const adapter = new this.bluetoothAdapterClass();
    await adapter.initialize();
    this.state.setBluetoothAdapter(adapter);
  }

  _setupIPCListeners() {
    if (!this.ipcRenderer) return;
    
    const ipcRenderer = this.ipcRenderer;
    
    ipcRenderer.on('bluetooth:stateChange', (event, state) => {
      console.log('[BluetoothOrchestrator] IPC - État Bluetooth:', state);
      this.state.setBluetoothState(state);
      
      if (state === 'poweredOn') {
        this.sensorUIController.updateStatus('Bluetooth prêt - Cliquez pour scanner');
      } else {
        this.sensorUIController.updateStatus(`Bluetooth: ${state}`);
      }
    });
    
    ipcRenderer.on('sensor:discovered', (event, data) => {
      console.log('[BluetoothOrchestrator] IPC - Capteur découvert:', data.address);
      this.state.getDiscoveredDevices().add(data.address);
      
      const sensorInfo = this._getSensorInfo(data.address);
      if (sensorInfo) {
        this.sensorUIController.addSensor(data.address, sensorInfo.position, sensorInfo.color);
      }
    });
    
    ipcRenderer.on('sensor:connected', (event, data) => {
      console.log('[BluetoothOrchestrator] IPC - Capteur connecté:', data.address);
      this.state.getConnectedDevices().add(data.address);
      
      const sensorInfo = this._getSensorInfo(data.address);
      if (sensorInfo) {
        this.sensorUIController.updateSensorStatus(data.address, sensorInfo.position, 'connected');
      }
    });
    
    ipcRenderer.on('sensor:disconnected', (event, data) => {
      console.log('[BluetoothOrchestrator] IPC - Capteur déconnecté:', data.address);
      this._handleDisconnection(data.address);
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
      const normalized = this.SensorUtils.normalizeAnglesWithOffset(data.angles, offsets);
      
      this._updateAngles(sensorInfo.position, normalized);
      
      // NOUVEAU : Notifier les callbacks d'exercices
      // En mode IPC, on reçoit les angles mais les exercices ont besoin des données gyro
      // On reconstruit un objet de données compatible
      if (this.exerciseDataCallbacks.has(address)) {
        const callback = this.exerciseDataCallbacks.get(address);
        try {
          // Créer un objet compatible avec ce que les exercices attendent
          const exerciseData = {
            _ipcMode: true,
            angles: data.angles,
            gyro: data.gyro || null, // Gyro si disponible depuis le main process
            timestamp: Date.now()
          };
          callback(exerciseData, address);
        } catch (error) {
          console.error('[BluetoothOrchestrator] Erreur callback exercice:', error);
        }
      }
    });
    
    ipcRenderer.on('scan:started', () => {
      console.log('[BluetoothOrchestrator] IPC - Scan démarré');
      this.state.setIsScanning(true);
      this.sensorUIController.updateStatus('Recherche en cours...');
    });
    
    ipcRenderer.on('scan:stopped', () => {
      console.log('[BluetoothOrchestrator] IPC - Scan arrêté');
      this.state.setIsScanning(false);
      
      if (this.state.getConnectedDevices().size > 0) {
        this.sensorUIController.updateStatus(`${this.state.getConnectedDevices().size} capteur(s) connecté(s)`);
      } else {
        this.sensorUIController.updateStatus('Aucun capteur trouvé');
      }
    });
    
    // NOUVEAU : Listener pour les erreurs de scan
    ipcRenderer.on('scan:error', (event, data) => {
      console.error('[BluetoothOrchestrator] IPC - Erreur scan:', data.error);
      this.state.setIsScanning(false);
      this.sensorUIController.updateStatus(`Erreur: ${data.error}`);
    });
  }

  async toggleScan() {
    if (this.state.getIsScanning()) {
      await this.stopScan();
    } else {
      await this.startScan();
    }
  }

  async startScan() {
    console.log('[BluetoothOrchestrator] Démarrage scan...');
    
    this._resetDiscovery();
    
    try {
      if (this.useIPCMode) {
        // CORRECTION : Utiliser 'sensor:scan' au lieu de 'bluetooth:startScan'
        console.log('[BluetoothOrchestrator] Envoi IPC: sensor:scan');
        this.ipcRenderer.send('sensor:scan', {
          targetAddresses: [
            this.sensorConfig.leftAddress,
            this.sensorConfig.rightAddress
          ]
        });
      } else {
        await this._startDirectScan();
      }
      
    } catch (error) {
      console.error('[BluetoothOrchestrator] Erreur scan:', error);
      this.sensorUIController.updateStatus('Erreur lors du scan');
    }
  }

  async stopScan() {
    console.log('[BluetoothOrchestrator] Arrêt scan...');
    
    try {
      if (this.useIPCMode) {
        // CORRECTION : Utiliser 'sensor:stop-scan' au lieu de 'bluetooth:stopScan'
        console.log('[BluetoothOrchestrator] Envoi IPC: sensor:stop-scan');
        this.ipcRenderer.send('sensor:stop-scan');
      } else {
        await this.state.getBluetoothAdapter()?.stopScan();
        this.state.setIsScanning(false);
      }
      
    } catch (error) {
      console.error('[BluetoothOrchestrator] Erreur arrêt scan:', error);
    }
  }

  async _startDirectScan() {
    const adapter = this.state.getBluetoothAdapter();
    if (!adapter) {
      throw new Error('Adapter Bluetooth non initialisé');
    }
    
    this.state.setIsScanning(true);
    this.sensorUIController.updateStatus('Recherche en cours...');
    
    const targetAddresses = [
      this.sensorConfig.leftAddress,
      this.sensorConfig.rightAddress
    ];
    
    const onDiscovered = (peripheral) => {
      this._handleDiscovery(peripheral);
    };
    
    await adapter.startScan(targetAddresses, onDiscovered);
    
    setTimeout(async () => {
      if (this.state.getIsScanning()) {
        await this.stopScan();
      }
    }, 10000);
  }

  _handleDiscovery(peripheral) {
    const address = peripheral.address.toLowerCase();
    
    if (this.state.getDiscoveredDevices().has(address)) {
      return;
    }
    
    console.log('[BluetoothOrchestrator] Capteur découvert:', address);
    this.state.getDiscoveredDevices().add(address);
    
    const sensorInfo = this._getSensorInfo(address);
    if (!sensorInfo) {
      console.warn('[BluetoothOrchestrator] Capteur inconnu:', address);
      return;
    }
    
    this.sensorUIController.addSensor(address, sensorInfo.position, sensorInfo.color);
    
    this._connectToSensor(peripheral, sensorInfo);
  }

  async _connectToSensor(peripheral, sensorInfo) {
    const address = peripheral.address.toLowerCase();
    
    console.log('[BluetoothOrchestrator] Connexion à:', sensorInfo.position);
    this.sensorUIController.updateSensorStatus(address, sensorInfo.position, 'connecting');
    
    try {
      const adapter = this.state.getBluetoothAdapter();
      
      await adapter.connect(peripheral);
      
      this.state.getConnectedDevices().add(address);
      this.state.getPeripheralRefs().set(address, peripheral);
      
      console.log('[BluetoothOrchestrator] ✓ Connecté:', sensorInfo.position);
      this.sensorUIController.updateSensorStatus(address, sensorInfo.position, 'connected');
      
      await this._setupSensorNotifications(peripheral, address, sensorInfo);
      
    } catch (error) {
      console.error('[BluetoothOrchestrator] Erreur connexion:', error);
      this.sensorUIController.updateSensorStatus(address, sensorInfo.position, 'error');
      this.state.getDiscoveredDevices().delete(address);
    }
  }

  async _setupSensorNotifications(peripheral, address, sensorInfo) {
    try {
      const adapter = this.state.getBluetoothAdapter();
      
      const dataCallback = (data) => {
        this._handleSensorData(data, address, sensorInfo.position, sensorInfo.color);
      };
      
      await adapter.setupNotifications(peripheral, dataCallback);
      
      console.log('[BluetoothOrchestrator] Notifications configurées:', sensorInfo.position);
      
    } catch (error) {
      console.error('[BluetoothOrchestrator] Erreur notifications:', error);
      throw error;
    }
  }

  _handleSensorData(data, address, position, color) {
    if (!data || data.length < 1) return;
    
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
    
    // NOUVEAU : Notifier les callbacks d'exercices (envoyer les données brutes)
    if (this.exerciseDataCallbacks.has(address)) {
      const callback = this.exerciseDataCallbacks.get(address);
      try {
        callback(data, address);
      } catch (error) {
        console.error('[BluetoothOrchestrator] Erreur callback exercice:', error);
      }
    }
  }

  _handleDisconnection(address) {
    console.log('[BluetoothOrchestrator] Déconnexion capteur:', address);
    
    this.state.getConnectedDevices().delete(address);
    this.state.getSensorsWithData().delete(address);
    this.state.getPeripheralRefs().delete(address);
    
    const sensorInfo = this._getSensorInfo(address);
    if (sensorInfo) {
      this.sensorUIController.updateSensorStatus(address, sensorInfo.position, 'disconnected');
    }
  }

  _updateAngles(position, angles) {
    if (this.onAnglesUpdate) {
      this.onAnglesUpdate(position, angles);
    }
  }

  _checkIfReady() {
    const connected = this.state.getConnectedDevices().size;
    const withData = this.state.getSensorsWithData().size;
    
    if (connected > 0 && connected === withData) {
      console.log('[BluetoothOrchestrator] ✓ Tous les capteurs prêts');
      this.sensorUIController.updateStatus(`${connected} capteur(s) prêt(s)`);
    }
  }

  _resetDiscovery() {
    this.state.getDiscoveredDevices().clear();
    this.state.getConnectedDevices().clear();
    this.state.getSensorsWithData().clear();
    this.state.getCalibrationOffsets().clear();
    this.state.getPeripheralRefs().clear();
    
    this.sensorUIController.clearSensors();
  }

  async cleanup() {
    console.log('[BluetoothOrchestrator] Nettoyage...');
    
    if (this.state.getIsScanning()) {
      await this.stopScan();
    }
    
    if (this.useIPCMode && this.ipcRenderer) {
      this.ipcRenderer.removeAllListeners('bluetooth:stateChange');
      this.ipcRenderer.removeAllListeners('sensor:discovered');
      this.ipcRenderer.removeAllListeners('sensor:connected');
      this.ipcRenderer.removeAllListeners('sensor:disconnected');
      this.ipcRenderer.removeAllListeners('sensor:data');
      this.ipcRenderer.removeAllListeners('scan:started');
      this.ipcRenderer.removeAllListeners('scan:stopped');
      this.ipcRenderer.removeAllListeners('scan:error'); // NOUVEAU
    }
    
    if (this.state.getBluetoothAdapter()) {
      await this.state.getBluetoothAdapter().cleanup();
    }
  }

  dispose() {
    console.log('[BluetoothOrchestrator] Dispose');
    this.cleanup();
    this.state = null;
    this.sensorUIController = null;
    this.onAnglesUpdate = null;
    this.bluetoothAdapterClass = null;
    this.ipcRenderer = null;
    this.exerciseDataCallbacks.clear();
  }

  // ========================================
  // MÉTHODES PUBLIQUES POUR USE CASES
  // ========================================

  /**
   * Récupère le service capteur pour les use cases
   * En mode IPC, retourne l'orchestrator lui-même qui sert de proxy
   * En mode Direct, retourne l'adapter Noble
   * @returns {Object} Instance du service capteur
   */
  getSensorService() {
    if (this.useIPCMode) {
      // En mode IPC, l'orchestrator sert de proxy
      console.log('[BluetoothOrchestrator] getSensorService() → Mode IPC, retourne l\'orchestrator');
      return this;
    } else {
      // En mode Direct, retourner l'adapter Noble
      console.log('[BluetoothOrchestrator] getSensorService() → Mode Direct, retourne l\'adapter');
      return this.state.getBluetoothAdapter();
    }
  }

  /**
   * Méthode proxy pour setupNotifications (compatibilité avec RunExerciseUseCase)
   * En mode IPC, délègue à registerExerciseCallback
   * En mode Direct, délègue à l'adapter Noble
   * @param {Object} peripheral - Peripheral du capteur
   * @param {Function} callback - Callback à appeler avec les données
   */
  async setupNotifications(peripheral, callback) {
    if (this.useIPCMode) {
      // En mode IPC, enregistrer le callback
      console.log('[BluetoothOrchestrator] setupNotifications (mode IPC) pour', peripheral.address);
      this.registerExerciseCallback(peripheral.address, callback);
      return Promise.resolve();
    } else {
      // En mode Direct, déléguer à l'adapter
      console.log('[BluetoothOrchestrator] setupNotifications (mode Direct)');
      const adapter = this.state.getBluetoothAdapter();
      if (!adapter) {
        throw new Error('Adapter Bluetooth non disponible');
      }
      return adapter.setupNotifications(peripheral, callback);
    }
  }

  /**
   * Récupère les capteurs connectés avec leurs informations
   * Compatible mode IPC et Direct
   * @returns {Array} Liste des capteurs connectés [{address, position, peripheral}, ...]
   */
  getConnectedSensors() {
    const sensors = [];
    
    // Parcourir les devices connectés
    for (const address of this.state.getConnectedDevices()) {
      const sensorInfo = this._getSensorInfo(address);
      
      if (!sensorInfo) continue;
      
      // En mode Direct, récupérer le peripheral réel
      let peripheral = null;
      
      if (this.state.getPeripheralRefs && this.state.getPeripheralRefs()) {
        peripheral = this.state.getPeripheralRefs().get(address);
      }
      
      // Si pas de peripheral (mode IPC), créer un objet minimal
      if (!peripheral) {
        peripheral = {
          address: address,
          advertisement: {
            localName: `Capteur ${sensorInfo.position}`
          },
          _ipcMode: true,
          _bluetoothOrchestrator: this // Référence pour que RunExerciseUseCase puisse s'enregistrer
        };
      }
      
      sensors.push({
        address: address,
        position: sensorInfo.position,
        color: sensorInfo.color,
        peripheral: peripheral
      });
    }
    
    return sensors;
  }

  /**
   * Récupère le peripheral pour un exercice
   * Priorité : capteur droit > premier capteur disponible
   * @returns {Object|null} Peripheral du capteur ou null si aucun disponible
   */
  getPeripheralForExercise() {
    const sensors = this.getConnectedSensors();
    
    if (sensors.length === 0) {
      console.warn('[BluetoothOrchestrator] Aucun capteur connecté pour exercice');
      return null;
    }
    
    // Chercher le capteur droit en priorité (pour Heart of Frost)
    const rightSensor = sensors.find(s => s.position === 'DROIT');
    if (rightSensor) {
      console.log('[BluetoothOrchestrator] Capteur DROIT sélectionné pour exercice');
      return rightSensor.peripheral;
    }
    
    // Sinon prendre le premier disponible
    console.log(`[BluetoothOrchestrator] Capteur ${sensors[0].position} sélectionné pour exercice`);
    return sensors[0].peripheral;
  }

  /**
   * Enregistre un callback pour recevoir les données brutes d'un capteur
   * Utilisé par les exercices en mode IPC
   * @param {string} address - Adresse du capteur
   * @param {Function} callback - Fonction à appeler avec (data, address)
   */
  registerExerciseCallback(address, callback) {
    console.log(`[BluetoothOrchestrator] Enregistrement callback exercice pour ${address}`);
    this.exerciseDataCallbacks.set(address.toLowerCase(), callback);
  }

  /**
   * Désenregistre un callback d'exercice
   * @param {string} address - Adresse du capteur
   */
  unregisterExerciseCallback(address) {
    console.log(`[BluetoothOrchestrator] Désenregistrement callback exercice pour ${address}`);
    this.exerciseDataCallbacks.delete(address.toLowerCase());
  }

  // ========================================
  // FONCTIONS UTILITAIRES PRIVÉES
  // ========================================

  _getSensorInfo(address) {
    const normalizedAddress = address.toLowerCase();
    
    if (normalizedAddress === this.sensorConfig.leftAddress.toLowerCase()) {
      return { position: 'GAUCHE', color: this.sensorConfig.leftColor };
    }
    
    if (normalizedAddress === this.sensorConfig.rightAddress.toLowerCase()) {
      return { position: 'DROIT', color: this.sensorConfig.rightColor };
    }
    
    return null;
  }
}

module.exports = BluetoothOrchestrator;