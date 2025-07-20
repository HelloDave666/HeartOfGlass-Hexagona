// src/core/domain/valueObjects/SensorData.js

/**
 * Value Object représentant les données d'un capteur IMU
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
    } else {
      this.angles = { x: 0, y: 0, z: 0 };
      this.timestamp = Date.now();
      this.isValid = false;
    }

    // Rendre l'objet immuable
    Object.freeze(this.angles);
    Object.freeze(this);
  }

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

  static isAngleData(rawData) {
    return rawData && rawData.length >= 20 && 
           rawData[0] === 0x55 && rawData[1] === 0x61;
  }

  static isBatteryData(rawData) {
    return rawData && rawData.length >= 6 && 
           rawData[0] === 0x55 && rawData[1] === 0x71;
  }
}

module.exports = SensorData;
