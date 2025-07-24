// src/adapters/primary/ui/app.js

// Import Noble-WinRT pour Windows
const noble = require('noble-winrt');

// Point d'entrée de l'interface utilisateur
console.log('Heart of Glass - UI loaded (noble-winrt with robust reconnection)');

// Variables globales
let connectedDevices = new Map();
let sensorsWithData = new Map();
let isScanning = false;
let calibrationOffsets = new Map();
let connectionMonitor = null;
let isMonitoringActive = false;
let reconnectionAttempts = new Map();
let connectionTimeouts = new Map();
let sensorUpdateCounter = new Map();
let scanTimeoutHandle = null;
let autoRetryTimeoutHandle = null;

// Cache des capteurs découverts
let knownSensors = new Map();
let sensorDiscoveryCache = new Map();
let lastScanTime = 0;

// Configuration des capteurs
const SENSOR_CONFIG = {
  leftAddress: 'ce:de:c2:f5:17:be',
  rightAddress: 'f0:70:c4:de:d1:22',
  leftColor: 'blue',
  rightColor: 'green'
};

// Configuration de connexion améliorée
const CONNECTION_CONFIG = {
  scanTimeout: 60000, // 60 secondes
  scanDelay: 500, // 500ms
  monitorInterval: 2000, // 2 secondes
  reconnectDelay: 1000, // Délai avant reconnexion
  maxReconnectAttempts: 5,
  backoffMultiplier: 1.5,
  connectionTimeout: 10000, // Timeout pour une tentative de connexion
  discoveryDebounce: 3000, // Éviter les découvertes en rafale
  autoRetryDisabled: true // DÉSACTIVER le retry automatique après timeout
};

// Fonctions globales pour l'interface
let updateConnectionStatus = (message) => {
  const statusDisplay = document.getElementById('connectionStatus');
  if (statusDisplay) {
    statusDisplay.textContent = message;
    statusDisplay.style.color = '#888';
    statusDisplay.style.fontSize = '0.9rem';
    statusDisplay.style.marginTop = '0.5rem';
  }
};

// Gestion du cache des capteurs
function initSensorCache() {
  console.log('[Cache] Initialisation du cache des capteurs');
  
  // Ajouter nos capteurs configurés au cache
  knownSensors.set(SENSOR_CONFIG.leftAddress.toLowerCase(), {
    address: SENSOR_CONFIG.leftAddress.toLowerCase(),
    position: 'GAUCHE',
    color: SENSOR_CONFIG.leftColor,
    name: 'WT901BLE67',
    lastSeen: 0,
    connectionCount: 0,
    isConfigured: true,
    lastConnectionAttempt: 0,
    connectionHistory: []
  });
  
  knownSensors.set(SENSOR_CONFIG.rightAddress.toLowerCase(), {
    address: SENSOR_CONFIG.rightAddress.toLowerCase(),
    position: 'DROIT', 
    color: SENSOR_CONFIG.rightColor,
    name: 'WT901BLE67',
    lastSeen: 0,
    connectionCount: 0,
    isConfigured: true,
    lastConnectionAttempt: 0,
    connectionHistory: []
  });
  
  console.log('[Cache] Capteurs configurés:', Array.from(knownSensors.keys()));
}

function updateSensorCache(peripheral, position) {
  const address = peripheral.address.toLowerCase();
  const now = Date.now();
  
  const existingInfo = knownSensors.get(address) || {};
  const connectionHistory = existingInfo.connectionHistory || [];
  
  // Ajouter à l'historique de connexion
  connectionHistory.push({
    timestamp: now,
    rssi: peripheral.rssi,
    success: true
  });
  
  // Garder seulement les 10 dernières connexions
  if (connectionHistory.length > 10) {
    connectionHistory.shift();
  }
  
  const sensorInfo = {
    ...existingInfo,
    address: address,
    position: position,
    color: position === 'GAUCHE' ? SENSOR_CONFIG.leftColor : SENSOR_CONFIG.rightColor,
    name: peripheral.advertisement.localName || 'WT901BLE67',
    lastSeen: now,
    lastRssi: peripheral.rssi,
    connectionCount: (existingInfo.connectionCount || 0) + 1,
    isConfigured: true,
    connectionHistory: connectionHistory,
    averageRssi: calculateAverageRssi(connectionHistory)
  };
  
  knownSensors.set(address, sensorInfo);
  console.log('[Cache] Capteur mis à jour:', sensorInfo);
}

function calculateAverageRssi(history) {
  if (!history || history.length === 0) return -100;
  const sum = history.reduce((acc, item) => acc + item.rssi, 0);
  return Math.round(sum / history.length);
}

function isKnownSensor(address) {
  return knownSensors.has(address.toLowerCase());
}

function getExpectedSensors() {
  return Array.from(knownSensors.values()).filter(sensor => sensor.isConfigured);
}

// Configuration des onglets
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  function activateTab(tabId) {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    const selectedTab = document.querySelector(`[data-tab="${tabId}"]`);
    const selectedContent = document.getElementById(tabId);
    
    if (selectedTab && selectedContent) {
      selectedTab.classList.add('active');
      selectedContent.classList.add('active');
    }
  }
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      activateTab(tabId);
    });
  });
  
  // Activer le premier onglet
  activateTab('mainTab');
}

// Interface des capteurs
function setupSensorInterface() {
  const sensorContainer = document.getElementById('sensorContainer');
  if (!sensorContainer) return;

  sensorContainer.innerHTML = `
    <div class="sensor-controls">
      <button id="scanButton" class="scan-button">
        Rechercher les capteurs
      </button>
      <div id="connectionStatus" class="connection-status"></div>
      <div id="scanError" class="error-message" style="display: none;"></div>
      <div id="discoveryInfo" class="discovery-info"></div>
    </div>
    <div id="deviceList" class="device-list"></div>
  `;

  const scanButton = /** @type {HTMLButtonElement} */ (document.getElementById('scanButton'));
  const deviceList = document.getElementById('deviceList');
  const errorDisplay = document.getElementById('scanError');
  const statusDisplay = document.getElementById('connectionStatus');
  const discoveryDisplay = document.getElementById('discoveryInfo');

  // Gestionnaire du bouton de scan
  scanButton.addEventListener('click', () => {
    if (isScanning) {
      stopScan();
    } else {
      startScan();
    }
  });

  function startScan() {
    console.log('[Bluetooth] Démarrage du scan ciblé (noble-winrt)');
    console.log('[Bluetooth] État actuel - isScanning:', isScanning, 'noble.state:', noble.state);
    
    // Annuler tout auto-retry en cours
    if (autoRetryTimeoutHandle) {
      clearTimeout(autoRetryTimeoutHandle);
      autoRetryTimeoutHandle = null;
    }
    
    isScanning = true;
    lastScanTime = Date.now();
    updateScanButton('Recherche en cours...', '#e74c3c', false);
    hideError();
    
    // Réinitialiser les tentatives de reconnexion
    reconnectionAttempts.clear();
    
    // S'assurer que Noble est dans un état stable
    ensureNobleReady(() => {
      // S'assurer que le scan précédent est arrêté
      try {
        if (noble._bindings && noble._bindings._radio) {
          noble.stopScanning();
          console.log('[Bluetooth] Scan précédent arrêté');
        }
      } catch (error) {
        console.log('[Bluetooth] Pas de scan précédent à arrêter');
      }
      
      // Réinitialiser l'affichage
      deviceList.innerHTML = '';
      connectedDevices.clear();
      sensorsWithData.clear();
      calibrationOffsets.clear();
      sensorDiscoveryCache.clear();
      sensorUpdateCounter.clear();
      updateConnectionStatus('Recherche des capteurs configurés...');
      updateDiscoveryInfo('Recherche en cours...');
      
      // Arrêter le monitoring si actif
      if (connectionMonitor) {
        clearInterval(connectionMonitor);
        connectionMonitor = null;
        isMonitoringActive = false;
      }
      
      // Créer les affichages des capteurs
      const leftDisplay = createDeviceDisplay('GAUCHE', SENSOR_CONFIG.leftColor);
      const rightDisplay = createDeviceDisplay('DROIT', SENSOR_CONFIG.rightColor);
      deviceList.appendChild(leftDisplay.element);
      deviceList.appendChild(rightDisplay.element);

      // Démarrer le scan Noble-WinRT avec délai approprié
      setTimeout(() => {
        console.log('[Bluetooth] État Noble-WinRT après délai:', noble.state);
        
        const initNoble = () => {
          if (noble.state === 'poweredOn') {
            console.log('[Bluetooth] Noble-WinRT prêt, démarrage du scan ciblé');
            try {
              noble.startScanning([], false); // Scan tous les devices mais on filtrera
              console.log('[Bluetooth] Scan démarré avec succès (noble-winrt)');
              updateConnectionStatus('Scan actif - Recherche ciblée...');
              updateDiscoveryInfo('Scan des dispositifs Bluetooth...');
              
              // Timeout pour le scan - arrêt automatique après la durée configurée
              if (scanTimeoutHandle) {
                clearTimeout(scanTimeoutHandle);
              }
              
              scanTimeoutHandle = setTimeout(() => {
                if (isScanning) {
                  const leftConnected = connectedDevices.has(SENSOR_CONFIG.leftAddress.toLowerCase());
                  const rightConnected = connectedDevices.has(SENSOR_CONFIG.rightAddress.toLowerCase());
                  
                  if (!leftConnected || !rightConnected) {
                    console.log('[Bluetooth] Timeout scan - Arrêt après', CONNECTION_CONFIG.scanTimeout / 1000, 'secondes');
                    const missing = !leftConnected && !rightConnected ? 'les deux capteurs' : 
                                   !leftConnected ? 'le capteur GAUCHE' : 'le capteur DROIT';
                    updateConnectionStatus(`Timeout: ${missing} non trouvé(s)`);
                    updateDiscoveryInfo('Scan terminé - Capteurs manquants');
                    
                    // PAS de retry automatique - laisser l'utilisateur décider
                    if (!CONNECTION_CONFIG.autoRetryDisabled) {
                      autoRetryTimeoutHandle = setTimeout(() => {
                        if (!isScanning && (!leftConnected || !rightConnected)) {
                          updateConnectionStatus('Nouvelle tentative de scan automatique...');
                          startScan();
                        }
                      }, 5000);
                    }
                    
                    stopScan();
                  }
                }
              }, CONNECTION_CONFIG.scanTimeout);
              
            } catch (error) {
              console.error('[Bluetooth] Erreur au démarrage du scan:', error);
              showError('Erreur de démarrage du scan Bluetooth');
              updateScanButton('Réessayer', '#e74c3c', true);
              isScanning = false;
              updateConnectionStatus('Erreur de scan');
              updateDiscoveryInfo('Erreur de scan');
            }
          } else if (noble.state === 'poweredOff') {
            showError('Bluetooth désactivé. Activez le Bluetooth et réessayez.');
            updateScanButton('Réessayer', '#e74c3c', true);
            isScanning = false;
            updateConnectionStatus('Bluetooth désactivé');
            updateDiscoveryInfo('Bluetooth désactivé');
          } else if (noble.state === 'unsupported') {
            showError('Bluetooth non supporté sur ce système.');
            updateScanButton('Bluetooth non supporté', '#e74c3c', false);
            isScanning = false;
            updateConnectionStatus('Bluetooth non supporté');
            updateDiscoveryInfo('Bluetooth non supporté');
          } else {
            // État unknown/resetting - attendre
            console.log('[Bluetooth] État Noble-WinRT:', noble.state, '- Attente...');
            updateConnectionStatus(`Initialisation Bluetooth (${noble.state})...`);
            updateDiscoveryInfo('Initialisation Bluetooth...');
            setTimeout(initNoble, 1000);
          }
        };

        initNoble();
      }, CONNECTION_CONFIG.scanDelay);
    });
  }

  function ensureNobleReady(callback) {
    if (noble.state === 'poweredOn') {
      callback();
    } else if (noble.state === 'unknown') {
      // Forcer l'initialisation
      noble._bindings.init();
      setTimeout(() => ensureNobleReady(callback), 500);
    } else {
      setTimeout(() => ensureNobleReady(callback), 500);
    }
  }

  function stopScan() {
    console.log('[Bluetooth] Arrêt du scan');
    isScanning = false;
    
    // Annuler les timeouts
    if (scanTimeoutHandle) {
      clearTimeout(scanTimeoutHandle);
      scanTimeoutHandle = null;
    }
    if (autoRetryTimeoutHandle) {
      clearTimeout(autoRetryTimeoutHandle);
      autoRetryTimeoutHandle = null;
    }
    
    try {
      noble.stopScanning();
    } catch (error) {
      console.error('[Bluetooth] Erreur arrêt scan:', error);
    }
    updateScanButton('Rechercher les capteurs', '#4CAF50', true);
    updateConnectionStatus('Scan arrêté');
    updateDiscoveryInfo('Scan arrêté manuellement');
  }

  function updateScanButton(text, color, enabled) {
    const button = /** @type {HTMLButtonElement} */ (scanButton);
    button.textContent = text;
    button.style.backgroundColor = color;
    button.disabled = !enabled;
    button.style.cursor = enabled ? 'pointer' : 'not-allowed';
  }

  function updateDiscoveryInfo(message) {
    if (discoveryDisplay) {
      discoveryDisplay.textContent = message;
      discoveryDisplay.style.color = '#666';
      discoveryDisplay.style.fontSize = '0.8rem';
      discoveryDisplay.style.marginTop = '0.25rem';
    }
  }

  function showError(message) {
    errorDisplay.textContent = `Erreur: ${message}`;
    errorDisplay.style.display = 'block';
  }

  function hideError() {
    errorDisplay.style.display = 'none';
  }

  function createDeviceDisplay(position, color) {
    const element = document.createElement('div');
    element.className = 'device-info';
    element.innerHTML = `
      <div class="status-indicator status-disconnected"></div>
      <div class="info-basic">
        <h3 style="color: ${color}">Capteur ${position}</h3>
        <p class="address" style="color: ${color}">Adresse: --</p>
        <p class="rssi" style="color: ${color}">RSSI: --</p>
        <p class="signal" style="color: ${color}">Force du signal: --%</p>
        <p class="state" style="color: ${color}">État: déconnecté</p>
        <p class="battery" style="color: ${color}">Batterie: --%</p>
        <p class="connection-quality" style="color: ${color}">Qualité: --</p>
      </div>
      <div class="info-sensor">
        <h3>Données capteur</h3>
        <p class="roll" style="color: ${color}">Roll (X): --°</p>
        <p class="pitch" style="color: ${color}">Pitch (Y): --°</p>
        <p class="yaw" style="color: ${color}">Yaw (Z): --°</p>
      </div>
    `;

    return {
      element,
      position,
      color,
      updateStatus: (connected) => {
        const indicator = element.querySelector('.status-indicator');
        indicator.className = `status-indicator ${connected ? 'status-connected' : 'status-disconnected'}`;
        element.querySelector('.state').textContent = `État: ${connected ? 'connecté' : 'déconnecté'}`;
      },
      updateInfo: (info) => {
        if (info.address) element.querySelector('.address').textContent = `Adresse: ${info.address}`;
        if (info.rssi !== undefined) element.querySelector('.rssi').textContent = `RSSI: ${info.rssi}dBm`;
        if (info.signalStrength !== undefined) element.querySelector('.signal').textContent = `Force du signal: ${info.signalStrength}%`;
        if (info.connectionQuality) element.querySelector('.connection-quality').textContent = `Qualité: ${info.connectionQuality}`;
      },
      updateAngles: (angles) => {
        element.querySelector('.roll').textContent = `Roll (X): ${angles.x}°`;
        element.querySelector('.pitch').textContent = `Pitch (Y): ${angles.y}°`;
        element.querySelector('.yaw').textContent = `Yaw (Z): ${angles.z}°`;
      },
      updateBattery: (percentage) => {
        element.querySelector('.battery').textContent = `Batterie: ${percentage}%`;
      }
    };
  }
}

// Monitoring des connexions amélioré
function startConnectionMonitoring() {
  // Toujours nettoyer l'ancien monitoring avant d'en créer un nouveau
  if (connectionMonitor) {
    clearInterval(connectionMonitor);
    connectionMonitor = null;
  }
  
  console.log('[Monitor] Démarrage du monitoring des connexions');
  isMonitoringActive = true;
  
  let noConnectionCounter = 0; // Compteur pour éviter les faux positifs
  
  connectionMonitor = setInterval(() => {
    const leftConnected = connectedDevices.has(SENSOR_CONFIG.leftAddress.toLowerCase());
    const rightConnected = connectedDevices.has(SENSOR_CONFIG.rightAddress.toLowerCase());
    const leftHasData = sensorsWithData.has(SENSOR_CONFIG.leftAddress.toLowerCase());
    const rightHasData = sensorsWithData.has(SENSOR_CONFIG.rightAddress.toLowerCase());
    
    // Log de debug détaillé
    console.log('[Monitor] État détaillé - Gauche connecté:', leftConnected, 'avec données:', leftHasData, 
                '- Droit connecté:', rightConnected, 'avec données:', rightHasData);
    
    // Vérifier la qualité de connexion
    connectedDevices.forEach((peripheral, address) => {
      const sensorInfo = knownSensors.get(address);
      if (sensorInfo) {
        const quality = evaluateConnectionQuality(sensorInfo);
        updateSensorDisplay(sensorInfo.position, {
          connected: true,
          connectionQuality: quality
        });
        
        // Si la qualité est mauvaise, envisager une reconnexion préventive
        if (quality === 'Faible' && !reconnectionAttempts.has(address)) {
          console.log(`[Monitor] Qualité de connexion faible pour ${sensorInfo.position}, surveillance renforcée`);
        }
      }
    });
    
    // Ne déclencher le reset que si vraiment aucun capteur n'est connecté
    if (!leftConnected && !rightConnected && !isScanning) {
      noConnectionCounter++;
      console.log(`[Monitor] Aucun capteur connecté - Compteur: ${noConnectionCounter}`);
      
      if (noConnectionCounter >= 2) { // Attendre 2 cycles pour confirmer
        console.log('[Monitor] Déconnexion confirmée - Déclenchement du reset');
        updateConnectionStatus('Capteurs déconnectés - Reset automatique...');
        
        // Reset immédiat
        resetToSearchMode();
        noConnectionCounter = 0;
      } else {
        updateConnectionStatus('Vérification de la connexion...');
      }
    } else {
      // Réinitialiser le compteur si au moins un capteur est connecté
      if (noConnectionCounter > 0) {
        noConnectionCounter = 0;
      }
      
      if (!leftConnected || !rightConnected) {
        const missing = !leftConnected ? 'GAUCHE' : 'DROIT';
        console.log(`[Monitor] Capteur ${missing} déconnecté`);
        updateConnectionStatus(`Capteur ${missing} déconnecté - En attente...`);
      } else if (leftConnected && rightConnected) {
        updateConnectionStatus('Deux capteurs connectés et fonctionnels');
      }
    }
  }, CONNECTION_CONFIG.monitorInterval);
}

function evaluateConnectionQuality(sensorInfo) {
  if (!sensorInfo.connectionHistory || sensorInfo.connectionHistory.length === 0) {
    return 'Inconnue';
  }
  
  const avgRssi = sensorInfo.averageRssi || -100;
  const recentConnections = sensorInfo.connectionHistory.slice(-5);
  const successRate = recentConnections.filter(c => c.success).length / recentConnections.length;
  
  if (avgRssi > -60 && successRate === 1) return 'Excellente';
  if (avgRssi > -70 && successRate >= 0.8) return 'Bonne';
  if (avgRssi > -80 && successRate >= 0.6) return 'Moyenne';
  return 'Faible';
}

function resetToSearchMode() {
  console.log('[Reset] Retour au mode recherche');
  
  // Arrêter le monitoring AVANT de modifier les états
  if (connectionMonitor) {
    clearInterval(connectionMonitor);
    connectionMonitor = null;
  }
  
  // Réinitialiser les états
  isScanning = false;
  isMonitoringActive = false;
  
  // Nettoyer les timeouts
  if (scanTimeoutHandle) {
    clearTimeout(scanTimeoutHandle);
    scanTimeoutHandle = null;
  }
  if (autoRetryTimeoutHandle) {
    clearTimeout(autoRetryTimeoutHandle);
    autoRetryTimeoutHandle = null;
  }
  connectionTimeouts.forEach(timeout => clearTimeout(timeout));
  connectionTimeouts.clear();
  
  // S'assurer que le scan est arrêté
  try {
    if (noble.state === 'poweredOn') {
      noble.stopScanning();
      console.log('[Reset] Scan arrêté');
    }
  } catch (error) {
    console.log('[Reset] Erreur arrêt scan (normal):', error.message);
  }
  
  // Réinitialiser l'interface
  const scanButton = /** @type {HTMLButtonElement} */ (document.getElementById('scanButton'));
  if (scanButton) {
    scanButton.textContent = 'Rechercher les capteurs';
    scanButton.style.backgroundColor = '#4CAF50';
    scanButton.disabled = false;
    scanButton.style.cursor = 'pointer';
  }
  
  const statusDisplay = document.getElementById('connectionStatus');
  if (statusDisplay) {
    statusDisplay.textContent = 'Capteurs déconnectés - Prêt pour nouvelle recherche';
  }
  
  const discoveryDisplay = document.getElementById('discoveryInfo');
  if (discoveryDisplay) {
    discoveryDisplay.textContent = 'Prêt pour nouvelle recherche';
  }
  
  // Nettoyer les données
  connectedDevices.clear();
  sensorsWithData.clear();
  calibrationOffsets.clear();
  reconnectionAttempts.clear(); // Important: réinitialiser les tentatives
  sensorUpdateCounter.clear(); // Réinitialiser les compteurs
  
  // Mettre à jour l'affichage des capteurs
  updateSensorDisplay('GAUCHE', { connected: false });
  updateSensorDisplay('DROIT', { connected: false });
  
  console.log('[Reset] Mode recherche restauré - Monitoring:', isMonitoringActive, 'Noble:', noble.state);
}

// Configuration Noble-WinRT avec filtrage intelligent et gestion robuste
function setupNoble() {
  console.log('[Noble] Configuration des gestionnaires noble-winrt avec filtrage robuste');
  
  // Gestionnaire d'état Bluetooth
  noble.on('stateChange', (state) => {
    console.log('[Bluetooth] Changement d\'état Noble-WinRT:', state);
    
    // Si le Bluetooth est désactivé pendant le fonctionnement
    if (state === 'poweredOff' && (isScanning || connectedDevices.size > 0)) {
      console.log('[Bluetooth] Bluetooth désactivé - arrêt des opérations');
      resetToSearchMode();
      updateConnectionStatus('Bluetooth désactivé - Activez le Bluetooth');
    }
  });

  // Gestionnaire de découverte avec filtrage agressif et debouncing
  noble.on('discover', (peripheral) => {
    const deviceName = peripheral.advertisement.localName || '';
    const address = peripheral.address.toLowerCase();
    
    // FILTRE 1: Ignorer tous les devices qui ne sont pas des capteurs IMU
    if (!deviceName.includes('WT901BLE67') && !deviceName.includes('WT901BLE')) {
      return; // Ignorer silencieusement tous les autres dispositifs
    }
    
    // FILTRE 2: Ne traiter que nos capteurs configurés
    if (!isKnownSensor(address)) {
      console.log('[Bluetooth] Capteur IMU trouvé mais non configuré:', address, deviceName);
      return;
    }
    
    // FILTRE 3: Debouncing - éviter les découvertes en rafale
    const cacheKey = `${address}-${deviceName}`;
    const now = Date.now();
    if (sensorDiscoveryCache.has(cacheKey)) {
      const lastDiscovery = sensorDiscoveryCache.get(cacheKey);
      if ((now - lastDiscovery) < CONNECTION_CONFIG.discoveryDebounce) {
        return; // Déjà traité récemment
      }
    }
    sensorDiscoveryCache.set(cacheKey, now);
    
    console.log('[Bluetooth] Capteur IMU configuré trouvé:', {
      address: address,
      name: deviceName,
      rssi: peripheral.rssi
    });
    
    // Mettre à jour les infos de découverte
    const discoveryDisplay = document.getElementById('discoveryInfo');
    if (discoveryDisplay) {
      const sensorInfo = knownSensors.get(address);
      const position = sensorInfo ? sensorInfo.position : 'INCONNU';
      discoveryDisplay.textContent = `Capteur ${position} trouvé (${peripheral.rssi}dBm)`;
    }
    
    handleDiscovery(peripheral);
  });

  // Log de l'état initial
  console.log('[Noble] État initial noble-winrt:', noble.state);
}

function handleDiscovery(peripheral) {
  const address = peripheral.address.toLowerCase();
  const sensorInfo = knownSensors.get(address);
  
  if (!sensorInfo) {
    console.log('[Bluetooth] Capteur non configuré dans le cache, ignoré');
    return;
  }
  
  const position = sensorInfo.position;
  const color = sensorInfo.color;

  console.log('[Bluetooth] Capteur reconnu depuis le cache:', position, color);

  // Si déjà connecté, ne pas reconnecter
  if (connectedDevices.has(address)) {
    console.log('[Bluetooth] Capteur déjà connecté');
    return;
  }

  // Vérifier les tentatives de reconnexion
  const attempts = reconnectionAttempts.get(address) || 0;
  if (attempts >= CONNECTION_CONFIG.maxReconnectAttempts) {
    console.log(`[Bluetooth] Maximum de tentatives atteint pour ${position}`);
    updateConnectionStatus(`Impossible de connecter le capteur ${position}`);
    return;
  }

  // Calculer le délai de backoff
  const backoffDelay = CONNECTION_CONFIG.reconnectDelay * Math.pow(CONNECTION_CONFIG.backoffMultiplier, attempts);
  
  // Nettoyer toute référence précédente du périphérique
  if (peripheral._events) {
    peripheral.removeAllListeners();
  }
  
  // Connexion au capteur avec timeout
  console.log(`[Bluetooth] Tentative de connexion à ${peripheral.address} (tentative ${attempts + 1})`);
  reconnectionAttempts.set(address, attempts + 1);
  
  // Créer un timeout pour cette tentative de connexion
  const connectionTimeout = setTimeout(() => {
    console.log(`[Bluetooth] Timeout de connexion pour ${position}`);
    handleConnectionError(null, peripheral, position, color);
  }, CONNECTION_CONFIG.connectionTimeout);
  
  connectionTimeouts.set(address, connectionTimeout);
  
  peripheral.connect((error) => {
    // Annuler le timeout si la connexion aboutit ou échoue
    clearTimeout(connectionTimeout);
    connectionTimeouts.delete(address);
    
    if (error) {
      handleConnectionError(error, peripheral, position, color);
      return;
    }

    console.log('[Bluetooth] Connecté à:', peripheral.address);
    connectedDevices.set(address, peripheral);
    reconnectionAttempts.delete(address); // Reset les tentatives en cas de succès
    
    // Mettre à jour le cache avec les infos de connexion
    updateSensorCache(peripheral, position);

    // Mettre à jour l'affichage
    updateSensorDisplay(position, {
      connected: true,
      address: peripheral.address,
      rssi: peripheral.rssi,
      signalStrength: Math.max(0, Math.min(100, 100 + peripheral.rssi))
    });

    // Découvrir les services avec gestion d'erreur
    peripheral.discoverAllServicesAndCharacteristics((error, services, characteristics) => {
      if (error) {
        console.error('[Bluetooth] Erreur découverte services:', error);
        // Tenter une reconnexion
        peripheral.disconnect();
        return;
      }

      console.log('[Bluetooth] Services découverts pour:', peripheral.address, '- Caractéristiques:', characteristics.length);
      
      // Nettoyer tous les listeners précédents sur les caractéristiques
      characteristics.forEach(char => {
        if (char._events) {
          char.removeAllListeners('data');
        }
      });

      // Envoyer commande batterie pour le capteur gauche
      if (position === 'GAUCHE' && characteristics.length > 0) {
        const batteryCmd = Buffer.from([0xFF, 0xAA, 0x27, 0x64, 0x00]);
        characteristics[0].write(batteryCmd, true, (error) => {
          if (error) console.error('[Bluetooth] Erreur lecture batterie:', error);
          else console.log('[Bluetooth] Commande batterie envoyée');
        });
      }

      // Activer les notifications avec gestion d'erreur
      let successfulNotifications = 0;
      let notificationPromises = [];
      
      characteristics.forEach((characteristic, index) => {
        // S'assurer qu'on n'a pas déjà des listeners actifs
        characteristic.removeAllListeners('data');
        
        const promise = new Promise((resolve) => {
          characteristic.notify(true, (error) => {
            if (error) {
              console.error('[Bluetooth] Erreur notification caractéristique', index, ':', error);
              resolve(false);
              return;
            }

            successfulNotifications++;
            console.log('[Bluetooth] Notification activée pour caractéristique', index);

            // Ajouter UN SEUL listener pour les données
            characteristic.on('data', (data) => {
              handleSensorData(data, peripheral.address, position, color);
            });
            
            resolve(true);
          });
        });
        
        notificationPromises.push(promise);
      });
      
      // Attendre que toutes les notifications soient configurées
      Promise.all(notificationPromises).then((results) => {
        console.log(`[Bluetooth] ${successfulNotifications} notifications actives pour ${position}`);
        
        if (successfulNotifications === 0) {
          console.error('[Bluetooth] Aucune notification active, déconnexion');
          peripheral.disconnect();
        }
      });
    });

    // Gérer la déconnexion avec mise à jour du cache et reconnexion automatique
    peripheral.removeAllListeners('disconnect'); // Nettoyer d'abord
    peripheral.once('disconnect', () => {
      console.log('[Bluetooth] Déconnexion détectée:', peripheral.address, position);
      
      // Nettoyer les références du périphérique
      connectedDevices.delete(address);
      sensorsWithData.delete(address);
      calibrationOffsets.delete(address); // Important: réinitialiser la calibration
      sensorUpdateCounter.delete(address);
      
      // Mettre à jour l'affichage
      updateSensorDisplay(position, { connected: false });
      
      // Enregistrer la déconnexion dans l'historique
      const sensorInfo = knownSensors.get(address);
      if (sensorInfo) {
        sensorInfo.connectionHistory.push({
          timestamp: Date.now(),
          rssi: peripheral.rssi || -100,
          success: false
        });
      }
      
      // Mettre à jour le statut de connexion
      const leftConnected = connectedDevices.has(SENSOR_CONFIG.leftAddress.toLowerCase());
      const rightConnected = connectedDevices.has(SENSOR_CONFIG.rightAddress.toLowerCase());
      
      if (!leftConnected && !rightConnected) {
        console.log('[Bluetooth] Tous les capteurs déconnectés');
        const statusDisplay = document.getElementById('connectionStatus');
        if (statusDisplay) {
          statusDisplay.textContent = 'Tous les capteurs déconnectés';
        }
        
        // Forcer la vérification du monitoring si tous déconnectés
        if (isMonitoringActive && !isScanning) {
          console.log('[Bluetooth] Forcer vérification monitoring après déconnexion totale');
          // Le monitoring devrait détecter et faire le reset
        }
      }
      
      // Tentative de reconnexion automatique si on est en mode scan
      if (isScanning && reconnectionAttempts.get(address) < CONNECTION_CONFIG.maxReconnectAttempts) {
        console.log(`[Bluetooth] Tentative de reconnexion automatique pour ${position}`);
        setTimeout(() => {
          if (isScanning && !connectedDevices.has(address)) {
            // Forcer une nouvelle découverte
            noble.startScanning([], false);
          }
        }, backoffDelay);
      }
    });
  });
}

function handleConnectionError(error, peripheral, position, color) {
  console.error('[Bluetooth] Erreur connexion:', error || 'Timeout');
  
  const address = peripheral.address.toLowerCase();
  const attempts = reconnectionAttempts.get(address) || 0;
  
  // Enregistrer l'échec dans l'historique
  const sensorInfo = knownSensors.get(address);
  if (sensorInfo) {
    sensorInfo.connectionHistory.push({
      timestamp: Date.now(),
      rssi: peripheral.rssi || -100,
      success: false
    });
  }
  
  if (attempts < CONNECTION_CONFIG.maxReconnectAttempts) {
    const backoffDelay = CONNECTION_CONFIG.reconnectDelay * Math.pow(CONNECTION_CONFIG.backoffMultiplier, attempts);
    console.log(`[Bluetooth] Nouvelle tentative dans ${backoffDelay}ms`);
    updateConnectionStatus(`Connexion échouée ${position} - Nouvelle tentative...`);
    
    setTimeout(() => {
      if (isScanning && !connectedDevices.has(address)) {
        // Relancer le scan pour redécouvrir le périphérique
        noble.startScanning([], false);
      }
    }, backoffDelay);
  } else {
    updateConnectionStatus(`Impossible de connecter ${position} après ${attempts} tentatives`);
  }
}

function handleSensorData(data, address, position, color) {
  if (!data || data.length < 1) return;

  // Données d'angle
  if (data[0] === 0x55 && data[1] === 0x61 && data.length >= 20) {
    // Log des données reçues (première fois seulement)
    if (!sensorsWithData.has(address)) {
      console.log('[Bluetooth] Premières données d\'angle reçues de:', address);
      sensorsWithData.set(address, true);
    }
    
    const angles = {
      x: ((data[15] << 8 | data[14]) / 32768 * 180),
      y: ((data[17] << 8 | data[16]) / 32768 * 180),
      z: ((data[19] << 8 | data[18]) / 32768 * 180)
    };

    // Calibration automatique
    if (!calibrationOffsets.has(address)) {
      console.log('[Bluetooth] Calibration pour:', address, angles);
      calibrationOffsets.set(address, {
        x: angles.x,
        y: angles.y,
        z: angles.z
      });
    }

    const offsets = calibrationOffsets.get(address);
    const normalizedAngles = {
      x: normalizeAngle(angles.x - offsets.x, true),
      y: normalizeAngle(angles.y - offsets.y, true),
      z: normalizeAngle(angles.z - offsets.z, true)
    };

    // Log périodique pour debug (toutes les 50 updates)
    const updateCount = (sensorUpdateCounter.get(address) || 0) + 1;
    sensorUpdateCounter.set(address, updateCount);
    if (updateCount % 50 === 0) {
      console.log(`[Data] ${position} - Angles: X:${normalizedAngles.x.toFixed(1)}° Y:${normalizedAngles.y.toFixed(1)}° Z:${normalizedAngles.z.toFixed(1)}°`);
    }

    // Mettre à jour l'affichage
    updateSensorAngles(position, {
      x: normalizedAngles.x.toFixed(1),
      y: normalizedAngles.y.toFixed(1),
      z: normalizedAngles.z.toFixed(1)
    });

    // Vérifier si les deux capteurs sont actifs
    checkBothSensorsReady();
  }
  // Données de batterie
  else if (data[0] === 0x55 && data[1] === 0x71 && data.length >= 6) {
    const batteryValue = (data[5] << 8) | data[4];
    let percentage = 0;
    
    if (batteryValue > 830) percentage = 100;
    else if (batteryValue > 393) percentage = 90;
    else if (batteryValue > 387) percentage = 75;
    else if (batteryValue > 382) percentage = 60;
    else if (batteryValue > 379) percentage = 50;
    else if (batteryValue > 377) percentage = 40;
    else if (batteryValue > 373) percentage = 30;
    else if (batteryValue > 370) percentage = 20;
    else if (batteryValue > 368) percentage = 15;
    else if (batteryValue > 350) percentage = 10;
    else if (batteryValue > 340) percentage = 5;

    console.log('[Bluetooth] Batterie', position, ':', percentage, '%');
    updateSensorBattery(position, percentage);
  } else {
    // Log des données non reconnues pour debug
    const updateCount = sensorUpdateCounter.get(address) || 0;
    sensorUpdateCounter.set(address, updateCount + 1);
    if (updateCount % 100 === 0) {
      console.log('[Data] Données non reconnues:', 'Header:', data[0], data[1], 'Longueur:', data.length);
    }
  }
}

function normalizeAngle(angle, preserveFullRange = false) {
  if (preserveFullRange) {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  }
  
  angle = angle % 360;
  if (angle < 0) angle += 360;
  return angle;
}

function checkBothSensorsReady() {
  const leftConnected = connectedDevices.has(SENSOR_CONFIG.leftAddress.toLowerCase());
  const rightConnected = connectedDevices.has(SENSOR_CONFIG.rightAddress.toLowerCase());
  const leftHasData = sensorsWithData.has(SENSOR_CONFIG.leftAddress.toLowerCase());
  const rightHasData = sensorsWithData.has(SENSOR_CONFIG.rightAddress.toLowerCase());

  if (leftConnected && rightConnected && leftHasData && rightHasData) {
    console.log('[Bluetooth] Les deux capteurs sont prêts et envoient des données');
    const scanButton = /** @type {HTMLButtonElement} */ (document.getElementById('scanButton'));
    const statusDisplay = document.getElementById('connectionStatus');
    const discoveryDisplay = document.getElementById('discoveryInfo');
    
    if (scanButton) {
      scanButton.textContent = 'Capteurs connectés';
      scanButton.style.backgroundColor = '#3498db';
    }
    
    if (statusDisplay) {
      statusDisplay.textContent = 'Deux capteurs connectés et fonctionnels';
    }
    
    if (discoveryDisplay) {
      discoveryDisplay.textContent = 'Connexion complète - Monitoring actif';
    }
    
    // Arrêter le scan automatiquement
    try {
      noble.stopScanning();
      isScanning = false;
    } catch (error) {
      console.error('[Bluetooth] Erreur arrêt scan:', error);
    }
    
    // Toujours redémarrer le monitoring après une connexion complète
    console.log('[Bluetooth] Redémarrage du monitoring après connexion complète');
    startConnectionMonitoring();
  } else {
    // Capteurs partiellement connectés - continuer le scan
    if (leftConnected || rightConnected) {
      const missing = !leftConnected ? 'GAUCHE' : 'DROIT';
      console.log(`[Bluetooth] Capteur ${missing} manquant, scan continue...`);
      updateConnectionStatus(`Capteur ${missing} manquant - Recherche en cours...`);
      
      const discoveryDisplay = document.getElementById('discoveryInfo');
      if (discoveryDisplay) {
        discoveryDisplay.textContent = `Recherche du capteur ${missing}...`;
      }
    }
  }
}

// Fonctions utilitaires pour mettre à jour l'affichage
function updateSensorDisplay(position, info) {
  const displays = document.querySelectorAll('.device-info');
  const display = Array.from(displays).find(d => 
    d.querySelector('h3').textContent.includes(position)
  );
  
  if (display) {
    const indicator = display.querySelector('.status-indicator');
    indicator.className = `status-indicator ${info.connected ? 'status-connected' : 'status-disconnected'}`;
    display.querySelector('.state').textContent = `État: ${info.connected ? 'connecté' : 'déconnecté'}`;
    
    if (info.connected) {
      if (info.address) display.querySelector('.address').textContent = `Adresse: ${info.address}`;
      if (info.rssi !== undefined) display.querySelector('.rssi').textContent = `RSSI: ${info.rssi}dBm`;
      if (info.signalStrength !== undefined) display.querySelector('.signal').textContent = `Force du signal: ${info.signalStrength}%`;
      if (info.connectionQuality) display.querySelector('.connection-quality').textContent = `Qualité: ${info.connectionQuality}`;
    } else {
      // Réinitialiser l'affichage quand déconnecté
      display.querySelector('.address').textContent = 'Adresse: --';
      display.querySelector('.rssi').textContent = 'RSSI: --';
      display.querySelector('.signal').textContent = 'Force du signal: --%';
      display.querySelector('.battery').textContent = 'Batterie: --%';
      display.querySelector('.connection-quality').textContent = 'Qualité: --';
      display.querySelector('.roll').textContent = 'Roll (X): --°';
      display.querySelector('.pitch').textContent = 'Pitch (Y): --°';
      display.querySelector('.yaw').textContent = 'Yaw (Z): --°';
    }
  }
}

function updateSensorAngles(position, angles) {
  const displays = document.querySelectorAll('.device-info');
  const display = Array.from(displays).find(d => 
    d.querySelector('h3').textContent.includes(position)
  );
  
  if (display) {
    display.querySelector('.roll').textContent = `Roll (X): ${angles.x}°`;
    display.querySelector('.pitch').textContent = `Pitch (Y): ${angles.y}°`;
    display.querySelector('.yaw').textContent = `Yaw (Z): ${angles.z}°`;
  }
}

function updateSensorBattery(position, percentage) {
  const displays = document.querySelectorAll('.device-info');
  const display = Array.from(displays).find(d => 
    d.querySelector('h3').textContent.includes(position)
  );
  
  if (display) {
    display.querySelector('.battery').textContent = `Batterie: ${percentage}%`;
  }
}

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', () => {
  console.log('[App] DOM chargé, initialisation...');
  
  // Initialiser le cache des capteurs
  initSensorCache();
  
  setupTabs();
  setupSensorInterface();
  setupNoble();
  
  console.log('[App] Application prête (noble-winrt with robust reconnection)');
  console.log('[App] Configuration capteurs:', SENSOR_CONFIG);
  console.log('[App] Configuration connexion:', CONNECTION_CONFIG);
  console.log('[App] Cache des capteurs:', Array.from(knownSensors.entries()));
});

// Gestion de la fermeture propre de l'application
if (window.require) {
  const { ipcRenderer } = window.require('electron');
  
  // Écouter le signal de fermeture
  ipcRenderer.on('app-closing', () => {
    console.log('[App] Signal de fermeture reçu, nettoyage en cours...');
    
    // Arrêter le monitoring
    if (connectionMonitor) {
      clearInterval(connectionMonitor);
      connectionMonitor = null;
    }
    
    // Arrêter les timeouts
    if (scanTimeoutHandle) {
      clearTimeout(scanTimeoutHandle);
    }
    if (autoRetryTimeoutHandle) {
      clearTimeout(autoRetryTimeoutHandle);
    }
    connectionTimeouts.forEach(timeout => clearTimeout(timeout));
    
    // Déconnecter tous les capteurs
    connectedDevices.forEach((peripheral, address) => {
      try {
        console.log('[App] Déconnexion du capteur:', address);
        peripheral.disconnect();
      } catch (error) {
        console.error('[App] Erreur déconnexion:', error);
      }
    });
    
    // Arrêter Noble
    try {
      if (noble.state === 'poweredOn') {
        noble.stopScanning();
      }
    } catch (error) {
      console.error('[App] Erreur arrêt Noble:', error);
    }
    
    // Signaler que le nettoyage est terminé
    setTimeout(() => {
      ipcRenderer.send('cleanup-complete');
    }, 200);
  });
}