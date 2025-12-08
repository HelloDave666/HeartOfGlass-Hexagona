// src/adapters/primary/ui/services/StateManager.js
// src/adapters/primary/ui/services/StateManager.js
// NOTE: Service cross-cutting qui centralise l'état de l'application
// Utilisé par tous les contrôleurs et orchestrateurs
// Alternative possible: Déplacer vers src/shared/state/ dans une future refactorisation

class StateManager {
  constructor() {
    this.connectedDevices = new Set();
    this.sensorsWithData = new Set();
    this.peripheralRefs = new Map();
    this.calibrationOffsets = new Map();
    
    this.bluetoothAdapter = null;
    this.scanTimeout = null;
    
    this.audioSystem = null;
    this.audioState = null;
    this.audioParameters = null;
    
    this.timelineUpdateInterval = null;
    this.currentAudioFile = null;

    this.audioRecorder = null;
    this.isRecording = false;
    
    this.smoothedPlaybackRate = 1.0;
    this.lastAngles = {
      left: { x: 0, y: 0, z: 0, timestamp: 0 },
      right: { x: 0, y: 0, z: 0, timestamp: 0 }
    };
    
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

  getConnectedDevices() {
    return this.connectedDevices;
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

  getBluetoothAdapter() {
    return this.bluetoothAdapter;
  }

  setBluetoothAdapter(adapter) {
    this.bluetoothAdapter = adapter;
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

  getAudioUI() {
    return this.audioUI;
  }

  reset() {
    this.connectedDevices.clear();
    this.sensorsWithData.clear();
    this.peripheralRefs.clear();
    this.calibrationOffsets.clear();
    
    this.clearScanTimeout();
    this.clearTimelineUpdateInterval();
    
    this.bluetoothAdapter = null;
    this.audioSystem = null;
    this.currentAudioFile = null;
    this.audioRecorder = null;
    this.isRecording = false;
    this.smoothedPlaybackRate = 1.0;
    
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