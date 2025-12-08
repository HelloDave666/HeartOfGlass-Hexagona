const IAudioService = require('../../../../core/ports/output/IAudioService.js');
const GrainPlayer = require('./GrainPlayer.js');
const AudioProcessingChain = require('./AudioProcessingChain.js');
const fs = require('fs');
const path = require('path');

class GranularSynthesisAdapter extends IAudioService {
 constructor() {
 super();
 this.audioContext = null;
 this.audioBuffer = null;
 this.grainPlayer = null;
 this.processingChain = null;
 this.isInitialized = false;
 this.isPlaying = false;
 this.currentPosition = 0;
 this.playbackRate = 1.0;
 this.playbackDirection = 1;
 this.volume = 0.5; // [NEW] v3.4.3 : 50% par défaut au lieu de 80%
 this.grainParams = {
 grainSize: 60,
 overlap: 50,
 windowType: 'hann'
 };
 this.grainScheduler = null;
 this.lastGrainTime = 0;
 this.outputNode = null;
 }

 async initialize() {
 try {
 if (typeof window !== 'undefined' && window.AudioContext) {
 this.audioContext = new window.AudioContext();
 } else {
 throw new Error('Web Audio API non disponible');
 }
 this.grainPlayer = new GrainPlayer(this.audioContext);
 this.processingChain = new AudioProcessingChain(this.audioContext);
 this.processingChain.connect(this.audioContext.destination);
 this.isInitialized = true;
 return true;
 } catch (error) {
 console.error('[GranularSynthesisAdapter] Erreur initialisation:', error);
 throw error;
 }
 }

 async loadAudioFile(filePath) {
 if (!this.isInitialized) {
 throw new Error('Système audio non initialisé');
 }
 try {
 const absolutePath = path.resolve(filePath);
 if (!fs.existsSync(absolutePath)) {
 throw new Error(`Fichier introuvable: ${absolutePath}`);
 }
 const fileBuffer = fs.readFileSync(absolutePath);
 const arrayBuffer = new ArrayBuffer(fileBuffer.length);
 const view = new Uint8Array(arrayBuffer);
 view.set(fileBuffer);
 this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
 this.currentPosition = 0;
 console.log('[GranularSynthesisAdapter] Fichier chargé:', {
 duration: this.audioBuffer.duration,
 sampleRate: this.audioBuffer.sampleRate,
 channels: this.audioBuffer.numberOfChannels
 });
 return true;
 } catch (error) {
 console.error('[GranularSynthesisAdapter] Erreur chargement fichier:', error);
 throw error;
 }
 }

 startPlayback() {
 if (!this.audioBuffer) {
 throw new Error('Aucun fichier audio chargé');
 }
 if (this.isPlaying) {
 return false;
 }
 this.isPlaying = true;
 this.lastGrainTime = this.audioContext.currentTime;
 this.scheduleNextGrain();
 console.log('[GranularSynthesisAdapter] Lecture démarrée');
 return true;
 }

 stopPlayback() {
 if (!this.isPlaying) {
 return;
 }
 this.isPlaying = false;
 if (this.grainScheduler) {
 clearTimeout(this.grainScheduler);
 this.grainScheduler = null;
 }
 this.grainPlayer.stopAllGrains();
 console.log('[GranularSynthesisAdapter] Lecture arrêtée');
 }

 scheduleNextGrain() {
 if (!this.isPlaying) {
 return;
 }
 const grainSizeSec = this.grainParams.grainSize / 1000;
 const overlapFactor = this.grainParams.overlap / 100;
 const grainInterval = grainSizeSec * (1 - overlapFactor);
 const now = this.audioContext.currentTime;
 const timeSinceLastGrain = now - this.lastGrainTime;
 if (timeSinceLastGrain >= grainInterval) {
 this.playGrain();
 this.lastGrainTime = now;
 }
 const nextScheduleTime = Math.max(1, (grainInterval * 1000) / 2);
 this.grainScheduler = setTimeout(() => {
 this.scheduleNextGrain();
 }, nextScheduleTime);
 }

 playGrain() {
 const grainSizeSec = this.grainParams.grainSize / 1000;
 const overlapFactor = this.grainParams.overlap / 100;
 const grainInterval = grainSizeSec * (1 - overlapFactor);
 
 const effectiveRate = Math.abs(this.playbackRate);
 
 this.grainPlayer.playGrain(
 this.audioBuffer,
 this.currentPosition,
 grainSizeSec,
 effectiveRate,
 this.volume,
 this.grainParams.windowType,
 this.processingChain.input
 );
 
 const advancement = grainInterval * this.playbackRate * this.playbackDirection;
 this.currentPosition += advancement;
 
 if (this.currentPosition >= this.audioBuffer.duration) {
 this.currentPosition = 0;
 } else if (this.currentPosition < 0) {
 this.currentPosition = this.audioBuffer.duration + this.currentPosition;
 }
 }

 setPlaybackRate(rate, direction) {
 this.playbackRate = Math.max(0, Math.min(3.0, Math.abs(rate)));
 this.playbackDirection = direction >= 0 ? 1 : -1;
 }

 setVolume(volume) {
 this.volume = Math.max(0, Math.min(1, volume));
 if (this.processingChain) {
 this.processingChain.setMasterVolume(this.volume);
 }
 }

 setPlaybackPosition(position) {
 if (this.audioBuffer) {
 this.currentPosition = Math.max(0, Math.min(position, this.audioBuffer.duration));
 }
 }

 getPlaybackPosition() {
 return this.currentPosition;
 }

 isPlaybackActive() {
 return this.isPlaying;
 }

 isAudioBufferLoaded() {
 return this.audioBuffer !== null;
 }

 setGranularParams(params) {
 if (params.grainSize !== undefined) {
 this.grainParams.grainSize = Math.max(10, Math.min(500, params.grainSize));
 }
 if (params.overlap !== undefined) {
 this.grainParams.overlap = Math.max(0, Math.min(95, params.overlap));
 }
 if (params.windowType !== undefined) {
 this.grainParams.windowType = params.windowType;
 }
 }

 setAudioFilters(filterConfig) {
 if (!this.processingChain) {
 return;
 }
 if (filterConfig.lowpassFreq !== undefined) {
 this.processingChain.setLowpassFilter(filterConfig.lowpassFreq, true);
 }
 if (filterConfig.highpassFreq !== undefined) {
 this.processingChain.setHighpassFilter(filterConfig.highpassFreq, true);
 }
 }

 getState() {
 return {
 isInitialized: this.isInitialized,
 isPlaying: this.isPlaying,
 hasBuffer: this.audioBuffer !== null,
 currentPosition: this.currentPosition,
 duration: this.audioBuffer ? this.audioBuffer.duration : 0,
 playbackRate: this.playbackRate,
 playbackDirection: this.playbackDirection,
 volume: this.volume,
 granularParams: { ...this.grainParams },
 activeGrains: this.grainPlayer ? this.grainPlayer.getActiveGrainCount() : 0
 };
 }

 createOutputNode() {
 if (this.outputNode) {
 return this.outputNode;
 }
 
 this.outputNode = this.audioContext.createGain();
 this.outputNode.gain.value = 1.0;
 
 this.processingChain.disconnect();
 this.processingChain.connect(this.outputNode);
 this.outputNode.connect(this.audioContext.destination);
 
 console.log('[Audio] Output node créé pour enregistrement');
 
 return this.outputNode;
 }

 dispose() {
 this.stopPlayback();
 if (this.processingChain) {
 this.processingChain.dispose();
 }
 if (this.audioContext && this.audioContext.state !== 'closed') {
 this.audioContext.close();
 }
 this.audioBuffer = null;
 this.grainPlayer = null;
 this.processingChain = null;
 this.outputNode = null;
 this.isInitialized = false;
 }
}

module.exports = GranularSynthesisAdapter;