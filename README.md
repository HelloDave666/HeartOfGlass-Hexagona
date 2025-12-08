@'
# Heart of Glass 2.0

Application ludopedagogique utilisant des capteurs IMU BWT901BLECL5 avec synthese audio granulaire.

## Architecture

Ce projet utilise une architecture hexagonale (Ports & Adapters) pour une meilleure modularite et maintenabilite.

### Structure
- **src/core/** : Domaine metier (logique pure)
- **src/adapters/** : Implementations des interfaces
- **src/infrastructure/** : Configuration et services techniques
- **src/shared/** : Code partage

## Installation

```bash
npm install