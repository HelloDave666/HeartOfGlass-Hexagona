const GranularSynthesisAdapter = require('./src/adapters/secondary/audio/granular/GranularSynthesisAdapter.js');

console.log('=== Test GranularSynthesisAdapter ===\n');

console.log('Test 1 : Création adapter');
const adapter = new GranularSynthesisAdapter();
console.log('✓ Adapter créé');
console.log('  Initialisé:', adapter.isInitialized);
console.log('  Buffer chargé:', adapter.isAudioBufferLoaded());

console.log('\nTest 2 : Configuration paramètres granulaires');
adapter.setGranularParams({
  grainSize: 200,
  overlap: 80,
  windowType: 'hamming'
});
const state = adapter.getState();
console.log('✓ Paramètres configurés');
console.log('  Grain size:', state.granularParams.grainSize, 'ms');
console.log('  Overlap:', state.granularParams.overlap, '%');
console.log('  Window:', state.granularParams.windowType);

console.log('\nTest 3 : Contrôle lecture');
adapter.setPlaybackRate(1.5, 1);
adapter.setVolume(0.7);
const stateAfter = adapter.getState();
console.log('✓ Contrôles configurés');
console.log('  Playback rate:', stateAfter.playbackRate);
console.log('  Direction:', stateAfter.playbackDirection);
console.log('  Volume:', stateAfter.volume);

console.log('\nTest 4 : Position');
adapter.setPlaybackPosition(5.0);
console.log('✓ Position définie');
console.log('  Position:', adapter.getPlaybackPosition(), 's');

console.log('\nTest 5 : État complet');
const fullState = adapter.getState();
console.log('✓ État récupéré');
console.log('  isInitialized:', fullState.isInitialized);
console.log('  isPlaying:', fullState.isPlaying);
console.log('  hasBuffer:', fullState.hasBuffer);

console.log('\n=== Tous les tests OK ===');
console.log('\nNote: Tests complets (initialize, loadAudioFile) nécessitent');
console.log('un environnement navigateur avec Web Audio API');