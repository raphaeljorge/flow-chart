import { EventEmitter } from "eventemitter3";
import { FlowTab } from "../../state/TabManager";

export interface TabBarEvents {
  tabClicked: (tabId: string) => void;
  tabClosed: (tabId: string) => void;
  tabRenamed: (tabId: string, newName: string) => void;
  newTabClicked: () => void;
  tabContextMenu: (tabId: string, event: MouseEvent) => void;
}

export class TabBar extends EventEmitter<TabBarEvents> {
  private container: HTMLElement;
  private tabsContainer!: HTMLElement;
  private newTabButton!: HTMLElement;
  private tabs: Map<string, HTMLElement> = new Map();
  private activeTabId: string | null = null;
  private renamingTabId: string | null = null;

  constructor(container: HTMLElement) {
    super();
    this.container = container;
    this.init();
  }

  private init(): void {
    this.container.className = 'tab-bar';
    this.container.innerHTML = `
      <div class="tab-bar-content">
        <div class="tabs-container" role="tablist"></div>
        <button class="new-tab-button" title="New Tab (Ctrl+T)" role="button" aria-label="Add new tab">
          <i class="ph ph-plus"></i>
        </button>
      </div>
    `;

    this.tabsContainer = this.container.querySelector('.tabs-container')!;
    this.newTabButton = this.container.querySelector('.new-tab-button')!;

    this.wireUpEvents();
  }

  private wireUpEvents(): void {
    this.newTabButton.addEventListener('click', () => {
      this.emit('newTabClicked');
    });

    // Handle tab clicks, close buttons, and context menus
    this.tabsContainer.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const tab = target.closest('.tab') as HTMLElement;
      
      if (!tab) return;
      
      const tabId = tab.dataset.tabId!;
      
      if (target.classList.contains('tab-close')) {
        e.stopPropagation();
        this.emit('tabClosed', tabId);
      } else if (!target.classList.contains('tab-title-input')) {
        this.emit('tabClicked', tabId);
      }
    });

    // Handle context menus
    this.tabsContainer.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const tab = (e.target as HTMLElement).closest('.tab') as HTMLElement;
      if (tab) {
        const tabId = tab.dataset.tabId!;
        this.emit('tabContextMenu', tabId, e as MouseEvent);
      }
    });

    // Handle double-click for renaming
    this.tabsContainer.addEventListener('dblclick', (e) => {
      const tab = (e.target as HTMLElement).closest('.tab') as HTMLElement;
      if (tab && !tab.classList.contains('tab-main')) {
        const tabId = tab.dataset.tabId!;
        this.startRenaming(tabId);
      }
    });

    // Handle keyboard events for renaming
    this.tabsContainer.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement && e.target.classList.contains('tab-title-input')) {
        if (e.key === 'Enter') {
          this.finishRenaming(true);
        } else if (e.key === 'Escape') {
          this.finishRenaming(false);
        }
      }
    });

    this.tabsContainer.addEventListener('blur', (e) => {
      if (e.target instanceof HTMLInputElement && e.target.classList.contains('tab-title-input')) {
        this.finishRenaming(true);
      }
    }, true);
  }

  public updateTabs(tabs: FlowTab[], activeTabId: string | null): void {
    // Clear existing tabs
    this.tabs.clear();
    this.tabsContainer.innerHTML = '';
    this.activeTabId = activeTabId;

    // Sort tabs to put main tab first
    const sortedTabs = [...tabs].sort((a, b) => {
      if (a.isMain && !b.isMain) return -1;
      if (!a.isMain && b.isMain) return 1;
      return 0;
    });

    // Create tab elements
    sortedTabs.forEach(tab => {
      const tabElement = this.createTabElement(tab);
      this.tabs.set(tab.id, tabElement);
      this.tabsContainer.appendChild(tabElement);
    });

    // Update visual state
    this.updateActiveTab();
  }

  private createTabElement(tab: FlowTab): HTMLElement {
    const tabElement = document.createElement('div');
    tabElement.className = `tab ${tab.isMain ? 'tab-main' : ''} ${tab.isDirty ? 'tab-dirty' : ''}`;
    tabElement.dataset.tabId = tab.id;
    tabElement.setAttribute('role', 'tab');
    tabElement.setAttribute('aria-selected', 'false');
    tabElement.title = `${tab.name}${tab.isDirty ? ' (unsaved)' : ''}`;

    const closeButton = !tab.isMain || this.tabs.size > 0 ? 
      '<button class="tab-close" title="Close tab" aria-label="Close tab"><i class="ph ph-x"></i></button>' : '';

    tabElement.innerHTML = `
      <span class="tab-icon">
        ${tab.isMain ? '<i class="ph ph-house"></i>' : '<i class="ph ph-file"></i>'}
      </span>
      <span class="tab-title">${tab.name}</span>
      ${closeButton}
    `;

    // Add dirty indicator if needed using the same method as updateTabDirtyState
    if (tab.isDirty) {
      const indicator = document.createElement('span');
      indicator.className = 'tab-dirty-indicator';
      indicator.textContent = '●';
      
      const closeBtn = tabElement.querySelector('.tab-close');
      if (closeBtn) {
        tabElement.insertBefore(indicator, closeBtn);
      } else {
        tabElement.appendChild(indicator);
      }
    }

    return tabElement;
  }

  private updateActiveTab(): void {
    this.tabs.forEach((tabElement, tabId) => {
      const isActive = tabId === this.activeTabId;
      tabElement.classList.toggle('tab-active', isActive);
      tabElement.setAttribute('aria-selected', isActive.toString());
    });
  }

  public setActiveTab(tabId: string): void {
    this.activeTabId = tabId;
    this.updateActiveTab();
  }

  public updateTabDirtyState(tabId: string, isDirty: boolean): void {
    const tabElement = this.tabs.get(tabId);
    if (!tabElement) return;

    tabElement.classList.toggle('tab-dirty', isDirty);
    
    const dirtyIndicator = tabElement.querySelector('.tab-dirty-indicator');
    if (isDirty && !dirtyIndicator) {
      const indicator = document.createElement('span');
      indicator.className = 'tab-dirty-indicator';
      indicator.textContent = '●';
      
      const closeButton = tabElement.querySelector('.tab-close');
      if (closeButton) {
        tabElement.insertBefore(indicator, closeButton);
      } else {
        tabElement.appendChild(indicator);
      }
    } else if (!isDirty && dirtyIndicator) {
      dirtyIndicator.remove();
    }

    // Update title
    const tab = tabElement;
    const tabTitle = tab.querySelector('.tab-title')?.textContent || '';
    tab.title = `${tabTitle}${isDirty ? ' (unsaved)' : ''}`;
  }

  public updateTabName(tabId: string, newName: string): void {
    const tabElement = this.tabs.get(tabId);
    if (!tabElement) return;

    const titleElement = tabElement.querySelector('.tab-title');
    if (titleElement) {
      titleElement.textContent = newName;
    }

    // Update title attribute
    const isDirty = tabElement.classList.contains('tab-dirty');
    tabElement.title = `${newName}${isDirty ? ' (unsaved)' : ''}`;
  }

  public startRenaming(tabId: string): void {
    if (this.renamingTabId) {
      this.finishRenaming(false); // Cancel any existing rename
    }

    const tabElement = this.tabs.get(tabId);
    if (!tabElement) return;

    const titleElement = tabElement.querySelector('.tab-title');
    if (!titleElement) return;

    const currentName = titleElement.textContent || '';
    this.renamingTabId = tabId;

    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tab-title-input';
    input.value = currentName;
    input.setAttribute('aria-label', 'Rename tab');

    // Replace title with input
    (titleElement as HTMLElement).style.display = 'none';
    titleElement.parentNode!.insertBefore(input, titleElement.nextSibling);

    // Focus and select all text
    input.focus();
    input.select();
  }

  private finishRenaming(save: boolean): void {
    if (!this.renamingTabId) return;

    const tabElement = this.tabs.get(this.renamingTabId);
    if (!tabElement) {
      this.renamingTabId = null;
      return;
    }

    const input = tabElement.querySelector('.tab-title-input') as HTMLInputElement;
    const titleElement = tabElement.querySelector('.tab-title');
    
    if (!input || !titleElement) {
      this.renamingTabId = null;
      return;
    }

    if (save && input.value.trim() !== '') {
      const newName = input.value.trim();
      titleElement.textContent = newName;
      this.emit('tabRenamed', this.renamingTabId, newName);
    }

    // Remove input and show title
    input.remove();
    (titleElement as HTMLElement).style.display = '';
    this.renamingTabId = null;
  }

  public highlightTab(tabId: string, duration: number = 1000): void {
    const tabElement = this.tabs.get(tabId);
    if (!tabElement) return;

    tabElement.classList.add('tab-highlighted');
    setTimeout(() => {
      tabElement.classList.remove('tab-highlighted');
    }, duration);
  }

  public getTabElement(tabId: string): HTMLElement | null {
    return this.tabs.get(tabId) || null;
  }

  public destroy(): void {
    this.removeAllListeners();
    this.tabs.clear();
    this.container.innerHTML = '';
  }
} 