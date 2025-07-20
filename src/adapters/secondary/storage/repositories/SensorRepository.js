// src/adapters/secondary/storage/repositories/SensorRepository.js

class SensorRepository {
  constructor() {
    // Stockage en mémoire pour cette implémentation
    // Peut être remplacé par electron-store ou autre pour la persistance
    this.sensors = new Map();
  }

  async save(sensor) {
    this.sensors.set(sensor.address, sensor);
    return sensor;
  }

  async findByAddress(address) {
    return this.sensors.get(address.toLowerCase());
  }

  async findAll() {
    return Array.from(this.sensors.values());
  }

  async findByPosition(position) {
    return Array.from(this.sensors.values())
      .find(sensor => sensor.position === position);
  }

  async getActiveSensors() {
    return Array.from(this.sensors.values())
      .filter(sensor => sensor.isActive());
  }

  async delete(address) {
    return this.sensors.delete(address.toLowerCase());
  }

  async clear() {
    this.sensors.clear();
  }

  // Méthodes utilitaires
  async areBothSensorsActive() {
    const sensors = await this.getActiveSensors();
    return sensors.length === 2 && 
           sensors.some(s => s.position === 'GAUCHE') &&
           sensors.some(s => s.position === 'DROIT');
  }

  async getSensorsPairs() {
    const leftSensor = await this.findByPosition('GAUCHE');
    const rightSensor = await this.findByPosition('DROIT');
    return { leftSensor, rightSensor };
  }
}

module.exports = SensorRepository;
