/**
 * Test du système narratif
 *
 * Ce script teste le chargement de la narrative et l'initialisation
 * du NarrativeController sans l'interface graphique.
 */

const path = require('path');

// Import des composants
const JSONNarrativeRepository = require('./src/adapters/secondary/storage/JSONNarrativeRepository');
const LoadNarrativeUseCase = require('./src/core/useCases/narrative/LoadNarrativeUseCase');

async function testNarrativeSystem() {
  console.log('=== TEST SYSTÈME NARRATIF ===\n');

  try {
    // 1. Configuration
    const narrativesPath = path.join(__dirname, 'narratives');
    console.log(`[1/5] Chemin narratives: ${narrativesPath}\n`);

    // 2. Créer Repository
    console.log('[2/5] Création du Repository...');
    const repository = new JSONNarrativeRepository(narrativesPath);
    console.log('[OK] Repository créé\n');

    // 3. Créer Use Case
    console.log('[3/5] Création du Use Case...');
    const loadNarrativeUseCase = new LoadNarrativeUseCase(repository);
    console.log('[OK] Use Case créé\n');

    // 4. Charger la narrative
    console.log('[4/5] Chargement de la narrative...');
    const result = await loadNarrativeUseCase.execute({
      validateMedia: false,
      resetProgress: false
    });

    if (!result.success) {
      console.error('[ERROR] Échec du chargement:', result.error);
      process.exit(1);
    }

    console.log('[OK] Narrative chargée avec succès!\n');

    // 5. Afficher les informations
    console.log('[5/5] Informations de la narrative:\n');
    console.log(`Titre: ${result.narrative.title}`);
    console.log(`Version: ${result.narrative.version}`);
    console.log(`ID: ${result.narrative.id}\n`);

    console.log('Statistiques:');
    console.log(`  - Chapitres: ${result.stats.totalChapters}`);
    console.log(`  - Scènes: ${result.stats.totalScenes}`);
    console.log(`  - Dialogues: ${result.stats.totalDialogues}`);
    console.log(`  - Mots: ${result.stats.totalWords}`);
    console.log(`  - Personnages: ${result.stats.totalCharacters}`);
    console.log(`  - Durée estimée: ${result.stats.estimatedDurationMinutes} minutes\n`);

    console.log('Chapitres:');
    result.narrative.chapters.forEach((chapter, idx) => {
      console.log(`  ${idx + 1}. ${chapter.title}`);
      console.log(`     - ID: ${chapter.id}`);
      console.log(`     - Scènes: ${chapter.scenes.length}`);
      console.log(`     - Débloqué: ${chapter.isUnlocked() ? 'Oui' : 'Non'}`);
      if (chapter.unlockCondition) {
        console.log(`     - Condition: ${chapter.unlockCondition.type} (${chapter.unlockCondition.exerciseId || 'N/A'})`);
      }
      console.log('');
    });

    console.log('Personnages:');
    result.narrative.characters.forEach((character, id) => {
      console.log(`  - ${character.name} (${id})`);
      console.log(`    Portraits: ${character.getAvailableEmotions().join(', ')}`);
    });

    console.log('\n=== TEST RÉUSSI ===');
    console.log('Le système narratif fonctionne correctement!');
    console.log('\nProchaines étapes:');
    console.log('1. Lancer l\'application avec "npm start"');
    console.log('2. Le NarrativeController sera automatiquement initialisé');
    console.log('3. Utiliser narrativeController.startChapter("00-intro-tutorial") pour démarrer\n');

  } catch (error) {
    console.error('\n[ERROR] Erreur durant le test:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Exécuter le test
testNarrativeSystem();
