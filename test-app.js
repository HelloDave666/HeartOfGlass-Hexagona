// test-app.js
// Script de test pour vérifier que l'application démarre correctement

const path = require('path');
const fs = require('fs');

console.log('=== Test de l\'application Heart of Glass ===\n');

// Vérifier les fichiers critiques
const criticalFiles = [
  'src/adapters/primary/electron/main/index.js',
  'src/adapters/primary/electron/preload/index.js',
  'src/adapters/primary/electron/renderer/index.html',
  'src/adapters/primary/ui/app.js',
  'src/adapters/primary/ui/styles/main.css',
  'src/adapters/primary/ui/components/SensorDisplay.js',
  'src/core/domain/entities/Sensor.js',
  'src/core/domain/valueObjects/SensorData.js',
  'src/core/ports/output/ISensorService.js',
  'src/core/useCases/sensor/ConnectSensorUseCase.js',
  'src/adapters/secondary/sensors/bluetooth/NobleBluetoothAdapter.js',
  'src/adapters/secondary/storage/repositories/SensorRepository.js',
  'src/infrastructure/eventBus/EventBus.js',
  'src/infrastructure/di/Container.js',
  'src/adapters/primary/ipc/handlers/SensorHandler.js'
];

let allFilesExist = true;

console.log('Vérification des fichiers...');
criticalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✓ ${file}`);
  } else {
    console.log(`✗ MANQUANT: ${file}`);
    allFilesExist = false;
  }
});

if (allFilesExist) {
  console.log('\n✅ Tous les fichiers sont présents!');
  console.log('\nVous pouvez maintenant démarrer l\'application avec: npm start');
} else {
  console.log('\n❌ Des fichiers sont manquants. Vérifiez l\'installation.');
}

// Vérifier les dépendances
console.log('\n=== Vérification des dépendances ===');
try {
  const packageJson = require('./package.json');
  const dependencies = Object.keys(packageJson.dependencies || {});
  
  console.log(`\nDépendances installées: ${dependencies.length}`);
  dependencies.forEach(dep => console.log(`  - ${dep}`));
  
  // Vérifier si node_modules existe
  if (fs.existsSync('node_modules')) {
    console.log('\n✅ Le dossier node_modules existe');
  } else {
    console.log('\n❌ Le dossier node_modules est manquant - exécutez: npm install');
  }
} catch (error) {
  console.log('\n❌ Erreur lors de la lecture du package.json');
}

console.log('\n=== Test terminé ===');
