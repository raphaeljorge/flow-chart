import { EventEmitter } from "eventemitter3";
import { TabManager, FlowTab } from "../state/TabManager";
import { TabBar } from "../components/TabBar/TabBar";
import { NodeEditorController } from "./NodeEditorController";
import { GraphState } from "../core/types";

export interface TabControllerEvents {
  activeTabChanged: (tab: FlowTab) => void;
  tabStateChanged: (tabs: FlowTab[], activeTab: FlowTab | null) => void;
  unsavedChangesWarning: (tabCount: number) => void;
}

export class TabController extends EventEmitter<TabControllerEvents> {
  private tabManager: TabManager;
  private tabBar: TabBar;
  private editorControllers: Map<string, NodeEditorController> = new Map();
  private currentController: NodeEditorController | null = null;
  private contextMenu: HTMLElement | null = null;

  constructor(
    tabBarContainer: HTMLElement,
    private canvasContainer: HTMLElement,
    private editorOptions: any
  ) {
    super();
    
    this.tabManager = new TabManager();
    this.tabBar = new TabBar(tabBarContainer);
    
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.initializeFirstTab();
  }

  private setupEventListeners(): void {
    // TabManager events
    this.tabManager.on('tabCreated', (tab) => {
      this.updateTabBarState();
    });

    this.tabManager.on('tabClosed', (tabId) => {
      // Clean up editor controller
      const controller = this.editorControllers.get(tabId);
      if (controller) {
        controller.destroy();
        this.editorControllers.delete(tabId);
      }
      this.updateTabBarState();
    });

    this.tabManager.on('tabSwitched', (tab) => {
      this.switchToTab(tab);
    });

    this.tabManager.on('tabRenamed', (tab) => {
      this.tabBar.updateTabName(tab.id, tab.name);
    });

    this.tabManager.on('tabDirtyStateChanged', (tab) => {
      this.tabBar.updateTabDirtyState(tab.id, tab.isDirty);
    });

    // TabBar events
    this.tabBar.on('tabClicked', (tabId) => {
      this.tabManager.switchToTab(tabId);
    });

    this.tabBar.on('tabClosed', (tabId) => {
      this.closeTab(tabId);
    });

    this.tabBar.on('tabRenamed', (tabId, newName) => {
      this.tabManager.renameTab(tabId, newName);
    });

    this.tabBar.on('newTabClicked', () => {
      this.createNewTab();
    });

    this.tabBar.on('tabContextMenu', (tabId, event) => {
      this.showTabContextMenu(tabId, event);
    });
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + T: New Tab
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        this.createNewTab();
        return;
      }

      // Ctrl/Cmd + W: Close Tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        const activeTab = this.tabManager.getActiveTab();
        if (activeTab) {
          this.closeTab(activeTab.id);
        }
        return;
      }

      // Ctrl/Cmd + Tab: Switch to next tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
        e.preventDefault();
        const nextTab = e.shiftKey ? 
          this.tabManager.getPreviousTab() : 
          this.tabManager.getNextTab();
        if (nextTab) {
          this.tabManager.switchToTab(nextTab.id);
        }
        return;
      }

      // Ctrl/Cmd + 1-9: Direct tab access
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        const tab = this.tabManager.getTabByIndex(tabIndex);
        if (tab) {
          this.tabManager.switchToTab(tab.id);
        }
        return;
      }

      // Ctrl/Cmd + S: Save current tab
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.saveCurrentTab();
        return;
      }

      // Ctrl/Cmd + Shift + S: Save all tabs
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        this.saveAllTabs();
        return;
      }
    });
  }

  private async initializeFirstTab(): Promise<void> {
    // Create main tab if it doesn't exist
    let mainTab = this.tabManager.getTab('main');
    if (!mainTab) {
      mainTab = this.tabManager.createMainTab();
    }

    // Try to load saved state for main tab
    await this.tabManager.loadTab('main');
    
    // Switch to main tab
    this.tabManager.switchToTab('main');
    this.updateTabBarState();
  }

  public createNewTab(name?: string): FlowTab {
    const tab = this.tabManager.createTab(name);
    this.tabManager.switchToTab(tab.id);
    return tab;
  }

  public async closeTab(tabId: string): Promise<boolean> {
    const tab = this.tabManager.getTab(tabId);
    if (!tab) return false;

    // Check for unsaved changes
    if (tab.isDirty) {
      const shouldSave = await this.confirmUnsavedChanges(tab);
      if (shouldSave === null) return false; // Cancelled
      if (shouldSave) {
        await this.tabManager.saveTab(tabId);
      }
    }

    return this.tabManager.closeTab(tabId);
  }

  private async confirmUnsavedChanges(tab: FlowTab): Promise<boolean | null> {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'unsaved-changes-modal';
      modal.innerHTML = `
        <div class="modal-backdrop" onclick="handleCancel()"></div>
        <div class="modal-content">
          <h3>Unsaved Changes</h3>
          <p>Tab "${tab.name}" has unsaved changes. Do you want to save them?</p>
          <div class="modal-buttons">
            <button class="btn btn-danger" onclick="handleDiscard()">Discard</button>
            <button class="btn btn-secondary" onclick="handleCancel()">Cancel</button>
            <button class="btn btn-primary" onclick="handleSave()">Save</button>
          </div>
        </div>
      `;

      // Add global handlers
      (window as any).handleSave = () => {
        document.body.removeChild(modal);
        resolve(true);
      };
      (window as any).handleDiscard = () => {
        document.body.removeChild(modal);
        resolve(false);
      };
      (window as any).handleCancel = () => {
        document.body.removeChild(modal);
        resolve(null);
      };

      document.body.appendChild(modal);
    });
  }

  private async switchToTab(tab: FlowTab): Promise<void> {
    // Save current tab state before switching
    if (this.currentController) {
      const activeTab = this.tabManager.getActiveTab();
      if (activeTab) {
        const currentState = this.currentController.getGraphState();
        this.tabManager.updateTabState(activeTab.id, currentState);
      }
    }

    // Get or create editor controller for the tab
    let controller = this.editorControllers.get(tab.id);
    if (!controller) {
      controller = await this.createEditorController(tab);
      this.editorControllers.set(tab.id, controller);
    }

    // Hide current controller
    if (this.currentController && this.currentController !== controller) {
      (this.currentController as any).container.style.display = 'none';
    }

    // Show new controller
    (controller as any).container.style.display = 'block';
    this.currentController = controller;

    // Load tab state into controller
    controller.setGraphState(tab.graphState, false);

    // Update UI
    this.tabBar.setActiveTab(tab.id);
    this.emit('activeTabChanged', tab);
    this.emit('tabStateChanged', this.tabManager.getTabs(), tab);
  }

  private async createEditorController(tab: FlowTab): Promise<NodeEditorController> {
    // Create a container for this tab's editor
    const editorContainer = document.createElement('div');
    editorContainer.className = 'tab-editor-container';
    editorContainer.style.display = 'none';
    editorContainer.style.width = '100%';
    editorContainer.style.height = '100%';
    this.canvasContainer.appendChild(editorContainer);

    // Create the editor controller
    const controller = new NodeEditorController(editorContainer, {
      ...this.editorOptions,
      // Override storage key for non-main tabs
      storageKey: tab.isMain ? undefined : `flow_tab_${tab.id}`,
    });

    // Wait for controller to be ready
    await new Promise<void>((resolve) => {
      controller.on('ready', () => resolve());
    });

    // Setup dirty state tracking for this controller (only once)
    this.setupDirtyStateTracking(tab.id, controller);

    return controller;
  }

  private setupDirtyStateTracking(tabId: string, controller: NodeEditorController): void {
    // Add listeners for dirty state tracking
    const handleGraphChange = () => {
      this.tabManager.markTabDirty(tabId, true);
    };

    const handleGraphSaved = () => {
      this.tabManager.markTabDirty(tabId, false);
    };

    // Listen for any changes that should mark the tab dirty
    controller.on('nodeAdded', handleGraphChange);
    controller.on('nodeRemoved', handleGraphChange);
    controller.on('nodeUpdated', handleGraphChange);
    controller.on('connectionAdded', handleGraphChange);
    controller.on('connectionRemoved', handleGraphChange);
    controller.on('stickyNoteAdded', handleGraphChange);
    controller.on('stickyNoteRemoved', handleGraphChange);
    controller.on('stickyNoteUpdated', handleGraphChange);

    // Listen for save events
    controller.on('graphSaved', handleGraphSaved);

    // Store references for cleanup
    (controller as any)._tabHandlers = { 
      handleGraphChange, 
      handleGraphSaved,
      events: [
        'nodeAdded', 'nodeRemoved', 'nodeUpdated',
        'connectionAdded', 'connectionRemoved',
        'stickyNoteAdded', 'stickyNoteRemoved', 'stickyNoteUpdated',
        'graphSaved'
      ]
    };
  }

  private showTabContextMenu(tabId: string, event: MouseEvent): void {
    // Simple context menu for now
    console.log('Context menu for tab:', tabId, event);
  }

  public async saveCurrentTab(): Promise<boolean> {
    const activeTab = this.tabManager.getActiveTab();
    if (!activeTab || !this.currentController) return false;

    // Update tab state with current controller state
    const currentState = this.currentController.getGraphState();
    this.tabManager.updateTabState(activeTab.id, currentState);

    // Save to storage
    return await this.tabManager.saveTab(activeTab.id);
  }

  public async saveAllTabs(): Promise<void> {
    const tabs = this.tabManager.getTabs();
    const savePromises = tabs.map(tab => this.tabManager.saveTab(tab.id));
    await Promise.all(savePromises);
  }

  private updateTabBarState(): void {
    const tabs = this.tabManager.getTabs();
    const activeTab = this.tabManager.getActiveTab();
    this.tabBar.updateTabs(tabs, activeTab?.id || null);
    this.emit('tabStateChanged', tabs, activeTab);
  }

  // Public API
  public getActiveTab(): FlowTab | null {
    return this.tabManager.getActiveTab();
  }

  public getCurrentController(): NodeEditorController | null {
    return this.currentController;
  }

  public getTabs(): FlowTab[] {
    return this.tabManager.getTabs();
  }

  public hasUnsavedChanges(): boolean {
    return this.tabManager.hasUnsavedChanges();
  }

  public destroy(): void {
    // Clean up all editor controllers
    this.editorControllers.forEach(controller => controller.destroy());
    this.editorControllers.clear();

    // Clean up components
    this.tabBar.destroy();
    this.tabManager.destroy();

    // Clean up event listeners
    this.removeAllListeners();
  }
} 