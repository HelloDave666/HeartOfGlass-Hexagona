// src/core/useCases/sensor/ConnectSensorUseCase.js

const Sensor = require('../../domain/entities/Sensor');
const SensorData = require('../../domain/valueObjects/SensorData');

class ConnectSensorUseCase {
 constructor(sensorService, sensorRepository, eventBus) {
 this.sensorService = sensorService;
 this.sensorRepository = sensorRepository;
 this.eventBus = eventBus;
 }

 async execute(peripheral, sensorConfig) {
 try {
 const { leftAddress, rightAddress, leftColor, rightColor } = sensorConfig;
 const address = peripheral.address.toLowerCase();
 
 // Déterminer la position et la couleur du capteur
 let position, color;
 if (address === leftAddress.toLowerCase()) {
 position = 'GAUCHE';
 color = leftColor;
 } else if (address === rightAddress.toLowerCase()) {
 position = 'DROIT';
 color = rightColor;
 } else {
 throw new Error('Capteur non reconnu');
 }

 // Créer ou récupérer l'entité Sensor
 let sensor = await this.sensorRepository.findByAddress(address);
 if (!sensor) {
 sensor = new Sensor(address, position, color);
 }

 // [OK] CORRECTION : Connexion physique AVEC callback de déconnexion
 await this.sensorService.connectSensor(peripheral, () => {
 // Callback de déconnexion
 this.handleDisconnection(sensor);
 });
 sensor.connect(peripheral);

 // Configuration des notifications pour recevoir les données
 await this.sensorService.setupNotifications(peripheral, (data) => {
 this.handleSensorData(sensor, data);
 });

 // Sauvegarder l'état
 await this.sensorRepository.save(sensor);

 // Émettre l'événement de connexion
 this.eventBus.emit('sensor:connected', {
 address: sensor.address,
 position: sensor.position,
 color: sensor.color
 });

 // Si c'est le capteur gauche, envoyer la commande de batterie
 if (position === 'GAUCHE') {
 const batteryCommand = Buffer.from([0xFF, 0xAA, 0x27, 0x64, 0x00]);
 await this.sensorService.sendCommand(peripheral, batteryCommand);
 }

 return sensor;
 } catch (error) {
 this.eventBus.emit('sensor:connection-failed', {
 address: peripheral.address,
 error: error.message
 });
 throw error;
 }
 }

 handleSensorData(sensor, rawData) {
 try {
 if (SensorData.isAngleData(rawData)) {
 const sensorData = new SensorData(rawData);
 if (sensorData.isValid) {
 // Calibrer si nécessaire
 if (!sensor.calibrationOffset.x && !sensor.calibrationOffset.y && !sensor.calibrationOffset.z) {
 sensor.calibrate(sensorData.angles);
 }

 // Mettre à jour les angles
 sensor.updateAngles(sensorData.angles);

 // Émettre l'événement de données avec TOUTES les données (angles + gyro + accel)
 this.eventBus.emit('sensor:data', {
 address: sensor.address,
 position: sensor.position,
 angles: sensor.currentAngles,
 gyro: sensorData.gyro, // [OK] Ajout du gyroscope
 accel: sensorData.accel // [OK] Ajout de l'accélération
 });
 }
 } else if (SensorData.isBatteryData(rawData)) {
 const batteryData = SensorData.createFromBatteryData(rawData);
 if (batteryData) {
 sensor.updateBattery(batteryData.percentage);
 
 this.eventBus.emit('sensor:battery', {
 address: sensor.address,
 position: sensor.position,
 battery: batteryData.percentage
 });
 }
 }
 
 // Sauvegarder l'état mis à jour
 this.sensorRepository.save(sensor);
 } catch (error) {
 console.error('Erreur traitement données capteur:', error);
 }
 }

 /**
 * [OK] NOUVELLE MÉTHODE : Gère la déconnexion d'un capteur
 */
 handleDisconnection(sensor) {
 console.log(`[ConnectSensorUseCase] Déconnexion détectée: ${sensor.position}`);
 
 try {
 // Marquer le capteur comme déconnecté
 sensor.disconnect();
 
 // Mettre à jour dans le repository
 this.sensorRepository.save(sensor);
 
 // Émettre l'événement de déconnexion
 this.eventBus.emit('sensor:disconnected', {
 address: sensor.address,
 position: sensor.position,
 color: sensor.color
 });
 
 console.log(`[ConnectSensorUseCase] Événement sensor:disconnected émis pour ${sensor.position}`);
 
 } catch (error) {
 console.error('[ConnectSensorUseCase] Erreur gestion déconnexion:', error);
 }
 }
}

module.exports = ConnectSensorUseCase;