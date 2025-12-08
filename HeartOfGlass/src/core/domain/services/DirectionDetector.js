/**
 * DirectionDetector - Service de détection de direction de rotation
 *
 * Responsabilités:
 * - Déterminer la direction de rotation (horaire/antihoraire) à partir des données gyroscope
 * - Gérer le consensus de direction (stabilité temporelle)
 * - Calculer la dead zone dynamique pour filtrer le bruit
 *
 * Architecture : Core/Domain/Services
 */
class DirectionDetector {
 /**
 * @param {Object} config - Configuration du détecteur
 */
 constructor(config) {
 this.config = config;

 // État interne
 this.usingDirectSignMethod = true; // Méthode hybride : démarrer avec méthode directe
 this.currentDeadZone = config.gyroDeadZoneRest;
 this.recentVelocityBuffer = [];
 }

 /**
 * Détecte la direction de rotation à partir des données gyroscope
 *
 * @param {Array} signedDeltaBuffer - Buffer des deltas gyroscope signés
 * @param {Object} calibrationOrchestrator - Orchestrateur de calibration
 * @returns {number|null} Direction (-1=horaire, 1=antihoraire, null=pas de consensus)
 */
 detectDirection(signedDeltaBuffer, calibrationOrchestrator) {
 if (!calibrationOrchestrator) {
 return null;
 }

 const calibrationModel = calibrationOrchestrator.getCalibrationModel();

 // Vérifier que le modèle est calibré
 if (!calibrationModel || !calibrationModel.isComplete) {
 return null;
 }

 // Calculer la moyenne des valeurs gyroscope du buffer
 const gyroValues = signedDeltaBuffer.map(s => s.delta);

 if (gyroValues.length === 0) {
 return null;
 }

 const avgGyro = gyroValues.reduce((sum, d) => sum + d, 0) / gyroValues.length;
 const absAvgGyro = Math.abs(avgGyro);

 // Méthode HYBRIDE avec HYSTÉRÉSIS
 // Décider quelle méthode utiliser avec zone tampon (évite oscillations à la frontière)
 if (this.config.directionHybridMethod) {
 // Hystérésis : Changer de méthode uniquement si on dépasse clairement les seuils
 if (this.usingDirectSignMethod && absAvgGyro >= this.config.directionDirectSignThresholdHigh) {
 // On monte au-dessus de 220°/s → Passer à méthode calibrée
 this.usingDirectSignMethod = false;
 } else if (!this.usingDirectSignMethod && absAvgGyro <= this.config.directionDirectSignThresholdLow) {
 // On descend en-dessous de 180°/s → Passer à méthode directe
 this.usingDirectSignMethod = true;
 }
 // Entre 180-220°/s → Garder la méthode actuelle (zone d'hystérésis)
 }

 // Appliquer la méthode choisie
 if (this.config.directionHybridMethod && this.usingDirectSignMethod) {
 // Méthode DIRECTE : Signe du gyroscope
 return this._detectDirectionBySign(gyroValues);
 }

 // Méthode CLASSIQUE : Plages calibrées (pour haute vitesse > 200°/s)
 return this._detectDirectionByCalibration(avgGyro, absAvgGyro, calibrationModel);
 }

 /**
 * Détecte la direction par le signe des valeurs gyroscope (méthode directe)
 * @private
 */
 _detectDirectionBySign(gyroValues) {
 // Calculer le ratio de valeurs positives dans le buffer
 const positiveCount = gyroValues.filter(v => v > 0).length;
 const positiveRatio = positiveCount / gyroValues.length;

 // 🔴 Seuil 85% - Plus stable
 if (positiveRatio > 0.85) {
 // Majorité forte positive → Horaire
 return -1;
 } else if (positiveRatio < 0.15) {
 // Majorité forte négative → Antihoraire
 return 1;
 } else {
 // Pas de consensus clair (entre 15% et 85%)
 return null;
 }
 }

 /**
 * Détecte la direction par plages calibrées (méthode classique)
 * @private
 */
 _detectDirectionByCalibration(avgGyro, absAvgGyro, calibrationModel) {
 // Calculer distance aux deux plages
 const distHoraire = this._distanceToRange(avgGyro, calibrationModel.clockwise);
 const distAntihoraire = this._distanceToRange(avgGyro, calibrationModel.counterclockwise);

 // Choisir la direction la plus proche
 const minDist = Math.min(distHoraire, distAntihoraire);
 const maxDist = Math.max(distHoraire, distAntihoraire);

 // Ratio de séparation ADAPTATIF
 // Ratio plus permissif aux vitesses moyennes pour meilleure détection
 let requiredRatio = 2.0; // Valeur par défaut

 if (this.config.directionSeparationRatioAdaptive) {
 if (absAvgGyro < this.config.directionSeparationVelocityLow) {
 // Basse vitesse (< 50°/s) → Ratio permissif 1.5
 requiredRatio = this.config.directionSeparationRatioLow;
 } else if (absAvgGyro < this.config.directionSeparationVelocityHigh) {
 // Moyenne vitesse (50-200°/s) → Ratio moyen 1.8
 requiredRatio = this.config.directionSeparationRatioMid;
 } else {
 // Haute vitesse (> 200°/s) → Ratio strict 2.5
 requiredRatio = this.config.directionSeparationRatioHigh;
 }
 }

 // Besoin d'une séparation claire selon le ratio adaptatif
 if (maxDist / Math.max(0.1, minDist) < requiredRatio) {
 return null; // Pas de consensus
 }

 // Mapping: déterminer la direction selon les plages calibrées
 // - Rotation horaire → direction -1 (AVANT)
 // - Rotation antihoraire → direction 1 (ARRIÈRE)
 if (distHoraire < distAntihoraire) {
 return -1;
 } else {
 return 1;
 }
 }

 /**
 * Vérifie si le consensus de direction est stable
 *
 * @param {Array} directionConsensusHistory - Historique des directions récentes
 * @param {number} candidateDirection - Direction candidate à vérifier
 * @returns {boolean} True si le consensus est stable
 */
 checkConsensusStability(directionConsensusHistory, candidateDirection) {
 if (!this.config.directionConsensusConfirmationEnabled) {
 return true; // Si désactivé, toujours considérer stable
 }

 // Pas assez d'historique encore
 if (directionConsensusHistory.length < this.config.directionConsensusConfirmationFrames) {
 return false;
 }

 // Vérifier que TOUTES les frames récentes ont la même direction
 for (const entry of directionConsensusHistory) {
 if (entry.direction !== candidateDirection) {
 return false; // Une frame différente → consensus instable
 }
 }

 return true; // Toutes les frames concordent → consensus stable
 }

 /**
 * Met à jour la dead zone dynamique en fonction de la vitesse angulaire
 *
 * @param {number} angularVelocity - Vitesse angulaire actuelle (°/s)
 * @returns {number} Dead zone calculée
 */
 updateDynamicDeadZone(angularVelocity) {
 if (!this.config.gyroDeadZoneDynamic) {
 return this.config.gyroDeadZoneRest; // Mode classique
 }

 // Ajouter vitesse actuelle au buffer récent
 this.recentVelocityBuffer.push(angularVelocity);

 // Garder seulement les N derniers échantillons
 if (this.recentVelocityBuffer.length > this.config.gyroRecentVelocityWindow) {
 this.recentVelocityBuffer.shift();
 }

 // Calculer vitesse moyenne récente
 if (this.recentVelocityBuffer.length === 0) {
 return this.config.gyroDeadZoneRest;
 }

 const avgRecentVelocity =
 this.recentVelocityBuffer.reduce((sum, v) => sum + v, 0) /
 this.recentVelocityBuffer.length;

 // Interpolation linéaire entre dead zone repos et mouvement
 const transitionStart = this.config.gyroDeadZoneTransitionStart;
 const transitionEnd = this.config.gyroDeadZoneTransitionEnd;

 if (avgRecentVelocity <= transitionStart) {
 // Au repos → dead zone large
 this.currentDeadZone = this.config.gyroDeadZoneRest;
 } else if (avgRecentVelocity >= transitionEnd) {
 // En mouvement → dead zone étroite
 this.currentDeadZone = this.config.gyroDeadZoneMoving;
 } else {
 // Transition progressive
 const progress = (avgRecentVelocity - transitionStart) / (transitionEnd - transitionStart);
 this.currentDeadZone = this.config.gyroDeadZoneRest +
 (this.config.gyroDeadZoneMoving - this.config.gyroDeadZoneRest) * progress;
 }

 return this.currentDeadZone;
 }

 /**
 * Calcule la distance entre une valeur et une plage
 * @private
 */
 _distanceToRange(value, range) {
 // Si la valeur est dans la plage, distance = 0
 if (value >= range.min && value <= range.max) {
 return 0;
 }

 // Sinon, distance = écart au bord le plus proche
 if (value < range.min) {
 return range.min - value;
 } else {
 return value - range.max;
 }
 }

 /**
 * Obtient la dead zone actuelle
 * @returns {number} Dead zone actuelle
 */
 getCurrentDeadZone() {
 return this.currentDeadZone;
 }

 /**
 * Réinitialise l'état interne du détecteur
 */
 reset() {
 this.usingDirectSignMethod = true;
 this.currentDeadZone = this.config.gyroDeadZoneRest;
 this.recentVelocityBuffer = [];
 }
}

module.exports = DirectionDetector;
