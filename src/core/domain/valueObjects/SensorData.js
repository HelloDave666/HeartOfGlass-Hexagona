// @ts-nocheck
// src/core/domain/valueObjects/SensorData.js

/**
 * Value Object représentant les données d'un capteur IMU
 * Supporte : Angles, Vitesse angulaire (Gyro), Accélération, Batterie
 */
class SensorData {
  constructor(rawData) {
    // Parser les données selon le protocole BWT901BLECL5
    if (rawData && rawData.length >= 20 && rawData[0] === 0x55 && rawData[1] === 0x61) {
      // Extraction des angles depuis les données brutes
      this.angles = {
        x: ((rawData[15] << 8 | rawData[14]) / 32768 * 180),
        y: ((rawData[17] << 8 | rawData[16]) / 32768 * 180),
        z: ((rawData[19] << 8 | rawData[18]) / 32768 * 180)
      };
      this.timestamp = Date.now();
      this.isValid = true;
      this.type = 'angle';
    } else {
      this.angles = { x: 0, y: 0, z: 0 };
      this.timestamp = Date.now();
      this.isValid = false;
      this.type = 'unknown';
    }

    // Rendre l'objet immuable
    Object.freeze(this.angles);
    Object.freeze(this);
  }

  /**
   * Parse les données de vitesse angulaire (GYRO)
   * Format: 0x55 0x52 GyroXL GyroXH GyroYL GyroYH GyroZL GyroZH TL TH SUM
   * Unité: °/s (degrés par seconde)
   */
  static createFromGyroData(rawData) {
    if (rawData && rawData.length >= 11 && 
        rawData[0] === 0x55 && rawData[1] === 0x52) {
      
      // Extraction des données gyroscope (vitesse angulaire)
      const gyroX = ((rawData[3] << 8) | rawData[2]) / 32768.0 * 2000; // ±2000 °/s
      const gyroY = ((rawData[5] << 8) | rawData[4]) / 32768.0 * 2000;
      const gyroZ = ((rawData[7] << 8) | rawData[6]) / 32768.0 * 2000;
      
      return {
        type: 'gyro',
        gyro: {
          x: gyroX,
          y: gyroY,
          z: gyroZ
        },
        timestamp: Date.now(),
        isValid: true
      };
    }
    return null;
  }

  /**
   * Parse les données d'accélération
   * Format: 0x55 0x51 AccXL AccXH AccYL AccYH AccZL AccZH TL TH SUM
   * Unité: g (gravité)
   */
  static createFromAccelData(rawData) {
    if (rawData && rawData.length >= 11 && 
        rawData[0] === 0x55 && rawData[1] === 0x51) {
      
      // Extraction des données accélération
      const accelX = ((rawData[3] << 8) | rawData[2]) / 32768.0 * 16; // ±16g
      const accelY = ((rawData[5] << 8) | rawData[4]) / 32768.0 * 16;
      const accelZ = ((rawData[7] << 8) | rawData[6]) / 32768.0 * 16;
      
      return {
        type: 'accel',
        accel: {
          x: accelX,
          y: accelY,
          z: accelZ
        },
        timestamp: Date.now(),
        isValid: true
      };
    }
    return null;
  }

  /**
   * Parse les données d'angle (format alternatif)
   * Format: 0x55 0x53 AngleXL AngleXH AngleYL AngleYH AngleZL AngleZH TL TH SUM
   * Unité: degrés
   */
  static createFromAngleData(rawData) {
    if (rawData && rawData.length >= 11 && 
        rawData[0] === 0x55 && rawData[1] === 0x53) {
      
      // Extraction des angles
      const angleX = ((rawData[3] << 8) | rawData[2]) / 32768.0 * 180;
      const angleY = ((rawData[5] << 8) | rawData[4]) / 32768.0 * 180;
      const angleZ = ((rawData[7] << 8) | rawData[6]) / 32768.0 * 180;
      
      return {
        type: 'angle',
        angles: {
          x: angleX,
          y: angleY,
          z: angleZ
        },
        timestamp: Date.now(),
        isValid: true
      };
    }
    return null;
  }

  /**
   * Parse les données de batterie
   */
  static createFromBatteryData(rawData) {
    if (rawData && rawData.length >= 6 && 
        rawData[0] === 0x55 && rawData[1] === 0x71 && rawData[2] === 0x64) {
      const batteryValue = (rawData[5] << 8) | rawData[4];
      let percentage = 0;
      
      if (batteryValue > 830) percentage = 100;
      else if (batteryValue > 393) percentage = 90;
      else if (batteryValue > 387) percentage = 75;
      else if (batteryValue > 382) percentage = 60;
      else if (batteryValue > 379) percentage = 50;
      else if (batteryValue > 377) percentage = 40;
      else if (batteryValue > 373) percentage = 30;
      else if (batteryValue > 370) percentage = 20;
      else if (batteryValue > 368) percentage = 15;
      else if (batteryValue > 350) percentage = 10;
      else if (batteryValue > 340) percentage = 5;

      return {
        type: 'battery',
        value: batteryValue,
        percentage: percentage,
        timestamp: Date.now()
      };
    }
    return null;
  }

  /**
   * Détecte le type de données reçues
   */
  static detectDataType(rawData) {
    if (!rawData || rawData.length < 2 || rawData[0] !== 0x55) {
      return 'unknown';
    }

    switch (rawData[1]) {
      case 0x51: return 'accel';
      case 0x52: return 'gyro';      // ← Important pour Heart of Frost
      case 0x53: return 'angle';
      case 0x61: return 'angle';
      case 0x71: return 'battery';
      default: return 'unknown';
    }
  }

  // Méthodes de vérification

  static isAngleData(rawData) {
    return rawData && rawData.length >= 11 && 
           rawData[0] === 0x55 && (rawData[1] === 0x53 || rawData[1] === 0x61);
  }

  static isGyroData(rawData) {
    return rawData && rawData.length >= 11 && 
           rawData[0] === 0x55 && rawData[1] === 0x52;
  }

  static isAccelData(rawData) {
    return rawData && rawData.length >= 11 && 
           rawData[0] === 0x55 && rawData[1] === 0x51;
  }

  static isBatteryData(rawData) {
    return rawData && rawData.length >= 6 && 
           rawData[0] === 0x55 && rawData[1] === 0x71;
  }

  /**
   * Parse automatiquement n'importe quel type de données
   */
  static parse(rawData) {
    const dataType = SensorData.detectDataType(rawData);

    switch (dataType) {
      case 'gyro':
        return SensorData.createFromGyroData(rawData);
      case 'accel':
        return SensorData.createFromAccelData(rawData);
      case 'angle':
        return SensorData.createFromAngleData(rawData);
      case 'battery':
        return SensorData.createFromBatteryData(rawData);
      default:
        return null;
    }
  }
}

module.exports = SensorData;