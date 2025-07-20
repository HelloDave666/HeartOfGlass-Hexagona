// src/adapters/primary/ui/services/BluetoothService.js

const noble = require('@abandonware/noble');

class BluetoothService {
  constructor() {
    this.isScanning = false;
    this.connectedDevices = new Map();
    this.sensorsWithData = new Map();
    this.callbacks = {
      onDiscovered: null,
      onConnected: null,
      onDisconnected: null,
      onData: null,
      onBattery: null,
      onReady: null
    };
    
    // Configuration des capteurs
    this.config = {
      leftAddress: 'ce:de:c2:f5:17:be',
      rightAddress: 'f0:70:c4:de:d1:22',
      leftColor: 'blue',
      rightColor: 'green'
    };
    
    this.calibrationOffsets = new Map();
    this.setupNoble();
  }

  setupNoble() {
    // Gestionnaire d'état Bluetooth
    noble.on('stateChange', (state) => {
      console.log('[Bluetooth] État:', state);
      if (state === 'poweredOn' && this.isScanning) {
        // Redémarrer le scan si nécessaire
        noble.startScanning();
      }
    });

    // Gestionnaire de découverte
    noble.on('discover', (peripheral) => {
      if (peripheral.advertisement.localName?.includes('WT901BLE67')) {
        console.log('[Bluetooth] Capteur trouvé:', peripheral.address);
        this.handleDiscovery(peripheral);
      }
    });
  }

  async startScanning() {
    console.log('[Bluetooth] Démarrage du scan');
    this.isScanning = true;
    this.connectedDevices.clear();
    this.sensorsWithData.clear();
    this.calibrationOffsets.clear();
    
    if (noble.state === 'poweredOn') {
      noble.startScanning();
      return { success: true };
    } else {
      return { 
        success: false, 
        error: 'Bluetooth non disponible. Vérifiez que le Bluetooth est activé.' 
      };
    }
  }

  stopScanning() {
    console.log('[Bluetooth] Arrêt du scan');
    this.isScanning = false;
    noble.stopScanning();
  }

  handleDiscovery(peripheral) {
    const address = peripheral.address.toLowerCase();
    const configLeft = this.config.leftAddress.toLowerCase();
    const configRight = this.config.rightAddress.toLowerCase();
    
    // Vérifier si c'est un de nos capteurs
    if (address !== configLeft && address !== configRight) {
      return;
    }

    // Déterminer la position
    const position = address === configLeft ? 'GAUCHE' : 'DROIT';
    const color = address === configLeft ? this.config.leftColor : this.config.rightColor;

    // Si déjà connecté, ne pas reconnecter
    if (this.connectedDevices.has(address)) {
      return;
    }

    // Connexion au capteur
    peripheral.connect((error) => {
      if (error) {
        console.error('[Bluetooth] Erreur connexion:', error);
        return;
      }

      console.log('[Bluetooth] Connecté à:', peripheral.address);
      this.connectedDevices.set(address, peripheral);

      // Notifier la connexion
      if (this.callbacks.onConnected) {
        this.callbacks.onConnected({
          address: peripheral.address,
          position,
          color,
          rssi: peripheral.rssi,
          signalStrength: Math.abs(peripheral.rssi)
        });
      }

      // Découvrir les services
      peripheral.discoverAllServicesAndCharacteristics((error, services, characteristics) => {
        if (error) {
          console.error('[Bluetooth] Erreur découverte services:', error);
          return;
        }

        console.log('[Bluetooth] Services découverts pour:', peripheral.address);

        // Envoyer commande batterie pour le capteur gauche
        if (position === 'GAUCHE' && characteristics.length > 0) {
          const batteryCmd = Buffer.from([0xFF, 0xAA, 0x27, 0x64, 0x00]);
          characteristics[0].write(batteryCmd, true, (error) => {
            if (error) console.error('[Bluetooth] Erreur lecture batterie:', error);
          });
        }

        // Activer les notifications
        characteristics.forEach(characteristic => {
          characteristic.notify(true, (error) => {
            if (error) {
              console.error('[Bluetooth] Erreur notification:', error);
              return;
            }

            characteristic.on('data', (data) => {
              this.handleSensorData(data, peripheral.address, position, color);
            });
          });
        });
      });

      // Gérer la déconnexion
      peripheral.once('disconnect', () => {
        console.log('[Bluetooth] Déconnexion:', peripheral.address);
        this.connectedDevices.delete(address);
        this.sensorsWithData.delete(address);
        
        if (this.callbacks.onDisconnected) {
          this.callbacks.onDisconnected({ address, position });
        }
      });
    });
  }

  handleSensorData(data, address, position, color) {
    if (!data || data.length < 1) return;

    // Données d'angle
    if (data[0] === 0x55 && data[1] === 0x61 && data.length >= 20) {
      const angles = {
        x: ((data[15] << 8 | data[14]) / 32768 * 180),
        y: ((data[17] << 8 | data[16]) / 32768 * 180),
        z: ((data[19] << 8 | data[18]) / 32768 * 180)
      };

      // Calibration automatique
      if (!this.calibrationOffsets.has(address)) {
        console.log('[Bluetooth] Calibration pour:', address);
        this.calibrationOffsets.set(address, {
          x: angles.x,
          y: angles.y,
          z: angles.z
        });
      }

      const offsets = this.calibrationOffsets.get(address);
      const normalizedAngles = {
        x: this.normalizeAngle(angles.x - offsets.x, true),
        y: this.normalizeAngle(angles.y - offsets.y, true),
        z: this.normalizeAngle(angles.z - offsets.z, true)
      };

      // Marquer le capteur comme ayant des données
      this.sensorsWithData.set(address, true);

      // Notifier les données
      if (this.callbacks.onData) {
        this.callbacks.onData({
          address,
          position,
          angles: normalizedAngles
        });
      }

      // Vérifier si les deux capteurs sont actifs
      this.checkBothSensorsReady();
    }
    // Données de batterie
    else if (data[0] === 0x55 && data[1] === 0x71 && data.length >= 6) {
      const batteryValue = (data[5] << 8) | data[4];
      let percentage = 0;
      
      if (batteryValue > 830) percentage = 100;
      else if (batteryValue > 393) percentage = 90;
      else if (batteryValue > 387) percentage = 75;
      else if (batteryValue > 382) percentage = 60;
      else if (batteryValue > 379) percentage = 50;
      else if (batteryValue > 377) percentage = 40;
      else if (batteryValue > 373) percentage = 30;
      else if (batteryValue > 370) percentage = 20;
      else if (batteryValue > 368) percentage = 15;
      else if (batteryValue > 350) percentage = 10;
      else if (batteryValue > 340) percentage = 5;

      if (this.callbacks.onBattery) {
        this.callbacks.onBattery({
          address,
          position,
          battery: percentage
        });
      }
    }
  }

  normalizeAngle(angle, preserveFullRange = false) {
    if (preserveFullRange) {
      while (angle > 180) angle -= 360;
      while (angle < -180) angle += 360;
      return angle;
    }
    
    angle = angle % 360;
    if (angle < 0) angle += 360;
    return angle;
  }

  checkBothSensorsReady() {
    const leftConnected = this.connectedDevices.has(this.config.leftAddress.toLowerCase());
    const rightConnected = this.connectedDevices.has(this.config.rightAddress.toLowerCase());
    const leftHasData = this.sensorsWithData.has(this.config.leftAddress.toLowerCase());
    const rightHasData = this.sensorsWithData.has(this.config.rightAddress.toLowerCase());

    if (leftConnected && rightConnected && leftHasData && rightHasData) {
      if (this.callbacks.onReady) {
        this.callbacks.onReady();
      }
      // Arrêter le scan automatiquement
      this.stopScanning();
    }
  }

  updateConfig(config) {
    this.config = { ...this.config, ...config };
  }

  // Méthodes pour définir les callbacks
  onDiscovered(callback) { this.callbacks.onDiscovered = callback; }
  onConnected(callback) { this.callbacks.onConnected = callback; }
  onDisconnected(callback) { this.callbacks.onDisconnected = callback; }
  onData(callback) { this.callbacks.onData = callback; }
  onBattery(callback) { this.callbacks.onBattery = callback; }
  onReady(callback) { this.callbacks.onReady = callback; }
}

// Export singleton
let instance = null;
module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new BluetoothService();
    }
    return instance;
  }
};
