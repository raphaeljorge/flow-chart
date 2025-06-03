// src/ui/QuickAddMenu.ts
import { EventEmitter } from 'eventemitter3';
import { Point, NodeDefinition } from '../core/Types';
import { IconService } from '../editor/IconService'; // Importar IconService

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
  private highlightedIndex: number = -1; // Índice do item destacado na lista de resultados
  private filteredDefinitions: NodeDefinition[] = []; // Cache das definições filtradas

  constructor(
    private container: HTMLElement, // Onde o menu será anexado
    options: QuickAddMenuOptions,
    private iconService: IconService // Injetar IconService aqui
  ) {
    this.nodeDefinitions = options.nodeDefinitions;
    this.events = new EventEmitter();
    this.setupGlobalClickListener();
  }

  private createMenuElement(): void {
    if (this.menuElement) this.menuElement.remove();
    this.menuElement = document.createElement('div');
    this.menuElement.className = 'quick-add-search'; 
    
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'text';
    this.inputElement.placeholder = 'Search nodes to add...';
    this.inputElement.className = 'quick-add-input';
    
    this.resultsElement = document.createElement('div');
    this.resultsElement.className = 'quick-add-results';

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
    this.highlightedIndex = -1; // Reset highlight
    this.renderResults(''); // Render initial results
    this.inputElement.focus();
    this.events.emit('shown', clientPosition);
  }

  public hide(): void {
    if (this.menuElement) {
      this.menuElement.style.display = 'none';
      this.events.emit('hidden');
    }
    this.currentPosition = null;
    this.highlightedIndex = -1; // Reset highlight
    this.filteredDefinitions = []; // Clear filtered results
  }

  private handleInput = (e: Event): void => {
    const searchTerm = (e.target as HTMLInputElement).value;
    this.highlightedIndex = -1; // Reset highlight on new input
    this.renderResults(searchTerm);
  };
  
  private handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
          this.hide();
          e.preventDefault(); 
      } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.moveHighlight(1);
      } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.moveHighlight(-1);
      } else if (e.key === 'Enter') {
          e.preventDefault();
          if (this.highlightedIndex !== -1 && this.filteredDefinitions[this.highlightedIndex]) {
              const selectedDef = this.filteredDefinitions[this.highlightedIndex];
              if (this.currentPosition) {
                  this.events.emit('itemSelected', selectedDef, this.currentPosition);
              }
              this.hide();
          } else if (this.filteredDefinitions.length === 1 && this.highlightedIndex === -1) {
              const selectedDef = this.filteredDefinitions[0];
              if (this.currentPosition) {
                  this.events.emit('itemSelected', selectedDef, this.currentPosition);
              }
              this.hide();
          }
      }
  }

  private moveHighlight(direction: 1 | -1): void {
      if (this.filteredDefinitions.length === 0) return;

      let newIndex = this.highlightedIndex + direction;

      if (newIndex >= this.filteredDefinitions.length) {
          newIndex = 0; 
      } else if (newIndex < 0) {
          newIndex = this.filteredDefinitions.length - 1; 
      }
      this.highlightedIndex = newIndex;
      this.updateHighlightInDOM();
      this.scrollIntoView(this.highlightedIndex);
  }

  private updateHighlightInDOM(): void {
    if (!this.resultsElement) return;
    const items = Array.from(this.resultsElement.children);
    items.forEach((item, index) => {
        if (item instanceof HTMLElement) {
            item.classList.toggle('highlighted', index === this.highlightedIndex);
        }
    });
  }

  private scrollIntoView(index: number): void {
      if (!this.resultsElement) return;
      const itemElement = this.resultsElement.children[index] as HTMLElement;
      if (itemElement) {
          const menuRect = this.resultsElement.getBoundingClientRect();
          const itemRect = itemElement.getBoundingClientRect();

          if (itemRect.bottom > menuRect.bottom) {
              this.resultsElement.scrollTop += itemRect.bottom - menuRect.bottom;
          } else if (itemRect.top < menuRect.top) {
              this.resultsElement.scrollTop -= menuRect.top - itemRect.top;
          }
      }
  }

  private renderResults(searchTerm: string): void {
    if (!this.resultsElement) return;
    this.resultsElement.innerHTML = '';

    const lowerSearchTerm = searchTerm.toLowerCase();
    this.filteredDefinitions = this.nodeDefinitions.filter(def => 
      def.title.toLowerCase().includes(lowerSearchTerm) ||
      def.description.toLowerCase().includes(lowerSearchTerm) ||
      def.category.toLowerCase().includes(lowerSearchTerm)
    );

    if (this.filteredDefinitions.length === 0) {
      this.resultsElement.innerHTML = `<div class="quick-add-no-results">No matching nodes found.</div>`;
      return;
    }

    this.filteredDefinitions.forEach((def, index) => {
      const itemElement = document.createElement('div');
      itemElement.className = 'quick-add-item'; 
      itemElement.dataset.definitionId = def.id;
      
      let iconHTML = '';
      if (def.icon) { // Usar IconService
        iconHTML = this.iconService.getIconHTML(def.icon, { className: 'quick-add-item-icon' });
      }

      itemElement.innerHTML = `
        ${iconHTML}
        <div class="quick-add-item-info">
          <div class="quick-add-item-title">${def.title}</div>
          <div class="quick-add-item-category">${def.category}</div>
        </div>
      `;
      
      itemElement.addEventListener('click', () => {
        if (this.currentPosition) {
          this.events.emit('itemSelected', def, this.currentPosition);
        }
        this.hide();
      });
      this.resultsElement!.appendChild(itemElement);
    });

    if (this.filteredDefinitions.length > 0 && this.highlightedIndex === -1) {
        this.highlightedIndex = 0;
        this.updateHighlightInDOM();
    }
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
    if (this.inputElement) {
        this.inputElement.removeEventListener('input', this.handleInput);
        this.inputElement.removeEventListener('keydown', this.handleKeyDown);
    }
    document.removeEventListener('click', this.setupGlobalClickListener as EventListenerOrEventListenerObject, true);
    this.menuElement?.remove();
    this.events.removeAllListeners();
  }
}