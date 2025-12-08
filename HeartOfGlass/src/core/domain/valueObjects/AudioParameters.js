class AudioParameters {
  constructor(grainSize = 350, overlap = 92, windowType = 'hann') {
    this.grainSize = this.validateGrainSize(grainSize);
    this.overlap = this.validateOverlap(overlap);
    this.windowType = this.validateWindowType(windowType);
    Object.freeze(this);
  }

  validateGrainSize(value) {
    const size = Number(value);
    if (isNaN(size) || size < 10 || size > 500) {
      throw new Error(`Grain size invalide: ${value}. Doit être entre 10 et 500 ms.`);
    }
    return size;
  }

  validateOverlap(value) {
    const overlap = Number(value);
    if (isNaN(overlap) || overlap < 0 || overlap > 95) {
      throw new Error(`Overlap invalide: ${value}. Doit être entre 0 et 95%.`);
    }
    return overlap;
  }

  validateWindowType(value) {
    const validTypes = ['hann', 'hanning', 'hamming', 'triangular', 'bartlett', 'rectangular', 'none'];
    const normalized = String(value).toLowerCase();
    if (!validTypes.includes(normalized)) {
      throw new Error(`Type de fenêtre invalide: ${value}. Types valides: ${validTypes.join(', ')}`);
    }
    return normalized;
  }

  with(changes) {
    return new AudioParameters(
      changes.grainSize !== undefined ? changes.grainSize : this.grainSize,
      changes.overlap !== undefined ? changes.overlap : this.overlap,
      changes.windowType !== undefined ? changes.windowType : this.windowType
    );
  }

  equals(other) {
    if (!(other instanceof AudioParameters)) {
      return false;
    }
    return (
      this.grainSize === other.grainSize &&
      this.overlap === other.overlap &&
      this.windowType === other.windowType
    );
  }

  toObject() {
    return {
      grainSize: this.grainSize,
      overlap: this.overlap,
      windowType: this.windowType
    };
  }

  toString() {
    return `AudioParameters(grainSize=${this.grainSize}ms, overlap=${this.overlap}%, window=${this.windowType})`;
  }

  static createDefault() {
    return new AudioParameters();
  }

  static fromObject(obj) {
    return new AudioParameters(obj.grainSize, obj.overlap, obj.windowType);
  }
}

module.exports = AudioParameters;