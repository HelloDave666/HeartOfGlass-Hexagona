﻿// src/adapters/primary/ui/app.js
// INTÉGRATION : NobleBluetoothAdapter + Système Audio Granulaire + Enregistrement MP3

console.log('Heart of Glass - Version avec NobleBluetoothAdapter + Audio Granulaire + MP3 Recording');

// ========================================
// MODE HYBRIDE : Basculement IPC / Direct
// ========================================
const USE_IPC_MODE = true; // false = mode direct (actuel), true = mode IPC (nouveau)
console.log(`[App] Mode: ${USE_IPC_MODE ? 'IPC (Architecture Hexagonale)' : 'DIRECT (Legacy)'}`)

const path = require('path');

const projectRoot = process.cwd();

// Import conditionnel selon le mode
let bluetoothAdapterClass;

if (USE_IPC_MODE) {
  // Mode IPC : Utiliser le client IPC
  const SensorIPCClient = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'services', 'SensorIPCClient.js'));
  bluetoothAdapterClass = SensorIPCClient;
  console.log('[App] Mode IPC : SensorIPCClient chargé');
} else {
  // Mode Direct : Utiliser NobleBluetoothAdapter
  const adapterPath = path.join(projectRoot, 'src', 'adapters', 'secondary', 'sensors', 'bluetooth', 'NobleBluetoothAdapter.js');
  bluetoothAdapterClass = require(adapterPath);
  console.log('[App] Mode DIRECT : NobleBluetoothAdapter chargé');
  console.log('[App] Project root:', projectRoot);
  console.log('[App] Adapter path:', adapterPath);
}

const audioAdapterPath = path.join(projectRoot, 'src', 'adapters', 'secondary', 'audio', 'granular', 'GranularSynthesisAdapter.js');
const AudioParameters = require(path.join(projectRoot, 'src', 'core', 'domain', 'valueObjects', 'AudioParameters.js'));
const AudioState = require(path.join(projectRoot, 'src', 'core', 'domain', 'valueObjects', 'AudioState.js'));
const GranularSynthesisAdapter = require(audioAdapterPath);

const AudioRecorder = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'services', 'AudioRecorder.js'));
const TabController = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'controllers', 'TabController.js'));
const StateManager = require(path.join(projectRoot, 'src', 'adapters', 'primary', 'ui', 'services', 'StateManager.js'));

const SENSOR_CONFIG = {
  leftAddress: 'ce:de:c2:f5:17:be',
  rightAddress: 'f0:70:c4:de:d1:22',
  leftColor: 'blue',
  rightColor: 'green'
};

const AUDIO_CONFIG = {
  defaultGrainSize: 60,
  defaultOverlap: 60,
  defaultWindow: 'hann',
  defaultVolume: 0.8,
  minGrainSize: 10,
  maxGrainSize: 500,
  minOverlap: 0,
  maxOverlap: 95
};

const state = new StateManager();
state.setAudioState(AudioState.createInitial());
state.setAudioParameters(new AudioParameters(
  AUDIO_CONFIG.defaultGrainSize,
  AUDIO_CONFIG.defaultOverlap,
  AUDIO_CONFIG.defaultWindow
));

const SMOOTHING_FACTOR = 0.3;

const IMU_MAPPING = {
  velocitySensitivity: 2.0,
  volumeSensitivity: 1.0,
  minPlaybackRate: 0.1,
  maxPlaybackRate: 3.0,
  volumeAngleRange: 45,
  deadZone: 2.0
};

let tabController = null;

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

function setupTabs() {
  tabController = new TabController();
  const initialized = tabController.initialize();
  
  if (!initialized) {
    console.error('[App] Echec initialisation TabController');
  }
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
  const button = document.getElementById('scanButton');
  if (button) {
    button.textContent = text;
    button.style.backgroundColor = color;

    if (button instanceof HTMLButtonElement) {
      button.disabled = !enabled;
    } else {
      if (enabled) {
        button.removeAttribute('aria-disabled');
      } else {
        button.setAttribute('aria-disabled', 'true');
      }
    }

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
  
  if (position === 'DROIT') {
    console.log(`[IMU] DROIT - Y: ${angles.y.toFixed(1)}° | IMU enabled: ${state.isIMUToAudioEnabled()} | Playing: ${state.getAudioState().isPlaying}`);
  }
  
  if (state.isIMUToAudioEnabled() && state.getAudioSystem() && state.getAudioState().isPlaying) {
    const now = Date.now();
    const side = position === 'GAUCHE' ? 'left' : 'right';
    
    const lastAngle = state.getLastAngles()[side];
    const deltaTime = (now - lastAngle.timestamp) / 1000;
    
    if (deltaTime > 0) {
      const angularVelocity = (angles.y - lastAngle.y) / deltaTime;
      
      if (position === 'DROIT' && Math.abs(angularVelocity) > 1) {
        console.log(`[IMU→Audio] Vitesse angulaire: ${angularVelocity.toFixed(1)}°/s`);
      }
      
      applyIMUToAudio(position, angles, angularVelocity);
    }
    
    state.updateLastAngles(side, angles);
  }
}

function setupAudioInterface() {
  console.log('[Audio] Configuration interface audio...');
  
  const audioUI = state.getAudioUI();
  
  audioUI.fileInput = document.getElementById('audioFile');
  audioUI.fileName = null;
  audioUI.playPauseButton = document.getElementById('playPauseButton');
  audioUI.stopButton = null;
  
  audioUI.timeline = document.getElementById('timelineContainer');
  audioUI.timelineProgress = document.getElementById('timelineProgress');
  audioUI.timelineHandle = document.getElementById('timelineHandle');
  audioUI.positionDisplay = document.getElementById('positionDisplay');
  
  audioUI.audioStatus = document.getElementById('audioStatus');
  audioUI.speedDisplay = document.getElementById('speedDisplay');
  audioUI.volumeDisplay = document.getElementById('volumeDisplay');
  
  audioUI.grainSizeInput = document.getElementById('grainSizeInput');
  audioUI.overlapInput = document.getElementById('overlapInput');
  audioUI.windowSelect = document.getElementById('windowTypeSelect');
  
  audioUI.imuToggle = document.getElementById('imuControl');
  audioUI.imuSensitivity = document.getElementById('sensitivitySlider');
  
  audioUI.recordButton = document.getElementById('recordButton');
  
  if (!audioUI.fileInput || !audioUI.playPauseButton) {
    console.error('[Audio] Éléments UI audio manquants');
    return;
  }
  
  audioUI.fileInput.addEventListener('change', handleFileSelect);
  audioUI.playPauseButton.addEventListener('click', togglePlayPause);
  
  if (audioUI.timeline) {
    audioUI.timeline.addEventListener('click', handleTimelineClick);
  }
  
  if (audioUI.grainSizeInput) {
    audioUI.grainSizeInput.addEventListener('input', handleGrainSizeChange);
  }
  if (audioUI.overlapInput) {
    audioUI.overlapInput.addEventListener('input', handleOverlapChange);
  }
  if (audioUI.windowSelect) {
    audioUI.windowSelect.addEventListener('change', handleWindowChange);
  }
  
  if (audioUI.imuToggle) {
    audioUI.imuToggle.addEventListener('change', handleIMUToggle);
  }
  
  if (audioUI.recordButton) {
    audioUI.recordButton.addEventListener('click', toggleRecording);
  }
  
  updateAudioUI();
  
  console.log('[Audio] Interface audio configurée');
}

function updateAudioUI() {
  const audioUI = state.getAudioUI();
  const audioState = state.getAudioState();
  const currentAudioFile = state.getCurrentAudioFile();
  const isRecording = state.getIsRecording();
  
  if (audioUI.playPauseButton) {
    const playIcon = audioUI.playPauseButton.querySelector('.play-icon');
    const pauseIcon = audioUI.playPauseButton.querySelector('.pause-icon');
    
    if (!currentAudioFile) {
      audioUI.playPauseButton.disabled = true;
      if (playIcon) playIcon.style.display = 'inline';
      if (pauseIcon) pauseIcon.style.display = 'none';
    } else {
      audioUI.playPauseButton.disabled = false;
      if (audioState.isPlaying) {
        if (playIcon) playIcon.style.display = 'none';
        if (pauseIcon) pauseIcon.style.display = 'inline';
      } else {
        if (playIcon) playIcon.style.display = 'inline';
        if (pauseIcon) pauseIcon.style.display = 'none';
      }
    }
  }
  
  if (audioUI.recordButton) {
    if (currentAudioFile && audioState.isPlaying) {
      audioUI.recordButton.disabled = false;
      audioUI.recordButton.style.backgroundColor = isRecording ? '#e74c3c' : '#f39c12';
      audioUI.recordButton.title = isRecording ? 'Arrêter l\'enregistrement' : 'Démarrer l\'enregistrement';
    } else {
      audioUI.recordButton.disabled = true;
      audioUI.recordButton.style.backgroundColor = '#95a5a6';
      audioUI.recordButton.title = 'Démarrez la lecture pour enregistrer';
    }
  }
  
  if (audioUI.timelineProgress && audioState.duration > 0) {
    const percent = (audioState.currentPosition / audioState.duration) * 100;
    audioUI.timelineProgress.style.width = `${percent}%`;
    
    if (audioUI.timelineHandle) {
      audioUI.timelineHandle.style.left = `${percent}%`;
    }
  }
  
  if (audioUI.positionDisplay) {
    const current = formatTime(audioState.currentPosition);
    const total = formatTime(audioState.duration);
    audioUI.positionDisplay.textContent = `${current} / ${total}`;
  }
  
  if (audioUI.audioStatus) {
    audioUI.audioStatus.textContent = `État: ${audioState.isPlaying ? 'Lecture' : 'Arrêté'}`;
  }
  
  if (audioUI.volumeDisplay) {
    audioUI.volumeDisplay.textContent = `Volume: ${Math.round(audioState.volume * 100)}%`;
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function initializeBluetooth() {
  const modeText = USE_IPC_MODE ? 'IPC' : 'DIRECT';
  console.log('[App] Initialisation Bluetooth (mode ' + modeText + ')...');
  
  try {
    const adapter = new bluetoothAdapterClass();
    state.setBluetoothAdapter(adapter);
    
    const availability = await state.getBluetoothAdapter().checkBluetoothAvailability();
    
    if (!availability.available) {
      throw new Error(availability.error || 'Bluetooth non disponible');
    }
    
    console.log('[App] Bluetooth prêt, état:', availability.state);
    
    state.getBluetoothAdapter().onDiscover(handleDiscovery);
    state.getBluetoothAdapter().onStateChange(handleStateChange);
    
    return true;
    
  } catch (error) {
    console.error('[App] Erreur initialisation Bluetooth:', error);
    updateStatus(`Erreur Bluetooth: ${error.message}`);
    updateScanButton('Bluetooth indisponible', '#e74c3c', false);
    return false;
  }
}

function setupIPCListeners() {
  if (!USE_IPC_MODE || !window.require) {
    return;
  }
  
  const { ipcRenderer } = window.require('electron');
  
  console.log('[App] Configuration des listeners IPC...');
  
  ipcRenderer.on('sensor:connected', (event, data) => {
    console.log('[App] IPC - Capteur connecté:', data);
    
    const address = data.address.toLowerCase();
    state.getConnectedDevices().add(address);
    
    const sensorInfo = getSensorInfo(address);
    if (sensorInfo) {
      updateDeviceDisplay(sensorInfo.position, {
        connected: true,
        address: address
      });
      
      checkIfReady();
    }
  });
  
  ipcRenderer.on('sensor:disconnected', (event, data) => {
    console.log('[App] IPC - Capteur déconnecté:', data);
    
    const address = data.address.toLowerCase();
    state.getConnectedDevices().delete(address);
    state.getSensorsWithData().delete(address);
    state.getCalibrationOffsets().delete(address);
    
    const sensorInfo = getSensorInfo(address);
    if (sensorInfo) {
      updateDeviceDisplay(sensorInfo.position, {
        connected: false
      });
      
      checkIfReady();
    }
  });
  
  ipcRenderer.on('sensor:data', (event, data) => {
    const address = data.address.toLowerCase();
    const sensorInfo = getSensorInfo(address);
    
    if (!sensorInfo) return;
    
    if (!state.getSensorsWithData().has(address)) {
      console.log('[App] IPC - Premières données:', sensorInfo.position);
      state.getSensorsWithData().add(address);
      checkIfReady();
    }
    
    if (!state.getCalibrationOffsets().has(address)) {
      state.getCalibrationOffsets().set(address, { 
        x: data.angles.x, 
        y: data.angles.y, 
        z: data.angles.z 
      });
    }
    
    const offsets = state.getCalibrationOffsets().get(address);
    const normalized = {
      x: normalizeAngle(data.angles.x - offsets.x),
      y: normalizeAngle(data.angles.y - offsets.y),
      z: normalizeAngle(data.angles.z - offsets.z)
    };
    
    updateAngles(sensorInfo.position, normalized);
  });
  
  ipcRenderer.on('sensors:ready', () => {
    console.log('[App] IPC - Les deux capteurs sont prêts');
    updateScanButton('Capteurs connectés', '#27ae60', false);
    updateStatus('Deux capteurs connectés et fonctionnels');
  });
  
  console.log('[App] ✓ Listeners IPC configurés');
}

function handleStateChange(stateValue) {
  console.log('[App] État Bluetooth changé:', stateValue);
  
  if (stateValue === 'poweredOff') {
    updateStatus('Bluetooth désactivé');
    updateScanButton('Bluetooth désactivé', '#e74c3c', false);
  } else if (stateValue === 'poweredOn') {
    updateStatus('Bluetooth activé');
    if (!state.getBluetoothAdapter().getScanStatus().isScanning) {
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
  
  console.log(`[App] Capteur ${sensorInfo.position} trouvé`);
  console.log(`[App] Adresse: ${address}`);
  console.log(`[App] Signal: ${peripheral.rssi}dBm`);
  
  updateDeviceDisplay(sensorInfo.position, {
    connected: false,
    address: address,
    rssi: peripheral.rssi
  });
  
  try {
    console.log(`[App] Connexion à ${sensorInfo.position}...`);
    updateStatus(`Connexion au capteur ${sensorInfo.position}...`);
    
    await state.getBluetoothAdapter().connectSensor(peripheral, () => {
      handleDisconnection(address, sensorInfo.position);
    });
    
    state.getPeripheralRefs().set(address, peripheral);
    await handleConnection(address, sensorInfo.position, sensorInfo.color, peripheral);
    
  } catch (error) {
    console.error(`[App] Erreur connexion ${sensorInfo.position}:`, error);
    updateStatus(`Erreur: ${error.message}`);
  }
}

async function handleConnection(address, position, color, peripheral) {
  console.log(`[App] ${position} connecté`);
  
  state.getConnectedDevices().add(address);
  
  updateDeviceDisplay(position, {
    connected: true,
    address: address
  });
  
  await state.getBluetoothAdapter().setupNotifications(peripheral, (data, deviceAddress) => {
    if (deviceAddress === address) {
      handleSensorData(data, address, position, color);
    }
  });
  
  checkIfReady();
}

function handleDisconnection(address, position) {
  console.log(`[App] Déconnexion ${position}`);
  
  state.getConnectedDevices().delete(address);
  state.getSensorsWithData().delete(address);
  state.getCalibrationOffsets().delete(address);
  state.getPeripheralRefs().delete(address);
  
  updateDeviceDisplay(position, {
    connected: false
  });
  
  if (state.getConnectedDevices().size === 0) {
    console.log('[App] Aucun capteur connecté');
    
    if (!state.getBluetoothAdapter().getScanStatus().isScanning) {
      updateScanButton('Rechercher les capteurs', '#4CAF50', true);
      updateStatus('Aucun capteur connecté');
    }
  }
  else {
    console.log('[App] Un capteur reste connecté');
    
    if (!state.getBluetoothAdapter().getScanStatus().isScanning) {
      updateScanButton('Reconnecter les capteurs', '#f39c12', true);
      updateStatus(`Capteur ${position} déconnecté - Cliquez pour reconnecter`);
    }
  }
}

function handleSensorData(data, address, position, color) {
  if (!data || data.length < 1) return;
  
  if (data[0] === 0x55 && data[1] === 0x61 && data.length >= 20) {
    
    if (!state.getSensorsWithData().has(address)) {
      console.log('[App] Premières données:', position);
      state.getSensorsWithData().add(address);
      checkIfReady();
    }
    
    const angles = {
      x: ((data[15] << 8 | data[14]) / 32768 * 180),
      y: ((data[17] << 8 | data[16]) / 32768 * 180),
      z: ((data[19] << 8 | data[18]) / 32768 * 180)
    };
    
    if (!state.getCalibrationOffsets().has(address)) {
      state.getCalibrationOffsets().set(address, { x: angles.x, y: angles.y, z: angles.z });
    }
    
    const offsets = state.getCalibrationOffsets().get(address);
    const normalized = {
      x: normalizeAngle(angles.x - offsets.x),
      y: normalizeAngle(angles.y - offsets.y),
      z: normalizeAngle(angles.z - offsets.z)
    };
    
    updateAngles(position, normalized);
  }
}

function checkIfReady() {
  const leftConnected = state.getConnectedDevices().has(SENSOR_CONFIG.leftAddress.toLowerCase());
  const rightConnected = state.getConnectedDevices().has(SENSOR_CONFIG.rightAddress.toLowerCase());
  const leftHasData = state.getSensorsWithData().has(SENSOR_CONFIG.leftAddress.toLowerCase());
  const rightHasData = state.getSensorsWithData().has(SENSOR_CONFIG.rightAddress.toLowerCase());

  if (leftConnected && rightConnected && leftHasData && rightHasData) {
    console.log('[App] Les deux capteurs fonctionnent');
    
    if (state.getBluetoothAdapter().getScanStatus().isScanning) {
      stopScan();
    }
    
    updateScanButton('Capteurs connectés', '#27ae60', false);
    updateStatus('Deux capteurs connectés et fonctionnels');
  }
  else if ((leftConnected && !rightConnected) || (!leftConnected && rightConnected)) {
    console.log('[App] Un capteur manque');
    
    if (!state.getBluetoothAdapter().getScanStatus().isScanning) {
      const missingSensor = !leftConnected ? 'GAUCHE' : 'DROIT';
      updateScanButton('Reconnecter les capteurs', '#f39c12', true);
      updateStatus(`Capteur ${missingSensor} déconnecté - Cliquez pour reconnecter`);
    }
  }
  else if (!leftConnected && !rightConnected) {
    console.log('[App] Aucun capteur connecté');
    
    if (!state.getBluetoothAdapter().getScanStatus().isScanning) {
      updateScanButton('Rechercher les capteurs', '#4CAF50', true);
      updateStatus('Aucun capteur connecté - Cliquez pour rechercher');
    }
  }
}

async function toggleScan() {
  const status = state.getBluetoothAdapter().getScanStatus();
  
  if (status.isScanning) {
    await stopScan();
  } else {
    await startScan();
  }
}

async function startScan() {
  try {
    console.log('[App] Démarrage scan...');
    
    const leftConnected = state.getConnectedDevices().has(SENSOR_CONFIG.leftAddress.toLowerCase());
    const rightConnected = state.getConnectedDevices().has(SENSOR_CONFIG.rightAddress.toLowerCase());
    const leftHasData = state.getSensorsWithData().has(SENSOR_CONFIG.leftAddress.toLowerCase());
    const rightHasData = state.getSensorsWithData().has(SENSOR_CONFIG.rightAddress.toLowerCase());
    
    if (leftConnected && rightConnected && leftHasData && rightHasData) {
      console.log('[App] Les deux capteurs sont déjà connectés et fonctionnels');
      updateStatus('Les deux capteurs fonctionnent déjà');
      return;
    }
    
    updateScanButton('Recherche...', '#e74c3c', false);
    updateStatus('Recherche des capteurs...');
    
    await state.getBluetoothAdapter().startScanning();
    
    console.log('[App] Scan démarré');
    updateStatus('Scan actif - Recherche des capteurs...');
    
    const timeout = setTimeout(() => {
      const leftNowConnected = state.getConnectedDevices().has(SENSOR_CONFIG.leftAddress.toLowerCase());
      const rightNowConnected = state.getConnectedDevices().has(SENSOR_CONFIG.rightAddress.toLowerCase());
      
      if (!leftNowConnected || !rightNowConnected) {
        console.log('[App] Timeout scan');
        const missing = [];
        if (!leftNowConnected) missing.push('GAUCHE');
        if (!rightNowConnected) missing.push('DROIT');
        updateStatus(`Timeout - ${missing.join(' et ')} non trouvé(s)`);
        stopScan();
      }
    }, 45000);
    
    state.setScanTimeout(timeout);
    
  } catch (error) {
    console.error('[App] Erreur démarrage scan:', error);
    updateStatus('Erreur de scan');
    updateScanButton('Réessayer', '#e74c3c', true);
  }
}

async function stopScan() {
  try {
    console.log('[App] Arrêt scan...');
    
    state.clearScanTimeout();
    
    await state.getBluetoothAdapter().stopScanning();
    
    console.log('[App] Scan arrêté');
    
    updateScanButton('Stabilisation...', '#95a5a6', false);
    
    setTimeout(() => {
      const leftConnected = state.getConnectedDevices().has(SENSOR_CONFIG.leftAddress.toLowerCase());
      const rightConnected = state.getConnectedDevices().has(SENSOR_CONFIG.rightAddress.toLowerCase());
      const leftHasData = state.getSensorsWithData().has(SENSOR_CONFIG.leftAddress.toLowerCase());
      const rightHasData = state.getSensorsWithData().has(SENSOR_CONFIG.rightAddress.toLowerCase());
      
      if (leftConnected && rightConnected && leftHasData && rightHasData) {
        updateScanButton('Capteurs connectés', '#27ae60', false);
        updateStatus('Deux capteurs connectés et fonctionnels');
      }
      else if (leftConnected || rightConnected) {
        const missingSensor = !leftConnected ? 'GAUCHE' : 'DROIT';
        updateScanButton('Reconnecter les capteurs', '#f39c12', true);
        updateStatus(`Capteur ${missingSensor} manquant - Cliquez pour reconnecter`);
      }
      else {
        updateScanButton('Rechercher les capteurs', '#4CAF50', true);
        updateStatus('Prêt pour nouveau scan');
      }
    }, 3000);
    
  } catch (error) {
    console.error('[App] Errêt arrêt scan:', error);
  }
}

async function initializeAudioSystem() {
  console.log('[Audio] Initialisation système audio...');
  
  try {
    const audioSystem = new GranularSynthesisAdapter();
    state.setAudioSystem(audioSystem);
    
    await state.getAudioSystem().initialize();
    
    state.getAudioSystem().setGranularParams({
      grainSize: state.getAudioParameters().grainSize,
      overlap: state.getAudioParameters().overlap,
      windowType: state.getAudioParameters().windowType
    });
    
    state.getAudioSystem().setVolume(state.getAudioState().volume);
    
    console.log('[Audio] Système audio initialisé');
    return true;
    
  } catch (error) {
    console.error('[Audio] Erreur initialisation:', error);
    return false;
  }
}

async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  console.log('[Audio] Fichier sélectionné:', file.name);
  
  try {
    if (state.getAudioState().isPlaying) {
      await stopAudio();
    }
    
    const fileBuffer = await file.arrayBuffer();
    const audioContext = state.getAudioSystem().audioContext;
    const audioBuffer = await audioContext.decodeAudioData(fileBuffer);
    
    state.getAudioSystem().audioBuffer = audioBuffer;
    state.getAudioSystem().currentPosition = 0;
    
    state.setCurrentAudioFile(file);
    state.setAudioState(state.getAudioState().with({
      duration: audioBuffer.duration,
      currentPosition: 0
    }));
    
    console.log('[Audio] Fichier chargé:', audioBuffer.duration.toFixed(2), 'secondes');
    
    updateAudioUI();
    
  } catch (error) {
    console.error('[Audio] Erreur chargement fichier:', error);
    alert('Erreur lors du chargement du fichier audio');
  }
}

async function togglePlayPause() {
  if (!state.getCurrentAudioFile() || !state.getAudioSystem()) return;
  
  try {
    if (state.getAudioState().isPlaying) {
      state.getAudioSystem().stopPlayback();
      state.setAudioState(state.getAudioState().with({ isPlaying: false }));
      stopTimelineUpdates();
      console.log('[Audio] Arrêt');
    } else {
      state.getAudioSystem().startPlayback();
      state.setAudioState(state.getAudioState().with({ isPlaying: true }));
      startTimelineUpdates();
      console.log('[Audio] Lecture - État: ', state.getAudioState().isPlaying);
    }
    
    updateAudioUI();
    
  } catch (error) {
    console.error('[Audio] Erreur play/pause:', error);
  }
}

async function stopAudio() {
  if (!state.getAudioSystem()) return;
  
  try {
    state.getAudioSystem().stopPlayback();
    state.setAudioState(state.getAudioState().with({
      isPlaying: false,
      currentPosition: 0
    }));
    
    stopTimelineUpdates();
    updateAudioUI();
    
    console.log('[Audio] Stop');
    
  } catch (error) {
    console.error('[Audio] Erreur stop:', error);
  }
}

function handleTimelineClick(event) {
  if (!state.getCurrentAudioFile() || !state.getAudioSystem()) return;
  
  const rect = state.getAudioUI().timeline.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const percent = (clickX / rect.width) * 100;
  const newPosition = (percent / 100) * state.getAudioState().duration;
  
  state.getAudioSystem().setPlaybackPosition(newPosition);
  state.setAudioState(state.getAudioState().with({ currentPosition: newPosition }));
  
  updateAudioUI();
  console.log(`[Audio] Seek to ${newPosition.toFixed(2)}s (${percent.toFixed(1)}%)`);
}

function handleGrainSizeChange(event) {
  let grainSize = parseInt(event.target.value);
  
  if (grainSize < 10) grainSize = 10;
  if (grainSize > 500) grainSize = 500;
  
  const grainSizeValueDisplay = document.getElementById('grainSizeValue');
  if (grainSizeValueDisplay) {
    grainSizeValueDisplay.textContent = `${grainSize} ms`;
  }
  
  try {
    state.setAudioParameters(state.getAudioParameters().with({ grainSize }));
    
    if (state.getAudioSystem()) {
      state.getAudioSystem().setGranularParams({ grainSize });
    }
    
    console.log('[Audio] Grain size:', grainSize, 'ms');
    
  } catch (error) {
    console.error('[Audio] Erreur grain size:', error);
  }
}

function handleOverlapChange(event) {
  let overlap = parseInt(event.target.value);
  
  if (isNaN(overlap)) {
    console.warn('[Audio] Valeur overlap invalide:', event.target.value);
    overlap = AUDIO_CONFIG.defaultOverlap;
  }
  
  if (overlap < 0) overlap = 0;
  if (overlap > 95) overlap = 95;
  
  const overlapValueDisplay = document.getElementById('overlapValue');
  if (overlapValueDisplay) {
    overlapValueDisplay.textContent = `${overlap}%`;
  }
  
  try {
    state.setAudioParameters(state.getAudioParameters().with({ overlap }));
    
    if (state.getAudioSystem()) {
      state.getAudioSystem().setGranularParams({ overlap });
    }
    
    console.log('[Audio] Overlap:', overlap, '%');
    
  } catch (error) {
    console.error('[Audio] Erreur overlap:', error);
  }
}

function handleWindowChange(event) {
  const windowType = event.target.value;
  
  try {
    state.setAudioParameters(state.getAudioParameters().with({ windowType }));
    
    if (state.getAudioSystem()) {
      state.getAudioSystem().setGranularParams({ windowType });
    }
    
    console.log('[Audio] Window type:', windowType);
    
  } catch (error) {
    console.error('[Audio] Erreur window type:', error);
  }
}

function handleIMUToggle(event) {
  state.setIMUToAudioEnabled(event.target.checked);
  
  if (state.isIMUToAudioEnabled()) {
    const now = Date.now();
    state.getLastAngles().left.timestamp = now;
    state.getLastAngles().right.timestamp = now;
    console.log('[Audio] Contrôle IMU vinyle ACTIVÉ');
    console.log('[Audio] Main DROITE = Vitesse (rotation Pitch Y)');
    console.log('[Audio] Main GAUCHE = Volume (angle Pitch Y)');
  } else {
    if (state.getAudioSystem()) {
      state.getAudioSystem().setPlaybackRate(1.0, 1);
    }
    console.log('[Audio] Contrôle IMU désactivé');
  }
}

async function toggleRecording() {
  if (!state.getAudioSystem() || !state.getCurrentAudioFile()) {
    console.warn('[Recorder] Aucun fichier audio chargé');
    return;
  }

  if (!state.getAudioState().isPlaying) {
    console.warn('[Recorder] La lecture doit être active pour enregistrer');
    return;
  }

  try {
    if (!state.getIsRecording()) {
      console.log('[Recorder] Démarrage enregistrement...');
      
      if (!state.getAudioRecorder()) {
        const recorder = new AudioRecorder();
        state.setAudioRecorder(recorder);
        const sourceNode = state.getAudioSystem().createOutputNode();
        await state.getAudioRecorder().initialize(state.getAudioSystem().audioContext, sourceNode);
      }
      
      state.getAudioRecorder().startRecording();
      state.setIsRecording(true);
      
      updateAudioUI();
      console.log('[Recorder] Enregistrement en cours');
      
    } else {
      console.log('[Recorder] Arrêt enregistrement...');
      
      const blob = state.getAudioRecorder().stopRecording();
      state.setIsRecording(false);
      
      if (blob) {
        state.getAudioRecorder().downloadRecording(blob);
        console.log('[Recorder] Enregistrement sauvegardé');
      }
      
      updateAudioUI();
    }
    
  } catch (error) {
    console.error('[Recorder] Erreur:', error);
    state.setIsRecording(false);
    updateAudioUI();
    alert('Erreur lors de l\'enregistrement: ' + error.message);
  }
}

function startTimelineUpdates() {
  stopTimelineUpdates();
  
  const interval = setInterval(() => {
    if (state.getAudioSystem() && state.getAudioState().isPlaying) {
      const currentPos = state.getAudioSystem().getPlaybackPosition();
      state.setAudioState(state.getAudioState().with({ currentPosition: currentPos }));
      updateAudioUI();
      
      if (currentPos >= state.getAudioState().duration) {
        stopAudio();
      }
    }
  }, 100);
  
  state.setTimelineUpdateInterval(interval);
}

function stopTimelineUpdates() {
  state.clearTimelineUpdateInterval();
}

function applyIMUToAudio(position, angles, angularVelocity) {
  const audioUI = state.getAudioUI();
  if (!audioUI.imuSensitivity || !state.getAudioSystem()) return;
  
  const sensitivity = parseFloat(audioUI.imuSensitivity.value);
  
  if (position === 'DROIT') {
    const angle = angles.y;
    
    let playbackRate;
    let direction;
    
    if (Math.abs(angle) <= IMU_MAPPING.deadZone) {
      playbackRate = 1.0;
      direction = 1;
      
      state.setSmoothedPlaybackRate(1.0);
      
      state.getAudioSystem().setPlaybackRate(1.0, 1);
      
      if (audioUI.speedDisplay) {
        audioUI.speedDisplay.textContent = 'Vitesse: 1.0x →';
        audioUI.speedDisplay.style.color = '#2ecc71';
      }
      
    } else if (angle > IMU_MAPPING.deadZone) {
      const normalizedAngle = Math.min(angle - IMU_MAPPING.deadZone, 90) / 90;
      playbackRate = 1.0 + (normalizedAngle * sensitivity);
      direction = 1;
      
      playbackRate = Math.max(0.5, Math.min(3.0, playbackRate));
      
      const newRate = state.getSmoothedPlaybackRate() + (playbackRate - state.getSmoothedPlaybackRate()) * SMOOTHING_FACTOR;
      state.setSmoothedPlaybackRate(newRate);
      
      state.getAudioSystem().setPlaybackRate(state.getSmoothedPlaybackRate(), direction);
      
      if (audioUI.speedDisplay) {
        audioUI.speedDisplay.textContent = `Vitesse: ${state.getSmoothedPlaybackRate().toFixed(2)}x →`;
        audioUI.speedDisplay.style.color = '#3498db';
      }
      
    } else {
      const normalizedAngle = Math.min(Math.abs(angle) - IMU_MAPPING.deadZone, 90) / 90;
      playbackRate = 1.0 + (normalizedAngle * sensitivity);
      direction = -1;
      
      playbackRate = Math.max(0.5, Math.min(3.0, playbackRate));
      
      const newRate = state.getSmoothedPlaybackRate() + (playbackRate - state.getSmoothedPlaybackRate()) * SMOOTHING_FACTOR;
      state.setSmoothedPlaybackRate(newRate);
      
      state.getAudioSystem().setPlaybackRate(state.getSmoothedPlaybackRate(), direction);
      
      if (audioUI.speedDisplay) {
        audioUI.speedDisplay.textContent = `Vitesse: ${state.getSmoothedPlaybackRate().toFixed(2)}x ←`;
        audioUI.speedDisplay.style.color = '#e74c3c';
      }
    }
  }
  
  else if (position === 'GAUCHE') {
    const normalizedAngle = Math.max(-45, Math.min(45, angles.y));
    const volumeRatio = (normalizedAngle + 45) / 90;
    const volume = volumeRatio * IMU_MAPPING.volumeSensitivity;
    
    state.getAudioSystem().setVolume(volume);
    state.setAudioState(state.getAudioState().with({ volume }));
    
    if (audioUI.volumeDisplay) {
      audioUI.volumeDisplay.textContent = `Volume: ${Math.round(volume * 100)}%`;
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] Initialisation application...');
  
  setupTabs();
  setupSensorInterface();
  setupAudioInterface();
  setupIPCListeners();
  
  const bluetoothOk = await initializeBluetooth();
  const audioOk = await initializeAudioSystem();
  
  if (bluetoothOk) {
    console.log('[App] Bluetooth prêt');
    updateStatus('Cliquez sur "Rechercher les capteurs" pour commencer');
  } else {
    console.error('[App] Bluetooth échoué');
  }
  
  if (audioOk) {
    console.log('[Audio] Audio prêt');
  } else {
    console.error('[Audio] Audio échoué');
  }
  
  console.log('[App] Application prête');
});

if (window.require) {
  const { ipcRenderer } = window.require('electron');
  
  ipcRenderer.on('app-closing', async () => {
    console.log('[App] Fermeture - Nettoyage...');
    
    state.clearScanTimeout();
    
    if (state.getBluetoothAdapter()) {
      await state.getBluetoothAdapter().cleanup();
    }
    
    stopTimelineUpdates();
    
    if (state.getAudioRecorder()) {
      state.getAudioRecorder().dispose();
      state.setAudioRecorder(null);
    }
    
    if (state.getAudioSystem()) {
      state.getAudioSystem().dispose();
    }
    
    if (tabController) {
      tabController.dispose();
      tabController = null;
    }
    
    setTimeout(() => {
      ipcRenderer.send('cleanup-complete');
    }, 200);
  });
}