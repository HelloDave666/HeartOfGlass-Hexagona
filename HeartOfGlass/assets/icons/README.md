# Icônes Personnalisées - Fool of Craft

Ce dossier contient les icônes personnalisées pour l'interface de Fool of Craft.

## Structure des Icônes

### Icônes du Tutoriel

Les icônes suivantes sont utilisées dans le modal tutoriel de configuration des capteurs :

#### 1. Icône Principale du Tutoriel
- **Classe CSS** : `.tutorial-icon-main`
- **Dimensions** : 80x80px
- **Usage** : Header du modal tutoriel
- **Fichier recommandé** : `tutorial-main.svg` ou `tutorial-main.png`
- **Description** : Icône représentant l'aide/tutoriel général

#### 2. Icône Bluetooth/Connexion (Étape 1)
- **Classe CSS** : `.step-icon-bluetooth`
- **Dimensions** : 60x60px
- **Couleur de bordure** : Bleu (rgba(33, 150, 243, 0.5))
- **Fichier recommandé** : `step-bluetooth.svg`
- **Description** : Représente la connexion Bluetooth aux capteurs IMU

#### 3. Icône Calibration (Étape 2)
- **Classe CSS** : `.step-icon-calibration`
- **Dimensions** : 60x60px
- **Couleur de bordure** : Orange (rgba(255, 152, 0, 0.5))
- **Fichier recommandé** : `step-calibration.svg`
- **Description** : Représente la calibration/précision des capteurs

#### 4. Icône Audio (Étape 3)
- **Classe CSS** : `.step-icon-audio`
- **Dimensions** : 60x60px
- **Couleur de bordure** : Violet (rgba(156, 39, 176, 0.5))
- **Fichier recommandé** : `step-audio.svg`
- **Description** : Représente le chargement et la manipulation audio

#### 5. Icône Exploration (Étape 4)
- **Classe CSS** : `.step-icon-explore`
- **Dimensions** : 60x60px
- **Couleur de bordure** : Vert (rgba(76, 175, 80, 0.5))
- **Fichier recommandé** : `step-explore.svg`
- **Description** : Représente l'exploration sonore et les gestes

#### 6. Icône Astuce/Info (Footer)
- **Classe CSS** : `.footer-icon-placeholder`
- **Dimensions** : 50x50px
- **Fichier recommandé** : `tip-icon.svg`
- **Description** : Icône pour les astuces et informations complémentaires

### Icônes des Catégories d'Artisanat

À venir : Icônes pour Verrerie, Céramique, Tapisserie

## Format Recommandé

### SVG (Préféré)
- **Avantages** : Scalable, petite taille de fichier, modifiable
- **Format** : SVG optimisé (SVGO)
- **Palette** : Tons amber (#FFB74D) et violet (#667eea) pour cohérence

### PNG (Alternatif)
- **Résolution** : 2x la taille affichée (pour Retina)
  - Icônes 80x80 → PNG de 160x160px
  - Icônes 60x60 → PNG de 120x120px
  - Icônes 50x50 → PNG de 100x100px
- **Format** : PNG-24 avec transparence
- **Optimisation** : Utiliser TinyPNG ou ImageOptim

## Comment Remplacer les Icônes

### Méthode 1 : Remplacement CSS (Recommandé pour SVG inline)

Dans `FoolOfCraftUIController.js`, modifiez les placeholders :

```javascript
// Au lieu de :
<div class="step-icon-placeholder step-icon-bluetooth">
  <span class="icon-temp">📡</span>
</div>

// Utilisez :
<div class="step-icon-placeholder step-icon-bluetooth">
  <svg><!-- votre SVG inline --></svg>
</div>
```

### Méthode 2 : Images externes

Dans `FoolOfCraftUIController.js`, modifiez les placeholders :

```javascript
<div class="step-icon-placeholder step-icon-bluetooth">
  <img src="../../../../../assets/icons/step-bluetooth.svg" alt="Bluetooth">
</div>
```

### Méthode 3 : CSS Background (Pour simplicité)

Dans le fichier CSS du contrôleur, ajoutez :

```css
.step-icon-bluetooth {
  background-image: url('../../../../../assets/icons/step-bluetooth.svg');
  background-size: 40px 40px;
  background-position: center;
  background-repeat: no-repeat;
}

/* Masquer l'icône temporaire */
.step-icon-bluetooth .icon-temp {
  display: none;
}
```

## Directives de Design

### Style Visuel
- **Minimaliste** : Formes simples et reconnaissables
- **Cohérent** : Épaisseur de trait uniforme (2-3px)
- **Palette** : Utiliser les couleurs de la charte
  - Amber : #FFB74D (artisanat, chaleur)
  - Violet : #667eea (technologie, son)
  - Dégradés subtils acceptés

### Inspiration
- Style line art / contour
- Inspiré des pictogrammes de métiers d'art
- Mélange d'artisanat traditionnel et technologie moderne

### Icônes Spécifiques

#### Bluetooth/Connexion
- Suggestions : Ondes radio, signal Bluetooth stylisé, capteurs connectés
- Éviter : Logo Bluetooth classique (trop générique)

#### Calibration
- Suggestions : Cible avec précision, geste calibré, balance/équilibre
- Éviter : Outils mécaniques classiques

#### Audio
- Suggestions : Forme d'onde stylisée, grain sonore, vibration
- Éviter : Haut-parleur classique (trop évident)

#### Exploration
- Suggestions : Geste artistique, mains en action, spirale créative
- Éviter : Loupe/recherche (pas adapté au contexte)

## Checklist de Remplacement

- [ ] Créer/obtenir les 6 icônes principales
- [ ] Optimiser les fichiers (SVGO pour SVG, TinyPNG pour PNG)
- [ ] Placer les fichiers dans `/assets/icons/`
- [ ] Modifier `FoolOfCraftUIController.js` pour intégrer les icônes
- [ ] Optionnellement masquer `.icon-temp` via CSS
- [ ] Tester l'affichage dans différentes résolutions
- [ ] Vérifier la cohérence visuelle de l'ensemble

## Notes

- Les emojis actuels (📚 📡 🎯 🔊 🎭 💡) servent de placeholder temporaire
- Ils seront automatiquement masqués quand vous ajouterez vos icônes personnalisées
- Conservez les classes CSS existantes pour assurer la compatibilité
