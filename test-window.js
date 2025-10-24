const WindowFunctions = require('./src/adapters/secondary/audio/granular/WindowFunctions.js');

console.log('=== Test WindowFunctions ===\n');

// Test 1 : Créer une fenêtre Hann
console.log('Test 1 : Fenêtre Hann (10 échantillons)');
const hannWindow = WindowFunctions.hann(10);
console.log('Valeurs:', Array.from(hannWindow).map(v => v.toFixed(3)));
console.log('✓ Fenêtre créée\n');

// Test 2 : Lister les fenêtres disponibles
console.log('Test 2 : Fenêtres disponibles');
const available = WindowFunctions.getAvailableWindows();
available.forEach(w => {
  console.log(`- ${w.name}: ${w.description}`);
});
console.log('✓ Liste récupérée\n');

// Test 3 : Obtenir une fenêtre par nom
console.log('Test 3 : Obtenir fenêtre par nom');
const window = WindowFunctions.getWindow('hann', 5);
console.log('Valeurs:', Array.from(window).map(v => v.toFixed(3)));
console.log('✓ Fenêtre obtenue\n');

console.log('=== Tous les tests OK ===');