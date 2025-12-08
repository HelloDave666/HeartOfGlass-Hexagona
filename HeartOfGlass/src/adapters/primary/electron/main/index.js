// src/adapters/primary/electron/main/index.js
// Version refactorisée avec Container DI

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let container;
let sensorHandler;

function createWindow() {
 mainWindow = new BrowserWindow({
 width: 1920,
 height: 1080,
 webPreferences: {
 // Configuration compatible avec Noble
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

// Initialiser le Container et les handlers IPC
async function initializeContainer() {
 console.log('[Main] Initialisation du Container DI...');

 try {
 // Importer le Container
 const { getInstance } = require('../../../../infrastructure/di/Container');
 container = getInstance();

 // Initialiser les services essentiels (pas le Bluetooth encore)
 container.initializeEssentials();

 // Récupérer le SensorHandler (qui contient déjà tous les IPC handlers)
 sensorHandler = container.resolve('sensorHandler');

 console.log('[Main] [OK] Container initialisé');
 console.log('[Main] [OK] IPC handlers configurés (sensor:scan, sensor:stop-scan, sensor:get-status, sensor:update-config)');

 return true;
 } catch (error) {
 console.error('[Main] ✗ Erreur initialisation Container:', error);
 return false;
 }
}

// Initialisation de l'application
app.whenReady().then(async () => {
 console.log('[Main] Application prête');

 // Initialiser le Container AVANT de créer la fenêtre
 const containerOk = await initializeContainer();

 if (!containerOk) {
 console.error('[Main] Container échoué - L\'application démarre quand même');
 console.error('[Main] app.js utilisera le mode direct (ancien système)');
 }

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
 console.error('[Main] Erreur non capturée:', error);
});

// Log des messages du renderer
ipcMain.on('log', (event, { level, message }) => {
 const timestamp = new Date().toLocaleTimeString();
 console.log(`[Renderer ${level}] ${timestamp} - ${message}`);
});

// Gestion de la fermeture propre
app.on('before-quit', async () => {
 console.log('[Main] Fermeture de l\'application...');

 if (mainWindow) {
 mainWindow.webContents.send('app-closing');
 }

 // Cleanup du Container si initialisé
 if (container) {
 try {
 const sensorService = container.resolve('sensorService');
 if (sensorService && typeof sensorService.cleanup === 'function') {
 console.log('[Main] Nettoyage du service Bluetooth...');
 await sensorService.cleanup();
 }
 } catch (error) {
 console.error('[Main] Erreur cleanup:', error);
 }
 }
});

// Écouter la confirmation de nettoyage depuis le renderer
ipcMain.on('cleanup-complete', () => {
 console.log('[Main] Nettoyage renderer terminé');
 // Ne pas quitter immédiatement, laisser before-quit faire le cleanup
});
