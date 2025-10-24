const IAudioService = require('./src/core/ports/output/IAudioService.js');

console.log('✓ IAudioService importé correctement');
console.log('Type:', typeof IAudioService);

// Vérifier qu'on ne peut pas instancier directement
try {
  const service = new IAudioService();
  service.initialize();
} catch (error) {
  console.log('✓ Erreur attendue:', error.message);
}