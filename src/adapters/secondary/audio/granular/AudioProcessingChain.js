class AudioProcessingChain {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.input = audioContext.createGain();
    this.output = audioContext.createGain();
    this.effects = {};
    this.effectsOrder = [];
    this.isBypassed = false;
    this.buildChain();
  }

  buildChain() {
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.5;  // 🆕 v3.4.3 : 50% par défaut au lieu de 80%
    this.lowpassFilter = this.audioContext.createBiquadFilter();
    this.lowpassFilter.type = 'lowpass';
    this.lowpassFilter.frequency.value = 20000;
    this.lowpassFilter.Q.value = 1.0;
    this.highpassFilter = this.audioContext.createBiquadFilter();
    this.highpassFilter.type = 'highpass';
    this.highpassFilter.frequency.value = 20;
    this.highpassFilter.Q.value = 1.0;
    this.effects.masterGain = { node: this.masterGain, enabled: true };
    this.effects.lowpass = { node: this.lowpassFilter, enabled: false };
    this.effects.highpass = { node: this.highpassFilter, enabled: false };
    this.effectsOrder = ['highpass', 'lowpass', 'masterGain'];
    this.reconnect();
  }

  reconnect() {
    try {
      this.input.disconnect();
      this.output.disconnect();
      Object.values(this.effects).forEach(effect => {
        try {
          effect.node.disconnect();
        } catch (e) {}
      });
    } catch (e) {}

    let currentNode = this.input;
    this.effectsOrder.forEach(effectName => {
      const effect = this.effects[effectName];
      if (effect && effect.enabled) {
        currentNode.connect(effect.node);
        currentNode = effect.node;
      }
    });
    currentNode.connect(this.output);
  }

  setMasterVolume(volume) {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.masterGain.gain.setTargetAtTime(
      clampedVolume,
      this.audioContext.currentTime,
      0.01
    );
  }

  setLowpassFilter(frequency, enabled = true) {
    this.lowpassFilter.frequency.setTargetAtTime(
      frequency,
      this.audioContext.currentTime,
      0.01
    );
    this.effects.lowpass.enabled = enabled;
    this.reconnect();
  }

  setHighpassFilter(frequency, enabled = true) {
    this.highpassFilter.frequency.setTargetAtTime(
      frequency,
      this.audioContext.currentTime,
      0.01
    );
    this.effects.highpass.enabled = enabled;
    this.reconnect();
  }

  enableEffect(effectName) {
    if (this.effects[effectName]) {
      this.effects[effectName].enabled = true;
      this.reconnect();
    }
  }

  disableEffect(effectName) {
    if (this.effects[effectName]) {
      this.effects[effectName].enabled = false;
      this.reconnect();
    }
  }

  bypass(bypassed) {
    this.isBypassed = bypassed;
    if (bypassed) {
      try {
        this.input.disconnect();
      } catch (e) {}
      this.input.connect(this.output);
    } else {
      this.reconnect();
    }
  }

  connect(destination) {
    this.output.connect(destination);
  }

  disconnect() {
    try {
      this.output.disconnect();
    } catch (e) {}
  }

  getState() {
    return {
      masterVolume: this.masterGain.gain.value,
      lowpassEnabled: this.effects.lowpass.enabled,
      lowpassFrequency: this.lowpassFilter.frequency.value,
      highpassEnabled: this.effects.highpass.enabled,
      highpassFrequency: this.highpassFilter.frequency.value,
      isBypassed: this.isBypassed
    };
  }

  dispose() {
    this.disconnect();
    try {
      this.input.disconnect();
      Object.values(this.effects).forEach(effect => {
        effect.node.disconnect();
      });
    } catch (e) {}
    this.effects = {};
  }
}

module.exports = AudioProcessingChain;