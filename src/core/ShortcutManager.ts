// src/core/ShortcutManager.ts
import { EventEmitter } from 'eventemitter3';

interface ShortcutAction {
  id: string; 
}

interface ShortcutDefinition {
  key: string; 
  ctrlKey?: boolean;
  metaKey?: boolean; 
  shiftKey?: boolean;
  altKey?: boolean;
  actionId: string;
  preventDefault?: boolean;
  target?: EventTarget | Document;
}

export class ShortcutManager {
  private events: EventEmitter;
  private shortcuts: Map<string, ShortcutDefinition[]>; 
  private activeElement: EventTarget | Document;

  constructor(targetElement: EventTarget | Document = document) {
    this.events = new EventEmitter();
    this.shortcuts = new Map();
    this.activeElement = targetElement;
    this.initializeDefaultShortcuts(); 
    this.setupEventListeners();
  }

  private initializeDefaultShortcuts(): void {
    this.registerShortcut({ key: 'C', ctrlKey: true, metaKey: true, actionId: 'copy', preventDefault: true });
    this.registerShortcut({ key: 'V', ctrlKey: true, metaKey: true, actionId: 'paste', preventDefault: true });
    this.registerShortcut({ key: 'Delete', actionId: 'delete', preventDefault: true });
    this.registerShortcut({ key: 'Backspace', actionId: 'delete', preventDefault: true });
    this.registerShortcut({ key: 'R', actionId: 'resetView', preventDefault: false });
    this.registerShortcut({ key: 'G', actionId: 'toggleGrid', preventDefault: true });
    this.registerShortcut({ key: 'S', actionId: 'toggleSnapToGrid', preventDefault: true });
    this.registerShortcut({ key: 'F', actionId: 'zoomToFit', preventDefault: true });
    
    // Novos atalhos para Undo/Redo
    this.registerShortcut({ key: 'Z', ctrlKey: true, metaKey: true, actionId: 'undo', preventDefault: true }); // Ctrl+Z ou Cmd+Z
    this.registerShortcut({ key: 'Y', ctrlKey: true, metaKey: true, actionId: 'redo', preventDefault: true }); // Ctrl+Y ou Cmd+Y
    this.registerShortcut({ key: 'Z', ctrlKey: true, metaKey: true, shiftKey: true, actionId: 'redo', preventDefault: true }); // Ctrl+Shift+Z ou Cmd+Shift+Z (alternativa para redo)
  
    this.registerShortcut({ key: 'F', shiftKey: true, actionId: 'zoomToSelection', preventDefault: true }); // Shift+F
  }

  public registerShortcut(shortcutDef: ShortcutDefinition): void {
    const actionShortcuts = this.shortcuts.get(shortcutDef.actionId) || [];
    actionShortcuts.push(shortcutDef);
    this.shortcuts.set(shortcutDef.actionId, actionShortcuts);
  }

  private setupEventListeners(): void {
    this.activeElement.addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const targetElement = e.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(targetElement.tagName) && !targetElement.classList.contains('quick-add-input')) {
        if (!(e.key === 'Escape')) { 
             return;
        }
    }
    
    for (const [actionId, definitions] of this.shortcuts.entries()) {
      for (const def of definitions) {
        const ctrlOrMeta = def.metaKey ? e.metaKey : e.ctrlKey; 

        if (
          e.key.toUpperCase() === def.key.toUpperCase() &&
          (def.ctrlKey || def.metaKey ? ctrlOrMeta : true) && 
          (def.shiftKey === undefined || e.shiftKey === def.shiftKey) &&
          (def.altKey === undefined || e.altKey === def.altKey)
        ) {
          if (def.preventDefault) {
            e.preventDefault();
          }
          this.events.emit(actionId, e); 
          return; 
        }
      }
    }
  };

  public on(actionId: string, listener: (event?: KeyboardEvent) => void): this {
    this.events.on(actionId, listener);
    return this;
  }

  public off(actionId: string, listener: (event?: KeyboardEvent) => void): this {
    this.events.off(actionId, listener);
    return this;
  }

  public destroy(): void {
    this.activeElement.removeEventListener('keydown', this.handleKeyDown);
    this.events.removeAllListeners();
    this.shortcuts.clear();
  }
}