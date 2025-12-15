# Bibliothèque de Vidéos - Heart of Glass

Ce dossier contient les vidéos narratives et tutorielles pour l'interface Heart of Glass.

## Structure du Dossier

```
assets/videos/
├── README.md
├── thumbnails/           # Miniatures des vidéos (format JPG/PNG recommandé)
│   ├── intro-rita.jpg
│   ├── capteurs-basics.jpg
│   ├── station-tour.jpg
│   └── rotation-guide.jpg
├── intro-rita.mp4        # Vidéo d'introduction de Rita
├── capteurs-basics.mp4   # Tutoriel configuration capteurs
├── station-tour.mp4      # Visite de la station spatiale
└── rotation-guide.mp4    # Guide exercice de rotation
```

## Format des Vidéos

### Formats Supportés
- **MP4** (H.264/H.265) - Recommandé
- **WebM** (VP8/VP9)
- **OGG** (Theora)

### Spécifications Recommandées
- **Résolution**: 1920x1080 (Full HD) ou 1280x720 (HD)
- **Ratio**: 16:9
- **Codec vidéo**: H.264
- **Codec audio**: AAC
- **Bitrate vidéo**: 2-5 Mbps
- **Framerate**: 30 fps

## Miniatures (Thumbnails)

Les miniatures doivent être placées dans le dossier `thumbnails/` :
- **Format**: JPG ou PNG
- **Résolution**: 1280x720 pixels (16:9)
- **Poids**: < 500 KB recommandé

Si une miniature n'est pas trouvée, une icône de remplacement sera affichée automatiquement.

## Configuration des Vidéos

Les vidéos sont configurées dans le fichier :
`HeartOfGlass/src/adapters/primary/ui/controllers/HeartOfGlassUIController.js`

Dans la méthode `_renderVideoLibrary()`, vous trouverez le tableau de configuration :

```javascript
const videos = [
  {
    id: 'intro-rita',                    // Identifiant unique
    title: 'Introduction : Rencontrez Rita',  // Titre affiché
    description: 'Découvrez qui est Rita et son compagnon Echo',
    thumbnail: '../../../../../assets/videos/thumbnails/intro-rita.jpg',
    videoPath: '../../../../../assets/videos/intro-rita.mp4',
    category: 'story',                   // 'story' ou 'tutorial'
    duration: '2:30'                     // Durée affichée
  },
  // ... autres vidéos
];
```

## Catégories de Vidéos

### Histoire (`story`)
Vidéos narratives sur Rita, Echo et l'univers de Heart of Glass :
- Introduction des personnages
- Exploration de la station spatiale
- Éléments d'histoire et de contexte
- Badge couleur : Amber (orange/doré)

### Tutoriel (`tutorial`)
Vidéos pédagogiques pour apprendre à utiliser l'application :
- Configuration et calibration des capteurs
- Guides des exercices
- Instructions techniques
- Badge couleur : Violet/bleu

## Ajouter une Nouvelle Vidéo

1. **Placer les fichiers** :
   - Vidéo dans `assets/videos/`
   - Miniature dans `assets/videos/thumbnails/`

2. **Ajouter la configuration** dans `HeartOfGlassUIController.js` :

```javascript
{
  id: 'ma-nouvelle-video',
  title: 'Titre de la Vidéo',
  description: 'Description courte',
  thumbnail: '../../../../../assets/videos/thumbnails/ma-nouvelle-video.jpg',
  videoPath: '../../../../../assets/videos/ma-nouvelle-video.mp4',
  category: 'story', // ou 'tutorial'
  duration: '3:45'
}
```

3. **Redémarrer l'application** pour voir la nouvelle vidéo

## Optimisation des Vidéos

Pour optimiser la taille des fichiers, vous pouvez utiliser FFmpeg :

```bash
# Encoder en H.264 avec bonne qualité et taille réduite
ffmpeg -i input.mp4 -c:v libx264 -preset slow -crf 23 -c:a aac -b:a 128k output.mp4

# Créer une miniature à partir d'une vidéo (frame à 5 secondes)
ffmpeg -i input.mp4 -ss 00:00:05 -vframes 1 -vf scale=1280:720 thumbnail.jpg
```

## Notes Importantes

- Les chemins relatifs utilisent `../../../../../assets/videos/` car ils sont calculés depuis le fichier HTML du renderer Electron
- Les vidéos sont chargées à la demande (pas de préchargement)
- Le placeholder est affiché tant qu'aucune vidéo n'est sélectionnée
- Les vidéos manquantes affichent une erreur dans la console et réaffichent le placeholder

## Thématique Visuelle

Les vidéos doivent respecter l'ambiance visuelle de Heart of Glass :
- **Palette de couleurs** : Warm amber, violets, bleus
- **Ambiance** : Station spatiale, technologie vieillissante
- **Personnages** :
  - Rita "Handy" : Sweat violet, lunettes, ~10 ans
  - Echo : Petit oiseau bleu aux yeux rouges
