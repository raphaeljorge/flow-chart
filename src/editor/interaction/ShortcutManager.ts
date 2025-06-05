// src/editor/interaction/ShortcutManager.ts
import { EventEmitter } from 'eventemitter3';

interface ShortcutDefinition {
  key: string; // e.g., 'C', 'Delete', 'ArrowUp'
  ctrlKey?: boolean; // For Ctrl key on Windows/Linux
  metaKey?: boolean; // For Command key on macOS (usually treated as equivalent to ctrlKey for web apps)
  shiftKey?: boolean;
  altKey?: boolean;
  actionId: string; // Unique ID for the action to be emitted
  preventDefault?: boolean; // Whether to call event.preventDefault()
  // target?: EventTarget | Document; // Element to attach listener (default: document, set in constructor)
  // Consider adding a 'condition' function if shortcuts should only be active in certain modes
}

export class ShortcutManager {
  private events: EventEmitter;
  private shortcuts: Map<string, ShortcutDefinition[]>; // actionId -> array of definitions
  private activeTarget: EventTarget | Document; // The element listening for keydown events

  constructor(targetElement: EventTarget | Document = document) {
    this.events = new EventEmitter();
    this.shortcuts = new Map();
    this.activeTarget = targetElement;
    this.initializeDefaultShortcuts();
    this.setupEventListeners();
  }

  private initializeDefaultShortcuts(): void {
    // Note: For ctrlKey/metaKey, the handler will check for either based on platform conventions (e.g. e.metaKey || e.ctrlKey)
    this.registerShortcut({ key: 'C', ctrlKey: true, actionId: 'copy', preventDefault: true }); // Handles Cmd+C on Mac too
    this.registerShortcut({ key: 'V', ctrlKey: true, actionId: 'paste', preventDefault: true });
    this.registerShortcut({ key: 'X', ctrlKey: true, actionId: 'cut', preventDefault: true }); // Assuming cut is copy + delete

    this.registerShortcut({ key: 'Z', ctrlKey: true, actionId: 'undo', preventDefault: true });
    this.registerShortcut({ key: 'Y', ctrlKey: true, actionId: 'redo', preventDefault: true }); // Standard redo
    this.registerShortcut({ key: 'Z', ctrlKey: true, shiftKey: true, actionId: 'redo', preventDefault: true }); // Alternative redo (Cmd+Shift+Z)

    this.registerShortcut({ key: 'Delete', actionId: 'delete', preventDefault: true });
    this.registerShortcut({ key: 'Backspace', actionId: 'delete', preventDefault: true });

    this.registerShortcut({ key: 'A', ctrlKey: true, actionId: 'selectAll', preventDefault: true });

    this.registerShortcut({ key: 'G', actionId: 'toggleGrid', preventDefault: true });
    this.registerShortcut({ key: 'S', actionId: 'toggleSnapToGrid', preventDefault: true });
    this.registerShortcut({ key: 'F', actionId: 'zoomToFit', preventDefault: true });
    this.registerShortcut({ key: 'R', actionId: 'resetView', preventDefault: false }); // Allow 'r' for text input if not focused on canvas
    this.registerShortcut({ key: 'F', shiftKey: true, actionId: 'zoomToSelection', preventDefault: true });

    this.registerShortcut({ key: 'Escape', actionId: 'escape', preventDefault: false }); // General escape action
  }

  public registerShortcut(shortcutDef: Omit<ShortcutDefinition, 'target'>): void {
    const actionShortcuts = this.shortcuts.get(shortcutDef.actionId) || [];
    actionShortcuts.push(shortcutDef as ShortcutDefinition);
    this.shortcuts.set(shortcutDef.actionId, actionShortcuts);
  }

  private setupEventListeners(): void {
    // Ensure 'this' context is correct for handleKeyDown
    this.activeTarget.addEventListener('keydown', this.handleKeyDown as EventListener);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const targetElement = e.target as HTMLElement;

    // Ignore shortcuts if focus is on an input, textarea, or select, unless it's Escape
    // or a specific quick-add input
    if (
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetElement.tagName) &&
      !targetElement.isContentEditable && // Allow shortcuts if contentEditable (like sticky note text area)
      !targetElement.classList.contains('quick-add-input') && // Allow quick-add input to have its own key handling
      e.key !== 'Escape' // Always allow Escape
    ) {
      // For specific inputs like ConfigPanel, allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
      const isCtrlCmd = e.ctrlKey || e.metaKey;
      if (isCtrlCmd && ['A', 'C', 'V', 'X'].includes(e.key.toUpperCase())) {
          // Let the browser handle default input field shortcuts
      } else {
          return; // Otherwise, ignore other shortcuts for standard input fields
      }
    }


    for (const [actionId, definitions] of this.shortcuts.entries()) {
      for (const def of definitions) {
        const ctrlOrMetaPressed = def.ctrlKey ? (e.ctrlKey || e.metaKey) : true; // If ctrlKey is specified, either ctrl or meta must be pressed
        const shiftPressed = def.shiftKey ? e.shiftKey : true; // If shiftKey is specified, it must be pressed
        const altPressed = def.altKey ? e.altKey : true;     // If altKey is specified, it must be pressed

        // If a modifier is NOT specified in def, we usually mean it should NOT be pressed
        // This logic needs refinement: if def.ctrlKey is false/undefined, e.ctrlKey should be false.
        const ctrlOrMetaRequired = !!def.ctrlKey; // True if ctrl/meta is part of the shortcut definition
        const shiftRequired = !!def.shiftKey;
        const altRequired = !!def.altKey;

        const ctrlOrMetaMatch = ctrlOrMetaRequired ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
        const shiftMatch = shiftRequired ? e.shiftKey : !e.shiftKey;
        const altMatch = altRequired ? e.altKey : !e.altKey;


        if (
          e.key.toUpperCase() === def.key.toUpperCase() &&
          ctrlOrMetaMatch &&
          shiftMatch &&
          altMatch
        ) {
          if (def.preventDefault) {
            e.preventDefault();
            e.stopPropagation(); // Often good to stop propagation too
          }
          this.events.emit(actionId, e); // Emit the generic actionId
          return; // Shortcut found and handled
        }
      }
    }
  };

  public on(actionId: string, listener: (event: KeyboardEvent) => void): this {
    this.events.on(actionId, listener);
    return this;
  }

  public off(actionId: string, listener: (event: KeyboardEvent) => void): this {
    this.events.off(actionId, listener);
    return this;
  }

  public destroy(): void {
    this.activeTarget.removeEventListener('keydown', this.handleKeyDown as EventListener);
    this.events.removeAllListeners();
    this.shortcuts.clear();
  }
}