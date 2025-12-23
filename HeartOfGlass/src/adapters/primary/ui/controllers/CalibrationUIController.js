/**
 * CalibrationUIController.js
 *
 * Contrôleur d'interface pour la calibration des capteurs IMU.
 * Gère l'affichage et les interactions utilisateur pour le workflow de calibration.
 *
 * Architecture: Controller - Gère l'interface de calibration
 */

class CalibrationUIController {
 constructor(config) {
 this.calibrationOrchestrator = config.calibrationOrchestrator;
 this.containerElement = null;

 // Références DOM
 this.dom = {
 // Boutons
 btnRestStart: null,
 btnRestStop: null,
 btnClockwiseStart: null,
 btnClockwiseStop: null,
 btnCounterclockwiseStart: null,
 btnCounterclockwiseStop: null,
 btnReset: null,

 // Progress bars
 progressRest: null,
 progressClockwise: null,
 progressCounterclockwise: null,

 // Status
 statusRest: null,
 statusClockwise: null,
 statusCounterclockwise: null,

 // Results
 resultsDisplay: null,
 calibrationStatus: null
 };

 console.log('[CalibrationUIController] Créé');
 }

 /**
 * Initialise le contrôleur
 * @param {string} containerId - ID du conteneur DOM
 * @returns {boolean} - true si succès
 */
 initialize(containerId = 'calibrationTab') {
 this.containerElement = document.getElementById(containerId);

 if (!this.containerElement) {
 console.error('[CalibrationUIController] Conteneur non trouvé:', containerId);
 return false;
 }

 this.createInterface();
 this.setupEventListeners();
 this.updateInterfaceState();

 // Charger calibration existante si disponible
 if (this.calibrationOrchestrator.loadFromLocalStorage()) {
 this.displayCalibrationResults();
 }

 console.log('[CalibrationUIController] Initialisé');
 return true;
 }

 /**
 * Crée l'interface HTML
 * @private
 */
 createInterface() {
 this.containerElement.innerHTML = `
 <div class="calibration-layout">
 <section class="calibration-controls">
 <div class="calibration-header">
 <h2> Calibration des Capteurs</h2>
 <p class="calibration-intro">
 Calibrez votre capteur IMU en 3 étapes pour une détection optimale des rotations.
 Chaque phase collecte des données pour créer un modèle de référence.
 </p>
 </div>

 <!-- Phase 1: Repos -->
 <div class="calibration-step" data-step="rest">
 <div class="step-header">
 <div class="step-number">1</div>
 <div class="step-info">
 <h3>📍 Position de Repos</h3>
 <p class="step-description">Mesurez le bruit de fond du capteur immobile.</p>
 </div>
 </div>
 <div class="step-content">
 <div class="step-instruction">
 <strong>Instructions :</strong>
 <p>Posez le capteur à PLAT sur la table. Ne le touchez pas pendant la mesure.</p>
 </div>
 <div class="step-controls">
 <button id="btn-rest-start" class="btn-primary">
 Démarrer
 </button>
 <button id="btn-rest-stop" class="btn-secondary" disabled>
 Terminer
 </button>
 </div>
 <div class="step-progress">
 <div class="progress-bar">
 <div id="progress-rest" class="progress-fill"></div>
 </div>
 <span id="status-rest" class="progress-status">En attente...</span>
 <div id="velocity-rest" class="velocity-display" style="display: none;"></div>
 </div>
 </div>
 </div>

 <!-- Phase 2: Horaire -->
 <div class="calibration-step" data-step="clockwise">
 <div class="step-header">
 <div class="step-number">2</div>
 <div class="step-info">
 <h3>CW Rotation Horaire</h3>
 <p class="step-description">Enregistrez vos rotations dans le sens horaire.</p>
 </div>
 </div>
 <div class="step-content">
 <div class="step-instruction">
 <strong>Instructions :</strong>
 <p>Tournez le capteur LENTEMENT dans le sens HORAIRE (CW). Faites plusieurs tours complets à votre vitesse habituelle.</p>
 </div>
 <div class="step-controls">
 <button id="btn-clockwise-start" class="btn-primary" disabled>
 Démarrer
 </button>
 <button id="btn-clockwise-stop" class="btn-secondary" disabled>
 Terminer
 </button>
 </div>
 <div class="step-progress">
 <div class="progress-bar">
 <div id="progress-clockwise" class="progress-fill"></div>
 </div>
 <span id="status-clockwise" class="progress-status">En attente...</span>
 <div id="velocity-clockwise" class="velocity-display" style="display: none;"></div>
 </div>
 </div>
 </div>

 <!-- Phase 3: Antihoraire -->
 <div class="calibration-step" data-step="counterclockwise">
 <div class="step-header">
 <div class="step-number">3</div>
 <div class="step-info">
 <h3>CCW Rotation Antihoraire</h3>
 <p class="step-description">Enregistrez vos rotations dans le sens antihoraire.</p>
 </div>
 </div>
 <div class="step-content">
 <div class="step-instruction">
 <strong>Instructions :</strong>
 <p>Tournez le capteur LENTEMENT dans le sens ANTIHORAIRE (CCW). Faites plusieurs tours complets à votre vitesse habituelle.</p>
 </div>
 <div class="step-controls">
 <button id="btn-counterclockwise-start" class="btn-primary" disabled>
 Démarrer
 </button>
 <button id="btn-counterclockwise-stop" class="btn-secondary" disabled>
 Terminer
 </button>
 </div>
 <div class="step-progress">
 <div class="progress-bar">
 <div id="progress-counterclockwise" class="progress-fill"></div>
 </div>
 <span id="status-counterclockwise" class="progress-status">En attente...</span>
 <div id="velocity-counterclockwise" class="velocity-display" style="display: none;"></div>
 </div>
 </div>
 </div>

 <!-- Actions globales -->
 <div class="calibration-actions">
 <button id="btn-reset" class="btn-danger">
 <span class="btn-icon"></span> Réinitialiser la calibration
 </button>
 </div>
 </section>

 <!-- Résultats -->
 <section class="calibration-results">
 <h2> Résultats de Calibration</h2>
 <div id="calibration-status" class="calibration-status">
 <p class="status-message">Aucune calibration effectuée</p>
 </div>
 <div id="results-display" class="results-display">
 <!-- Rempli dynamiquement -->
 </div>
 </section>
 </div>
 `;

 // Récupérer les références DOM
 this.dom.btnRestStart = document.getElementById('btn-rest-start');
 this.dom.btnRestStop = document.getElementById('btn-rest-stop');
 this.dom.btnClockwiseStart = document.getElementById('btn-clockwise-start');
 this.dom.btnClockwiseStop = document.getElementById('btn-clockwise-stop');
 this.dom.btnCounterclockwiseStart = document.getElementById('btn-counterclockwise-start');
 this.dom.btnCounterclockwiseStop = document.getElementById('btn-counterclockwise-stop');
 this.dom.btnReset = document.getElementById('btn-reset');

 this.dom.progressRest = document.getElementById('progress-rest');
 this.dom.progressClockwise = document.getElementById('progress-clockwise');
 this.dom.progressCounterclockwise = document.getElementById('progress-counterclockwise');

 this.dom.statusRest = document.getElementById('status-rest');
 this.dom.statusClockwise = document.getElementById('status-clockwise');
 this.dom.statusCounterclockwise = document.getElementById('status-counterclockwise');

 this.dom.velocityRest = document.getElementById('velocity-rest');
 this.dom.velocityClockwise = document.getElementById('velocity-clockwise');
 this.dom.velocityCounterclockwise = document.getElementById('velocity-counterclockwise');

 this.dom.resultsDisplay = document.getElementById('results-display');
 this.dom.calibrationStatus = document.getElementById('calibration-status');
 }

 /**
 * Configure les event listeners
 * @private
 */
 setupEventListeners() {
 // Phase Repos
 this.dom.btnRestStart?.addEventListener('click', () => this.startPhase('rest'));
 this.dom.btnRestStop?.addEventListener('click', () => this.stopPhase());

 // Phase Horaire
 this.dom.btnClockwiseStart?.addEventListener('click', () => this.startPhase('clockwise'));
 this.dom.btnClockwiseStop?.addEventListener('click', () => this.stopPhase());

 // Phase Antihoraire
 this.dom.btnCounterclockwiseStart?.addEventListener('click', () => this.startPhase('counterclockwise'));
 this.dom.btnCounterclockwiseStop?.addEventListener('click', () => this.stopPhase());

 // Reset
 this.dom.btnReset?.addEventListener('click', () => this.resetCalibration());
 }

 /**
 * Démarre une phase de calibration
 * @private
 */
 startPhase(phase) {
 const success = this.calibrationOrchestrator.startPhase(phase);
 if (success) {
 this.updateInterfaceState();
 }
 }

 /**
 * Arrête la phase actuelle
 * @private
 */
 stopPhase() {
 const results = this.calibrationOrchestrator.stopPhase();
 this.updateInterfaceState();

 if (results) {
 // Si calibration complète, afficher résultats
 if (this.calibrationOrchestrator.isCalibrated()) {
 this.displayCalibrationResults();
 }
 }
 }

 /**
 * Réinitialise la calibration
 * @private
 */
 resetCalibration() {
 if (confirm('Êtes-vous sûr de vouloir réinitialiser la calibration ?')) {
 this.calibrationOrchestrator.reset();
 this.updateInterfaceState();
 this.clearResults();
 }
 }

 /**
 * Met à jour l'état de l'interface selon la phase active
 * @private
 */
 updateInterfaceState() {
 const model = this.calibrationOrchestrator.getCalibrationModel();
 const currentPhase = this.calibrationOrchestrator.currentPhase;

 // Activer/désactiver boutons selon l'état
 const restCompleted = model.rest.samples > 0;
 const clockwiseCompleted = model.clockwise.samples > 0;
 const counterclockwiseCompleted = model.counterclockwise.samples > 0;

 // Phase Repos
 this.dom.btnRestStart.disabled = currentPhase !== null;
 this.dom.btnRestStop.disabled = currentPhase !== 'rest';

 // Phase Horaire
 this.dom.btnClockwiseStart.disabled = !restCompleted || currentPhase !== null;
 this.dom.btnClockwiseStop.disabled = currentPhase !== 'clockwise';

 // Phase Antihoraire
 this.dom.btnCounterclockwiseStart.disabled = !clockwiseCompleted || currentPhase !== null;
 this.dom.btnCounterclockwiseStop.disabled = currentPhase !== 'counterclockwise';

 // Marquer les étapes complétées
 this._markStepCompleted('rest', restCompleted);
 this._markStepCompleted('clockwise', clockwiseCompleted);
 this._markStepCompleted('counterclockwise', counterclockwiseCompleted);
 }

 /**
 * Marque une étape comme complétée visuellement
 * @private
 */
 _markStepCompleted(step, isCompleted) {
 const stepElement = this.containerElement.querySelector(`.calibration-step[data-step="${step}"]`);
 if (!stepElement) return;

 if (isCompleted) {
 stepElement.classList.add('completed');
 } else {
 stepElement.classList.remove('completed');
 }
 }

 /**
 * Callback appelé par l'orchestrator pour updates
 * @param {Object} update - Informations de mise à jour
 */
 onCalibrationUpdate(update) {
 const { phase, status, samplesCollected, progress, message, results, currentDelta, currentVelocity } = update;

 // Mettre à jour la progress bar
 if (phase && progress !== undefined) {
 const progressEl = this.dom[`progress${this._capitalize(phase)}`];
 if (progressEl) {
 progressEl.style.width = `${progress}%`;
 }
 }

 // Mettre à jour le status text
 if (phase && message) {
 const statusEl = this.dom[`status${this._capitalize(phase)}`];
 if (statusEl) {
 statusEl.textContent = `${message} (${samplesCollected || 0} échantillons)`;
 }
 }

 // Afficher la vitesse/delta en temps réel pendant la collecte
 if (phase && status === 'collecting') {
 const velocityEl = this.dom[`velocity${this._capitalize(phase)}`];
 if (velocityEl) {
 velocityEl.style.display = 'block';

 if (phase === 'rest' && currentVelocity !== undefined) {
 velocityEl.innerHTML = `<strong>Vitesse actuelle:</strong> ${currentVelocity.toFixed(2)}°/s`;
 } else if ((phase === 'clockwise' || phase === 'counterclockwise') && currentDelta !== undefined && currentVelocity !== undefined) {
 // Inverser le signe pour l'affichage afin que :
 // - Phase horaire affiche des valeurs positives
 // - Phase antihoraire affiche des valeurs négatives
 // Note: Cela n'affecte que l'UI, les vraies valeurs dans le modèle restent inchangées
 const displayValue = -currentDelta; // Inverser le signe pour l'affichage
 const sign = displayValue >= 0 ? '+' : '-';
 const color = displayValue > 0 ? '#4CAF50' : '#2196F3';
 velocityEl.innerHTML = `
 <strong>Gyroscope moyen:</strong> <span style="color: ${color}">${sign}${Math.abs(displayValue).toFixed(2)}°/s</span> |
 <strong>Vitesse:</strong> ${currentVelocity.toFixed(1)}°/s
 `;
 }
 }
 }

 // Si phase terminée, réinitialiser progress bar et cacher vitesse
 if (status === 'completed' && phase) {
 const progressEl = this.dom[`progress${this._capitalize(phase)}`];
 if (progressEl) {
 progressEl.style.width = '100%';
 progressEl.style.backgroundColor = '#4CAF50'; // Vert
 }

 const statusEl = this.dom[`status${this._capitalize(phase)}`];
 if (statusEl) {
 statusEl.textContent = `[OK] Terminé (${results?.samples || 0} échantillons)`;
 statusEl.style.color = '#4CAF50';
 }

 // Cacher l'affichage de vitesse
 const velocityEl = this.dom[`velocity${this._capitalize(phase)}`];
 if (velocityEl) {
 velocityEl.style.display = 'none';
 }
 }

 // Si erreur
 if (status === 'error' && phase) {
 const statusEl = this.dom[`status${this._capitalize(phase)}`];
 if (statusEl) {
 statusEl.textContent = `[WARNING] ${message}`;
 statusEl.style.color = '#ff9800';
 }
 }
 }

 /**
 * Callback appelé quand calibration complète
 * @param {Object} data - Données de calibration finale
 */
 onCalibrationComplete(data) {
 console.log('[CalibrationUIController] Calibration complète:', data);
 this.displayCalibrationResults();
 }

 /**
 * Affiche les résultats de calibration
 * @private
 */
 displayCalibrationResults() {
 const model = this.calibrationOrchestrator.getCalibrationModel();

 // Vérifier que le modèle est complet et valide
 if (!model || !model.isComplete) {
 return;
 }

 // Vérifier que toutes les propriétés existent
 if (!model.rest || !model.clockwise || !model.counterclockwise) {
 console.warn('[CalibrationUIController] Modèle incomplet, impossible d\'afficher les résultats');
 return;
 }

 // Vérifier que les valeurs numériques existent
 if (typeof model.rest.noiseLevel !== 'number' ||
 typeof model.clockwise.avg !== 'number' ||
 typeof model.counterclockwise.avg !== 'number') {
 console.warn('[CalibrationUIController] Valeurs numériques manquantes, impossible d\'afficher les résultats');
 return;
 }

 const separation = Math.abs(model.clockwise.avg - model.counterclockwise.avg);
 const isValid = separation >= 10;

 // Mettre à jour le status général
 this.dom.calibrationStatus.innerHTML = `
 <div class="status-icon">${isValid ? '[OK]' : '[WARNING]'}</div>
 <div class="status-text">
 <p class="status-message ${isValid ? 'status-success' : 'status-warning'}">
 ${isValid ? 'Calibration valide et prête à l\'emploi' : 'Calibration effectuée mais séparation faible'}
 </p>
 <p class="status-date">
 Calibré le ${new Date(model.timestamp).toLocaleString('fr-FR')}
 </p>
 </div>
 `;

 // Afficher les résultats détaillés
 this.dom.resultsDisplay.innerHTML = `
 <div class="result-section">
 <h3>📍 Repos</h3>
 <div class="result-item">
 <span class="result-label">Niveau de bruit:</span>
 <span class="result-value">${model.rest.noiseLevel.toFixed(2)}°/s</span>
 </div>
 <div class="result-item">
 <span class="result-label">Échantillons:</span>
 <span class="result-value">${model.rest.samples}</span>
 </div>
 </div>

 <div class="result-section">
 <h3>CW Rotation Horaire</h3>
 <div class="result-item">
 <span class="result-label">Moyenne:</span>
 <span class="result-value">${model.clockwise.avg.toFixed(2)}°</span>
 </div>
 <div class="result-item">
 <span class="result-label">Plage:</span>
 <span class="result-value">[${model.clockwise.min.toFixed(1)}°, ${model.clockwise.max.toFixed(1)}°]</span>
 </div>
 <div class="result-item">
 <span class="result-label">Échantillons:</span>
 <span class="result-value">${model.clockwise.samples}</span>
 </div>
 </div>

 <div class="result-section">
 <h3>CCW Rotation Antihoraire</h3>
 <div class="result-item">
 <span class="result-label">Moyenne:</span>
 <span class="result-value">${model.counterclockwise.avg.toFixed(2)}°</span>
 </div>
 <div class="result-item">
 <span class="result-label">Plage:</span>
 <span class="result-value">[${model.counterclockwise.min.toFixed(1)}°, ${model.counterclockwise.max.toFixed(1)}°]</span>
 </div>
 <div class="result-item">
 <span class="result-label">Échantillons:</span>
 <span class="result-value">${model.counterclockwise.samples}</span>
 </div>
 </div>

 <div class="result-section result-summary">
 <h3> Analyse</h3>
 <div class="result-item">
 <span class="result-label">Séparation:</span>
 <span class="result-value ${isValid ? 'value-good' : 'value-warning'}">
 ${separation.toFixed(2)}° ${isValid ? '[OK]' : '[WARNING]'}
 </span>
 </div>
 <div class="result-item">
 <span class="result-label">Statut:</span>
 <span class="result-value ${isValid ? 'value-good' : 'value-warning'}">
 ${isValid ? 'Détection robuste' : 'Recalibration recommandée'}
 </span>
 </div>
 </div>
 `;
 }

 /**
 * Efface les résultats affichés
 * @private
 */
 clearResults() {
 this.dom.calibrationStatus.innerHTML = `
 <p class="status-message">Aucune calibration effectuée</p>
 `;
 this.dom.resultsDisplay.innerHTML = '';

 // Réinitialiser les progress bars
 this.dom.progressRest.style.width = '0%';
 this.dom.progressClockwise.style.width = '0%';
 this.dom.progressCounterclockwise.style.width = '0%';

 this.dom.progressRest.style.backgroundColor = '';
 this.dom.progressClockwise.style.backgroundColor = '';
 this.dom.progressCounterclockwise.style.backgroundColor = '';

 // Réinitialiser les status
 this.dom.statusRest.textContent = 'En attente...';
 this.dom.statusClockwise.textContent = 'En attente...';
 this.dom.statusCounterclockwise.textContent = 'En attente...';

 this.dom.statusRest.style.color = '';
 this.dom.statusClockwise.style.color = '';
 this.dom.statusCounterclockwise.style.color = '';
 }

 /**
 * Capitalise la première lettre
 * @private
 */
 _capitalize(str) {
 return str.charAt(0).toUpperCase() + str.slice(1);
 }

 /**
 * Nettoyage
 */
 dispose() {
 // Supprimer les event listeners si nécessaire
 console.log('[CalibrationUIController] Disposed');
 }
}

// Export CommonJS
if (typeof module !== 'undefined' && module.exports) {
 module.exports = CalibrationUIController;
}
