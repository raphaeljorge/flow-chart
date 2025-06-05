// src/editor/components/ContextMenu/ContextMenu.ts
import { EventEmitter } from 'eventemitter3';
import { Point, InteractiveElementType } from '../../core/types';
import { EditorIconService } from '../../services/EditorIconService';
import './ContextMenu.css'; // Co-located CSS

export interface ContextMenuItemAction {
  id: string;
  label: string;
  iconName?: string; // Icon name like 'ph-plus'
  disabled?: boolean | (() => boolean); // Can be a boolean or a function that returns a boolean
  action: () => void;
  separatorBefore?: boolean;
  isSubmenu?: boolean; // If this item opens a submenu (not implemented in this basic version)
  // submenuItems?: ContextMenuItemAction[]; // For future submenu implementation
}

export interface ContextMenuContext {
  targetType: InteractiveElementType;
  targetId?: string; // ID of the node, connection, etc.
  // Potentially add more contextual info like selected items count, etc.
  canvasPoint?: Point; // Canvas coordinates of the context menu invocation
  clientPoint?: Point; // Client coordinates
}

export class ContextMenu {
  private wrapper: HTMLElement; // The overlay container where the menu is appended
  private menuElement: HTMLElement | null = null;
  private events: EventEmitter;
  private currentContext: ContextMenuContext | null = null;

  constructor(
    wrapperElement: HTMLElement, // e.g., the .editor-overlay-container
    private iconService: EditorIconService
  ) {
    this.wrapper = wrapperElement;
    this.events = new EventEmitter();
    // Global click listener to hide the menu is now managed by NodeEditorController or InteractionManager
    // to prevent multiple listeners if ContextMenu is re-instantiated.
    // For now, let's keep it simple and attach it here.
    this.setupGlobalClickListener();
  }

  private createMenuElement(): void {
    if (this.menuElement) {
      this.menuElement.innerHTML = ''; // Clear existing items instead of removing and re-adding the element
    } else {
      this.menuElement = document.createElement('div');
      this.menuElement.className = 'editor-context-menu';
      this.menuElement.style.display = 'none'; // Initially hidden
      this.wrapper.appendChild(this.menuElement);
    }
  }

  public show(clientPosition: Point, context: ContextMenuContext, items: ContextMenuItemAction[]): void {
    this.currentContext = context;
    this.createMenuElement(); // Ensure it exists and is cleared

    if (!this.menuElement || items.length === 0) {
      this.hide();
      return;
    }

    items.forEach(itemDef => {
      if (itemDef.separatorBefore) {
        const separator = document.createElement('div');
        separator.className = 'context-menu-separator';
        this.menuElement!.appendChild(separator);
      }

      const isDisabled = typeof itemDef.disabled === 'function' ? itemDef.disabled() : !!itemDef.disabled;

      const itemElement = document.createElement('div');
      itemElement.className = 'context-menu-item';
      if (isDisabled) {
        itemElement.classList.add('disabled');
      }

      let iconHTML = '';
      if (itemDef.iconName) {
        iconHTML = this.iconService.getIconHTMLString(itemDef.iconName, { className: 'menu-item-icon' });
      }

      itemElement.innerHTML = `${iconHTML}<span>${itemDef.label}</span>`;

      if (!isDisabled) {
        itemElement.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent global click listener from hiding immediately
          itemDef.action();
          this.events.emit('itemClicked', itemDef.id, this.currentContext);
          this.hide(); // Hide after action
        });
      }
      this.menuElement!.appendChild(itemElement);
    });

    // Position the menu
    // Adjust if it would go off-screen
    this.menuElement.style.display = 'block'; // Show it first to get dimensions
    const menuRect = this.menuElement.getBoundingClientRect();
    const wrapperRect = this.wrapper.getBoundingClientRect(); // Assuming wrapper is the viewport or positioned parent

    let x = clientPosition.x;
    let y = clientPosition.y;

    // Adjust horizontal position
    if (x + menuRect.width > wrapperRect.left + wrapperRect.width) {
      x = clientPosition.x - menuRect.width;
    }
    // Adjust vertical position
    if (y + menuRect.height > wrapperRect.top + wrapperRect.height) {
      y = clientPosition.y - menuRect.height;
    }
    // Ensure it's not off-screen top/left
    x = Math.max(wrapperRect.left, x);
    y = Math.max(wrapperRect.top, y);


    this.menuElement.style.left = `${x - wrapperRect.left}px`; // Position relative to wrapper
    this.menuElement.style.top = `${y - wrapperRect.top}px`;
    // Ensure menu is interactable
    this.menuElement.style.pointerEvents = 'auto';


    this.events.emit('shown', clientPosition, context);
  }

  public hide(): void {
    if (this.menuElement) {
      this.menuElement.style.display = 'none';
      this.menuElement.style.pointerEvents = 'none'; // Make non-interactable
      this.events.emit('hidden');
    }
    this.currentContext = null;
  }

  private handleGlobalClick = (e: MouseEvent): void => {
    if (this.menuElement && this.menuElement.style.display === 'block') {
      if (!this.menuElement.contains(e.target as Node)) {
        this.hide();
      }
    }
  };

  private setupGlobalClickListener(): void {
    // Use a bound version of the handler for add/removeEventListener
    document.addEventListener('mousedown', this.handleGlobalClick, true); // Use mousedown and capture phase
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    this.events.on(event, listener);
    return this;
  }

  public off(event: string, listener: (...args: any[]) => void): this {
    this.events.off(event, listener);
    return this;
  }

  public destroy(): void {
    document.removeEventListener('mousedown', this.handleGlobalClick, true);
    this.menuElement?.remove();
    this.events.removeAllListeners();
  }
}