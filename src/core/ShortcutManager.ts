import { EventEmitter } from 'eventemitter3';

interface ShortcutAction {
  id: string; // Identificador da ação, ex: 'copy', 'paste', 'delete'
  // Ação pode ser um callback direto ou um evento a ser emitido
  // Vamos usar eventos para maior desacoplamento
}

interface ShortcutDefinition {
  key: string; // Ex: 'C', 'V', 'Delete', 'Backspace', 'R'
  ctrlKey?: boolean;
  metaKey?: boolean; // Para Cmd no macOS
  shiftKey?: boolean;
  altKey?: boolean;
  actionId: string;
  preventDefault?: boolean;
  target?: EventTarget | Document; // Onde o listener será anexado, padrão para document
}

export class ShortcutManager {
  private events: EventEmitter;
  private shortcuts: Map<string, ShortcutDefinition[]>; // Mapeia 'actionId' para uma lista de suas possíveis definições de atalho
  private activeElement: EventTarget | Document;

  constructor(targetElement: EventTarget | Document = document) {
    this.events = new EventEmitter();
    this.shortcuts = new Map();
    this.activeElement = targetElement;
    this.initializeDefaultShortcuts(); // Atalhos que estavam no NodeEditor
    this.setupEventListeners();
  }

  private initializeDefaultShortcuts(): void {
    // Atalhos baseados no seu NodeEditor.ts original
    this.registerShortcut({ key: 'C', ctrlKey: true, metaKey: true, actionId: 'copy', preventDefault: true }); // Ctrl+C ou Cmd+C
    this.registerShortcut({ key: 'V', ctrlKey: true, metaKey: true, actionId: 'paste', preventDefault: true }); // Ctrl+V ou Cmd+V
    this.registerShortcut({ key: 'Delete', actionId: 'delete', preventDefault: true });
    this.registerShortcut({ key: 'Backspace', actionId: 'delete', preventDefault: true });
    this.registerShortcut({ key: 'R', actionId: 'resetView', preventDefault: false }); // R para resetar a view
    this.registerShortcut({ key: 'G', actionId: 'toggleGrid', preventDefault: true }); 
    this.registerShortcut({ key: 'S', actionId: 'toggleSnapToGrid', preventDefault: true }); 
    this.registerShortcut({ key: 'F', actionId: 'zoomToFit', preventDefault: true }); 
    // Adicionar mais atalhos conforme necessário (ex: Z para Undo, Y para Redo)
  }

  public registerShortcut(shortcutDef: ShortcutDefinition): void {
    const actionShortcuts = this.shortcuts.get(shortcutDef.actionId) || [];
    // Poderia verificar por conflitos aqui se desejado
    actionShortcuts.push(shortcutDef);
    this.shortcuts.set(shortcutDef.actionId, actionShortcuts);
  }

  private setupEventListeners(): void {
    this.activeElement.addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Ignorar atalhos se o foco estiver em um input, textarea, etc.,
    // a menos que o atalho seja especificamente para esses casos.
    const targetElement = e.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(targetElement.tagName) && !targetElement.classList.contains('quick-add-input')) { // Permite atalhos no quick-add
        // Poderíamos ter uma propriedade no ShortcutDefinition para "allowInInput"
        if (!(e.key === 'Escape')) { // Permite Escape para fechar popups, por exemplo
             return;
        }
    }
    
    for (const [actionId, definitions] of this.shortcuts.entries()) {
      for (const def of definitions) {
        const ctrlOrMeta = def.metaKey ? e.metaKey : e.ctrlKey; // Prioriza metaKey (Cmd) se especificado, senão usa ctrlKey

        if (
          e.key.toUpperCase() === def.key.toUpperCase() &&
          (def.ctrlKey || def.metaKey ? ctrlOrMeta : true) && // Verifica Ctrl ou Meta apenas se especificado
          (def.shiftKey === undefined || e.shiftKey === def.shiftKey) &&
          (def.altKey === undefined || e.altKey === def.altKey)
        ) {
          if (def.preventDefault) {
            e.preventDefault();
          }
          this.events.emit(actionId, e); // Emite o evento da ação
          return; // Atalho encontrado e processado
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