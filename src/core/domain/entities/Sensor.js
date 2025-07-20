// src/core/domain/entities/Sensor.js

/**
 * Entité représentant un capteur IMU BWT901BLECL5
 */
class Sensor {
  constructor(address, position, color) {
    this.address = address.toLowerCase();
    this.position = position; // 'GAUCHE' ou 'DROIT'
    this.color = color; // 'blue' ou 'green'
    this.isConnected = false;
    this.hasData = false;
    this.peripheral = null;
    this.calibrationOffset = { x: 0, y: 0, z: 0 };
    this.currentAngles = { x: 0, y: 0, z: 0 };
    this.batteryLevel = null;
    this.rssi = null;
    this.signalStrength = null;
  }

  connect(peripheral) {
    this.peripheral = peripheral;
    this.isConnected = true;
    this.rssi = peripheral.rssi;
    this.signalStrength = Math.abs(peripheral.rssi);
  }

  disconnect() {
    this.isConnected = false;
    this.hasData = false;
    this.peripheral = null;
    this.rssi = null;
    this.signalStrength = null;
  }

  calibrate(angles) {
    this.calibrationOffset = {
      x: angles.x,
      y: angles.y,
      z: angles.z
    };
  }

  updateAngles(rawAngles) {
    this.currentAngles = {
      x: this.normalizeAngle(rawAngles.x - this.calibrationOffset.x, true),
      y: this.normalizeAngle(rawAngles.y - this.calibrationOffset.y, true),
      z: this.normalizeAngle(rawAngles.z - this.calibrationOffset.z, true)
    };
    this.hasData = true;
  }

  updateBattery(percentage) {
    this.batteryLevel = percentage;
  }

  updateSignal(rssi) {
    this.rssi = rssi;
    this.signalStrength = Math.abs(rssi);
  }

  normalizeAngle(angle, preserveFullRange = false) {
    if (preserveFullRange) {
      while (angle > 180) angle -= 360;
      while (angle < -180) angle += 360;
      return angle;
    }
    
    angle = angle % 360;
    if (angle < 0) angle += 360;
    return angle;
  }

  isActive() {
    return this.isConnected && this.hasData;
  }

  toDisplayData() {
    return {
      address: this.address,
      position: this.position,
      color: this.color,
      isConnected: this.isConnected,
      hasData: this.hasData,
      angles: {
        x: this.currentAngles.x.toFixed(1),
        y: this.currentAngles.y.toFixed(1),
        z: this.currentAngles.z.toFixed(1)
      },
      battery: this.batteryLevel,
      rssi: this.rssi,
      signalStrength: this.signalStrength
    };
  }
}

module.exports = Sensor;
