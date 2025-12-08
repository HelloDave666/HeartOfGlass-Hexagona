// src/adapters/primary/ipc/handlers/SensorHandler.js

const { ipcMain } = require('electron');
const ConnectSensorUseCase = require('../../../../core/useCases/sensor/ConnectSensorUseCase');
const { Events } = require('../../../../infrastructure/eventBus/EventBus');

class SensorHandler {
  constructor(sensorService, sensorRepository, eventBus, config) {
    this.sensorService = sensorService;
    this.sensorRepository = sensorRepository;
    this.eventBus = eventBus;
    this.config = config;
    this.connectSensorUseCase = new ConnectSensorUseCase(
      sensorService,
      sensorRepository,
      eventBus
    );
    
    this.discoveryHandler = null;
    this.setupHandlers();
    this.setupEventForwarding();
  }

  setupHandlers() {
    // Scan des capteurs avec gestion d'erreur
    ipcMain.handle('sensor:scan', async () => {
      console.log('[IPC] Demande de scan des capteurs');
      try {
        // Vérifier d'abord si Bluetooth est disponible
        const availability = await this.sensorService.checkBluetoothAvailability();
        if (!availability.available) {
          return { 
            success: false, 
            error: availability.error || 'Bluetooth non disponible'
          };
        }
        
        // Configurer le gestionnaire de découverte si pas déjà fait
        if (!this.discoveryHandler) {
          this.setupDiscoveryHandler();
        }
        
        await this.sensorService.startScanning();
        return { success: true };
      } catch (error) {
        console.error('[IPC] Erreur scan:', error);
        return { 
          success: false, 
          error: error.message 
        };
      }
    });

    // Arrêt du scan
    ipcMain.handle('sensor:stop-scan', async () => {
      console.log('[IPC] Arrêt du scan');
      try {
        await this.sensorService.stopScanning();
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // État des capteurs
    ipcMain.handle('sensor:get-status', async () => {
      const sensors = await this.sensorRepository.findAll();
      const bothActive = await this.sensorRepository.areBothSensorsActive();
      
      return {
        sensors: sensors.map(s => s.toDisplayData()),
        bothActive,
        leftConnected: sensors.some(s => s.position === 'GAUCHE' && s.isConnected),
        rightConnected: sensors.some(s => s.position === 'DROIT' && s.isConnected)
      };
    });

    // Configuration des capteurs
    ipcMain.handle('sensor:update-config', async (event, config) => {
      this.config.leftAddress = config.leftAddress;
      this.config.rightAddress = config.rightAddress;
      this.config.swapHands = config.swapHands;
      
      // Réinitialiser si nécessaire
      if (config.reset) {
        await this.sensorRepository.clear();
      }
      
      return { success: true };
    });
  }

  setupDiscoveryHandler() {
    // Gestionnaire de découverte
    this.discoveryHandler = async (peripheral) => {
      const address = peripheral.address.toLowerCase();
      
      // Vérifier si c'est un de nos capteurs configurés
      if (address === this.config.leftAddress.toLowerCase() || 
          address === this.config.rightAddress.toLowerCase()) {
        
        // Connecter automatiquement
        try {
          await this.connectSensorUseCase.execute(peripheral, {
            leftAddress: this.config.leftAddress,
            rightAddress: this.config.rightAddress,
            leftColor: this.config.leftColor,
            rightColor: this.config.rightColor
          });
        } catch (error) {
          console.error('[IPC] Erreur connexion automatique:', error);
        }
      }
    };
    
    this.sensorService.onDiscover(this.discoveryHandler);
  }

  setupEventForwarding() {
  // Transférer les événements au renderer
  const eventsToForward = [
    Events.SENSOR_CONNECTED,
    Events.SENSOR_DISCONNECTED,
    Events.SENSOR_DATA,
    Events.SENSOR_BATTERY,
    Events.SENSORS_READY
  ];

  eventsToForward.forEach(eventName => {
    this.eventBus.on(eventName, (data) => {
      // Envoyer à toutes les fenêtres
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send(eventName, data);
      });
    });
  });

  // Flag pour éviter spam sensors:ready
  let sensorsReadyEmitted = false;

  // Vérifier si les deux capteurs sont prêts
  this.eventBus.on(Events.SENSOR_DATA, async () => {
    const bothActive = await this.sensorRepository.areBothSensorsActive();
    
    // N'émettre qu'une seule fois
    if (bothActive && !sensorsReadyEmitted) {
      sensorsReadyEmitted = true;
      this.eventBus.emit(Events.SENSORS_READY);
      
      // Arrêter le scan automatiquement
      await this.sensorService.stopScanning();
      
      console.log('[SensorHandler] Les deux capteurs sont prêts');
    }
  });
}
}

module.exports = SensorHandler;
