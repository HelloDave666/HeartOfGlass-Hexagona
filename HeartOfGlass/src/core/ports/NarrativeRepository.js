/**
 * NarrativeRepository - Port (interface) pour le repository narratif
 *
 * Définit le contrat que doivent respecter les implémentations
 * de repository (JSON, base de données, etc.).
 *
 * Architecture : Core/Ports (Hexagonal Architecture)
 */
class NarrativeRepository {
  /**
   * Charge la narrative complète depuis le stockage
   * @returns {Promise<Narrative>} Narrative chargée
   * @throws {Error} Si le chargement échoue
   */
  async loadNarrative() {
    throw new Error('loadNarrative() must be implemented');
  }

  /**
   * Charge un chapitre spécifique
   * @param {string} chapterId - ID du chapitre
   * @returns {Promise<Chapter>} Chapitre chargé
   * @throws {Error} Si le chargement échoue
   */
  async loadChapter(chapterId) {
    throw new Error('loadChapter() must be implemented');
  }

  /**
   * Charge tous les personnages
   * @returns {Promise<Map<string, Character>>} Map des personnages par ID
   * @throws {Error} Si le chargement échoue
   */
  async loadCharacters() {
    throw new Error('loadCharacters() must be implemented');
  }

  /**
   * Sauvegarde l'état de progression
   * @param {NarrativeState} state - État à sauvegarder
   * @returns {Promise<void>}
   * @throws {Error} Si la sauvegarde échoue
   */
  async saveProgress(state) {
    throw new Error('saveProgress() must be implemented');
  }

  /**
   * Charge l'état de progression sauvegardé
   * @returns {Promise<NarrativeState|null>} État sauvegardé ou null si aucun
   * @throws {Error} Si le chargement échoue
   */
  async loadProgress() {
    throw new Error('loadProgress() must be implemented');
  }

  /**
   * Vérifie si un fichier média existe
   * @param {string} mediaPath - Chemin relatif du média
   * @returns {Promise<boolean>}
   */
  async mediaExists(mediaPath) {
    throw new Error('mediaExists() must be implemented');
  }

  /**
   * Obtient le chemin absolu d'un média
   * @param {string} mediaPath - Chemin relatif du média
   * @returns {string} Chemin absolu
   */
  getMediaPath(mediaPath) {
    throw new Error('getMediaPath() must be implemented');
  }
}

module.exports = NarrativeRepository;
