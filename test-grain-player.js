const GrainPlayer = require('./src/adapters/secondary/audio/granular/GrainPlayer.js');

console.log('=== Test GrainPlayer ===\n');

// Test 1 : Créer un GrainPlayer (nécessite un mock AudioContext)
console.log('Test 1 : Création GrainPlayer');

// Mock simple d'AudioContext pour le test
class MockAudioContext {
  constructor() {
    this.currentTime = 0;
  }
  
  createBufferSource() {
    return {
      buffer: null,
      playbackRate: { value: 1.0 },
      connect: () => {},
      start: () => {},
      stop: () => {},
      disconnect: () => {},
      onended: null
    };
  }
  
  createGain() {
    return {
      gain: {
        value: 1.0,
        cancelScheduledValues: () => {},
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {}
      },
      connect: () => {},
      disconnect: () => {}
    };
  }
}

const mockContext = new MockAudioContext();
const player = new GrainPlayer(mockContext);

console.log('✓ GrainPlayer créé');
console.log('  Grains actifs:', player.getActiveGrainCount());
console.log('  Max grains:', player.maxActiveGrains);

// Test 2 : Configuration
console.log('\nTest 2 : Configuration');
player.setMaxActiveGrains(30);
console.log('✓ Max grains modifié:', player.maxActiveGrains);

// Test 3 : Arrêt de tous les grains
console.log('\nTest 3 : Arrêt grains');
player.stopAllGrains();
console.log('✓ Tous les grains arrêtés');
console.log('  Grains actifs:', player.getActiveGrainCount());

console.log('\n=== Tous les tests OK ===');
console.log('\nNote : Tests complets nécessitent un vrai AudioContext');
console.log('Ces tests seront effectués dans le navigateur');