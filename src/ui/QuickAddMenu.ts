// src/ui/QuickAddMenu.ts
import { EventEmitter } from 'eventemitter3';
import { Point, NodeDefinition } from '../core/Types';
// import { IconService } from '../editor/IconService';

export interface QuickAddMenuOptions {
  nodeDefinitions: NodeDefinition[];
}

export class QuickAddMenu {
  private menuElement: HTMLElement | null = null;
  private inputElement: HTMLInputElement | null = null;
  private resultsElement: HTMLElement | null = null;
  private events: EventEmitter;
  private nodeDefinitions: NodeDefinition[];
  private currentPosition: Point | null = null; // Posição no canvas onde o nó será adicionado

  constructor(
    private container: HTMLElement, // Onde o menu será anexado
    options: QuickAddMenuOptions,
    /* private iconService: IconService */
  ) {
    this.nodeDefinitions = options.nodeDefinitions;
    this.events = new EventEmitter();
    this.setupGlobalClickListener();
  }

  private createMenuElement(): void {
    if (this.menuElement) this.menuElement.remove();
    this.menuElement = document.createElement('div');
    this.menuElement.className = 'quick-add-search'; //
    
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'text';
    this.inputElement.placeholder = 'Search nodes to add...';
    this.inputElement.className = 'quick-add-input'; //
    
    this.resultsElement = document.createElement('div');
    this.resultsElement.className = 'quick-add-results'; //

    this.menuElement.appendChild(this.inputElement);
    this.menuElement.appendChild(this.resultsElement);
    this.container.appendChild(this.menuElement);

    this.inputElement.addEventListener('input', this.handleInput);
    this.inputElement.addEventListener('keydown', this.handleKeyDown);
  }

  public show(clientPosition: Point, canvasPosition: Point): void {
    this.currentPosition = canvasPosition;
    this.createMenuElement();
    if (!this.menuElement || !this.inputElement) return;

    this.menuElement.style.left = `${clientPosition.x}px`;
    this.menuElement.style.top = `${clientPosition.y}px`;
    this.menuElement.style.display = 'block';
    this.inputElement.value = '';
    this.inputElement.focus();
    this.renderResults('');
    this.events.emit('shown', clientPosition);
  }

  public hide(): void {
    if (this.menuElement) {
      this.menuElement.style.display = 'none';
      this.events.emit('hidden');
    }
    this.currentPosition = null;
  }

  private handleInput = (e: Event): void => {
    const searchTerm = (e.target as HTMLInputElement).value;
    this.renderResults(searchTerm);
  };
  
  private handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
          this.hide();
      }
      // TODO: Adicionar navegação pelos resultados com as setas e Enter para selecionar
  }

  private renderResults(searchTerm: string): void {
    if (!this.resultsElement) return;
    this.resultsElement.innerHTML = '';

    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = this.nodeDefinitions.filter(def => 
      def.title.toLowerCase().includes(lowerSearchTerm) ||
      def.description.toLowerCase().includes(lowerSearchTerm) ||
      def.category.toLowerCase().includes(lowerSearchTerm)
    );

    if (filtered.length === 0) {
      this.resultsElement.innerHTML = `<div class="quick-add-no-results">No matching nodes found.</div>`;
      return;
    }

    filtered.forEach(def => {
      const itemElement = document.createElement('div');
      itemElement.className = 'quick-add-item'; //
      itemElement.dataset.definitionId = def.id;
      
      let iconHTML = '';
      if (def.icon /* && this.iconService */) {
        // iconHTML = this.iconService.getIconHTML(def.icon, {className: 'quick-add-item-icon'});
        iconHTML = `<i class="ph ${def.icon} quick-add-item-icon"></i>`;
      }

      itemElement.innerHTML = `
        ${iconHTML}
        <div class="quick-add-item-info">
          <div class="quick-add-item-title">${def.title}</div>
          <div class="quick-add-item-category">${def.category}</div>
        </div>
      `; // Adicionar estilos para estas classes
      
      itemElement.addEventListener('click', () => {
        if (this.currentPosition) {
          this.events.emit('itemSelected', def, this.currentPosition);
        }
        this.hide();
      });
      this.resultsElement!.appendChild(itemElement);
    });
  }
  
  private setupGlobalClickListener(): void {
    document.addEventListener('click', (e) => {
      if (this.menuElement && this.menuElement.style.display === 'block') {
        if (!this.menuElement.contains(e.target as Node)) {
          this.hide();
        }
      }
    }, true);
  }
  
  public on(event: string, listener: (...args: any[]) => void): this {
    this.events.on(event, listener);
    return this;
  }

  public destroy(): void {
    this.menuElement?.remove();
    this.events.removeAllListeners();
    // Remover global click listener
  }
}