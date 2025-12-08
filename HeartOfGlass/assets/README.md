# Assets - Ressources de l'Application

Ce dossier contient les ressources visuelles et médias de l'application.

## Splash Screen d'Introduction

**Fichier requis** : `intro-splash.gif` (ou `.png`, `.jpg`)

### Spécifications
- **Format recommandé** : GIF animé (supporte aussi PNG, JPG)
- **Résolution** : 1920x1080 pixels
- **Durée animation** : Boucle continue (le splash s'affiche 4 secondes par défaut)
- **Poids** : Optimisé pour web (< 5MB recommandé)

### Placement
Placez votre image d'introduction ici :
```
HeartOfGlass/
  assets/
    intro-splash.gif  ← Votre image ici
```

### Fonctionnement
- L'image s'affiche automatiquement au lancement de l'application
- Durée d'affichage : **4 secondes** (configurable dans `app.js`)
- L'utilisateur peut **skip** en cliquant ou en pressant Espace/Enter/Escape
- Transition fade-out douce (0.8s)

### Configuration

Pour modifier les paramètres du splash screen, éditez `src/adapters/primary/ui/app.js` :

```javascript
const splashScreen = new SplashScreenController({
  imagePath: path.join(projectRoot, 'assets', 'intro-splash.gif'),
  duration: 4000,    // Durée en millisecondes
  skippable: true    // Permet de skip (true/false)
});
```

### Création d'un GIF animé

**Outils recommandés** :
- **Photoshop** : Exportation → Save for Web → GIF
- **GIMP** : Fichier → Exporter comme → GIF
- **Online** : ezgif.com, giphy.com

**Conseils** :
- Utilisez une boucle infinie
- Optimisez le nombre de couleurs (64-128 couleurs suffit)
- Compression adaptative pour réduire la taille
- Frame rate : 10-15 FPS suffisant pour intro

### Image Placeholder

Si vous n'avez pas encore d'image, vous pouvez créer un placeholder temporaire :

1. Créez une image 1920x1080 noire avec le titre "Heart of Glass"
2. Ou utilisez un dégradé violet/bleu (thème de l'app)
3. Nommez-la `intro-splash.png`

L'application fonctionnera sans image mais affichera un fond noir.
