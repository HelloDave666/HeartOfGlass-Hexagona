// src/infrastructure/eventBus/EventBus.js

const EventEmitter = require('events');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Augmenter la limite pour une app complexe
  }

  // Override emit pour ajouter du logging tout en gardant la signature
  emit(eventName, ...args) {
    console.log(`[EventBus] Émission: ${eventName}`, args[0]);
    return super.emit(eventName, ...args);
  }

  // Override on pour ajouter du logging tout en gardant la signature
  on(eventName, handler) {
    console.log(`[EventBus] Abonnement: ${eventName}`);
    return super.on(eventName, handler);
  }

  // Méthode personnalisée pour se désabonner (ne pas override off qui n'existe pas)
  unsubscribe(eventName, handler) {
    console.log(`[EventBus] Désabonnement: ${eventName}`);
    return this.removeListener(eventName, handler);
  }

  // Liste des événements disponibles (documentation)
  static get Events() {
    return {
      // Événements capteurs
      SENSOR_DISCOVERED: 'sensor:discovered',
      SENSOR_CONNECTED: 'sensor:connected',
      SENSOR_DISCONNECTED: 'sensor:disconnected',
      SENSOR_CONNECTION_FAILED: 'sensor:connection-failed',
      SENSOR_DATA: 'sensor:data',
      SENSOR_BATTERY: 'sensor:battery',
      SENSORS_READY: 'sensors:ready',
      
      // Événements audio
      AUDIO_LOADED: 'audio:loaded',
      AUDIO_STARTED: 'audio:started',
      AUDIO_PAUSED: 'audio:paused',
      AUDIO_STOPPED: 'audio:stopped',
      AUDIO_POSITION_CHANGED: 'audio:position-changed',
      AUDIO_SETTINGS_CHANGED: 'audio:settings-changed',
      
      // Événements enregistrement
      RECORDING_STARTED: 'recording:started',
      RECORDING_STOPPED: 'recording:stopped',
      RECORDING_SAVED: 'recording:saved',
      RECORDING_ERROR: 'recording:error',
      
      // Événements narratifs
      DIALOGUE_STARTED: 'dialogue:started',
      DIALOGUE_COMPLETED: 'dialogue:completed',
      DIALOGUE_SKIPPED: 'dialogue:skipped',
      
      // Événements système
      SYSTEM_READY: 'system:ready',
      SYSTEM_ERROR: 'system:error'
    };
  }
}

// Singleton
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new EventBus();
    }
    return instance;
  },
  Events: EventBus.Events
};
