/**
 * HeartOfGlassUIController - Contrôleur UI pour l'onglet Heart of Glass
 *
 * Affiche la liste des chapitres narratifs, permet de les lancer,
 * et affiche la progression.
 *
 * Architecture : Adapters/Primary/UI/Controllers
 */
class HeartOfGlassUIController {
  /**
   * @param {Object} dependencies - Dépendances
   * @param {NarrativeController} dependencies.narrativeController - Contrôleur narratif
   */
  constructor({ narrativeController }) {
    this.narrativeController = narrativeController;
    this.container = null;
    this.isInitialized = false;

    console.log('[HeartOfGlassUI] Controller created');
  }

  /**
   * Initialise l'interface dans le container spécifié
   * @param {string} containerId - ID du container HTML
   * @returns {boolean}
   */
  initialize(containerId = 'mainContent') {
    console.log(`[HeartOfGlassUI] Initializing in container: ${containerId}`);

    this.container = document.getElementById(containerId);

    if (!this.container) {
      console.error(`[HeartOfGlassUI] Container not found: ${containerId}`);
      return false;
    }

    // Attendre que le NarrativeController soit prêt
    if (!this.narrativeController || !this.narrativeController.narrative) {
      console.warn('[HeartOfGlassUI] NarrativeController not ready, will retry...');

      // Retry après 1 seconde
      setTimeout(() => {
        if (this.narrativeController && this.narrativeController.narrative) {
          this._renderInterface();
        } else {
          console.error('[HeartOfGlassUI] NarrativeController still not ready');
        }
      }, 1000);

      return true;
    }

    this._renderInterface();
    this.isInitialized = true;

    return true;
  }

  /**
   * Rend l'interface complète
   * @private
   */
  _renderInterface() {
    console.log('[HeartOfGlassUI] Rendering interface...');

    // Créer la structure HTML (simplifiée, une seule fenêtre)
    this.container.innerHTML = `
      <div class="heart-of-glass-ui">
        <!-- Header -->
        <div class="narrative-header">
          <h2>Heart Of Glass</h2>
          <p class="narrative-subtitle">Aux limites de la mer... de glace</p>
        </div>

        <!-- Progression globale -->
        <div class="global-progress">
          <div class="progress-info">
            <span class="progress-label">Progression Globale</span>
            <span class="progress-value" id="globalProgressValue">0%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" id="globalProgressBar" style="width: 0%"></div>
          </div>
        </div>

        <!-- Zone vidéo narrative -->
        <div class="video-zone">
          <div class="video-header">
            <h3>Vidéos et Tutoriels</h3>
            <p class="video-subtitle">Découvrez l'histoire de Rita et apprenez à utiliser les capteurs</p>
          </div>
          <div class="video-container">
            <video id="narrativeVideo" class="video-player" controls>
              <source src="" type="video/mp4">
              Votre navigateur ne supporte pas la lecture vidéo.
            </video>
            <div class="video-placeholder" id="videoPlaceholder">
              <div class="placeholder-content">
                <div class="placeholder-icon">▶</div>
                <p>Aucune vidéo chargée</p>
                <p class="placeholder-hint">Utilisez le chemin: assets/videos/votre-video.mp4</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Liste des chapitres -->
        <div class="chapters-list" id="chaptersList">
          <!-- Les chapitres seront injectés ici -->
        </div>
      </div>
    `;

    // Injecter les styles
    this._injectStyles();

    // Rendre les chapitres
    this._renderChapters();

    console.log('[HeartOfGlassUI] Interface rendered');
  }

  /**
   * Rend la liste des chapitres
   * @private
   */
  _renderChapters() {
    const chaptersList = document.getElementById('chaptersList');
    if (!chaptersList) return;

    // Récupérer les chapitres
    const chapters = this.narrativeController.narrative.chapters;
    const completedIds = this.narrativeController.narrative.state.completedChapterIds;

    // Calculer progression globale
    const progress = this.narrativeController.narrative.getOverallProgress();
    this._updateGlobalProgress(progress);

    // Vider la liste
    chaptersList.innerHTML = '';

    // Créer une card pour chaque chapitre
    chapters.forEach((chapter, index) => {
      const isUnlocked = chapter.isUnlocked();
      const isCompleted = completedIds.includes(chapter.id);
      const isCurrent = this.narrativeController.narrative.state.currentChapterId === chapter.id;

      const chapterCard = this._createChapterCard({
        chapter,
        index,
        isUnlocked,
        isCompleted,
        isCurrent
      });

      chaptersList.appendChild(chapterCard);
    });
  }

  /**
   * Crée une card pour un chapitre
   * @private
   */
  _createChapterCard({ chapter, index, isUnlocked, isCompleted, isCurrent }) {
    const card = document.createElement('div');
    card.className = `chapter-card ${isUnlocked ? 'unlocked' : 'locked'} ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`;

    const statusIcon = isCompleted ? '✓' : (isUnlocked ? '▶' : '🔒');
    const statusText = isCompleted ? 'Terminé' : (isUnlocked ? 'Disponible' : 'Verrouillé');

    card.innerHTML = `
      <div class="chapter-number">Chapitre ${index + 1}</div>
      <div class="chapter-content">
        <h3 class="chapter-title">${chapter.title}</h3>
        <div class="chapter-meta">
          <span class="chapter-status ${isUnlocked ? 'available' : 'locked'}">
            ${statusIcon} ${statusText}
          </span>
          <span class="chapter-scenes">${chapter.scenes.length} scènes</span>
        </div>
        ${isUnlocked ? `
          <button class="chapter-start-btn" data-chapter-id="${chapter.id}">
            ${isCompleted ? 'Rejouer' : (isCurrent ? 'Continuer' : 'Commencer')}
          </button>
        ` : `
          <div class="unlock-hint">
            ${chapter.unlockCondition ?
              `Complétez l'exercice "${chapter.unlockCondition.exerciseId}" pour débloquer` :
              'Chapitre verrouillé'
            }
          </div>
        `}
      </div>
    `;

    // Attacher l'event listener au bouton
    if (isUnlocked) {
      const startBtn = card.querySelector('.chapter-start-btn');
      startBtn.addEventListener('click', () => {
        this._onChapterStart(chapter.id);
      });
    }

    return card;
  }

  /**
   * Met à jour la progression globale
   * @private
   */
  _updateGlobalProgress(progress) {
    const progressValue = document.getElementById('globalProgressValue');
    const progressBar = document.getElementById('globalProgressBar');

    if (progressValue) {
      progressValue.textContent = `${progress}%`;
    }

    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }
  }

  /**
   * Gère le démarrage d'un chapitre
   * @private
   */
  _onChapterStart(chapterId) {
    console.log(`[HeartOfGlassUI] Starting chapter: ${chapterId}`);

    const success = this.narrativeController.startChapter(chapterId);

    if (success) {
      console.log('[HeartOfGlassUI] Chapter started successfully');
      // L'UI sera mise à jour quand le chapitre se termine
    } else {
      console.error('[HeartOfGlassUI] Failed to start chapter');
      alert('Erreur lors du démarrage du chapitre');
    }
  }

  /**
   * Rafraîchit l'interface (après progression)
   */
  refresh() {
    if (!this.isInitialized) return;
    this._renderChapters();
  }

  /**
   * Injecte les styles CSS
   * @private
   */
  _injectStyles() {
    const styleId = 'heart-of-glass-ui-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .heart-of-glass-ui {
        padding: 30px;
        max-width: 1200px;
        margin: 0 auto;
      }

      .narrative-header {
        text-align: center;
        margin-bottom: 40px;
      }

      .narrative-header h2 {
        margin: 0;
        font-size: 32px;
        color: #fff;
      }

      .narrative-subtitle {
        color: rgba(255, 255, 255, 0.7);
        margin-top: 10px;
      }

      .global-progress {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 30px;
      }

      .progress-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
        color: #fff;
      }

      .progress-label {
        font-weight: bold;
      }

      .progress-value {
        color: #667eea;
        font-weight: bold;
      }

      .progress-bar {
        height: 8px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        transition: width 0.5s ease;
      }

      .chapters-list {
        display: grid;
        gap: 20px;
        margin-bottom: 30px;
      }

      .chapter-card {
        background: rgba(255, 255, 255, 0.05);
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 25px;
        display: flex;
        gap: 20px;
        transition: all 0.3s ease;
      }

      .chapter-card.unlocked {
        border-color: rgba(102, 126, 234, 0.3);
      }

      .chapter-card.unlocked:hover {
        background: rgba(102, 126, 234, 0.1);
        border-color: rgba(102, 126, 234, 0.5);
        transform: translateY(-2px);
      }

      .chapter-card.completed {
        border-color: rgba(76, 175, 80, 0.3);
      }

      .chapter-card.current {
        border-color: rgba(255, 193, 7, 0.5);
        box-shadow: 0 0 20px rgba(255, 193, 7, 0.2);
      }

      .chapter-card.locked {
        opacity: 0.5;
      }

      .chapter-number {
        flex-shrink: 0;
        width: 80px;
        height: 80px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: bold;
        font-size: 14px;
        text-align: center;
      }

      .chapter-card.locked .chapter-number {
        background: rgba(255, 255, 255, 0.1);
      }

      .chapter-content {
        flex: 1;
      }

      .chapter-title {
        margin: 0 0 10px 0;
        color: #fff;
        font-size: 20px;
      }

      .chapter-meta {
        display: flex;
        gap: 20px;
        margin-bottom: 15px;
        font-size: 14px;
      }

      .chapter-status {
        padding: 4px 12px;
        border-radius: 12px;
        font-weight: bold;
      }

      .chapter-status.available {
        background: rgba(102, 126, 234, 0.2);
        color: #667eea;
      }

      .chapter-status.locked {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.5);
      }

      .chapter-scenes {
        color: rgba(255, 255, 255, 0.6);
      }

      .chapter-start-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        border: none;
        padding: 12px 30px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .chapter-start-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
      }

      .unlock-hint {
        color: rgba(255, 255, 255, 0.5);
        font-style: italic;
        font-size: 14px;
      }

      .instructions {
        text-align: center;
        padding: 20px;
        background: rgba(102, 126, 234, 0.1);
        border-radius: 8px;
        color: rgba(255, 255, 255, 0.7);
      }

      .instructions strong {
        color: #667eea;
      }

      /* Zone vidéo narrative (sans vignettes) */
      .video-zone {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 193, 7, 0.2);
        border-radius: 16px;
        padding: 30px;
        margin-bottom: 30px;
      }

      .video-header {
        text-align: center;
        margin-bottom: 25px;
      }

      .video-header h3 {
        margin: 0 0 8px 0;
        font-size: 24px;
        color: #fff;
        background: linear-gradient(135deg, #FFB74D 0%, #667eea 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .video-subtitle {
        color: rgba(255, 255, 255, 0.6);
        font-size: 14px;
        margin: 0;
      }

      .video-container {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        background: #000;
        border-radius: 12px;
        overflow: hidden;
        border: 2px solid rgba(255, 193, 7, 0.3);
      }

      .video-player {
        width: 100%;
        height: 100%;
        display: none;
      }

      .video-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
      }

      .placeholder-content {
        text-align: center;
        color: rgba(255, 255, 255, 0.5);
      }

      .placeholder-icon {
        font-size: 64px;
        margin-bottom: 15px;
        opacity: 0.3;
      }

      .placeholder-content p {
        margin: 5px 0;
      }

      .placeholder-hint {
        font-size: 12px;
        opacity: 0.7;
      }
    `;

    document.head.appendChild(style);
  }
}

module.exports = HeartOfGlassUIController;
