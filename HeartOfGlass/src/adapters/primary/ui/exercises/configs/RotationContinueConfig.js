/**
 * Configuration de l'exercice Rotation Continue
 *
 * Ce fichier centralise tous les paramètres de configuration pour l'exercice
 * RotationContinueExercise, facilitant les ajustements et la maintenance.
 */

/**
 * Configuration principale de l'exercice
 */
const exerciseConfig = {
 targetSpeed: 360, // 1 tour par seconde (référence pour 1.0x)

 duration: 300000, // 5 minutes
 checkInterval: 100,
 smoothingFactor: 0.65, // v3.3 : Lissage encore réduit (0.65 vs 0.70) → ultra-réactif

 // Paramètres fenêtre glissante
 samplingWindow: 4000, // Fenêtre glissante (4s)
 minSamplesForDecision: 5, // v3.3 : Réduit de 6 à 5 → réaction instantanée

 // Limites playback rate
 minPlaybackRate: 0.25, // Vitesse minimale (0.25x = 90°/s)
 maxPlaybackRate: 2.0, // Vitesse maximale (2.0x = 720°/s)

 // Validation dt robuste
 minValidDt: 0.01,
 maxValidDt: 0.2,

 // Repositionnement
 repositionThreshold: 10,
 repositionMinDuration: 200,
 repositionMaxDuration: 2500,
 freezePlaybackDuringReposition: false, // [NEW] v3.4 : Désactivé pour éviter sauts à 1.0x pendant rotations lentes

 // v3.2 : Détection direction ULTRA-RÉACTIVE
 directionWindowSize: 8, // 8 échantillons (~240ms à 30Hz) vs 15
 directionChangeThreshold: 0.65, // 65% des deltas (vs 70%) → plus sensible
 directionStabilityTime: 100, // v3.5 : 100ms (vs 200ms) → détection 2x plus rapide pour 0.30-0.50x

 // [NEW] v3.5.5 : SOLUTION 3 - Buffer de confirmation consensus
 directionConsensusConfirmationFrames: 3, // Nombre de frames consécutives pour confirmer changement (90-150ms à 30Hz)
 directionConsensusConfirmationEnabled: false, // 🔴 DÉSACTIVÉ - Trop de lag

 // v3.5 : Anti-oscillation ULTRA-RÉDUIT pour changements rapides à vitesse moyenne
 directionChangeLockTime: 100, // v3.5 : 100ms (vs 300ms) → changements 3x plus rapides
 directionZeroCrossingReset: true, // v3.5 : Réinitialiser lock si passage par zéro détecté
 directionZeroCrossingThreshold: 10, // Seuil vitesse pour considérer "passage par zéro" (°/s)

 // [NEW] Transition douce lors changement de direction (anti-artefacts audio)
 directionTransitionDuration: 250, // Durée transition 250ms pour éviter les sautes
 directionTransitionSpeedFactor: 0.4, // Réduire à 40% de la vitesse pendant transition

 // v3.3 : Lissage adaptatif dynamique ultra-réactif
 adaptiveSmoothingEnabled: true, // Activer lissage adaptatif
 baseSmoothingFactor: 0.55, // v3.3 : Lissage minimal réduit (0.55 vs 0.60) → mouvement régulier TRÈS réactif
 maxSmoothingFactor: 0.80, // v3.3 : Lissage maximal réduit (0.80 vs 0.85) → mouvement irrégulier plus fluide
 varianceThreshold: 60, // v3.3 : Seuil augmenté (60 vs 50) → tolérance accrue

 // [NEW] v3.2 : IDÉE 2 - Détection prédictive par accélération
 predictiveDetectionEnabled: true, // Activer détection prédictive
 accelerationThreshold: 800, // Seuil d'accélération angulaire (°/s²)
 earlyDetectionBonus: 150, // Réduction du temps de stabilité si accélération détectée (ms)

 // [NEW] PHASE D : Calibration interactive guidée
 calibrationRestDuration: 4000, // 4s repos pour mesurer bruit de fond
 calibrationStepDuration: 6000, // 6s par rotation (horaire + antihoraire)
 calibrationMinSamples: 30, // Minimum 30 échantillons par phase (~1s à 30Hz)

 // v3.4 : Contrôle de volume POTENTIOMÈTRE avec capteur GAUCHE
 volumeControlEnabled: true, // Activer contrôle volume capteur gauche
 volumeCenterAngle: 0, // Position centrale (0°) = 50% volume
 volumeRightZoneEnd: 90, // Butée droite (90°) = 100% volume (rotation horaire)
 volumeLeftZoneStart: 270, // Butée gauche (270° ou -90°) = 0% volume (rotation antihoraire)
 volumeDeadZoneStart: 90, // Début zone morte (90° à 270°)
 volumeDeadZoneEnd: 270, // Fin zone morte
 volumeSmoothingFactor: 0.75, // [NEW] v3.4.1 : Lissage augmenté (0.75 vs 0.45) → affichage stable
 volumeInitialValue: 0.5, // Volume initial au démarrage (50%)
 leftSensorInverted: true, // Capteur gauche inversé (main opposée)
 volumeGyroDeadZone: 3, // [NEW] v3.4.1 : Ignorer gyro < 3°/s (micro-mouvements au repos)
 volumeRestThreshold: 5, // [NEW] v3.4.1 : Seuil repos capteur (< 5°/s)
 volumeRestDuration: 1000, // [NEW] v3.4.1 : Durée repos avant reset angle (1s)
 volumeUIUpdateThreshold: 0.02, // [NEW] v3.4.1 : Mise à jour UI si changement > 2%

 // v3.5 : AMÉLIORATION #1 - Dead zone gyro DYNAMIQUE (capteur droit - vitesse)
 gyroDeadZoneDynamic: true, // Activer dead zone dynamique
 gyroDeadZoneRest: 3.0, // Dead zone au repos (°/s) - large pour ignorer bruit
 gyroDeadZoneMoving: 0.5, // Dead zone en mouvement (°/s) - étroite pour micro-mouvements
 gyroDeadZoneTransitionStart: 10, // Début transition (°/s) - considéré "au repos" en dessous
 gyroDeadZoneTransitionEnd: 30, // Fin transition (°/s) - considéré "en mouvement" au-dessus
 gyroRecentVelocityWindow: 10, // Nombre d'échantillons pour vitesse moyenne récente

 // v3.5 : AMÉLIORATION #2 - Seuil détection direction RÉDUIT
 directionDetectionMinVelocity: 1.5, // [NEW] Seuil minimal pour détecter direction (1.5°/s vs 5°/s)
 // Permet détection lors de micro-mouvements lents

 // v3.5 : AMÉLIORATION #4 - Ratio séparation ADAPTATIF selon vitesse
 directionSeparationRatioAdaptive: true, // Activer ratio adaptatif
 directionSeparationRatioLow: 1.5, // Ratio permissif à basse vitesse (< 50°/s)
 directionSeparationRatioMid: 1.8, // Ratio moyen à vitesse moyenne (50-200°/s) - pour 0.30-0.50x
 directionSeparationRatioHigh: 2.5, // Ratio strict à haute vitesse (> 200°/s)
 directionSeparationVelocityLow: 50, // Seuil vitesse basse (°/s)
 directionSeparationVelocityHigh: 200, // Seuil vitesse haute (°/s)

 // v3.5 : AMÉLIORATION #6 - Méthode HYBRIDE détection direction
 directionHybridMethod: true, // Activer méthode hybride
 directionDirectSignThresholdLow: 180, // Seuil bas : descendre → méthode directe
 directionDirectSignThresholdHigh: 9999 // [NEW] v3.5.2 : Désactivé (9999) → Méthode DIRECTE partout
 // (évite conflits entre méthodes qui causent snap à 1.00x)
};

/**
 * Configuration audio (synthèse granulaire)
 */
const audioSettings = {
 grainSize: 160,
 overlap: 77
};

module.exports = {
 exerciseConfig,
 audioSettings
};
