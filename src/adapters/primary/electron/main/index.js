// src/adapters/primary/electron/main/index.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { getInstance: getContainer } = require('../../../../infrastructure/di/Container');

let mainWindow;
let container;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js')
    },
    backgroundColor: '#1a1a1a',
    show: false // Afficher quand prêt
  });

  // Charger l'interface
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Afficher quand prêt
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Mode développement
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }
  });

  // Nettoyer à la fermeture
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialisation de l'application
app.whenReady().then(() => {
  console.log('[App] Application prête');
  
  // Initialiser le container de dépendances
  container = getContainer();
  container.initializeAll();
  
  // Créer la fenêtre
  createWindow();
  
  // Notifier que le système est prêt
  const eventBus = container.resolve('eventBus');
  eventBus.emit('system:ready');
});

// Gestion de la fermeture
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Nettoyer les ressources
    if (container) {
      const sensorService = container.resolve('sensorService');
      sensorService.stopScanning();
    }
    app.quit();
  }
});

// Réactivation sur macOS
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('[App] Erreur non capturée:', error);
  if (container) {
    const eventBus = container.resolve('eventBus');
    eventBus.emit('system:error', { error: error.message });
  }
});

// Log des messages du renderer
ipcMain.on('log', (event, { level, message }) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[Renderer ${level}] ${timestamp} - ${message}`);
});
