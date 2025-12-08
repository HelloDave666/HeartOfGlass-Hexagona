/**
 * Script de nettoyage des émojis dans le code
 *
 * Remplace tous les émojis par du texte simple
 */

const fs = require('fs');
const path = require('path');

// Mapping émojis → texte
const emojiReplacements = {
  '🆕': '[NEW]',
  '✅': '[OK]',
  '❌': '[ERROR]',
  '⚠️': '[WARNING]',
  '🎯': '',
  '🔧': '',
  '🔊': '',
  '📊': '',
  '🎵': '',
  '🤚': '',
  '✋': '',
  '🚨': '[!]',
  '📐': '',
  '⏰': '',
  '🔄': '',
  '↻': 'CW',
  '↺': 'CCW',
  '⚡': '',
  '✓': '[OK]',
  '⚙️': '',
  '📝': '',
  '💪': '',
  '🚀': '',
  '🎉': '',
  '📦': '',
  '🏗️': '',
  '📘': '',
  '🤖': ''
};

function cleanEmojisInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Remplacer chaque émoji
    for (const [emoji, replacement] of Object.entries(emojiReplacements)) {
      if (content.includes(emoji)) {
        content = content.replace(new RegExp(emoji, 'g'), replacement);
        modified = true;
      }
    }

    // Nettoyer espaces multiples créés par suppressions
    if (modified) {
      content = content.replace(/  +/g, ' ');
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Nettoyé: ${filePath}`);
      return 1;
    }

    return 0;
  } catch (error) {
    console.error(`✗ Erreur ${filePath}:`, error.message);
    return 0;
  }
}

function findJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Ignorer node_modules
      if (file !== 'node_modules' && file !== '.git') {
        findJsFiles(filePath, fileList);
      }
    } else if (file.endsWith('.js') && !file.includes('.template')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Exécution
console.log('Recherche fichiers .js...');
const jsFiles = findJsFiles('./src');
console.log(`Trouvé ${jsFiles.length} fichiers .js\n`);

let cleanedCount = 0;
jsFiles.forEach(file => {
  cleanedCount += cleanEmojisInFile(file);
});

console.log(`\nTerminé ! ${cleanedCount} fichiers modifiés.`);
