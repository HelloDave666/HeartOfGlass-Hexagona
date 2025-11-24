// src/core/domain/valueObjects/SensorData.js

/**
 * Value Object représentant les données d'un capteur IMU
 */
class SensorData {
  constructor(rawData) {
    // Parser les données selon le protocole BWT901BLECL5
    if (rawData && rawData.length >= 20 && rawData[0] === 0x55 && rawData[1] === 0x61) {
      // Extraction des angles Euler depuis les données brutes (bytes 14-19)
      this.angles = {
        x: this._parseSignedInt16(rawData[15], rawData[14]) / 32768 * 180,
        y: this._parseSignedInt16(rawData[17], rawData[16]) / 32768 * 180,
        z: this._parseSignedInt16(rawData[19], rawData[18]) / 32768 * 180
      };

      // Extraction des vitesses angulaires (gyroscope) depuis les données brutes (bytes 8-13)
      // Formule datasheet: wy = ((wyH<<8)|wyL) / 32768 * 2000 (°/s)
      this.gyro = {
        x: this._parseSignedInt16(rawData[9], rawData[8]) / 32768 * 2000,
        y: this._parseSignedInt16(rawData[11], rawData[10]) / 32768 * 2000,
        z: this._parseSignedInt16(rawData[13], rawData[12]) / 32768 * 2000
      };

      // Extraction de l'accélération (bytes 2-7) - pour usage futur
      this.accel = {
        x: this._parseSignedInt16(rawData[3], rawData[2]) / 32768 * 16,
        y: this._parseSignedInt16(rawData[5], rawData[4]) / 32768 * 16,
        z: this._parseSignedInt16(rawData[7], rawData[6]) / 32768 * 16
      };

      this.timestamp = Date.now();
      this.isValid = true;
    } else {
      this.angles = { x: 0, y: 0, z: 0 };
      this.gyro = { x: 0, y: 0, z: 0 };
      this.accel = { x: 0, y: 0, z: 0 };
      this.timestamp = Date.now();
      this.isValid = false;
    }

    // Rendre l'objet immuable
    Object.freeze(this.angles);
    Object.freeze(this.gyro);
    Object.freeze(this.accel);
    Object.freeze(this);
  }

  /**
   * Parse un entier signé 16 bits (little endian)
   * @param {number} highByte - Byte de poids fort
   * @param {number} lowByte - Byte de poids faible
   * @returns {number} - Valeur signée
   * @private
   */
  _parseSignedInt16(highByte, lowByte) {
    const value = (highByte << 8) | lowByte;
    // Convertir en signé si nécessaire (complément à 2)
    return value > 32767 ? value - 65536 : value;
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
