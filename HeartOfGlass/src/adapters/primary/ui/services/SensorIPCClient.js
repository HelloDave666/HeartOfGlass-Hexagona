// src/adapters/primary/ui/services/SensorIPCClient.js
// Client IPC qui remplace les appels directs à NobleBluetoothAdapter

/**
 * Client IPC pour la gestion des capteurs
 * Encapsule la communication avec le main process via IPC
 * Remplace NobleBluetoothAdapter dans app.js
 */
class SensorIPCClient {
 constructor() {
 this.ipcRenderer = null;
 this.isInitialized = false;
 this.isScanning = false;
 
 // Callbacks pour les événements
 this.discoveryCallbacks = [];
 this.stateChangeCallbacks = [];
 
 console.log('[SensorClient] Client IPC créé');
 }

 /**
 * Initialise le client IPC
 */
 async initialize() {
 if (this.isInitialized) {
 console.log('[SensorClient] Déjà initialisé');
 return true;
 }
 
 try {
 // Vérifier si on est dans Electron
 if (!window.require) {
 throw new Error('IPC non disponible (pas dans Electron)');
 }
 
 const { ipcRenderer } = window.require('electron');
 this.ipcRenderer = ipcRenderer;
 
 // Configurer les listeners pour les événements du main process
 this.setupEventListeners();
 
 this.isInitialized = true;
 console.log('[SensorClient] [OK] Client IPC initialisé');
 return true;
 
 } catch (error) {
 console.error('[SensorClient] ✗ Erreur initialisation:', error);
 throw error;
 }
 }

 /**
 * Configure les listeners pour les événements IPC
 */
 setupEventListeners() {
 if (!this.ipcRenderer) return;
 
 // Événement : Capteur connecté
 this.ipcRenderer.on('sensor:connected', (event, data) => {
 console.log('[SensorClient] Capteur connecté:', data);
 });
 
 // Événement : Capteur déconnecté
 this.ipcRenderer.on('sensor:disconnected', (event, data) => {
 console.log('[SensorClient] Capteur déconnecté:', data);
 });
 
 // Événement : Données capteur
 this.ipcRenderer.on('sensor:data', (event, data) => {
 // Ces événements seront gérés par app.js directement
 });
 
 // Événement : Batterie
 this.ipcRenderer.on('sensor:battery', (event, data) => {
 console.log('[SensorClient] Batterie:', data);
 });
 
 // Événement : Les deux capteurs sont prêts
 this.ipcRenderer.on('sensors:ready', (event) => {
 console.log('[SensorClient] Les deux capteurs sont prêts');
 });
 
 console.log('[SensorClient] Listeners IPC configurés');
 }

 /**
 * Vérifie la disponibilité Bluetooth
 */
 async checkBluetoothAvailability() {
 if (!this.isInitialized) {
 await this.initialize();
 }
 
 try {
 const result = await this.ipcRenderer.invoke('sensor:get-status');
 return { 
 available: true,
 state: 'poweredOn'
 };
 } catch (error) {
 return { 
 available: false, 
 error: error.message 
 };
 }
 }

 /**
 * Démarre le scan Bluetooth
 */
 async startScanning() {
 if (!this.isInitialized) {
 await this.initialize();
 }
 
 console.log('[SensorClient] Démarrage scan via IPC...');
 
 try {
 const result = await this.ipcRenderer.invoke('sensor:scan');
 
 if (result.success) {
 this.isScanning = true;
 console.log('[SensorClient] [OK] Scan démarré');
 } else {
 console.error('[SensorClient] ✗ Erreur scan:', result.error);
 throw new Error(result.error);
 }
 
 } catch (error) {
 console.error('[SensorClient] ✗ Erreur startScanning:', error);
 throw error;
 }
 }

 /**
 * Arrête le scan Bluetooth
 */
 async stopScanning() {
 if (!this.isInitialized) {
 console.log('[SensorClient] Pas initialisé, scan déjà arrêté');
 return;
 }
 
 console.log('[SensorClient] Arrêt scan via IPC...');
 
 try {
 const result = await this.ipcRenderer.invoke('sensor:stop-scan');
 
 if (result.success) {
 this.isScanning = false;
 console.log('[SensorClient] [OK] Scan arrêté');
 } else {
 console.error('[SensorClient] ✗ Erreur arrêt scan:', result.error);
 }
 
 } catch (error) {
 console.error('[SensorClient] ✗ Erreur stopScanning:', error);
 }
 }

 /**
 * Obtient le statut du scan
 */
 getScanStatus() {
 return {
 isScanning: this.isScanning,
 isInitialized: this.isInitialized
 };
 }

 /**
 * Met à jour la configuration des capteurs
 */
 async updateConfig(config) {
 if (!this.isInitialized) {
 await this.initialize();
 }
 
 try {
 const result = await this.ipcRenderer.invoke('sensor:update-config', config);
 return result;
 } catch (error) {
 console.error('[SensorClient] ✗ Erreur updateConfig:', error);
 throw error;
 }
 }

 /**
 * Enregistre un callback de découverte
 * Note: La découverte et connexion sont gérées automatiquement par le main process
 * Ces callbacks sont gardés pour compatibilité avec app.js
 */
 onDiscover(callback) {
 if (typeof callback === 'function') {
 this.discoveryCallbacks.push(callback);
 }
 }

 /**
 * Enregistre un callback de changement d'état
 */
 onStateChange(callback) {
 if (typeof callback === 'function') {
 this.stateChangeCallbacks.push(callback);
 }
 }

 /**
 * Retire un callback de découverte
 */
 removeDiscoveryCallback(callback) {
 this.discoveryCallbacks = this.discoveryCallbacks.filter(cb => cb !== callback);
 }

 /**
 * Retire un callback de changement d'état
 */
 removeStateChangeCallback(callback) {
 this.stateChangeCallbacks = this.stateChangeCallbacks.filter(cb => cb !== callback);
 }

 /**
 * Nettoie les ressources
 */
 async cleanup() {
 console.log('[SensorClient] Nettoyage...');
 
 try {
 if (this.isScanning) {
 await this.stopScanning();
 }
 
 // Nettoyer les callbacks
 this.discoveryCallbacks = [];
 this.stateChangeCallbacks = [];
 
 // Nettoyer les listeners IPC
 if (this.ipcRenderer) {
 this.ipcRenderer.removeAllListeners('sensor:connected');
 this.ipcRenderer.removeAllListeners('sensor:disconnected');
 this.ipcRenderer.removeAllListeners('sensor:data');
 this.ipcRenderer.removeAllListeners('sensor:battery');
 this.ipcRenderer.removeAllListeners('sensors:ready');
 }
 
 this.isInitialized = false;
 
 console.log('[SensorClient] [OK] Nettoyage terminé');
 
 } catch (error) {
 console.error('[SensorClient] Erreur nettoyage:', error);
 }
 }
}

// Export pour utilisation dans app.js
if (typeof module !== 'undefined' && module.exports) {
 module.exports = SensorIPCClient;
}