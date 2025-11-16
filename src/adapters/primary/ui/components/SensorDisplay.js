// src/adapters/primary/ui/components/SensorDisplay.js
// ⚠️ LEGACY CODE - Not currently used in the application
// Kept for reference - Bluetooth now handled by SensorIPCClient + BluetoothOrchestrator

// UNCOMMENT BELOW IF YOU NEED TO REACTIVATE THIS CLASS
/*
const { getInstance: getBluetoothService } = require('../services/BluetoothService');

class SensorDisplay {
  constructor(container, api) {
    this.container = container;
    this.api = api;
    this.bluetoothService = getBluetoothService();
    this.leftDisplay = null;
    this.rightDisplay = null;
    this.scanButton = null;
    this.isScanning = false;
    
    this.init();
  }

  init() {
    this.render();
    this.setupEventListeners();
    this.setupBluetoothCallbacks();
  }

  render() {
    this.container.innerHTML = `
      <div class="sensor-controls">
        <button id="scanButton" class="scan-button">
          Rechercher les capteurs
        </button>
        <div id="scanError" class="error-message" style="display: none;"></div>
      </div>
      <div id="deviceList" class="device-list"></div>
    `;

    this.scanButton = this.container.querySelector('#scanButton');
    this.deviceList = this.container.querySelector('#deviceList');
    this.errorDisplay = this.container.querySelector('#scanError');
  }

  setupEventListeners() {
    this.scanButton.addEventListener('click', () => this.toggleScan());
  }

  setupBluetoothCallbacks() {
    this.bluetoothService.onConnected((data) => this.handleSensorConnected(data));
    this.bluetoothService.onDisconnected((data) => this.handleSensorDisconnected(data));
    this.bluetoothService.onData((data) => this.handleSensorData(data));
    this.bluetoothService.onBattery((data) => this.handleBatteryUpdate(data));
    this.bluetoothService.onReady(() => this.handleSensorsReady());
  }

  async toggleScan() {
    if (this.isScanning) {
      await this.stopScan();
    } else {
      await this.startScan();
    }
  }

  async startScan() {
    console.log('[UI] Démarrage du scan');
    this.isScanning = true;
    this.updateScanButton('Recherche en cours...', '#e74c3c', false);
    this.hideError();
    
    this.deviceList.innerHTML = '';
    this.leftDisplay = this.createDeviceDisplay('GAUCHE', 'blue');
    this.rightDisplay = this.createDeviceDisplay('DROIT', 'green');
    this.deviceList.appendChild(this.leftDisplay.element);
    this.deviceList.appendChild(this.rightDisplay.element);

    try {
      const result = await this.bluetoothService.startScanning();
      if (!result.success) {
        throw new Error(result.error || 'Erreur inconnue');
      }
    } catch (error) {
      console.error('[UI] Erreur scan:', error);
      this.showError(error.message);
      this.updateScanButton('Réessayer', '#e74c3c', true);
      this.isScanning = false;
      
      if (error.message.includes('Bluetooth')) {
        this.showBluetoothHelp();
      }
    }
  }

  async stopScan() {
    console.log('[UI] Arrêt du scan');
    this.isScanning = false;
    this.bluetoothService.stopScanning();
    this.updateScanButton('Rechercher les capteurs', '#4CAF50', true);
  }

  showError(message) {
    this.errorDisplay.textContent = `Erreur: ${message}`;
    this.errorDisplay.style.display = 'block';
  }

  hideError() {
    this.errorDisplay.style.display = 'none';
  }

  showBluetoothHelp() {
    const helpDiv = document.createElement('div');
    helpDiv.className = 'bluetooth-help';
    helpDiv.innerHTML = `
      <h4>Vérifiez que :</h4>
      <ul>
        <li>Le Bluetooth est activé sur votre ordinateur</li>
        <li>Vous utilisez Windows 10/11 avec Bluetooth 4.0+</li>
        <li>Les capteurs BWT901BLECL5 sont allumés</li>
        <li>Les capteurs sont en mode appairage</li>
      </ul>
      <p>Si le problème persiste, redémarrez l'application.</p>
    `;
    this.deviceList.appendChild(helpDiv);
  }

  createDeviceDisplay(position, color) {
    const element = document.createElement('div');
    element.className = 'device-info';
    element.innerHTML = `
      <div class="status-indicator status-disconnected"></div>
      <div class="info-basic">
        <h3 style="color: ${color}">Capteur ${position}</h3>
        <p class="address" style="color: ${color}">Adresse: --</p>
        <p class="rssi" style="color: ${color}">RSSI: --</p>
        <p class="signal" style="color: ${color}">Force du signal: --%</p>
        <p class="state" style="color: ${color}">État: déconnecté</p>
        <p class="battery" style="color: ${color}">Batterie: --%</p>
      </div>
      <div class="info-sensor">
        <h3>Données capteur</h3>
        <p class="roll" style="color: ${color}">Roll (X): --°</p>
        <p class="pitch" style="color: ${color}">Pitch (Y): --°</p>
        <p class="yaw" style="color: ${color}">Yaw (Z): --°</p>
      </div>
    `;

    return {
      element,
      position,
      color,
      updateStatus: (connected) => {
        const indicator = element.querySelector('.status-indicator');
        indicator.className = `status-indicator ${connected ? 'status-connected' : 'status-disconnected'}`;
        element.querySelector('.state').textContent = `État: ${connected ? 'connecté' : 'déconnecté'}`;
      },
      updateInfo: (info) => {
        if (info.address) element.querySelector('.address').textContent = `Adresse: ${info.address}`;
        if (info.rssi !== undefined) element.querySelector('.rssi').textContent = `RSSI: ${info.rssi}dBm`;
        if (info.signalStrength !== undefined) element.querySelector('.signal').textContent = `Force du signal: ${info.signalStrength}%`;
      },
      updateAngles: (angles) => {
        element.querySelector('.roll').textContent = `Roll (X): ${angles.x}°`;
        element.querySelector('.pitch').textContent = `Pitch (Y): ${angles.y}°`;
        element.querySelector('.yaw').textContent = `Yaw (Z): ${angles.z}°`;
      },
      updateBattery: (percentage) => {
        element.querySelector('.battery').textContent = `Batterie: ${percentage}%`;
      }
    };
  }

  updateScanButton(text, color, enabled) {
    this.scanButton.textContent = text;
    this.scanButton.style.backgroundColor = color;
    this.scanButton.disabled = !enabled;
    this.scanButton.style.cursor = enabled ? 'pointer' : 'not-allowed';
  }

  handleSensorConnected(data) {
    console.log('[UI] Capteur connecté:', data);
    const display = data.position === 'GAUCHE' ? this.leftDisplay : this.rightDisplay;
    if (display) {
      display.updateStatus(true);
      display.updateInfo(data);
    }
  }

  handleSensorDisconnected(data) {
    console.log('[UI] Capteur déconnecté:', data);
    const display = data.position === 'GAUCHE' ? this.leftDisplay : this.rightDisplay;
    if (display) {
      display.updateStatus(false);
    }
    this.updateScanButton('Rechercher les capteurs', '#4CAF50', true);
    this.isScanning = false;
  }

  handleSensorData(data) {
    const display = data.position === 'GAUCHE' ? this.leftDisplay : this.rightDisplay;
    if (display && data.angles) {
      display.updateAngles({
        x: data.angles.x.toFixed(1),
        y: data.angles.y.toFixed(1),
        z: data.angles.z.toFixed(1)
      });
    }
  }

  handleBatteryUpdate(data) {
    const display = data.position === 'GAUCHE' ? this.leftDisplay : this.rightDisplay;
    if (display) {
      display.updateBattery(data.battery);
    }
  }

  handleSensorsReady() {
    console.log('[UI] Les deux capteurs sont prêts');
    this.updateScanButton('Capteurs trouvés', '#3498db', false);
    this.stopScan();
    this.hideError();
  }

  updateConfig(config) {
    this.bluetoothService.updateConfig(config);
  }

  getStatus() {
    const leftConnected = this.bluetoothService.connectedDevices.has(
      this.bluetoothService.config.leftAddress.toLowerCase()
    );
    const rightConnected = this.bluetoothService.connectedDevices.has(
      this.bluetoothService.config.rightAddress.toLowerCase()
    );
    
    return {
      leftConnected,
      rightConnected,
      bothActive: leftConnected && rightConnected
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SensorDisplay;
}
*/

// LEGACY CODE END
// If you need this class, uncomment the entire block above