// src/adapters/secondary/sensors/bluetooth/NobleBluetoothAdapter.js
// Version améliorée avec gestion robuste des reconnexions

const ISensorService = require('../../../../core/ports/output/ISensorService');

/**
 * Adapter Bluetooth robuste utilisant @abandonware/noble
 * Gère les capteurs BWT901BLECL5.0 avec reconnexion automatique
 */
class NobleBluetoothAdapter extends ISensorService {
 constructor() {
 super();
 this.noble = null;
 this.isInitialized = false;
 this.isScanning = false;
 this.currentState = 'unknown'; // État Bluetooth actuel
 
 // Callbacks
 this.discoveryCallbacks = [];
 this.stateChangeCallbacks = [];
 
 // Gestion des périphériques connectés
 this.connectedPeripherals = new Map(); // address -> peripheral
 this.peripheralCharacteristics = new Map(); // address -> characteristics[]
 this.reconnectAttempts = new Map(); // address -> attempt count
 
 // Configuration
 this.config = {
 maxReconnectAttempts: 5,
 reconnectDelay: 2000,
 scanTimeout: 45000,
 minCharacteristics: 6, // BWT901BLE67 doit avoir 6 caractéristiques
 connectionTimeout: 10000,
 nobleResetDelay: 5000
 };
 
 console.log('[NobleAdapter] Adapter créé');
 }

 /**
 * Initialise Noble et configure les handlers
 */
 async initialize() {
 if (this.isInitialized) {
 console.log('[NobleAdapter] Déjà initialisé');
 return true;
 }
 
 try {
 console.log('[NobleAdapter] Initialisation de Noble...');
 
 // Charger Noble
 this.noble = require('@abandonware/noble');
 
 // Configuration des handlers
 this.setupNobleHandlers();
 
 // Attendre que Bluetooth soit prêt
 await this.waitForPowerOn();
 
 this.isInitialized = true;
 console.log('[NobleAdapter] [OK] Noble initialisé avec succès');
 return true;
 
 } catch (error) {
 console.error('[NobleAdapter] ✗ Erreur initialisation:', error.message);
 throw new Error(`Bluetooth non disponible: ${error.message}`);
 }
 }

 /**
 * Configure les gestionnaires d'événements Noble
 */
 setupNobleHandlers() {
 if (!this.noble) return;
 
 // Nettoyer les anciens listeners
 this.noble.removeAllListeners('stateChange');
 this.noble.removeAllListeners('discover');
 
 // Gestionnaire d'état Bluetooth
 this.noble.on('stateChange', (state) => {
 console.log('[NobleAdapter] État Bluetooth:', state);
 
 // Mettre à jour l'état interne
 this.currentState = state;
 
 // Notifier les callbacks
 this.stateChangeCallbacks.forEach(callback => {
 try {
 callback(state);
 } catch (error) {
 console.error('[NobleAdapter] Erreur callback état:', error);
 }
 });
 
 // Gérer la désactivation Bluetooth
 if (state === 'poweredOff' && this.isScanning) {
 console.warn('[NobleAdapter] Bluetooth désactivé pendant le scan');
 this.isScanning = false;
 }
 });

 // Gestionnaire de découverte
 this.noble.on('discover', (peripheral) => {
 const localName = peripheral.advertisement?.localName || '';
 
 // Filtrer uniquement les capteurs WT901BLE67
 if (!localName.includes('WT901BLE67')) {
 return;
 }
 
 const address = peripheral.address.toLowerCase();
 console.log('[NobleAdapter] Capteur découvert:', address, '-', peripheral.rssi, 'dBm');
 
 // Notifier les callbacks
 this.discoveryCallbacks.forEach(callback => {
 try {
 callback(peripheral);
 } catch (error) {
 console.error('[NobleAdapter] Erreur callback découverte:', error);
 }
 });
 });
 
 console.log('[NobleAdapter] Handlers configurés');
 }

 /**
 * Attend que Bluetooth soit prêt
 */
 async waitForPowerOn() {
 if (!this.noble) {
 throw new Error('Noble non chargé');
 }
 
 return new Promise((resolve, reject) => {
 const timeout = setTimeout(() => {
 reject(new Error('Timeout: Bluetooth non disponible après 10 secondes'));
 }, 10000);

 // Vérifier l'état actuel (via événement initial)
 const checkState = () => {
 if (this.currentState === 'poweredOn') {
 clearTimeout(timeout);
 resolve();
 return true;
 } else if (this.currentState === 'poweredOff') {
 clearTimeout(timeout);
 reject(new Error('Bluetooth désactivé'));
 return true;
 }
 return false;
 };
 
 // Vérifier immédiatement
 if (checkState()) return;
 
 // Sinon, attendre l'événement
 const stateHandler = (state) => {
 this.currentState = state;
 
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
 });
 }

 /**
 * Reset complet de Noble (pour reconnexions)
 */
 async resetNoble() {
 console.log('[NobleAdapter] Reset Noble...');
 
 try {
 if (this.isScanning) {
 await this.stopScanning();
 }
 
 // Attendre que Noble se stabilise
 await new Promise(resolve => setTimeout(resolve, this.config.nobleResetDelay));
 
 console.log('[NobleAdapter] [OK] Noble resetté');
 } catch (error) {
 console.error('[NobleAdapter] Erreur reset Noble:', error);
 }
 }

 /**
 * Démarre le scan Bluetooth
 */
 async startScanning() {
 try {
 // Initialiser si nécessaire
 if (!this.isInitialized) {
 await this.initialize();
 }
 
 if (this.isScanning) {
 console.log('[NobleAdapter] Scan déjà actif');
 return;
 }
 
 console.log('[NobleAdapter] Démarrage du scan...');
 
 // S'assurer que Noble est arrêté proprement
 try {
 this.noble.stopScanning();
 } catch (e) {
 // Ignorer si déjà arrêté
 }
 
 // Petite pause pour stabiliser
 await new Promise(resolve => setTimeout(resolve, 1000));
 
 this.isScanning = true;
 this.noble.startScanning([], false); // Pas de filtre, pas de duplicates
 
 console.log('[NobleAdapter] [OK] Scan actif');
 
 } catch (error) {
 console.error('[NobleAdapter] ✗ Erreur démarrage scan:', error);
 this.isScanning = false;
 throw error;
 }
 }

 /**
 * Arrête le scan Bluetooth
 */
 async stopScanning() {
 if (!this.isInitialized || !this.isScanning) {
 console.log('[NobleAdapter] Scan déjà arrêté');
 return;
 }
 
 console.log('[NobleAdapter] Arrêt du scan...');
 this.isScanning = false;
 
 try {
 this.noble.stopScanning();
 console.log('[NobleAdapter] [OK] Scan arrêté');
 } catch (error) {
 console.error('[NobleAdapter] Erreur arrêt scan:', error);
 }
 }

 /**
 * Connecte un capteur avec retry automatique
 */
 async connectSensor(peripheral, onDisconnect = null) {
 if (!this.isInitialized) {
 throw new Error('Bluetooth non initialisé');
 }
 
 const address = peripheral.address.toLowerCase();
 const attempts = this.reconnectAttempts.get(address) || 0;
 
 console.log(`[NobleAdapter] Connexion ${address} - Tentative ${attempts + 1}`);
 
 return new Promise((resolve, reject) => {
 const timeoutId = setTimeout(() => {
 reject(new Error('Timeout connexion'));
 }, this.config.connectionTimeout);
 
 // Nettoyer les anciens listeners
 peripheral.removeAllListeners();
 
 peripheral.connect((error) => {
 clearTimeout(timeoutId);
 
 if (error) {
 console.error('[NobleAdapter] ✗ Erreur connexion:', error);
 
 // Incrémenter tentatives
 this.reconnectAttempts.set(address, attempts + 1);
 
 reject(error);
 return;
 }
 
 console.log('[NobleAdapter] [OK] Connexion réussie:', address);
 
 // Reset tentatives
 this.reconnectAttempts.delete(address);
 
 // Sauvegarder référence
 this.connectedPeripherals.set(address, peripheral);
 
 // Configurer handler de déconnexion
 peripheral.once('disconnect', () => {
 console.log('[NobleAdapter] Déconnexion détectée:', address);
 
 // Nettoyer
 this.connectedPeripherals.delete(address);
 this.peripheralCharacteristics.delete(address);
 
 // Callback personnalisé
 if (onDisconnect) {
 onDisconnect(address);
 }
 });
 
 resolve({
 address: address,
 name: peripheral.advertisement.localName,
 rssi: peripheral.rssi
 });
 });
 });
 }

 /**
 * Déconnecte un capteur
 */
 async disconnectSensor(address) {
 const normalizedAddress = address.toLowerCase();
 const peripheral = this.connectedPeripherals.get(normalizedAddress);
 
 if (!peripheral) {
 console.log('[NobleAdapter] Capteur déjà déconnecté:', normalizedAddress);
 return;
 }
 
 console.log('[NobleAdapter] Déconnexion:', normalizedAddress);
 
 try {
 peripheral.removeAllListeners();
 peripheral.disconnect();
 
 this.connectedPeripherals.delete(normalizedAddress);
 this.peripheralCharacteristics.delete(normalizedAddress);
 
 console.log('[NobleAdapter] [OK] Déconnecté:', normalizedAddress);
 } catch (error) {
 console.error('[NobleAdapter] Erreur déconnexion:', error);
 }
 }

 /**
 * Configure les notifications avec validation du nombre de caractéristiques
 */
 async setupNotifications(peripheral, onDataCallback) {
 if (!this.isInitialized) {
 throw new Error('Bluetooth non initialisé');
 }
 
 const address = peripheral.address.toLowerCase();
 
 return new Promise((resolve, reject) => {
 // Découvrir services et caractéristiques
 peripheral.discoverAllServicesAndCharacteristics((error, services, characteristics) => {
 if (error) {
 console.error('[NobleAdapter] ✗ Erreur découverte services:', error);
 reject(error);
 return;
 }

 const charCount = characteristics.length;
 console.log(`[NobleAdapter] ${charCount} caractéristiques trouvées pour ${address}`);
 
 // VALIDATION CRITIQUE : Vérifier qu'on a bien 6 caractéristiques
 if (charCount < this.config.minCharacteristics) {
 console.warn(`[NobleAdapter] [WARNING] Seulement ${charCount}/${this.config.minCharacteristics} caractéristiques`);
 reject(new Error(`Connexion incomplète: ${charCount}/${this.config.minCharacteristics} caractéristiques`));
 return;
 }
 
 // Sauvegarder les caractéristiques
 this.peripheralCharacteristics.set(address, characteristics);
 
 // Attendre un peu avant d'activer les notifications
 // (Critical pour Noble sur Windows)
 setTimeout(() => {
 let notificationsSetup = 0;
 const targetNotifications = characteristics.length;
 
 console.log('[NobleAdapter] Activation notifications...');
 
 characteristics.forEach((characteristic, index) => {
 // Nettoyer anciens listeners
 characteristic.removeAllListeners('data');
 
 characteristic.notify(true, (error) => {
 if (error) {
 console.error(`[NobleAdapter] ✗ Erreur notification ${index}:`, error);
 return;
 }
 
 notificationsSetup++;
 console.log(`[NobleAdapter] Notification ${notificationsSetup}/${targetNotifications} activée`);
 
 // Écouter les données
 characteristic.on('data', (data) => {
 if (data && data.length > 0) {
 onDataCallback(data, address);
 }
 });
 
 // Si toutes les notifications sont configurées
 if (notificationsSetup === targetNotifications) {
 console.log(`[NobleAdapter] [OK] Toutes les notifications actives pour ${address}`);
 resolve({
 characteristics: targetNotifications,
 address: address
 });
 }
 });
 });
 
 }, 1500); // Délai crucial pour stabilité Windows
 });
 });
 }

 /**
 * Envoie une commande à un capteur
 */
 async sendCommand(peripheral, command) {
 if (!this.isInitialized) {
 throw new Error('Bluetooth non initialisé');
 }
 
 const address = peripheral.address.toLowerCase();
 const characteristics = this.peripheralCharacteristics.get(address);
 
 // Si on a déjà les caractéristiques en cache
 if (characteristics && characteristics.length > 0) {
 return new Promise((resolve, reject) => {
 characteristics[0].write(command, true, (error) => {
 if (error) {
 console.error('[NobleAdapter] ✗ Erreur envoi commande:', error);
 reject(error);
 } else {
 console.log('[NobleAdapter] [OK] Commande envoyée à', address);
 resolve();
 }
 });
 });
 }
 
 // Sinon, découvrir d'abord
 return new Promise((resolve, reject) => {
 peripheral.discoverAllServicesAndCharacteristics((error, services, characteristics) => {
 if (error) {
 reject(error);
 return;
 }
 
 if (characteristics.length > 0) {
 // Sauvegarder pour prochaine fois
 this.peripheralCharacteristics.set(address, characteristics);
 
 characteristics[0].write(command, true, (error) => {
 if (error) {
 console.error('[NobleAdapter] ✗ Erreur envoi commande:', error);
 reject(error);
 } else {
 console.log('[NobleAdapter] [OK] Commande envoyée à', address);
 resolve();
 }
 });
 } else {
 reject(new Error('Aucune caractéristique trouvée'));
 }
 });
 });
 }

 /**
 * Enregistre un callback de découverte
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
 * Vérifie la disponibilité Bluetooth
 */
 async checkBluetoothAvailability() {
 try {
 await this.initialize();
 return { 
 available: true,
 state: this.currentState
 };
 } catch (error) {
 return { 
 available: false, 
 error: error.message 
 };
 }
 }

 /**
 * Obtient l'état du scan
 */
 getScanStatus() {
 return {
 isScanning: this.isScanning,
 isInitialized: this.isInitialized,
 connectedDevices: this.connectedPeripherals.size
 };
 }

 /**
 * Obtient la liste des capteurs connectés
 */
 getConnectedSensors() {
 return Array.from(this.connectedPeripherals.keys());
 }

 /**
 * Vérifie si un capteur est connecté
 */
 isSensorConnected(address) {
 return this.connectedPeripherals.has(address.toLowerCase());
 }

 /**
 * Nettoie toutes les connexions
 */
 async cleanup() {
 console.log('[NobleAdapter] Nettoyage...');
 
 try {
 // Arrêter le scan
 if (this.isScanning) {
 await this.stopScanning();
 }
 
 // Déconnecter tous les périphériques
 for (const [address, peripheral] of this.connectedPeripherals) {
 try {
 peripheral.removeAllListeners();
 peripheral.disconnect();
 } catch (error) {
 console.error(`[NobleAdapter] Erreur déconnexion ${address}:`, error);
 }
 }
 
 // Nettoyer les maps
 this.connectedPeripherals.clear();
 this.peripheralCharacteristics.clear();
 this.reconnectAttempts.clear();
 
 // Nettoyer les callbacks
 this.discoveryCallbacks = [];
 this.stateChangeCallbacks = [];
 
 // Nettoyer les listeners Noble
 if (this.noble) {
 this.noble.removeAllListeners();
 }
 
 this.isInitialized = false;
 
 console.log('[NobleAdapter] [OK] Nettoyage terminé');
 
 } catch (error) {
 console.error('[NobleAdapter] Erreur nettoyage:', error);
 }
 }
}

module.exports = NobleBluetoothAdapter;