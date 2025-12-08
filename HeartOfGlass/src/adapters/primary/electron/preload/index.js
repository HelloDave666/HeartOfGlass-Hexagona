// src/adapters/primary/electron/preload/index.js

const { contextBridge, ipcRenderer } = require('electron');

// API exposée au renderer
contextBridge.exposeInMainWorld('heartOfGlass', {
  sensor: {
    // Commandes
    scan: () => ipcRenderer.invoke('sensor:scan'),
    stopScan: () => ipcRenderer.invoke('sensor:stop-scan'),
    getStatus: () => ipcRenderer.invoke('sensor:get-status'),
    updateConfig: (config) => ipcRenderer.invoke('sensor:update-config', config),
    
    // Événements
    onConnected: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('sensor:connected', handler);
      return () => ipcRenderer.removeListener('sensor:connected', handler);
    },
    onDisconnected: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('sensor:disconnected', handler);
      return () => ipcRenderer.removeListener('sensor:disconnected', handler);
    },
    onData: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('sensor:data', handler);
      return () => ipcRenderer.removeListener('sensor:data', handler);
    },
    onBattery: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('sensor:battery', handler);
      return () => ipcRenderer.removeListener('sensor:battery', handler);
    },
    onReady: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('sensors:ready', handler);
      return () => ipcRenderer.removeListener('sensors:ready', handler);
    }
  },
  
  audio: {
    // TODO: Implémenter les méthodes audio
    startEngine: () => ipcRenderer.invoke('audio:start-engine'),
    stopEngine: () => ipcRenderer.invoke('audio:stop-engine'),
    updateSettings: (settings) => ipcRenderer.invoke('audio:update-settings', settings),
    loadFile: (file) => ipcRenderer.invoke('audio:load-file', file),
    play: () => ipcRenderer.invoke('audio:play'),
    pause: () => ipcRenderer.invoke('audio:pause'),
    stop: () => ipcRenderer.invoke('audio:stop'),
    setPosition: (position) => ipcRenderer.invoke('audio:set-position', position)
  },
  
  recording: {
    // TODO: Implémenter les méthodes d'enregistrement
    start: () => ipcRenderer.invoke('recording:start'),
    stop: () => ipcRenderer.invoke('recording:stop'),
    save: (format) => ipcRenderer.invoke('recording:save', format)
  },
  
  narrative: {
    // TODO: Implémenter les méthodes narratives
    addDialogue: (speaker, text, expression) => 
      ipcRenderer.invoke('narrative:add-dialogue', { speaker, text, expression }),
    nextDialogue: () => ipcRenderer.invoke('narrative:next-dialogue'),
    skipDialogue: () => ipcRenderer.invoke('narrative:skip-dialogue')
  },
  
  // Utilitaires
  log: (level, message) => ipcRenderer.send('log', { level, message })
});

// Exposer une version simplifiée de require pour certains modules si nécessaire
contextBridge.exposeInMainWorld('electronRequire', {
  // Rien pour l'instant, tout passe par l'API
});
