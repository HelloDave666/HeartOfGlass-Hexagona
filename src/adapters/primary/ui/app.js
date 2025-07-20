// src/adapters/primary/ui/app.js

// Importer les composants et services
const loadComponents = () => {
  const sensorScript = document.createElement('script');
  sensorScript.src = './components/SensorDisplay.js';
  document.head.appendChild(sensorScript);
  
  const bluetoothScript = document.createElement('script');
  bluetoothScript.src = './services/BluetoothService.js';
  document.head.appendChild(bluetoothScript);
};

// Point d'entrée de l'interface utilisateur
console.log('Heart of Glass - UI loaded');

// L'API est disponible via window.heartOfGlass
const api = window.heartOfGlass;

// Variables globales pour les composants
let sensorDisplay = null;
let audioController = null;
let narrativeSystem = null;

// Configuration des onglets
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  function activateTab(tabId) {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    const selectedTab = document.querySelector(`[data-tab="${tabId}"]`);
    const selectedContent = document.getElementById(tabId);
    
    if (selectedTab && selectedContent) {
      selectedTab.classList.add('active');
      selectedContent.classList.add('active');
    }
  }
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      activateTab(tabId);
    });
  });
  
  // Activer le premier onglet
  activateTab('mainTab');
}

// Initialisation des composants
function initializeComponents() {
  // Composant des capteurs
  const sensorContainer = document.getElementById('sensorContainer');
  if (sensorContainer && window.SensorDisplay) {
    sensorDisplay = new window.SensorDisplay(sensorContainer, api);
    console.log('[App] Composant capteurs initialisé');
  }
  
  // TODO: Initialiser les autres composants
  // audioController = new AudioController(...);
  // narrativeSystem = new NarrativeSystem(...);
}

// Configuration de l'interface
function setupInterface() {
  // Onglets
  setupTabs();
  
  // Slider de sensibilité
  const sensitivitySlider = /** @type {HTMLInputElement} */ (document.getElementById('sensitivitySlider'));
  const sensitivityValue = document.getElementById('sensitivityValue');
  
  if (sensitivitySlider && sensitivityValue) {
    sensitivitySlider.addEventListener('input', function() {
      const value = parseFloat(this.value);
      sensitivityValue.textContent = value.toFixed(1);
      // TODO: Propager la valeur au système audio
      console.log('[App] Sensibilité modifiée:', value);
    });
  }
  
  // Paramètres des capteurs
  setupSensorSettings();
  
  // Logger personnalisé
  setupCustomLogger();
}

// Configuration des paramètres des capteurs
function setupSensorSettings() {
  const applyButton = document.getElementById('applySensorSettings');
  if (!applyButton) return;
  
  applyButton.addEventListener('click', async () => {
    const leftAddressInput = /** @type {HTMLInputElement} */ (document.getElementById('customLeftSensorId'));
    const rightAddressInput = /** @type {HTMLInputElement} */ (document.getElementById('customRightSensorId'));
    const swapHandsInput = /** @type {HTMLInputElement} */ (document.getElementById('swapHands'));
    
    if (!leftAddressInput || !rightAddressInput || !swapHandsInput) return;
    
    const leftAddress = leftAddressInput.value.trim();
    const rightAddress = rightAddressInput.value.trim();
    const swapHands = swapHandsInput.checked;
    
    if (leftAddress && rightAddress) {
      try {
        // Mettre à jour la configuration dans le BluetoothService
        if (sensorDisplay) {
          sensorDisplay.updateConfig({
            leftAddress: swapHands ? rightAddress : leftAddress,
            rightAddress: swapHands ? leftAddress : rightAddress
          });
          
          alert('Paramètres des capteurs mis à jour. Redémarrez le scan pour appliquer les changements.');
          
          // Optionnel : redémarrer le scan automatiquement
          if (sensorDisplay.isScanning) {
            await sensorDisplay.stopScan();
          }
        }
      } catch (error) {
        console.error('[App] Erreur mise à jour config:', error);
        alert('Erreur lors de la mise à jour des paramètres');
      }
    } else {
      alert('Veuillez entrer des adresses valides pour les deux capteurs.');
    }
  });
}

// Logger visuel personnalisé
function setupCustomLogger() {
  let logContainer = null;
  let logVisible = false;
  
  // Créer le bouton de logs
  const toggleButton = document.createElement('button');
  toggleButton.textContent = 'Logs';
  toggleButton.className = 'log-toggle-button';
  toggleButton.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    padding: 5px 10px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    z-index: 10000;
  `;
  
  // Créer le conteneur de logs
  logContainer = document.createElement('div');
  logContainer.className = 'log-container';
  logContainer.style.cssText = `
    position: fixed;
    bottom: 50px;
    right: 10px;
    width: 400px;
    max-height: 300px;
    overflow-y: auto;
    background-color: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 10px;
    border-radius: 5px;
    font-family: monospace;
    font-size: 12px;
    z-index: 9999;
    display: none;
  `;
  
  toggleButton.addEventListener('click', () => {
    logVisible = !logVisible;
    logContainer.style.display = logVisible ? 'block' : 'none';
    toggleButton.textContent = logVisible ? 'Masquer' : 'Logs';
  });
  
  document.body.appendChild(toggleButton);
  document.body.appendChild(logContainer);
  
  // Rediriger console.log
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  const addLogEntry = (level, message) => {
    const entry = document.createElement('div');
    entry.style.cssText = `
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      padding: 5px 0;
      color: ${level === 'ERROR' ? '#ff5252' : level === 'WARN' ? '#ffd740' : '#fff'};
    `;
    
    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `[${timestamp}] ${message}`;
    
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
    
    // Limiter le nombre d'entrées
    while (logContainer.children.length > 100) {
      logContainer.removeChild(logContainer.firstChild);
    }
    
    // Envoyer au processus principal si la méthode existe
    if (api.log) {
      api.log(level, message);
    }
  };
  
  console.log = function(...args) {
    originalLog.apply(console, args);
    addLogEntry('INFO', args.join(' '));
  };
  
  console.error = function(...args) {
    originalError.apply(console, args);
    addLogEntry('ERROR', args.join(' '));
  };
  
  console.warn = function(...args) {
    originalWarn.apply(console, args);
    addLogEntry('WARN', args.join(' '));
  };
}

// Nettoyer lors de la fermeture
function cleanup() {
  console.log('[App] Nettoyage des ressources...');
  // TODO: Nettoyer les composants
}

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', () => {
  console.log('[App] DOM chargé, initialisation...');
  
  // Charger les composants
  loadComponents();
  
  // Attendre un peu que les scripts se chargent
  setTimeout(() => {
    setupInterface();
    initializeComponents();
    console.log('[App] Application prête');
  }, 100);
});

// Nettoyage à la fermeture
window.addEventListener('beforeunload', cleanup);
