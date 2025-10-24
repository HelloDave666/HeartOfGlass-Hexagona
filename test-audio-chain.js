const AudioProcessingChain = require('./src/adapters/secondary/audio/granular/AudioProcessingChain.js');

console.log('=== Test AudioProcessingChain ===\n');

class MockAudioContext {
  constructor() {
    this.currentTime = 0;
  }
  
  createGain() {
    return {
      gain: {
        value: 1.0,
        setTargetAtTime: function(value) {
          this.value = value;
        }
      },
      connect: () => {},
      disconnect: () => {}
    };
  }
  
  createBiquadFilter() {
    return {
      type: 'lowpass',
      frequency: {
        value: 1000,
        setTargetAtTime: function(value) {
          this.value = value;
        }
      },
      Q: { value: 1.0 },
      connect: () => {},
      disconnect: () => {}
    };
  }
}

console.log('Test 1 : Création chaîne de traitement');
const mockContext = new MockAudioContext();
const chain = new AudioProcessingChain(mockContext);
console.log('✓ Chaîne créée');

console.log('\nTest 2 : État initial');
const state = chain.getState();
console.log('  Volume master:', state.masterVolume);
console.log('  Lowpass activé:', state.lowpassEnabled);
console.log('  Highpass activé:', state.highpassEnabled);
console.log('✓ État récupéré');

console.log('\nTest 3 : Modification volume');
chain.setMasterVolume(0.5);
console.log('✓ Volume défini à 0.5');

console.log('\nTest 4 : Activation filtres');
chain.setLowpassFilter(5000, true);
chain.setHighpassFilter(100, true);
const stateAfter = chain.getState();
console.log('  Lowpass:', stateAfter.lowpassFrequency, 'Hz');
console.log('  Highpass:', stateAfter.highpassFrequency, 'Hz');
console.log('✓ Filtres configurés');

console.log('\nTest 5 : Bypass');
chain.bypass(true);
console.log('✓ Bypass activé');

console.log('\nTest 6 : Nettoyage');
chain.dispose();
console.log('✓ Chaîne nettoyée');

console.log('\n=== Tous les tests OK ===');