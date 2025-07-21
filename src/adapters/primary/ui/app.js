// src/adapters/primary/ui/app.js

// Import Noble-WinRT pour Windows
const noble = require('noble-winrt');

// Point d'entrée de l'interface utilisateur
console.log('Heart of Glass - UI loaded (noble-winrt with smart reconnection)');

// Variables globales
let connectedDevices = new Map();
let sensorsWithData = new Map();
let isScanning = false;
let calibrationOffsets = new Map();
let connectionMonitor = null;
let isMonitoringActive = false;

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
    isConfigured: true
  });
  
  knownSensors.set(SENSOR_CONFIG.rightAddress.toLowerCase(), {
    address: SENSOR_CONFIG.rightAddress.toLowerCase(),
    position: 'DROIT', 
    color: SENSOR_CONFIG.rightColor,
    name: 'WT901BLE67',
    lastSeen: 0,
    connectionCount: 0,
    isConfigured: true
  });
  
  console.log('[Cache] Capteurs configurés:', Array.from(knownSensors.keys()));
}

function updateSensorCache(peripheral, position) {
  const address = peripheral.address.toLowerCase();
  const now = Date.now();
  
  const sensorInfo = {
    address: address,
    position: position,
    color: position === 'GAUCHE' ? SENSOR_CONFIG.leftColor : SENSOR_CONFIG.rightColor,
    name: peripheral.advertisement.localName || 'WT901BLE67',
    lastSeen: now,
    lastRssi: peripheral.rssi,
    connectionCount: (knownSensors.get(address)?.connectionCount || 0) + 1,
    isConfigured: true
  };
  
  knownSensors.set(address, sensorInfo);
  console.log('[Cache] Capteur mis à jour:', sensorInfo);
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
    
    isScanning = true;
    lastScanTime = Date.now();
    updateScanButton('Recherche en cours...', '#e74c3c', false);
    hideError();
    
    // S'assurer que le scan précédent est arrêté
    try {
      if (noble.state === 'poweredOn') {
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

    // Démarrer le scan Noble-WinRT avec délai pour s'assurer que l'arrêt est effectué
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
            
            // Timeout pour le scan - arrêt automatique après 45 secondes
            setTimeout(() => {
              if (isScanning) {
                const leftConnected = connectedDevices.has(SENSOR_CONFIG.leftAddress.toLowerCase());
                const rightConnected = connectedDevices.has(SENSOR_CONFIG.rightAddress.toLowerCase());
                
                if (!leftConnected || !rightConnected) {
                  console.log('[Bluetooth] Timeout scan - Arrêt après 45 secondes');
                  const missing = !leftConnected && !rightConnected ? 'les deux capteurs' : 
                                 !leftConnected ? 'le capteur GAUCHE' : 'le capteur DROIT';
                  updateConnectionStatus(`Timeout: ${missing} non trouvé(s)`);
                  updateDiscoveryInfo('Scan terminé - Capteurs manquants');
                  stopScan();
                }
              }
            }, 45000);
            
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
    }, 100); // Délai de 100ms pour s'assurer que l'arrêt est effectué
  }

  function stopScan() {
    console.log('[Bluetooth] Arrêt du scan');
    isScanning = false;
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

// Monitoring des connexions
function startConnectionMonitoring() {
  if (connectionMonitor) {
    clearInterval(connectionMonitor);
  }
  
  if (isMonitoringActive) {
    console.log('[Monitor] Monitoring déjà actif, pas de redémarrage');
    return;
  }
  
  console.log('[Monitor] Démarrage du monitoring des connexions');
  isMonitoringActive = true;
  
  connectionMonitor = setInterval(() => {
    const leftConnected = connectedDevices.has(SENSOR_CONFIG.leftAddress.toLowerCase());
    const rightConnected = connectedDevices.has(SENSOR_CONFIG.rightAddress.toLowerCase());
    
    if (!leftConnected && !rightConnected) {
      console.log('[Monitor] Aucun capteur connecté - Déclenchement du reset dans 3 secondes');
      updateConnectionStatus('Capteurs déconnectés - Reset automatique dans 3s...');
      
      // Attendre 3 secondes avant de reset pour éviter les faux positifs
      setTimeout(() => {
        const leftStillDisconnected = !connectedDevices.has(SENSOR_CONFIG.leftAddress.toLowerCase());
        const rightStillDisconnected = !connectedDevices.has(SENSOR_CONFIG.rightAddress.toLowerCase());
        
        if (leftStillDisconnected && rightStillDisconnected && isMonitoringActive) {
          console.log('[Monitor] Confirmé - Tous les capteurs déconnectés, reset automatique');
          resetToSearchMode();
        }
      }, 3000);
      
    } else if (!leftConnected || !rightConnected) {
      const missing = !leftConnected ? 'GAUCHE' : 'DROIT';
      console.log(`[Monitor] Capteur ${missing} déconnecté`);
      updateConnectionStatus(`Capteur ${missing} déconnecté - En attente...`);
    }
  }, 3000); // Vérifier toutes les 3 secondes (moins fréquent)
}

function resetToSearchMode() {
  console.log('[Reset] Retour au mode recherche');
  isScanning = false;
  isMonitoringActive = false;
  
  // Arrêter le monitoring
  if (connectionMonitor) {
    clearInterval(connectionMonitor);
    connectionMonitor = null;
  }
  
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
  
  // Mettre à jour l'affichage des capteurs
  updateSensorDisplay('GAUCHE', { connected: false });
  updateSensorDisplay('DROIT', { connected: false });
  
  console.log('[Reset] Mode recherche restauré, état Noble:', noble.state);
}

// Configuration Noble-WinRT avec filtrage intelligent
function setupNoble() {
  console.log('[Noble] Configuration des gestionnaires noble-winrt avec filtrage');
  
  // Gestionnaire d'état Bluetooth
  noble.on('stateChange', (state) => {
    console.log('[Bluetooth] Changement d\'état Noble-WinRT:', state);
  });

  // Gestionnaire de découverte avec filtrage agressif
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
    
    // FILTRE 3: Éviter les doublons dans un court laps de temps
    const cacheKey = `${address}-${deviceName}`;
    const now = Date.now();
    if (sensorDiscoveryCache.has(cacheKey) && (now - sensorDiscoveryCache.get(cacheKey)) < 2000) {
      return; // Déjà traité récemment
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

  // Connexion au capteur
  console.log('[Bluetooth] Tentative de connexion à:', peripheral.address);
  peripheral.connect((error) => {
    if (error) {
      console.error('[Bluetooth] ❌ Erreur connexion:', error);
      return;
    }

    console.log('[Bluetooth] Connecté à:', peripheral.address);
    connectedDevices.set(address, peripheral);
    
    // Mettre à jour le cache avec les infos de connexion
    updateSensorCache(peripheral, position);

    // Mettre à jour l'affichage
    updateSensorDisplay(position, {
      connected: true,
      address: peripheral.address,
      rssi: peripheral.rssi,
      signalStrength: Math.max(0, Math.min(100, 100 + peripheral.rssi))
    });

    // Découvrir les services
    peripheral.discoverAllServicesAndCharacteristics((error, services, characteristics) => {
      if (error) {
        console.error('[Bluetooth] Erreur découverte services:', error);
        return;
      }

      console.log('[Bluetooth] Services découverts pour:', peripheral.address, '- Caractéristiques:', characteristics.length);

      // Envoyer commande batterie pour le capteur gauche
      if (position === 'GAUCHE' && characteristics.length > 0) {
        const batteryCmd = Buffer.from([0xFF, 0xAA, 0x27, 0x64, 0x00]);
        characteristics[0].write(batteryCmd, true, (error) => {
          if (error) console.error('[Bluetooth] Erreur lecture batterie:', error);
          else console.log('[Bluetooth] Commande batterie envoyée');
        });
      }

      // Activer les notifications
      characteristics.forEach((characteristic, index) => {
        characteristic.notify(true, (error) => {
          if (error) {
            console.error('[Bluetooth] Erreur notification caractéristique', index, ':', error);
            return;
          }

          console.log('[Bluetooth] Notification activée pour caractéristique', index);

          characteristic.on('data', (data) => {
            handleSensorData(data, peripheral.address, position, color);
          });
        });
      });
    });

    // Gérer la déconnexion avec mise à jour du cache
    peripheral.once('disconnect', () => {
      console.log('[Bluetooth] Déconnexion détectée:', peripheral.address, position);
      connectedDevices.delete(address);
      sensorsWithData.delete(address);
      updateSensorDisplay(position, { connected: false });
      
      // Mettre à jour le statut de connexion
      const leftConnected = connectedDevices.has(SENSOR_CONFIG.leftAddress.toLowerCase());
      const rightConnected = connectedDevices.has(SENSOR_CONFIG.rightAddress.toLowerCase());
      
      if (!leftConnected && !rightConnected) {
        console.log('[Bluetooth] Tous les capteurs déconnectés');
        const statusDisplay = document.getElementById('connectionStatus');
        if (statusDisplay) {
          statusDisplay.textContent = 'Tous les capteurs déconnectés';
        }
      }
    });
  });
}

function handleSensorData(data, address, position, color) {
  if (!data || data.length < 1) return;

  // Log des données reçues (première fois seulement)
  if (!sensorsWithData.has(address)) {
    console.log('[Bluetooth] Premières données reçues de:', address, 'longueur:', data.length);
  }

  // Données d'angle
  if (data[0] === 0x55 && data[1] === 0x61 && data.length >= 20) {
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

    // Marquer le capteur comme ayant des données
    if (!sensorsWithData.has(address)) {
      console.log('[Bluetooth] Capteur', position, 'commence à envoyer des données');
      sensorsWithData.set(address, true);
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
    } catch (error) {
      console.error('[Bluetooth] Erreur arrêt scan:', error);
    }
    isScanning = false;
    
    // Démarrer le monitoring seulement s'il n'est pas déjà actif
    if (!isMonitoringActive) {
      startConnectionMonitoring();
    }
  } else {
    // Capteurs partiellement connectés - continuer le scan un peu plus longtemps
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
    } else {
      // Réinitialiser l'affichage quand déconnecté
      display.querySelector('.address').textContent = 'Adresse: --';
      display.querySelector('.rssi').textContent = 'RSSI: --';
      display.querySelector('.signal').textContent = 'Force du signal: --%';
      display.querySelector('.battery').textContent = 'Batterie: --%';
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
  
  console.log('[App] Application prête (noble-winrt with smart reconnection)');
  console.log('[App] Configuration capteurs:', SENSOR_CONFIG);
  console.log('[App] Cache des capteurs:', Array.from(knownSensors.entries()));
});