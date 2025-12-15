# Miniatures de Vidéos

Ce dossier contient les miniatures (thumbnails) des vidéos affichées dans la bibliothèque vidéo.

## Format des Miniatures

- **Résolution** : 1280x720 pixels (ratio 16:9)
- **Format** : JPG ou PNG
- **Poids** : < 500 KB recommandé
- **Qualité** : JPEG quality 80-85 recommandé

## Nommage

Les miniatures doivent avoir le même nom que leur vidéo associée :
- `intro-rita.jpg` → pour `intro-rita.mp4`
- `capteurs-basics.jpg` → pour `capteurs-basics.mp4`
- etc.

## Créer une Miniature depuis une Vidéo

Avec FFmpeg, vous pouvez extraire un frame de la vidéo :

```bash
# Extraire le frame à 5 secondes
ffmpeg -i ../ma-video.mp4 -ss 00:00:05 -vframes 1 -vf scale=1280:720 ma-video.jpg

# Extraire le frame à un temps spécifique avec qualité optimisée
ffmpeg -i ../ma-video.mp4 -ss 00:00:08 -vframes 1 -vf scale=1280:720 -q:v 2 ma-video.jpg
```

## Fallback

Si une miniature n'est pas trouvée, le système affichera automatiquement :
- Une icône de livre pour les vidéos de type `story`
- Une icône de graduation pour les vidéos de type `tutorial`
