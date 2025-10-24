const AudioParameters = require('./src/core/domain/valueObjects/AudioParameters.js');
const AudioState = require('./src/core/domain/valueObjects/AudioState.js');

console.log('=== Test Value Objects ===\n');

console.log('Test 1 : AudioParameters - Création avec valeurs par défaut');
const params1 = AudioParameters.createDefault();
console.log('✓ Créé:', params1.toString());

console.log('\nTest 2 : AudioParameters - Validation');
try {
  const params2 = new AudioParameters(200, 80, 'hamming');
  console.log('✓ Paramètres valides:', params2.toString());
} catch (error) {
  console.log('✗ Erreur:', error.message);
}

console.log('\nTest 3 : AudioParameters - Immutabilité (with)');
const params3 = params1.with({ grainSize: 150 });
console.log('✓ Original:', params1.grainSize, 'ms');
console.log('✓ Nouveau:', params3.grainSize, 'ms');

console.log('\nTest 4 : AudioParameters - Validation erreur');
try {
  new AudioParameters(999, 50, 'hann');
  console.log('✗ Devrait échouer');
} catch (error) {
  console.log('✓ Erreur attendue:', error.message);
}

console.log('\nTest 5 : AudioState - Création');
const state1 = AudioState.createInitial();
console.log('✓ État créé:', state1.toString());

console.log('\nTest 6 : AudioState - Modification');
const state2 = state1.with({ isPlaying: true, currentPosition: 5.5 });
console.log('✓ État modifié:', state2.toString());
console.log('  Original inchangé:', state1.toString());

console.log('\nTest 7 : AudioState - Validation volume');
const state3 = new AudioState({ volume: 1.5 });
console.log('✓ Volume corrigé:', state3.volume);

console.log('\nTest 8 : Égalité');
const params4 = new AudioParameters(350, 92, 'hann');
const params5 = new AudioParameters(350, 92, 'hann');
console.log('✓ params4 equals params5:', params4.equals(params5));

console.log('\n=== Tous les tests OK ===');