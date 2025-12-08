// src/infrastructure/di/Container.js

const NobleBluetoothAdapter = require('../../adapters/secondary/sensors/bluetooth/NobleBluetoothAdapter');
const SensorRepository = require('../../adapters/secondary/storage/repositories/SensorRepository');
const SensorHandler = require('../../adapters/primary/ipc/handlers/SensorHandler');
const { getInstance: getEventBus } = require('../eventBus/EventBus');

class Container {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
  }

  // Enregistrer un service
  register(name, factory, options = {}) {
    this.services.set(name, {
      factory,
      singleton: options.singleton || false,
      lazy: options.lazy || false  // Ajout du lazy loading
    });
  }

  // Résoudre un service
  resolve(name) {
    const service = this.services.get(name);
    
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }

    if (service.singleton) {
      if (!this.singletons.has(name)) {
        this.singletons.set(name, service.factory(this));
      }
      return this.singletons.get(name);
    }

    return service.factory(this);
  }

  // Configuration du container
  configure() {
    // Configuration par défaut
    const defaultConfig = {
      leftAddress: 'ce:de:c2:f5:17:be',
      rightAddress: 'f0:70:c4:de:d1:22',
      leftColor: 'blue',
      rightColor: 'green',
      swapHands: false
    };

    // Infrastructure
    this.register('config', () => defaultConfig, { singleton: true });
    this.register('eventBus', () => getEventBus(), { singleton: true });

    // Adaptateurs secondaires - Bluetooth en lazy loading
    this.register('sensorService', () => new NobleBluetoothAdapter(), { 
      singleton: true, 
      lazy: true  // Ne pas initialiser au démarrage
    });
    this.register('sensorRepository', () => new SensorRepository(), { singleton: true });

    // Gestionnaires IPC
    this.register('sensorHandler', (container) => {
      return new SensorHandler(
        container.resolve('sensorService'),
        container.resolve('sensorRepository'),
        container.resolve('eventBus'),
        container.resolve('config')
      );
    }, { singleton: true });

    // TODO: Ajouter les autres services au fur et à mesure
    // - audioService
    // - audioRepository
    // - audioHandler
    // - recordingService
    // - narrativeService
    // etc.
  }

  // Initialiser seulement les services essentiels
  initializeEssentials() {
    console.log('[Container] Initialisation des services essentiels...');
    
    // Initialiser seulement les services qui ne dépendent pas du hardware
    this.resolve('eventBus');
    this.resolve('sensorRepository');
    this.resolve('sensorHandler');
    
    console.log('[Container] Services essentiels initialisés');
  }

  // Ancienne méthode gardée pour compatibilité
  initializeAll() {
    this.initializeEssentials();
  }
}

// Export singleton
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new Container();
      instance.configure();
    }
    return instance;
  },
  Container
};
