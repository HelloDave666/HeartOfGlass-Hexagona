class AudioState {
  constructor(data = {}) {
    this.isInitialized = Boolean(data.isInitialized || false);
    this.isPlaying = Boolean(data.isPlaying || false);
    this.hasBuffer = Boolean(data.hasBuffer || false);
    this.currentPosition = this.validatePosition(data.currentPosition || 0);
    this.duration = this.validateDuration(data.duration || 0);
    this.playbackRate = this.validatePlaybackRate(data.playbackRate || 1.0);
    this.playbackDirection = this.validateDirection(data.playbackDirection || 1);
    this.volume = this.validateVolume(data.volume || 0.8);
    this.activeGrains = this.validateActiveGrains(data.activeGrains || 0);
    Object.freeze(this);
  }

  validatePosition(value) {
    const pos = Number(value);
    if (isNaN(pos) || pos < 0) {
      return 0;
    }
    return pos;
  }

  validateDuration(value) {
    const dur = Number(value);
    if (isNaN(dur) || dur < 0) {
      return 0;
    }
    return dur;
  }

  validatePlaybackRate(value) {
    const rate = Number(value);
    if (isNaN(rate) || rate < 0 || rate > 3.0) {
      return 1.0;
    }
    return rate;
  }

  validateDirection(value) {
    return value >= 0 ? 1 : -1;
  }

  validateVolume(value) {
    const vol = Number(value);
    if (isNaN(vol) || vol < 0 || vol > 1.0) {
      return 0.8;
    }
    return vol;
  }

  validateActiveGrains(value) {
    const grains = Number(value);
    if (isNaN(grains) || grains < 0) {
      return 0;
    }
    return Math.floor(grains);
  }

  with(changes) {
    return new AudioState({
      isInitialized: changes.isInitialized !== undefined ? changes.isInitialized : this.isInitialized,
      isPlaying: changes.isPlaying !== undefined ? changes.isPlaying : this.isPlaying,
      hasBuffer: changes.hasBuffer !== undefined ? changes.hasBuffer : this.hasBuffer,
      currentPosition: changes.currentPosition !== undefined ? changes.currentPosition : this.currentPosition,
      duration: changes.duration !== undefined ? changes.duration : this.duration,
      playbackRate: changes.playbackRate !== undefined ? changes.playbackRate : this.playbackRate,
      playbackDirection: changes.playbackDirection !== undefined ? changes.playbackDirection : this.playbackDirection,
      volume: changes.volume !== undefined ? changes.volume : this.volume,
      activeGrains: changes.activeGrains !== undefined ? changes.activeGrains : this.activeGrains
    });
  }

  equals(other) {
    if (!(other instanceof AudioState)) {
      return false;
    }
    return (
      this.isInitialized === other.isInitialized &&
      this.isPlaying === other.isPlaying &&
      this.hasBuffer === other.hasBuffer &&
      this.currentPosition === other.currentPosition &&
      this.duration === other.duration &&
      this.playbackRate === other.playbackRate &&
      this.playbackDirection === other.playbackDirection &&
      this.volume === other.volume &&
      this.activeGrains === other.activeGrains
    );
  }

  toObject() {
    return {
      isInitialized: this.isInitialized,
      isPlaying: this.isPlaying,
      hasBuffer: this.hasBuffer,
      currentPosition: this.currentPosition,
      duration: this.duration,
      playbackRate: this.playbackRate,
      playbackDirection: this.playbackDirection,
      volume: this.volume,
      activeGrains: this.activeGrains
    };
  }

  toString() {
    return `AudioState(playing=${this.isPlaying}, pos=${this.currentPosition.toFixed(2)}s/${this.duration.toFixed(2)}s, vol=${this.volume})`;
  }

  static createInitial() {
    return new AudioState();
  }

  static fromObject(obj) {
    return new AudioState(obj);
  }
}

module.exports = AudioState;