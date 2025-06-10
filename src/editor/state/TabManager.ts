import { EventEmitter } from "eventemitter3";
import { GraphState, ViewState, ConnectionRoutingMode } from "../core/types";

// Helper function to create default ViewState
const createDefaultViewState = (): ViewState => ({
  scale: 1,
  offset: { x: 0, y: 0 },
  showGrid: true,
  snapToGrid: false,
  gridSize: 20,
  backgroundPattern: 'dots',
  preferences: {
    connectionRouting: ConnectionRoutingMode.BEZIER,
    grid: {
      pattern: 'dots',
      snapToGrid: false,
      adaptiveGrid: true,
    },
    connectionAppearance: {
      thicknessMode: 'uniform',
      showLabels: false,
      showDirectionArrows: true,
      animateFlow: false,
      colorMode: 'uniform',
    },
    performance: {
      animations: 'essential',
      shadowEffects: true,
      maxVisibleNodes: 1000,
    },
  },
  navigationPath: [{ graphId: 'root', label: 'Main Flow' }],
});

export interface FlowTab {
  id: string;
  name: string;
  isDirty: boolean;
  isMain: boolean; // The main tab uses default localStorage
  graphState: GraphState;
  lastSaved?: Date;
}

export interface TabManagerEvents {
  tabCreated: (tab: FlowTab) => void;
  tabClosed: (tabId: string) => void;
  tabSwitched: (tab: FlowTab) => void;
  tabRenamed: (tab: FlowTab, oldName: string) => void;
  tabDirtyStateChanged: (tab: FlowTab) => void;
  tabSaved: (tab: FlowTab) => void;
  tabLoaded: (tab: FlowTab) => void;
}

export class TabManager extends EventEmitter<TabManagerEvents> {
  private tabs: Map<string, FlowTab> = new Map();
  private activeTabId: string | null = null;
  private nextTabId = 1;

  private readonly STORAGE_PREFIX = 'flow_tab_';
  private readonly TABS_METADATA_KEY = 'flow_tabs_metadata';

  constructor() {
    super();
    this.loadTabsFromStorage();
  }

  /**
   * Creates a new tab with an empty flow
   */
  createTab(name?: string): FlowTab {
    const id = `tab_${this.nextTabId++}`;
    const tabName = name || `Flow ${this.nextTabId - 1}`;
    
    const tab: FlowTab = {
      id,
      name: tabName,
      isDirty: false,
      isMain: false,
      graphState: {
        nodes: [],
        connections: [],
        stickyNotes: [],
        nodeGroups: [],
        viewState: createDefaultViewState(),
      },
    };

    this.tabs.set(id, tab);
    this.saveTabsMetadata();
    this.emit('tabCreated', tab);
    
    return tab;
  }

  /**
   * Creates the main tab (uses default localStorage)
   */
  createMainTab(): FlowTab {
    const tab: FlowTab = {
      id: 'main',
      name: 'Main Flow',
      isDirty: false,
      isMain: true,
      graphState: {
        nodes: [],
        connections: [],
        stickyNotes: [],
        nodeGroups: [],
        viewState: createDefaultViewState(),
      },
    };

    this.tabs.set('main', tab);
    this.activeTabId = 'main';
    this.emit('tabCreated', tab);
    
    return tab;
  }

  /**
   * Closes a tab
   */
  closeTab(tabId: string): boolean {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    // Cannot close the main tab if it's the only one
    if (tab.isMain && this.tabs.size === 1) {
      return false;
    }

    // If closing the active tab, switch to another one
    if (this.activeTabId === tabId) {
      const remainingTabs = Array.from(this.tabs.values()).filter(t => t.id !== tabId);
      if (remainingTabs.length > 0) {
        // Prefer main tab, otherwise pick the first available
        const nextTab = remainingTabs.find(t => t.isMain) || remainingTabs[0];
        this.switchToTab(nextTab.id);
      } else {
        this.activeTabId = null;
      }
    }

    this.tabs.delete(tabId);
    
    // Remove from localStorage if not main tab
    if (!tab.isMain) {
      localStorage.removeItem(this.getStorageKey(tabId));
    }
    
    this.saveTabsMetadata();
    this.emit('tabClosed', tabId);
    
    return true;
  }

  /**
   * Switches to a specific tab
   */
  switchToTab(tabId: string): boolean {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    this.activeTabId = tabId;
    this.emit('tabSwitched', tab);
    
    return true;
  }

  /**
   * Renames a tab
   */
  renameTab(tabId: string, newName: string): boolean {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    const oldName = tab.name;
    tab.name = newName;
    this.markTabDirty(tabId, true);
    this.saveTabsMetadata();
    this.emit('tabRenamed', tab, oldName);
    
    return true;
  }

  /**
   * Updates the graph state for a tab
   */
  updateTabState(tabId: string, graphState: GraphState): boolean {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    tab.graphState = JSON.parse(JSON.stringify(graphState));
    this.markTabDirty(tabId, true);
    
    return true;
  }

  /**
   * Marks a tab as dirty or clean
   */
  markTabDirty(tabId: string, isDirty: boolean): boolean {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    if (tab.isDirty !== isDirty) {
      tab.isDirty = isDirty;
      this.emit('tabDirtyStateChanged', tab);
    }
    
    return true;
  }

  /**
   * Saves a tab's state to localStorage
   */
  async saveTab(tabId: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    try {
      const storageKey = tab.isMain ? 'flow_builder_graph' : this.getStorageKey(tabId);
      localStorage.setItem(storageKey, JSON.stringify(tab.graphState));
      
      tab.lastSaved = new Date();
      this.markTabDirty(tabId, false);
      this.saveTabsMetadata();
      this.emit('tabSaved', tab);
      
      return true;
    } catch (error) {
      console.error(`Failed to save tab ${tabId}:`, error);
      return false;
    }
  }

  /**
   * Loads a tab's state from localStorage
   */
  async loadTab(tabId: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;

    try {
      const storageKey = tab.isMain ? 'flow_builder_graph' : this.getStorageKey(tabId);
      const savedData = localStorage.getItem(storageKey);
      
      if (savedData) {
        const graphState = JSON.parse(savedData);
        
        // Ensure ViewState is properly initialized
        if (!graphState.viewState || !graphState.viewState.navigationPath || graphState.viewState.navigationPath.length === 0) {
          graphState.viewState = {
            ...createDefaultViewState(),
            ...graphState.viewState,
            navigationPath: [{ graphId: 'root', label: 'Main Flow' }]
          };
        }
        
        tab.graphState = graphState;
        this.markTabDirty(tabId, false);
        this.emit('tabLoaded', tab);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Failed to load tab ${tabId}:`, error);
      return false;
    }
  }

  /**
   * Gets all tabs
   */
  getTabs(): FlowTab[] {
    return Array.from(this.tabs.values());
  }

  /**
   * Gets active tab
   */
  getActiveTab(): FlowTab | null {
    return this.activeTabId ? this.tabs.get(this.activeTabId) || null : null;
  }

  /**
   * Gets a specific tab
   */
  getTab(tabId: string): FlowTab | null {
    return this.tabs.get(tabId) || null;
  }

  /**
   * Gets the next tab in sequence
   */
  getNextTab(): FlowTab | null {
    const tabs = this.getTabs();
    if (tabs.length <= 1) return null;
    
    const currentIndex = tabs.findIndex(t => t.id === this.activeTabId);
    const nextIndex = (currentIndex + 1) % tabs.length;
    
    return tabs[nextIndex];
  }

  /**
   * Gets the previous tab in sequence
   */
  getPreviousTab(): FlowTab | null {
    const tabs = this.getTabs();
    if (tabs.length <= 1) return null;
    
    const currentIndex = tabs.findIndex(t => t.id === this.activeTabId);
    const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
    
    return tabs[prevIndex];
  }

  /**
   * Gets tab by index (for Ctrl+1-9 shortcuts)
   */
  getTabByIndex(index: number): FlowTab | null {
    const tabs = this.getTabs();
    return tabs[index] || null;
  }

  /**
   * Checks if there are unsaved changes
   */
  hasUnsavedChanges(): boolean {
    return Array.from(this.tabs.values()).some(tab => tab.isDirty);
  }

  /**
   * Gets the count of dirty tabs
   */
  getDirtyTabCount(): number {
    return Array.from(this.tabs.values()).filter(tab => tab.isDirty).length;
  }

  private getStorageKey(tabId: string): string {
    return `${this.STORAGE_PREFIX}${tabId}`;
  }

  private saveTabsMetadata(): void {
    const metadata = Array.from(this.tabs.values()).map(tab => ({
      id: tab.id,
      name: tab.name,
      isMain: tab.isMain,
      lastSaved: tab.lastSaved,
    }));
    
    localStorage.setItem(this.TABS_METADATA_KEY, JSON.stringify({
      tabs: metadata,
      activeTabId: this.activeTabId,
      nextTabId: this.nextTabId,
    }));
  }

  private loadTabsFromStorage(): void {
    try {
      const metadataStr = localStorage.getItem(this.TABS_METADATA_KEY);
      if (!metadataStr) {
        // Create main tab if no metadata exists
        this.createMainTab();
        return;
      }

      const metadata = JSON.parse(metadataStr);
      this.nextTabId = metadata.nextTabId || 1;
      this.activeTabId = metadata.activeTabId;

      // Restore tabs
      for (const tabMeta of metadata.tabs || []) {
        const tab: FlowTab = {
          id: tabMeta.id,
          name: tabMeta.name,
          isDirty: false,
          isMain: tabMeta.isMain,
          lastSaved: tabMeta.lastSaved ? new Date(tabMeta.lastSaved) : undefined,
                     graphState: {
             nodes: [],
             connections: [],
             stickyNotes: [],
             nodeGroups: [],
             viewState: createDefaultViewState(),
           },
        };

        this.tabs.set(tab.id, tab);
      }

      // Ensure we have at least a main tab
      if (!this.tabs.has('main')) {
        this.createMainTab();
      }

      // Ensure active tab exists
      if (!this.activeTabId || !this.tabs.has(this.activeTabId)) {
        this.activeTabId = this.tabs.has('main') ? 'main' : (this.tabs.keys().next().value || null);
      }

    } catch (error) {
      console.error('Failed to load tabs metadata:', error);
      // Fallback to main tab
      this.createMainTab();
    }
  }

  /**
   * Clears all tab data (for reset/clear operations)
   */
  clearAllTabs(): void {
    // Remove all tab data from localStorage
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    
    localStorage.removeItem(this.TABS_METADATA_KEY);
    
    // Reset state
    this.tabs.clear();
    this.nextTabId = 1;
    this.activeTabId = null;
    
    // Create fresh main tab
    this.createMainTab();
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    this.removeAllListeners();
    this.tabs.clear();
  }
} 