// src/adapters/primary/ui/services/StateManager.js
// NOTE: Service cross-cutting qui centralise l'état de l'application
// Utilisé par tous les contrôleurs et orchestrateurs
// Alternative possible: Déplacer vers src/shared/state/ dans une future refactorisation

class StateManager {
  constructor() {
    // Bluetooth - Devices
    this.connectedDevices = new Set();
    this.discoveredDevices = new Set();  // NOUVEAU
    this.sensorsWithData = new Set();
    this.peripheralRefs = new Map();
    this.calibrationOffsets = new Map();
    
    // Bluetooth - État
    this.bluetoothAdapter = null;
    this.bluetoothState = 'unknown';  // NOUVEAU: poweredOn, poweredOff, etc.
    this.isScanning = false;  // NOUVEAU
    this.scanTimeout = null;
    
    // Audio - Système
    this.audioSystem = null;
    this.audioState = null;
    this.audioParameters = null;
    
    // Audio - Lecture
    this.timelineUpdateInterval = null;
    this.currentAudioFile = null;
    this.imuToAudioEnabled = false;
    
    // Audio - Enregistrement
    this.audioRecorder = null;
    this.isRecording = false;
    
    // IMU
    this.smoothedPlaybackRate = 1.0;
    this.lastAngles = {
      left: { x: 0, y: 0, z: 0, timestamp: 0 },
      right: { x: 0, y: 0, z: 0, timestamp: 0 }
    };
    
    // UI References
    this.audioUI = {
      fileInput: null,
      fileName: null,
      playPauseButton: null,
      stopButton: null,
      timeline: null,
      timelineSlider: null,
      currentTime: null,
      duration: null,
      volumeSlider: null,
      grainSizeSlider: null,
      grainSizeValue: null,
      overlapSlider: null,
      overlapValue: null,
      windowSelect: null,
      imuToggle: null,
      imuSensitivity: null,
      recordButton: null,
      timelineProgress: null,
      timelineHandle: null,
      positionDisplay: null,
      audioStatus: null,
      speedDisplay: null,
      volumeDisplay: null,
      grainSizeInput: null,
      overlapInput: null
    };
  }

  // ========================================
  // BLUETOOTH - DEVICES
  // ========================================

  getConnectedDevices() {
    return this.connectedDevices;
  }

  getDiscoveredDevices() {
    return this.discoveredDevices;
  }

  getSensorsWithData() {
    return this.sensorsWithData;
  }

  getPeripheralRefs() {
    return this.peripheralRefs;
  }

  getCalibrationOffsets() {
    return this.calibrationOffsets;
  }

  // ========================================
  // BLUETOOTH - ÉTAT
  // ========================================

  getBluetoothAdapter() {
    return this.bluetoothAdapter;
  }

  setBluetoothAdapter(adapter) {
    this.bluetoothAdapter = adapter;
  }

  getBluetoothState() {
    return this.bluetoothState;
  }

  setBluetoothState(state) {
    this.bluetoothState = state;
  }

  getIsScanning() {
    return this.isScanning;
  }

  setIsScanning(scanning) {
    this.isScanning = scanning;
  }

  getScanTimeout() {
    return this.scanTimeout;
  }

  setScanTimeout(timeout) {
    this.scanTimeout = timeout;
  }

  clearScanTimeout() {
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }
  }

  // ========================================
  // AUDIO - SYSTÈME
  // ========================================

  getAudioSystem() {
    return this.audioSystem;
  }

  setAudioSystem(system) {
    this.audioSystem = system;
  }

  getAudioState() {
    return this.audioState;
  }

  setAudioState(state) {
    this.audioState = state;
  }

  getAudioParameters() {
    return this.audioParameters;
  }

  setAudioParameters(params) {
    this.audioParameters = params;
  }

  // ========================================
  // AUDIO - LECTURE
  // ========================================

  getTimelineUpdateInterval() {
    return this.timelineUpdateInterval;
  }

  setTimelineUpdateInterval(interval) {
    this.timelineUpdateInterval = interval;
  }

  clearTimelineUpdateInterval() {
    if (this.timelineUpdateInterval) {
      clearInterval(this.timelineUpdateInterval);
      this.timelineUpdateInterval = null;
    }
  }

  getCurrentAudioFile() {
    return this.currentAudioFile;
  }

  setCurrentAudioFile(file) {
    this.currentAudioFile = file;
  }

  isIMUToAudioEnabled() {
    return this.imuToAudioEnabled;
  }

  setIMUToAudioEnabled(enabled) {
    this.imuToAudioEnabled = enabled;
  }

  // ========================================
  // AUDIO - ENREGISTREMENT
  // ========================================

  getAudioRecorder() {
    return this.audioRecorder;
  }

  setAudioRecorder(recorder) {
    this.audioRecorder = recorder;
  }

  getIsRecording() {
    return this.isRecording;
  }

  setIsRecording(recording) {
    this.isRecording = recording;
  }

  // ========================================
  // IMU
  // ========================================

  getSmoothedPlaybackRate() {
    return this.smoothedPlaybackRate;
  }

  setSmoothedPlaybackRate(rate) {
    this.smoothedPlaybackRate = rate;
  }

  getLastAngles() {
    return this.lastAngles;
  }

  updateLastAngles(side, angles) {
    this.lastAngles[side] = {
      x: angles.x,
      y: angles.y,
      z: angles.z,
      timestamp: Date.now()
    };
  }

  // ========================================
  // UI
  // ========================================

  getAudioUI() {
    return this.audioUI;
  }

  // ========================================
  // RESET
  // ========================================

  reset() {
    // Bluetooth
    this.connectedDevices.clear();
    this.discoveredDevices.clear();
    this.sensorsWithData.clear();
    this.peripheralRefs.clear();
    this.calibrationOffsets.clear();
    this.bluetoothState = 'unknown';
    this.isScanning = false;
    
    this.clearScanTimeout();
    this.clearTimelineUpdateInterval();
    
    this.bluetoothAdapter = null;
    
    // Audio
    this.audioSystem = null;
    this.currentAudioFile = null;
    this.audioRecorder = null;
    this.isRecording = false;
    this.imuToAudioEnabled = false;
    this.smoothedPlaybackRate = 1.0;
    
    // IMU
    this.lastAngles = {
      left: { x: 0, y: 0, z: 0, timestamp: 0 },
      right: { x: 0, y: 0, z: 0, timestamp: 0 }
    };
    
    console.log('[StateManager] Reset complete');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StateManager;
}