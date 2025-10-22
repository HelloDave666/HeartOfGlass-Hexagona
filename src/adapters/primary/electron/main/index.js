// src/adapters/primary/electron/main/index.js
// Version stable et simplifiée

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      // Configuration compatible avec Noble (comme l'ancien projet)
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
      webSecurity: false
    },
    backgroundColor: '#1a1a1a',
    show: false
  });

  // Charger l'interface
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Afficher quand prêt
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Toujours ouvrir les DevTools pour le debug
    mainWindow.webContents.openDevTools();
    console.log('[Main] Fenêtre affichée, DevTools ouvertes');
  });

  // Nettoyer à la fermeture
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialisation de l'application
app.whenReady().then(() => {
  console.log('[App] Application prête');
  createWindow();
});

// Gestion de la fermeture
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
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
});

// Log des messages du renderer
ipcMain.on('log', (event, { level, message }) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[Renderer ${level}] ${timestamp} - ${message}`);
});

// Gestion de la fermeture propre
app.on('before-quit', () => {
  if (mainWindow) {
    mainWindow.webContents.send('app-closing');
  }
});

// Écouter la confirmation de nettoyage
ipcMain.on('cleanup-complete', () => {
  console.log('[Main] Nettoyage terminé, fermeture de l\'application');
  app.quit();
});