// src/adapters/primary/ui/controllers/TabController.js

class TabController {
  constructor() {
    this.tabButtons = null;
    this.tabContents = null;
    this.activeTabId = null;
    this.eventHandlers = new Map();
  }

  initialize() {
    console.log('[TabController] Initialisation...');
    
    this.tabButtons = document.querySelectorAll('.tab-button');
    this.tabContents = document.querySelectorAll('.tab-content');
    
    if (this.tabButtons.length === 0) {
      console.warn('[TabController] Aucun bouton d\'onglet trouve');
      return false;
    }
    
    if (this.tabContents.length === 0) {
      console.warn('[TabController] Aucun contenu d\'onglet trouve');
      return false;
    }
    
    const activeButton = document.querySelector('.tab-button.active');
    if (activeButton) {
      this.activeTabId = activeButton.getAttribute('data-tab');
    } else if (this.tabButtons.length > 0) {
      this.activeTabId = this.tabButtons[0].getAttribute('data-tab');
      this.activateTab(this.activeTabId);
    }
    
    this.setupEventListeners();
    
    console.log('[TabController] Initialise avec', this.tabButtons.length, 'onglets');
    console.log('[TabController] Onglet actif:', this.activeTabId);
    
    return true;
  }

  setupEventListeners() {
    this.tabButtons.forEach(button => {
      const handler = (event) => {
        this.handleTabClick(event, button);
      };
      
      this.eventHandlers.set(button, handler);
      button.addEventListener('click', handler);
    });
  }

  handleTabClick(event, button) {
    event.preventDefault();
    
    const tabId = button.getAttribute('data-tab');
    
    if (!tabId) {
      console.warn('[TabController] Bouton sans attribut data-tab');
      return;
    }
    
    if (tabId === this.activeTabId) {
      return;
    }
    
    console.log(`[TabController] Changement d'onglet: ${this.activeTabId} -> ${tabId}`);
    
    const previousTabId = this.activeTabId;
    
    this.activateTab(tabId);
    this.emitTabChangeEvent(previousTabId, tabId);
  }

  activateTab(tabId) {
    const targetButton = Array.from(this.tabButtons).find(
      btn => btn.getAttribute('data-tab') === tabId
    );
    
    if (!targetButton) {
      console.error(`[TabController] Onglet "${tabId}" introuvable`);
      return false;
    }
    
    const targetContent = document.getElementById(tabId);
    
    if (!targetContent) {
      console.error(`[TabController] Contenu pour l'onglet "${tabId}" introuvable`);
      return false;
    }
    
    this.tabButtons.forEach(btn => btn.classList.remove('active'));
    this.tabContents.forEach(content => content.classList.remove('active'));
    
    targetButton.classList.add('active');
    targetContent.classList.add('active');
    
    this.activeTabId = tabId;
    
    return true;
  }

  emitTabChangeEvent(previousTabId, newTabId) {
    const event = new CustomEvent('tab-changed', {
      detail: {
        previousTab: previousTabId,
        currentTab: newTabId,
        timestamp: Date.now()
      },
      bubbles: true
    });
    
    document.dispatchEvent(event);
    
    console.log(`[TabController] Evenement 'tab-changed' emis: ${previousTabId} -> ${newTabId}`);
  }

  getActiveTab() {
    return this.activeTabId;
  }

  isTabActive(tabId) {
    return this.activeTabId === tabId;
  }

  getAvailableTabs() {
    if (!this.tabButtons) {
      return [];
    }
    
    return Array.from(this.tabButtons).map(btn => 
      btn.getAttribute('data-tab')
    ).filter(id => id !== null);
  }

  dispose() {
    console.log('[TabController] Nettoyage...');
    
    if (this.tabButtons && this.eventHandlers.size > 0) {
      this.tabButtons.forEach(button => {
        const handler = this.eventHandlers.get(button);
        if (handler) {
          button.removeEventListener('click', handler);
        }
      });
    }
    
    this.eventHandlers.clear();
    this.tabButtons = null;
    this.tabContents = null;
    this.activeTabId = null;
    
    console.log('[TabController] Nettoyage termine');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TabController;
}