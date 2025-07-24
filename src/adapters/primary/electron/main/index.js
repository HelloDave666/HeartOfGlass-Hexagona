// src/adapters/primary/electron/main/index.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      // Configuration temporaire pour faire fonctionner Noble
      // (similaire à l'ancien projet qui fonctionnait)
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
      webSecurity: false
    },
    backgroundColor: '#1a1a1a',
    show: false // Afficher quand prêt
  });

  // Charger l'interface
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Afficher quand prêt
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Toujours ouvrir les DevTools pour le débogage
    mainWindow.webContents.openDevTools();
    
    console.log('[Main] Fenêtre affichée, DevTools ouvertes');
  });

  // Gérer la fermeture proprement
  mainWindow.on('close', (event) => {
    console.log('[Main] Fermeture de la fenêtre demandée');
    
    // Envoyer un signal au renderer pour nettoyer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app-closing');
      
      // Attendre un peu pour le nettoyage
      setTimeout(() => {
        mainWindow = null;
        app.quit();
      }, 500);
      
      // Empêcher la fermeture immédiate
      event.preventDefault();
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
  createWindow();
});

// Gestion de la fermeture
app.on('window-all-closed', () => {
  console.log('[App] Toutes les fenêtres fermées');
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

// Gestion propre de la fermeture de l'app
app.on('before-quit', () => {
  console.log('[App] Fermeture de l\'application');
});

// Log des messages du renderer
ipcMain.on('log', (event, { level, message }) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[Renderer ${level}] ${timestamp} - ${message}`);
});

// Réponse au renderer que le nettoyage est terminé
ipcMain.on('cleanup-complete', () => {
  console.log('[Main] Nettoyage terminé, fermeture de l\'application');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  app.quit();
});