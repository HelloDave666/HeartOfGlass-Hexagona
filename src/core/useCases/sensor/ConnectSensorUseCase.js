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

      // ✅ CORRECTION : Connexion physique AVEC callback de déconnexion
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
      // NOUVEAU : Format étendu 0x61 (accel + gyro + angles dans un même paquet)
      if (rawData && rawData.length >= 20 && rawData[0] === 0x55 && rawData[1] === 0x61) {
        console.log(`[ConnectSensorUseCase] ${sensor.position} FORMAT 0x61 détecté`);
        
        // Parser l'accélération (bytes 2-7) - Format BWT901
        const accelX = ((rawData[3] << 8) | rawData[2]) / 32768.0 * 16; // g
        const accelY = ((rawData[5] << 8) | rawData[4]) / 32768.0 * 16; // g
        const accelZ = ((rawData[7] << 8) | rawData[6]) / 32768.0 * 16; // g
        
        // Parser le gyroscope (bytes 8-13) - VITESSE ANGULAIRE
        const gyroX = ((rawData[9] << 8) | rawData[8]) / 32768.0 * 2000; // °/s
        const gyroY = ((rawData[11] << 8) | rawData[10]) / 32768.0 * 2000; // °/s
        const gyroZ = ((rawData[13] << 8) | rawData[12]) / 32768.0 * 2000; // °/s
        
        // Parser les angles (bytes 14-19) - ANGLES
        const angleX = ((rawData[15] << 8) | rawData[14]) / 32768.0 * 180; // degrés (Roll)
        const angleY = ((rawData[17] << 8) | rawData[16]) / 32768.0 * 180; // degrés (Pitch)
        const angleZ = ((rawData[19] << 8) | rawData[18]) / 32768.0 * 180; // degrés (Yaw)
        
        console.log(`[ConnectSensorUseCase] ${sensor.position} ACCEL: x=${accelX.toFixed(3)}g, y=${accelY.toFixed(3)}g, z=${accelZ.toFixed(3)}g`);
        console.log(`[ConnectSensorUseCase] ${sensor.position} GYRO: x=${gyroX.toFixed(2)}°/s, y=${gyroY.toFixed(2)}°/s, z=${gyroZ.toFixed(2)}°/s`);
        console.log(`[ConnectSensorUseCase] ${sensor.position} ANGLES: x=${angleX.toFixed(2)}°, y=${angleY.toFixed(2)}°, z=${angleZ.toFixed(2)}°`);
        
        // Mettre à jour les angles du capteur
        const angles = { x: angleX, y: angleY, z: angleZ };
        
        // Calibrer si nécessaire
        if (!sensor.calibrationOffset.x && !sensor.calibrationOffset.y && !sensor.calibrationOffset.z) {
          sensor.calibrate(angles);
        }
        
        sensor.updateAngles(angles);
        
        // Émettre l'événement avec ACCEL + GYRO + ANGLES
        this.eventBus.emit('sensor:data', {
          address: sensor.address,
          position: sensor.position,
          angles: sensor.currentAngles,
          gyro: { x: gyroX, y: gyroY, z: gyroZ },
          accel: { x: accelX, y: accelY, z: accelZ },
          mag: null
        });
        
        // Sauvegarder
        this.sensorRepository.save(sensor);
        return;
      }
      
      // ANCIEN CODE - Traiter les angles (0x55 0x51)
      if (SensorData.isAngleData(rawData)) {
        const sensorData = new SensorData(rawData);
        if (sensorData.isValid) {
          // Calibrer si nécessaire
          if (!sensor.calibrationOffset.x && !sensor.calibrationOffset.y && !sensor.calibrationOffset.z) {
            sensor.calibrate(sensorData.angles);
          }
          
          // Mettre à jour les angles
          sensor.updateAngles(sensorData.angles);
          
          console.log(`[ConnectSensorUseCase] ${sensor.position} ANGLES détectés: ${JSON.stringify(sensor.currentAngles)}`);
          
          // Émettre l'événement de données AVEC gyro: null
          this.eventBus.emit('sensor:data', {
            address: sensor.address,
            position: sensor.position,
            angles: sensor.currentAngles,
            gyro: null,
            accel: null,
            mag: null
          });
        }
      } 
      // NOUVEAU CODE - Traiter les données gyro (0x55 0x52)
      else if (rawData && rawData.length >= 11 && rawData[0] === 0x55 && rawData[1] === 0x52) {
        console.log(`[ConnectSensorUseCase] ${sensor.position} GYRO DÉTECTÉ !`);
        
        // Parser données gyro BWT901
        const gyroX = ((rawData[3] << 8) | rawData[2]) / 32768.0 * 2000; // °/s
        const gyroY = ((rawData[5] << 8) | rawData[4]) / 32768.0 * 2000; // °/s
        const gyroZ = ((rawData[7] << 8) | rawData[6]) / 32768.0 * 2000; // °/s
        
        console.log(`[ConnectSensorUseCase] ${sensor.position} GYRO: x=${gyroX.toFixed(2)}, y=${gyroY.toFixed(2)}, z=${gyroZ.toFixed(2)} °/s`);
        
        // Émettre l'événement avec données gyro
        this.eventBus.emit('sensor:data', {
          address: sensor.address,
          position: sensor.position,
          angles: sensor.currentAngles, // Garder angles précédents
          gyro: { x: gyroX, y: gyroY, z: gyroZ },
          accel: null,
          mag: null
        });
      }
      // NOUVEAU CODE - Traiter les données accéléromètre (0x55 0x53)
      else if (rawData && rawData.length >= 11 && rawData[0] === 0x55 && rawData[1] === 0x53) {
        console.log(`[ConnectSensorUseCase] ${sensor.position} ACCEL détecté`);
        
        // Parser données accel BWT901
        const accelX = ((rawData[3] << 8) | rawData[2]) / 32768.0 * 16; // g
        const accelY = ((rawData[5] << 8) | rawData[4]) / 32768.0 * 16; // g
        const accelZ = ((rawData[7] << 8) | rawData[6]) / 32768.0 * 16; // g
        
        // Émettre l'événement avec données accel
        this.eventBus.emit('sensor:data', {
          address: sensor.address,
          position: sensor.position,
          angles: sensor.currentAngles,
          gyro: null,
          accel: { x: accelX, y: accelY, z: accelZ },
          mag: null
        });
      }
      // ANCIEN CODE - Traiter les données batterie
      else if (SensorData.isBatteryData(rawData)) {
        console.log(`[ConnectSensorUseCase] ${sensor.position} BATTERIE détectée`);
        
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
      console.error('[ConnectSensorUseCase] Erreur traitement données capteur:', error);
    }
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Gère la déconnexion d'un capteur
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