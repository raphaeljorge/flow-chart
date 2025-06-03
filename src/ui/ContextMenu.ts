// src/ui/ContextMenu.ts
import { EventEmitter } from 'eventemitter3';
import { Point } from '../core/Types';
// import { IconService } from '../editor/IconService'; // Para ícones nos itens do menu

export interface ContextMenuItemAction {
  id: string; // ID da ação, ex: 'add-node', 'delete-selected'
  label: string;
  iconClass?: string; // Classe do ícone (ex: 'ph-plus')
  disabled?: boolean | (() => boolean);
  action: () => void; // Callback a ser executado
  separatorBefore?: boolean;
}

export interface ContextMenuContext {
  targetType: 'canvas' | 'node' | 'stickyNote' | 'port' | 'connection'; // Tipo do alvo clicado
  targetId?: string; // ID do alvo, se aplicável
  // Outras informações contextuais podem ser adicionadas
}

export class ContextMenu {
  private menuElement: HTMLElement | null = null;
  private events: EventEmitter;
  private currentContext: ContextMenuContext | null = null;

  constructor(
    private container: HTMLElement, // Onde o menu será anexado (geralmente o container do editor ou document.body)
    /* private iconService: IconService */
  ) {
    this.events = new EventEmitter();
    this.setupGlobalClickListener();
  }

  private createMenuElement(): void {
    if (this.menuElement) this.menuElement.remove();
    this.menuElement = document.createElement('div');
    this.menuElement.className = 'context-menu'; //
    this.container.appendChild(this.menuElement);
  }

  public show(position: Point, context: ContextMenuContext, items: ContextMenuItemAction[]): void {
    this.currentContext = context;
    this.createMenuElement();
    if (!this.menuElement) return;

    this.menuElement.innerHTML = ''; // Limpa itens anteriores
    items.forEach(itemDef => {
      if (itemDef.separatorBefore) {
        const separator = document.createElement('div');
        separator.className = 'context-menu-separator'; // Estilizar no CSS
        this.menuElement!.appendChild(separator);
      }

      const isDisabled = typeof itemDef.disabled === 'function' ? itemDef.disabled() : !!itemDef.disabled;

      const itemElement = document.createElement('div');
      itemElement.className = 'context-menu-item'; //
      if (isDisabled) {
        itemElement.classList.add('disabled'); // Estilizar no CSS
      }
      
      let iconHTML = '';
      if (itemDef.iconClass /* && this.iconService */) {
        // iconHTML = this.iconService.getIconHTML(itemDef.iconClass, {className: 'menu-item-icon'});
        iconHTML = `<i class="ph ${itemDef.iconClass} menu-item-icon"></i>`; // Placeholder
      }

      itemElement.innerHTML = `${iconHTML}<span>${itemDef.label}</span>`;
      
      if (!isDisabled) {
        itemElement.addEventListener('click', (e) => {
          e.stopPropagation();
          itemDef.action();
          this.events.emit('itemClicked', itemDef.id, this.currentContext);
          this.hide();
        });
      }
      this.menuElement!.appendChild(itemElement);
    });

    this.menuElement.style.left = `${position.x}px`;
    this.menuElement.style.top = `${position.y}px`;
    this.menuElement.style.display = 'block';
    this.events.emit('shown', position, context);
  }

  public hide(): void {
    if (this.menuElement) {
      this.menuElement.style.display = 'none';
      this.events.emit('hidden');
      // Opcional: remover o elemento do DOM se não for reutilizado frequentemente
      // this.menuElement.remove();
      // this.menuElement = null;
    }
    this.currentContext = null;
  }

  private setupGlobalClickListener(): void {
    // Adiciona um listener para fechar o menu ao clicar fora
    // Pode ser no window ou no container do editor
    document.addEventListener('click', (e) => {
      if (this.menuElement && this.menuElement.style.display === 'block') {
        if (!this.menuElement.contains(e.target as Node)) {
          this.hide();
        }
      }
    }, true); // Use capturing para pegar o clique antes que um item do menu o consuma (se necessário)
  }
  
  public on(event: string, listener: (...args: any[]) => void): this {
    this.events.on(event, listener);
    return this;
  }

  public destroy(): void {
    this.menuElement?.remove();
    this.events.removeAllListeners();
    // Remover global click listener se foi adicionado ao document/window
    // document.removeEventListener('click', ...) 
  }
}