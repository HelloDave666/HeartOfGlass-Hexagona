# 🏗️ ARCHITECTURE-MODEL - Pattern Hexagonal pour Exercices

**Guide complet pour l'implémentation d'exercices suivant l'architecture hexagonale**

Version: 1.0
Date: 2025-12-06
Basé sur: RotationContinueExercise v3.8.0 (819 lignes)

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture en couches](#architecture-en-couches)
3. [Services Domaine](#services-domaine)
4. [Use Cases](#use-cases)
5. [Adapter Pattern](#adapter-pattern)
6. [Guide d'implémentation](#guide-dimplémentation)
7. [Checklist intégration](#checklist-intégration)
8. [Exemple complet](#exemple-complet)

---

## 🎯 Vue d'ensemble

### Objectifs

L'architecture hexagonale (Ports & Adapters) vise à :

- ✅ **Séparer les responsabilités** : UI ≠ Business Logic ≠ Infrastructure
- ✅ **Faciliter les tests** : Logique métier testable indépendamment
- ✅ **Réduire la complexité** : Fichiers plus petits, plus maintenables
- ✅ **Réutiliser le code** : Services partagés entre exercices
- ✅ **Scalabilité** : Ajout facile de nouveaux exercices

### Résultats sur RotationContinueExercise

**Avant refactoring:**
- 1 fichier monolithique : 1021 lignes
- Toute la logique mélangée (UI + métier + état)
- Difficile à tester et maintenir

**Après refactoring:**
- Adapter : 819 lignes (-202 lignes, -19.8%)
- 8 Services Domaine : ~800 lignes (réutilisables)
- 1 Use Case : 469 lignes (orchestration)
- **Total code mieux organisé et maintenable**

---

## 📐 Architecture en couches

```
┌─────────────────────────────────────────────────────────────┐
│                    ADAPTER (UI Layer)                        │
│                                                              │
│  RotationContinueExercise.js (819 lignes)                   │
│  ├── Lifecycle: start(), stop()                             │
│  ├── Event Routing: update(sensorData, position)            │
│  ├── I/O: _sendAudioCommand(), _notifyUI()                  │
│  └── Délégation → Use Case + Services                       │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ↓ Délègue à
┌─────────────────────────────────────────────────────────────┐
│              USE CASE (Orchestration Layer)                  │
│                                                              │
│  ProcessSensorUpdateUseCase.js (469 lignes)                 │
│  ├── processRightSensor() - Valide et traite capteur        │
│  ├── updateDirection() - Détecte changement direction       │
│  └── calculateAudioCommand() - Calcule commande audio       │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ↓ Utilise
┌─────────────────────────────────────────────────────────────┐
│              SERVICES DOMAINE (Business Logic)               │
│                                                              │
│  BufferManager.js (98 lignes)                               │
│  ├── addSample() - Gestion fenêtre glissante                │
│  └── hasEnoughSamples() - Validation                        │
│                                                              │
│  ExerciseStateManager.js (185 lignes)                       │
│  ├── createInitialState() - État initial complet            │
│  ├── resetState() - Réinitialisation                        │
│  └── applyInitialState() / applyResetState()                │
│                                                              │
│  RepositioningDetector.js (110 lignes)                      │
│  └── detectRepositioning() - Détection reposition main      │
│                                                              │
│  DirectionDetector.js (~150 lignes)                         │
│  ├── detectDirection() - Consensus calibré                  │
│  ├── checkConsensusStability() - Validation                 │
│  └── updateDynamicDeadZone() - Dead zone adaptative         │
│                                                              │
│  SensorAnalyzer.js (~120 lignes)                            │
│  ├── calculateAngularVelocity() - Calcul vitesse            │
│  ├── calculateVelocityVariance() - Variance                 │
│  └── calculateAngularAcceleration() - Accélération          │
│                                                              │
│  PlaybackCalculator.js (~100 lignes)                        │
│  ├── calculateTargetRate() - Mapping vitesse → rate         │
│  ├── smoothPlaybackRate() - Lissage adaptatif               │
│  └── calculateAdaptiveSmoothingFactor() - Facteur lissage   │
│                                                              │
│  VolumeController.js (~90 lignes)                           │
│  ├── updateCumulativeAngle() - Angle cumulé                 │
│  ├── calculateVolumeFromAngle() - Mapping angle → volume    │
│  ├── smoothVolume() - Lissage                               │
│  └── snapToEdges() - Snap aux limites                       │
│                                                              │
│  ExerciseMetrics.js (~150 lignes)                           │
│  ├── calculateVelocityStats() - Stats vélocité              │
│  ├── countDirections() - Comptage directions                │
│  ├── countRepositions() - Comptage repositions              │
│  └── calculateStats() - Statistiques complètes              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Services Domaine

### Principe

Chaque service a **une responsabilité unique** (Single Responsibility Principle).

### Types de services

#### 1. Services de Gestion d'État

**Exemple: BufferManager**
- **Responsabilité** : Gérer les buffers de données (fenêtre glissante)
- **Méthodes** : addSample(), hasEnoughSamples()
- **Avantages** : Logique de buffer centralisée, réutilisable

**Exemple: ExerciseStateManager**
- **Responsabilité** : Gérer l'état de l'exercice
- **Méthodes** : createInitialState(), resetState(), applyResetState()
- **Avantages** : Élimine duplication constructor/start()

#### 2. Services de Détection

**Exemple: DirectionDetector**
- **Responsabilité** : Détecter changement de direction
- **Méthodes** : detectDirection(), checkConsensusStability()
- **Avantages** : Logique complexe isolée, testable

**Exemple: RepositioningDetector**
- **Responsabilité** : Détecter repositionnement main
- **Méthodes** : detectRepositioning()
- **Avantages** : Machine à états claire, événements structurés

#### 3. Services de Calcul

**Exemple: SensorAnalyzer**
- **Responsabilité** : Analyser données capteurs
- **Méthodes** : calculateAngularVelocity(), calculateVariance()
- **Avantages** : Calculs mathématiques réutilisables

**Exemple: PlaybackCalculator**
- **Responsabilité** : Calculer paramètres audio
- **Méthodes** : calculateTargetRate(), smoothPlaybackRate()
- **Avantages** : Mapping et lissage centralisés

#### 4. Services de Contrôle

**Exemple: VolumeController**
- **Responsabilité** : Contrôler le volume audio
- **Méthodes** : calculateVolumeFromAngle(), smoothVolume()
- **Avantages** : Logique volume isolée

#### 5. Services de Métriques

**Exemple: ExerciseMetrics**
- **Responsabilité** : Calculer statistiques exercice
- **Méthodes** : calculateStats(), countDirections()
- **Avantages** : Analytics centralisées

### Pattern de Service

```javascript
/**
 * MonService.js
 *
 * Responsabilité : [Description claire]
 *
 * Architecture: Core/Domain/Services
 */

class MonService {
  constructor(config) {
    this.config = config;
  }

  /**
   * Méthode principale
   *
   * @param {Object} input - Données d'entrée
   * @returns {Object} Résultat structuré
   */
  maMethode(input) {
    // 1. VALIDATION
    if (!this._validate(input)) {
      return { error: 'INVALID_INPUT' };
    }

    // 2. TRAITEMENT
    const result = this._process(input);

    // 3. RETOUR STRUCTURÉ
    return {
      success: true,
      data: result,
      metadata: { ... }
    };
  }

  /**
   * Méthodes privées
   * @private
   */
  _validate(input) { ... }
  _process(input) { ... }
}

module.exports = MonService;
```

---

## 🎯 Use Cases

### Principe

Le Use Case **orchestre** les services pour accomplir un cas d'utilisation métier.

### Responsabilités

1. **Coordination** : Appelle les bons services dans le bon ordre
2. **Transformation** : Convertit données UI → domaine → UI
3. **Gestion erreurs** : Gère les erreurs de manière centralisée
4. **Business rules** : Applique les règles métier

### Pattern Use Case

```javascript
/**
 * MonUseCase.js
 *
 * Use Case: [Description du cas d'utilisation]
 *
 * Architecture: Core/UseCases
 */

class MonUseCase {
  constructor({ service1, service2, config }) {
    this.service1 = service1;
    this.service2 = service2;
    this.config = config;
  }

  /**
   * Exécute le cas d'utilisation
   *
   * @param {Object} input - Données d'entrée
   * @returns {Object} Résultat avec métadonnées
   */
  execute(input) {
    // 1. VALIDATION via service
    const validation = this.service1.validate(input);
    if (!validation.isValid) {
      return { shouldSkip: true, reason: validation.reason };
    }

    // 2. TRAITEMENT via services
    const result1 = this.service1.process(input);
    const result2 = this.service2.process(result1);

    // 3. RETOUR STRUCTURÉ
    return {
      shouldSkip: false,
      data: result2,
      stateUpdates: { ... },
      events: [ ... ]
    };
  }
}

module.exports = MonUseCase;
```

### Exemple: ProcessSensorUpdateUseCase

```javascript
class ProcessSensorUpdateUseCase {
  constructor({ directionDetector, sensorAnalyzer, playbackCalculator, config }) {
    this.directionDetector = directionDetector;
    this.sensorAnalyzer = sensorAnalyzer;
    this.playbackCalculator = playbackCalculator;
    this.config = config;
  }

  // Cas d'utilisation 1: Mettre à jour la direction
  updateDirection(input) {
    const { gyroY, now, state } = input;

    // Orchestration des services
    const candidateDirection = this.directionDetector.detectDirection(
      state.signedDeltaBuffer,
      calibrationOrchestrator
    );

    const isStable = this.directionDetector.checkConsensusStability(
      state.directionConsensusHistory,
      candidateDirection
    );

    // Business logic
    if (!isStable) {
      return { directionChanged: false, stateUpdates: { ... } };
    }

    // Retour structuré
    return {
      directionChanged: true,
      oldDirection: state.currentDirection,
      newDirection: candidateDirection,
      stateUpdates: { ... }
    };
  }

  // Cas d'utilisation 2: Calculer commande audio
  calculateAudioCommand(input) { ... }

  // Cas d'utilisation 3: Traiter capteur
  processRightSensor(input) { ... }
}
```

---

## 🎨 Adapter Pattern

### Principe

L'Adapter est la **couche UI** qui :
- Reçoit les événements (capteurs, UI)
- Délègue au Use Case
- Envoie les commandes (audio, UI)

### Responsabilités LIMITÉES

✅ **CE QUE L'ADAPTER DOIT FAIRE :**
- Lifecycle (start, stop)
- Event routing (update)
- I/O (sendCommand, notifyUI)
- State management (via StateManager)
- Orchestration de haut niveau

❌ **CE QUE L'ADAPTER NE DOIT PAS FAIRE :**
- Calculs métier (→ Services)
- Détections complexes (→ Services)
- Orchestration métier (→ Use Case)
- Logique réutilisable (→ Services)

### Pattern Adapter

```javascript
class MonExerciseAdapter extends Exercise {
  constructor({ audioOrchestrator, state, calibrationOrchestrator }) {
    super({ name: 'Mon Exercice', duration: 60000 });

    // 1. DÉPENDANCES EXTERNES (I/O)
    this.audioOrchestrator = audioOrchestrator;
    this.state = state;
    this.calibrationOrchestrator = calibrationOrchestrator;

    // 2. CONFIGURATION
    this.config = monExerciceConfig;

    // 3. SERVICES DOMAINE
    this.service1 = new Service1(this.config);
    this.service2 = new Service2(this.config);
    this.stateManager = new ExerciseStateManager(this.config);

    // 4. USE CASE
    this.monUseCase = new MonUseCase({
      service1: this.service1,
      service2: this.service2,
      config: this.config
    });

    // 5. ÉTAT (via StateManager)
    this.checkIntervalId = null;
    this.originalAudioParams = null;

    // Déclaration propriétés gérées par StateManager
    this.propriete1 = null;
    this.propriete2 = null;

    // Initialisation via StateManager
    this.stateManager.applyInitialState(this);
  }

  /**
   * Démarre l'exercice
   */
  start() {
    if (this.isActive) return false;

    // 1. LOGS & VALIDATION
    console.log('[MonExercice] Démarrage...');

    // 2. SETUP AUDIO
    this.audioOrchestrator.setGrainSize(this.audioSettings.grainSize);

    // 3. RÉINITIALISATION ÉTAT (via StateManager)
    this.isActive = true;
    this.startTime = Date.now();
    this.stateManager.applyResetState(this);

    // 4. DÉMARRAGE
    this.audioOrchestrator.togglePlayPause();
    this._startMonitoring();
    this._notifyUI('EXERCISE_STARTED');

    return true;
  }

  /**
   * Arrête l'exercice
   */
  stop() {
    if (!this.isActive) return false;

    // 1. ARRÊT
    this.isActive = false;
    this._stopMonitoring();

    // 2. STATISTIQUES (via Service)
    const stats = this.metricsService.calculateStats(this.data);

    // 3. CLEANUP
    this.audioOrchestrator.togglePlayPause();
    this._notifyUI('EXERCISE_STOPPED', stats);

    return true;
  }

  /**
   * Traite mise à jour capteur
   */
  update(sensorData, position) {
    if (!this.isActive) return;

    const now = Date.now();

    // 1. EXTRACTION DONNÉES
    const { angles, gyro } = sensorData;

    // 2. DÉLÉGATION AU USE CASE
    const result = this.monUseCase.execute({
      angles,
      gyro,
      now,
      state: this._getState()
    });

    // 3. APPLICATION RÉSULTATS
    if (result.shouldSkip) return;

    this._applyStateUpdates(result.stateUpdates);
    this._handleEvents(result.events);

    // 4. I/O
    this._sendAudioCommand(result.command);
    this._notifyUI('UPDATE', result.uiData);
  }

  /**
   * Méthodes I/O privées
   * @private
   */
  _sendAudioCommand(command) { ... }
  _notifyUI(eventType, data) { ... }
  _getState() { ... }
  _applyStateUpdates(updates) { ... }
}
```

---

## 📝 Guide d'implémentation

### Étape 1: Analyser l'exercice existant

1. Identifier la logique métier
2. Identifier les calculs réutilisables
3. Identifier les détections/validations
4. Identifier l'état à gérer

### Étape 2: Extraire les Services

Pour chaque responsabilité identifiée :

```bash
# Créer le service
src/core/domain/services/MonService.js

# Structure
class MonService {
  constructor(config) { ... }
  maMethode(input) { ... }
}
```

### Étape 3: Créer le Use Case

```bash
# Créer le use case
src/core/useCases/MonUseCase.js

# Structure
class MonUseCase {
  constructor({ services, config }) { ... }
  execute(input) { ... }
}
```

### Étape 4: Refactorer l'Adapter

1. Importer services et use case
2. Instancier dans constructor
3. Déléguer dans update()
4. Supprimer méthodes obsolètes
5. Garder uniquement I/O et lifecycle

### Étape 5: Tester

1. Tests unitaires services
2. Tests intégration use case
3. Tests E2E adapter
4. Tests physiques capteurs

---

## ✅ Checklist intégration

### Phase 1: Préparation
- [ ] Analyser exercice existant
- [ ] Identifier responsabilités
- [ ] Lister services nécessaires
- [ ] Définir use case(s)

### Phase 2: Extraction Services
- [ ] Créer ExerciseStateManager
- [ ] Créer services détection
- [ ] Créer services calcul
- [ ] Créer services contrôle
- [ ] Créer service métriques

### Phase 3: Use Case
- [ ] Créer Use Case principal
- [ ] Implémenter orchestration
- [ ] Gérer erreurs
- [ ] Retourner résultats structurés

### Phase 4: Adapter
- [ ] Importer services + use case
- [ ] Instancier dans constructor
- [ ] Utiliser StateManager
- [ ] Déléguer à use case
- [ ] Supprimer code obsolète
- [ ] Conserver uniquement I/O

### Phase 5: Tests
- [ ] Tests unitaires services ✅
- [ ] Tests use case ✅
- [ ] Tests adapter ✅
- [ ] Tests physiques capteurs ✅

### Phase 6: Documentation
- [ ] Commenter code
- [ ] Documenter APIs
- [ ] Mettre à jour README

---

## 🎯 Exemple complet

Voir **RotationContinueExercise** comme référence complète :

```
HeartOfGlass/
├── src/
│   ├── adapters/primary/ui/exercises/
│   │   └── RotationContinueExercise.js (819 lignes - ADAPTER)
│   │
│   ├── core/
│   │   ├── domain/services/
│   │   │   ├── BufferManager.js (98 lignes)
│   │   │   ├── ExerciseStateManager.js (185 lignes)
│   │   │   ├── RepositioningDetector.js (110 lignes)
│   │   │   ├── DirectionDetector.js (~150 lignes)
│   │   │   ├── SensorAnalyzer.js (~120 lignes)
│   │   │   ├── PlaybackCalculator.js (~100 lignes)
│   │   │   ├── VolumeController.js (~90 lignes)
│   │   │   └── ExerciseMetrics.js (~150 lignes)
│   │   │
│   │   └── useCases/
│   │       └── ProcessSensorUpdateUseCase.js (469 lignes)
│   │
│   └── ...
```

---

## 🚀 Avantages du pattern

### 1. Maintenabilité ⭐⭐⭐⭐⭐
- Code organisé par responsabilité
- Fichiers plus petits (<200 lignes/service)
- Facile à comprendre et modifier

### 2. Testabilité ⭐⭐⭐⭐⭐
- Services testables unitairement
- Use case testable sans UI
- Mocks faciles (injection dépendances)

### 3. Réutilisabilité ⭐⭐⭐⭐⭐
- Services partagés entre exercices
- Logique métier réutilisable
- Pas de duplication

### 4. Scalabilité ⭐⭐⭐⭐⭐
- Ajout facile nouveaux exercices
- Extension services existants
- Architecture extensible

### 5. Qualité Code ⭐⭐⭐⭐⭐
- Single Responsibility Principle
- Dependency Injection
- Separation of Concerns

---

## 📚 Ressources

- **Code source**: RotationContinueExercise.js
- **Diagnostic**: DIAGNOSTIC-ARCHITECTURE.md
- **Tests**: test-process-sensor-usecase-v3.7.0.js
- **Template**: ExerciseTemplate.js (à venir)

---

**Version 1.0** - Document créé après refactoring complet RotationContinueExercise
**Réduction**: 1021 → 819 lignes (-202 lignes, -19.8%)
**Services**: 8 services domaine + 1 use case
**Architecture**: Hexagonale (Ports & Adapters)

🤖 Generated with Claude Code
