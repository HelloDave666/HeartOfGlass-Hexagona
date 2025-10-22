const NobleBluetoothAdapter = require('./src/adapters/secondary/sensors/bluetooth/NobleBluetoothAdapter');

async function test() {
  const adapter = new NobleBluetoothAdapter();
  
  console.log('=== TEST NOBLE ADAPTER ===\n');
  
  // Test 1: Vérifier disponibilité
  console.log('1. Vérification Bluetooth...');
  const availability = await adapter.checkBluetoothAvailability();
  console.log('Disponible:', availability.available);
  console.log('État:', availability.state);
  
  // Test 2: Démarrer scan
  console.log('\n2. Démarrage scan...');
  
  adapter.onDiscover((peripheral) => {
    console.log('✓ Capteur trouvé:', peripheral.address, '-', peripheral.advertisement.localName);
  });
  
  await adapter.startScanning();
  
  // Attendre 30 secondes
  console.log('Scan pendant 30 secondes...\n');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  // Arrêter
  await adapter.stopScanning();
  console.log('\n3. Scan arrêté');
  
  // Cleanup
  await adapter.cleanup();
  console.log('4. Nettoyage terminé');
  
  process.exit(0);
}

test().catch(err => {
  console.error('ERREUR:', err);
  process.exit(1);
});