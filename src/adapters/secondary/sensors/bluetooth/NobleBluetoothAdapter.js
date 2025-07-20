// src/adapters/secondary/sensors/bluetooth/NobleBluetoothAdapter.js

const ISensorService = require('../../../../core/ports/output/ISensorService');

class NobleBluetoothAdapter extends ISensorService {
  constructor() {
    super();
    this.noble = null;
    this.isInitialized = false;
    this.isScanning = false;
    this.discoveryCallbacks = [];
    this.stateChangeCallbacks = [];
  }

  async initialize() {
    if (this.isInitialized) return true;
    
    try {
      console.log('[Bluetooth] Initialisation de Noble...');
      // Charger Noble seulement quand nécessaire
      this.noble = require('@abandonware/noble');
      
      // Configuration Noble
      this.setupNobleHandlers();
      
      // Attendre que Bluetooth soit prêt
      await this.waitForPowerOn();
      
      this.isInitialized = true;
      console.log('[Bluetooth] Noble initialisé avec succès');
      return true;
    } catch (error) {
      console.error('[Bluetooth] Erreur initialisation Noble:', error.message);
      throw new Error(`Bluetooth non disponible: ${error.message}`);
    }
  }

  setupNobleHandlers() {
    if (!this.noble) return;
    
    // Gestionnaire d'état Bluetooth
    this.noble.on('stateChange', (state) => {
      console.log('[Bluetooth] État:', state);
      this.stateChangeCallbacks.forEach(callback => callback(state));
    });

    // Gestionnaire de découverte
    this.noble.on('discover', (peripheral) => {
      if (peripheral.advertisement.localName?.includes('WT901BLE67')) {
        console.log('[Bluetooth] Capteur découvert:', peripheral.address);
        this.discoveryCallbacks.forEach(callback => callback(peripheral));
      }
    });
  }

  async waitForPowerOn() {
    if (!this.noble) return;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout: Bluetooth non disponible après 10 secondes'));
      }, 10000);

      if (this.noble.state === 'poweredOn') {
        clearTimeout(timeout);
        resolve();
      } else {
        const stateHandler = (state) => {
          if (state === 'poweredOn') {
            clearTimeout(timeout);
            this.noble.removeListener('stateChange', stateHandler);
            resolve();
          } else if (state === 'poweredOff') {
            clearTimeout(timeout);
            this.noble.removeListener('stateChange', stateHandler);
            reject(new Error('Bluetooth désactivé'));
          }
        };
        this.noble.on('stateChange', stateHandler);
      }
    });
  }

  async startScanning() {
    try {
      // Initialiser si nécessaire
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      if (this.isScanning) return;
      
      console.log('[Bluetooth] Démarrage du scan');
      this.isScanning = true;
      this.noble.startScanning();
    } catch (error) {
      console.error('[Bluetooth] Erreur lors du démarrage du scan:', error);
      throw error;
    }
  }

  async stopScanning() {
    if (!this.isInitialized || !this.isScanning) return;
    
    console.log('[Bluetooth] Arrêt du scan');
    this.isScanning = false;
    this.noble.stopScanning();
  }

  async connectSensor(peripheral) {
    if (!this.isInitialized) {
      throw new Error('Bluetooth non initialisé');
    }
    
    return new Promise((resolve, reject) => {
      peripheral.connect((error) => {
        if (error) {
          console.error('[Bluetooth] Erreur connexion:', error);
          reject(error);
          return;
        }
        
        console.log('[Bluetooth] Connexion réussie:', peripheral.address);
        resolve({
          address: peripheral.address,
          name: peripheral.advertisement.localName,
          rssi: peripheral.rssi
        });
      });
    });
  }

  async disconnectSensor(address) {
    // Noble gère la déconnexion via l'objet peripheral
    console.log('[Bluetooth] Déconnexion demandée pour:', address);
  }

  async setupNotifications(peripheral, onDataCallback) {
    if (!this.isInitialized) {
      throw new Error('Bluetooth non initialisé');
    }
    
    return new Promise((resolve, reject) => {
      peripheral.discoverAllServicesAndCharacteristics((error, services, characteristics) => {
        if (error) {
          console.error('[Bluetooth] Erreur découverte services:', error);
          reject(error);
          return;
        }

        console.log('[Bluetooth] Services découverts pour:', peripheral.address);
        
        // Activer les notifications sur toutes les caractéristiques
        let notificationsSetup = 0;
        
        characteristics.forEach(characteristic => {
          characteristic.notify(true, (error) => {
            if (error) {
              console.error('[Bluetooth] Erreur activation notification:', error);
              return;
            }
            
            notificationsSetup++;
            
            // Écouter les données
            characteristic.on('data', (data) => {
              if (data && data.length > 0) {
                onDataCallback(data);
              }
            });
            
            // Si toutes les notifications sont configurées
            if (notificationsSetup === characteristics.length) {
              resolve();
            }
          });
        });
        
        // Gérer la déconnexion
        peripheral.once('disconnect', () => {
          console.log('[Bluetooth] Déconnexion détectée:', peripheral.address);
        });
      });
    });
  }

  async sendCommand(peripheral, command) {
    if (!this.isInitialized) {
      throw new Error('Bluetooth non initialisé');
    }
    
    return new Promise((resolve, reject) => {
      peripheral.discoverAllServicesAndCharacteristics((error, services, characteristics) => {
        if (error) {
          reject(error);
          return;
        }
        
        if (characteristics.length > 0) {
          characteristics[0].write(command, true, (error) => {
            if (error) {
              console.error('[Bluetooth] Erreur envoi commande:', error);
              reject(error);
            } else {
              console.log('[Bluetooth] Commande envoyée');
              resolve();
            }
          });
        } else {
          reject(new Error('Aucune caractéristique trouvée'));
        }
      });
    });
  }

  onDiscover(callback) {
    this.discoveryCallbacks.push(callback);
  }

  onStateChange(callback) {
    this.stateChangeCallbacks.push(callback);
  }

  removeDiscoveryCallback(callback) {
    this.discoveryCallbacks = this.discoveryCallbacks.filter(cb => cb !== callback);
  }

  removeStateChangeCallback(callback) {
    this.stateChangeCallbacks = this.stateChangeCallbacks.filter(cb => cb !== callback);
  }

  // Méthode pour vérifier si Bluetooth est disponible
  async checkBluetoothAvailability() {
    try {
      await this.initialize();
      return { available: true };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }
}

module.exports = NobleBluetoothAdapter;
