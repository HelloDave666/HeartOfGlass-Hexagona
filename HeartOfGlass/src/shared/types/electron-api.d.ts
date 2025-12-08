// src/shared/types/electron-api.d.ts

interface SensorAPI {
  scan: () => Promise<any>;
  stopScan: () => Promise<any>;
  getStatus: () => Promise<any>;
  updateConfig: (config: any) => Promise<any>;
  onConnected: (callback: (data: any) => void) => () => void;
  onDisconnected: (callback: (data: any) => void) => () => void;
  onData: (callback: (data: any) => void) => () => void;
  onBattery: (callback: (data: any) => void) => () => void;
  onReady: (callback: (data: any) => void) => () => void;
}

interface AudioAPI {
  startEngine: () => Promise<any>;
  stopEngine: () => Promise<any>;
  updateSettings: (settings: any) => Promise<any>;
  loadFile: (file: any) => Promise<any>;
  play: () => Promise<any>;
  pause: () => Promise<any>;
  stop: () => Promise<any>;
  setPosition: (position: number) => Promise<any>;
}

interface RecordingAPI {
  start: () => Promise<any>;
  stop: () => Promise<any>;
  save: (format: string) => Promise<any>;
}

interface NarrativeAPI {
  addDialogue: (speaker: string, text: string, expression?: string) => Promise<any>;
  nextDialogue: () => Promise<any>;
  skipDialogue: () => Promise<any>;
}

interface HeartOfGlassAPI {
  sensor: SensorAPI;
  audio: AudioAPI;
  recording: RecordingAPI;
  narrative: NarrativeAPI;
  log: (level: string, message: string) => void;
}

declare global {
  interface Window {
    heartOfGlass: HeartOfGlassAPI;
    SensorDisplay?: any;
    AudioController?: any;
    NarrativeSystem?: any;
  }
}

export {};
