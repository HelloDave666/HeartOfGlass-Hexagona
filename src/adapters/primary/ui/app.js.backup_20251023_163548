// src/adapters/primary/ui/app.js
// PHASE 1 : Version simplifiée utilisant NobleBluetoothAdapter

console.log('Heart of Glass - Version avec NobleBluetoothAdapter');

// Import du nouvel adapter - utiliser chemin absolu depuis la racine du projet
const path = require('path');

// Chemin absolu depuis la racine du projet
const projectRoot = process.cwd();
const adapterPath = path.join(projectRoot, 'src', 'adapters', 'secondary', 'sensors', 'bluetooth', 'NobleBluetoothAdapter.js');

console.log('[App] Project root:', projectRoot);
console.log('[App] Adapter path:', adapterPath);

const NobleBluetoothAdapter = require(adapterPath);

// ========================================
// CONFIGURATION
// ========================================
const SENSOR_CONFIG = {
  leftAddress: 'ce:de:c2:f5:17:be',
  rightAddress: 'f0:70:c4:de:d1:22',
  leftColor: 'blue',
  rightColor: 'green'
};

// ========================================
// ÉTAT DE L'APPLICATION
// ========================================
const connectedDevices = new Set();
const sensorsWithData = new Set();
const peripheralRefs = new Map();
const calibrationOffsets = new Map();

let bluetoothAdapter = null;
let scanTimeout = null;

// ========================================
// FONCTIONS UTILITAIRES
// ========================================
function getSensorInfo(address) {
  const addrLower = address.toLowerCase();
  if (addrLower === SENSOR_CONFIG.leftAddress.toLowerCase()) {
    return { position: 'GAUCHE', color: SENSOR_CONFIG.leftColor };
  }
  if (addrLower === SENSOR_CONFIG.rightAddress.toLowerCase()) {
    return { position: 'DROIT', color: SENSOR_CONFIG.rightColor };
  }
  return null;
}

function normalizeAngle(angle) {
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  return angle;
}

// ========================================
// INTERFACE UTILISATEUR
// ========================================
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      document.getElementById(tabId)?.classList.add('active');
    });
  });
}

function setupSensorInterface() {
  const sensorContainer = document.getElementById('sensorContainer');
  if (!sensorContainer) return;

  sensorContainer.innerHTML = `
    <div class="sensor-controls">
      <button id="scanButton" class="scan-button">
        Rechercher les capteurs
      </button>
      <div id="connectionStatus" class="connection-status"></div>
    </div>
    <div id="deviceList" class="device-list"></div>
  `;

  const scanButton = document.getElementById('scanButton');
  scanButton.addEventListener('click', toggleScan);
  
  createDeviceDisplays();
}

function createDeviceDisplays() {
  const deviceList = document.getElementById('deviceList');
  
  ['GAUCHE', 'DROIT'].forEach(position => {
    const color = position === 'GAUCHE' ? SENSOR_CONFIG.leftColor : SENSOR_CONFIG.rightColor;
    
    const element = document.createElement('div');
    element.className = 'device-info';
    element.dataset.position = position;
    element.innerHTML = `
      <div class="status-indicator status-disconnected"></div>
      <div class="info-basic">
        <h3 style="color: ${color}">Capteur ${position}</h3>
        <p class="state">État: déconnecté</p>
        <p class="address">Adresse: --</p>
        <p class="rssi">Signal: --</p>
      </div>
      <div class="info-sensor">
        <h3>Données</h3>
        <p class="roll" style="color: ${color}">Roll (X): --°</p>
        <p class="pitch" style="color: ${color}">Pitch (Y): --°</p>
        <p class="yaw" style="color: ${color}">Yaw (Z): --°</p>
      </div>
    `;
    
    deviceList.appendChild(element);
  });
}

function updateScanButton(text, color, enabled) {
  const button = /** @type {HTMLButtonElement} */ (document.getElementById('scanButton'));
  if (button) {
    button.textContent = text;
    button.style.backgroundColor = color;
    button.disabled = !enabled;
    button.style.cursor = enabled ? 'pointer' : 'not-allowed';
  }
}

function updateStatus(message) {
  const status = document.getElementById('connectionStatus');
  if (status) {
    status.textContent = message;
  }
}

function updateDeviceDisplay(position, info) {
  const display = document.querySelector(`[data-position="${position}"]`);
  if (!display) return;
  
  const indicator = display.querySelector('.status-indicator');
  indicator.className = `status-indicator ${info.connected ? 'status-connected' : 'status-disconnected'}`;
  
  display.querySelector('.state').textContent = `État: ${info.connected ? 'connecté' : 'déconnecté'}`;
  
  if (info.connected) {
    if (info.address) display.querySelector('.address').textContent = `Adresse: ${info.address}`;
    if (info.rssi !== undefined) {
      const signalPercent = Math.max(0, Math.min(100, 100 + info.rssi));
      display.querySelector('.rssi').textContent = `Signal: ${info.rssi}dBm (${signalPercent}%)`;
    }
  } else {
    display.querySelector('.address').textContent = 'Adresse: --';
    display.querySelector('.rssi').textContent = 'Signal: --';
    display.querySelector('.roll').textContent = 'Roll (X): --°';
    display.querySelector('.pitch').textContent = 'Pitch (Y): --°';
    display.querySelector('.yaw').textContent = 'Yaw (Z): --°';
  }
}

function updateAngles(position, angles) {
  const display = document.querySelector(`[data-position="${position}"]`);
  if (!display) return;
  
  display.querySelector('.roll').textContent = `Roll (X): ${angles.x.toFixed(1)}°`;
  display.querySelector('.pitch').textContent = `Pitch (Y): ${angles.y.toFixed(1)}°`;
  display.querySelector('.yaw').textContent = `Yaw (Z): ${angles.z.toFixed(1)}°`;
}

// ========================================
// GESTION BLUETOOTH
// ========================================
async function initializeBluetooth() {
  console.log('[App] Initialisation Bluetooth...');
  
  try {
    bluetoothAdapter = new NobleBluetoothAdapter();
    
    // Vérifier disponibilité
    const availability = await bluetoothAdapter.checkBluetoothAvailability();
    
    if (!availability.available) {
      throw new Error(availability.error || 'Bluetooth non disponible');
    }
    
    console.log('[App] Bluetooth prêt, état:', availability.state);
    
    // Enregistrer les callbacks
    bluetoothAdapter.onDiscover(handleDiscovery);
    bluetoothAdapter.onStateChange(handleStateChange);
    
    return true;
    
  } catch (error) {
    console.error('[App] Erreur initialisation Bluetooth:', error);
    updateStatus(`Erreur Bluetooth: ${error.message}`);
    updateScanButton('Bluetooth indisponible', '#e74c3c', false);
    return false;
  }
}

function handleStateChange(state) {
  console.log('[App] État Bluetooth changé:', state);
  
  if (state === 'poweredOff') {
    updateStatus('Bluetooth désactivé');
    updateScanButton('Bluetooth désactivé', '#e74c3c', false);
  } else if (state === 'poweredOn') {
    updateStatus('Bluetooth activé');
    if (!bluetoothAdapter.getScanStatus().isScanning) {
      updateScanButton('Rechercher les capteurs', '#4CAF50', true);
    }
  }
}

async function handleDiscovery(peripheral) {
  const address = peripheral.address.toLowerCase();
  const sensorInfo = getSensorInfo(address);
  
  if (!sensorInfo) {
    return;
  }
  
  console.log('[App] Découverte:', sensorInfo.position, '-', peripheral.rssi, 'dBm');
  
  if (connectedDevices.has(address)) {
    console.log('[App] Déjà connecté, ignoré');
    return;
  }
  
  if (!bluetoothAdapter.getScanStatus().isScanning) {
    console.log('[App] Scan inactif, ignoré');
    return;
  }
  
  // Tenter la connexion
  await connectSensor(peripheral, sensorInfo);
}

async function connectSensor(peripheral, sensorInfo) {
  const address = peripheral.address.toLowerCase();
  const { position } = sensorInfo;
  
  try {
    console.log(`[App] Connexion ${position}...`);
    
    // Connecter via l'adapter
    const result = await bluetoothAdapter.connectSensor(peripheral, (disconnectedAddress) => {
      handleDisconnection(disconnectedAddress);
    });
    
    console.log('[App] ✓ Connecté:', position);
    
    connectedDevices.add(address);
    peripheralRefs.set(address, peripheral);
    
    updateDeviceDisplay(position, { 
      connected: true, 
      address: result.address,
      rssi: result.rssi 
    });
    
    // Configurer notifications avec validation
    try {
      await bluetoothAdapter.setupNotifications(peripheral, (data, addr) => {
        handleSensorData(data, addr, position, sensorInfo.color);
      });
      
      console.log('[App] ✓ Notifications configurées:', position);
      
    } catch (error) {
      console.error('[App] ✗ Erreur notifications:', error);
      
      // Si moins de 6 caractéristiques, déconnecter et réessayer
      if (error.message.includes('incomplète')) {
        console.log('[App] Reconnexion nécessaire pour', position);
        await bluetoothAdapter.disconnectSensor(address);
        // Le scan continue, il va redécouvrir automatiquement
      }
    }
    
  } catch (error) {
    console.error('[App] ✗ Erreur connexion:', error);
  }
  
  checkIfReady();
}

function handleDisconnection(address) {
  const sensorInfo = getSensorInfo(address);
  if (!sensorInfo) return;
  
  const { position } = sensorInfo;
  
  console.log('[App] Déconnexion:', position);
  
  connectedDevices.delete(address);
  sensorsWithData.delete(address);
  calibrationOffsets.delete(address);
  peripheralRefs.delete(address);
  
  updateDeviceDisplay(position, { connected: false });
  
  // Vérifier l'état global et mettre à jour le bouton
  const leftConnected = connectedDevices.has(SENSOR_CONFIG.leftAddress.toLowerCase());
  const rightConnected = connectedDevices.has(SENSOR_CONFIG.rightAddress.toLowerCase());
  
  // Si tous déconnectés
  if (connectedDevices.size === 0) {
    console.log('[App] Tous capteurs déconnectés');
    
    if (bluetoothAdapter.getScanStatus().isScanning) {
      stopScan();
    } else {
      updateScanButton('Rechercher les capteurs', '#4CAF50', true);
      updateStatus('Capteurs déconnectés - Cliquez pour rechercher');
    }
  }
  // Si un seul déconnecté
  else if (leftConnected || rightConnected) {
    console.log('[App] Un capteur reste connecté');
    
    if (!bluetoothAdapter.getScanStatus().isScanning) {
      updateScanButton('Reconnecter les capteurs', '#f39c12', true);
      updateStatus(`Capteur ${position} déconnecté - Cliquez pour reconnecter`);
    }
  }
}

function handleSensorData(data, address, position, color) {
  if (!data || data.length < 1) return;
  
  // Données d'angle uniquement
  if (data[0] === 0x55 && data[1] === 0x61 && data.length >= 20) {
    
    if (!sensorsWithData.has(address)) {
      console.log('[App] Premières données:', position);
      sensorsWithData.add(address);
      checkIfReady();
    }
    
    const angles = {
      x: ((data[15] << 8 | data[14]) / 32768 * 180),
      y: ((data[17] << 8 | data[16]) / 32768 * 180),
      z: ((data[19] << 8 | data[18]) / 32768 * 180)
    };
    
    if (!calibrationOffsets.has(address)) {
      calibrationOffsets.set(address, { x: angles.x, y: angles.y, z: angles.z });
    }
    
    const offsets = calibrationOffsets.get(address);
    const normalized = {
      x: normalizeAngle(angles.x - offsets.x),
      y: normalizeAngle(angles.y - offsets.y),
      z: normalizeAngle(angles.z - offsets.z)
    };
    
    updateAngles(position, normalized);
  }
}

function checkIfReady() {
  const leftConnected = connectedDevices.has(SENSOR_CONFIG.leftAddress.toLowerCase());
  const rightConnected = connectedDevices.has(SENSOR_CONFIG.rightAddress.toLowerCase());
  const leftHasData = sensorsWithData.has(SENSOR_CONFIG.leftAddress.toLowerCase());
  const rightHasData = sensorsWithData.has(SENSOR_CONFIG.rightAddress.toLowerCase());

  // Les deux capteurs sont connectés ET envoient des données
  if (leftConnected && rightConnected && leftHasData && rightHasData) {
    console.log('[App] ✓ Les deux capteurs fonctionnent');
    
    if (bluetoothAdapter.getScanStatus().isScanning) {
      stopScan();
    }
    
    // DÉSACTIVER le bouton quand les deux fonctionnent
    updateScanButton('✓ Capteurs connectés', '#27ae60', false);
    updateStatus('Deux capteurs connectés et fonctionnels');
  }
  // Au moins un capteur est déconnecté
  else if ((leftConnected && !rightConnected) || (!leftConnected && rightConnected)) {
    console.log('[App] ⚠️ Un capteur manque');
    
    // RÉACTIVER le bouton pour permettre la reconnexion
    if (!bluetoothAdapter.getScanStatus().isScanning) {
      const missingSensor = !leftConnected ? 'GAUCHE' : 'DROIT';
      updateScanButton('Reconnecter les capteurs', '#f39c12', true);
      updateStatus(`Capteur ${missingSensor} déconnecté - Cliquez pour reconnecter`);
    }
  }
  // Aucun capteur connecté
  else if (!leftConnected && !rightConnected) {
    console.log('[App] ⚠️ Aucun capteur connecté');
    
    // RÉACTIVER le bouton
    if (!bluetoothAdapter.getScanStatus().isScanning) {
      updateScanButton('Rechercher les capteurs', '#4CAF50', true);
      updateStatus('Aucun capteur connecté - Cliquez pour rechercher');
    }
  }
}

// ========================================
// CONTRÔLE DU SCAN
// ========================================
async function toggleScan() {
  const status = bluetoothAdapter.getScanStatus();
  
  if (status.isScanning) {
    await stopScan();
  } else {
    await startScan();
  }
}

async function startScan() {
  try {
    console.log('[App] Démarrage scan...');
    
    // Vérifier si les deux capteurs sont déjà connectés avec données
    const leftConnected = connectedDevices.has(SENSOR_CONFIG.leftAddress.toLowerCase());
    const rightConnected = connectedDevices.has(SENSOR_CONFIG.rightAddress.toLowerCase());
    const leftHasData = sensorsWithData.has(SENSOR_CONFIG.leftAddress.toLowerCase());
    const rightHasData = sensorsWithData.has(SENSOR_CONFIG.rightAddress.toLowerCase());
    
    if (leftConnected && rightConnected && leftHasData && rightHasData) {
      console.log('[App] Les deux capteurs sont déjà connectés et fonctionnels');
      updateStatus('Les deux capteurs fonctionnent déjà');
      return;
    }
    
    updateScanButton('Recherche...', '#e74c3c', false);
    updateStatus('Recherche des capteurs...');
    
    await bluetoothAdapter.startScanning();
    
    console.log('[App] ✓ Scan démarré');
    updateStatus('Scan actif - Recherche des capteurs...');
    
    // Timeout de 45 secondes
    scanTimeout = setTimeout(() => {
      const leftNowConnected = connectedDevices.has(SENSOR_CONFIG.leftAddress.toLowerCase());
      const rightNowConnected = connectedDevices.has(SENSOR_CONFIG.rightAddress.toLowerCase());
      
      if (!leftNowConnected || !rightNowConnected) {
        console.log('[App] Timeout scan');
        const missing = [];
        if (!leftNowConnected) missing.push('GAUCHE');
        if (!rightNowConnected) missing.push('DROIT');
        updateStatus(`Timeout - ${missing.join(' et ')} non trouvé(s)`);
        stopScan();
      }
    }, 45000);
    
  } catch (error) {
    console.error('[App] Erreur démarrage scan:', error);
    updateStatus('Erreur de scan');
    updateScanButton('Réessayer', '#e74c3c', true);
  }
}

async function stopScan() {
  try {
    console.log('[App] Arrêt scan...');
    
    if (scanTimeout) {
      clearTimeout(scanTimeout);
      scanTimeout = null;
    }
    
    await bluetoothAdapter.stopScanning();
    
    console.log('[App] ✓ Scan arrêté');
    
    // Attendre stabilisation
    updateScanButton('Stabilisation...', '#95a5a6', false);
    
    setTimeout(() => {
      // Vérifier combien de capteurs sont connectés
      const leftConnected = connectedDevices.has(SENSOR_CONFIG.leftAddress.toLowerCase());
      const rightConnected = connectedDevices.has(SENSOR_CONFIG.rightAddress.toLowerCase());
      const leftHasData = sensorsWithData.has(SENSOR_CONFIG.leftAddress.toLowerCase());
      const rightHasData = sensorsWithData.has(SENSOR_CONFIG.rightAddress.toLowerCase());
      
      // Si les deux fonctionnent, désactiver le bouton
      if (leftConnected && rightConnected && leftHasData && rightHasData) {
        updateScanButton('✓ Capteurs connectés', '#27ae60', false);
        updateStatus('Deux capteurs connectés et fonctionnels');
      }
      // Si un seul connecté, permettre de reconnecter
      else if (leftConnected || rightConnected) {
        const missingSensor = !leftConnected ? 'GAUCHE' : 'DROIT';
        updateScanButton('Reconnecter les capteurs', '#f39c12', true);
        updateStatus(`Capteur ${missingSensor} manquant - Cliquez pour reconnecter`);
      }
      // Si aucun connecté, permettre de rechercher
      else {
        updateScanButton('Rechercher les capteurs', '#4CAF50', true);
        updateStatus('Prêt pour nouveau scan');
      }
    }, 3000);
    
  } catch (error) {
    console.error('[App] Erreur arrêt scan:', error);
  }
}

// ========================================
// INITIALISATION
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] Initialisation application...');
  
  setupTabs();
  setupSensorInterface();
  
  const success = await initializeBluetooth();
  
  if (success) {
    console.log('[App] ✓ Application prête');
    updateStatus('Cliquez sur "Rechercher les capteurs" pour commencer');
  } else {
    console.error('[App] ✗ Initialisation échouée');
  }
});

// ========================================
// NETTOYAGE À LA FERMETURE
// ========================================
if (window.require) {
  const { ipcRenderer } = window.require('electron');
  
  ipcRenderer.on('app-closing', async () => {
    console.log('[App] Fermeture - Nettoyage...');
    
    if (scanTimeout) {
      clearTimeout(scanTimeout);
    }
    
    if (bluetoothAdapter) {
      await bluetoothAdapter.cleanup();
    }
    
    setTimeout(() => {
      ipcRenderer.send('cleanup-complete');
    }, 200);
  });
}