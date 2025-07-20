// tests/setup.js

// Configuration globale pour tous les tests

// Mock console pour éviter le spam dans les tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock de l'API Electron pour les tests
global.electron = {
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn()
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  }
};

// Mock Web Audio API
global.AudioContext = jest.fn(() => ({
  createGain: jest.fn(() => ({
    connect: jest.fn(),
    gain: { value: 1 }
  })),
  createOscillator: jest.fn(() => ({
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    frequency: { value: 440 }
  })),
  createAnalyser: jest.fn(() => ({
    connect: jest.fn(),
    fftSize: 2048
  })),
  destination: {},
  sampleRate: 44100,
  currentTime: 0
}));

// Helper pour créer des fixtures de données capteur
global.createSensorData = (overrides = {}) => ({
  acc_x: 0,
  acc_y: 0,
  acc_z: 9.81,
  gyro_x: 0,
  gyro_y: 0,
  gyro_z: 0,
  mag_x: 0,
  mag_y: 0,
  mag_z: 0,
  timestamp: Date.now(),
  ...overrides
});

// Helper pour attendre des promesses
global.flushPromises = () => new Promise(resolve => setImmediate(resolve));

// Configuration des timeouts pour les tests async
jest.setTimeout(10000);
