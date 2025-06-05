// src/editor/components/QuickAddMenu/QuickAddMenu.ts
import { EventEmitter } from 'eventemitter3';
import { Point, NodeDefinition } from '../../core/types';
import { EditorIconService } from '../../services/EditorIconService';
import './QuickAddMenu.css'; // Co-located CSS

export interface QuickAddMenuOptions {
  nodeDefinitions: NodeDefinition[];
}

export class QuickAddMenu {
  private wrapper: HTMLElement; // The overlay container where the menu is appended
  private menuElement: HTMLElement | null = null;
  private inputElement: HTMLInputElement | null = null;
  private resultsElement: HTMLElement | null = null;
  private events: EventEmitter;
  private nodeDefinitions: NodeDefinition[];
  private currentCanvasPosition: Point | null = null; // Position in canvas where the node will be added
  private highlightedIndex: number = -1;
  private filteredDefinitions: NodeDefinition[] = [];

  constructor(
    wrapperElement: HTMLElement, // e.g., the .editor-overlay-container
    options: QuickAddMenuOptions,
    private iconService: EditorIconService
  ) {
    this.wrapper = wrapperElement;
    this.nodeDefinitions = options.nodeDefinitions;
    this.events = new EventEmitter();
    this.setupGlobalClickListener(); // To hide menu on outside click
  }

  private createMenuElement(): void {
    if (this.menuElement) {
      // If it exists, just clear input and results, don't remove and re-add wrapper.
      if(this.inputElement) this.inputElement.value = '';
      if(this.resultsElement) this.resultsElement.innerHTML = '';
      this.highlightedIndex = -1;
      this.filteredDefinitions = [];
      return;
    }

    this.menuElement = document.createElement('div');
    this.menuElement.className = 'editor-quick-add'; // Use a more specific class

    this.inputElement = document.createElement('input');
    this.inputElement.type = 'text';
    this.inputElement.placeholder = 'Search nodes to add... (Esc to close)';
    this.inputElement.className = 'quick-add-input';

    this.resultsElement = document.createElement('div');
    this.resultsElement.className = 'quick-add-results';

    this.menuElement.appendChild(this.inputElement);
    this.menuElement.appendChild(this.resultsElement);
    this.wrapper.appendChild(this.menuElement);

    this.inputElement.addEventListener('input', this.handleInput);
    this.inputElement.addEventListener('keydown', this.handleKeyDown);
    // Stop propagation to prevent global shortcuts while typing in quick add
    this.inputElement.addEventListener('keydown', (e) => e.stopPropagation());
  }

  public show(clientPosition: Point, canvasPosition: Point): void {
    this.currentCanvasPosition = canvasPosition;
    this.createMenuElement(); // Creates if not exists, or prepares if it does

    if (!this.menuElement || !this.inputElement) return;

    // Position the menu based on client coordinates
    this.menuElement.style.display = 'block';
    const menuRect = this.menuElement.getBoundingClientRect();
    const wrapperRect = this.wrapper.getBoundingClientRect();

    let x = clientPosition.x;
    let y = clientPosition.y;

    if (x + menuRect.width > wrapperRect.left + wrapperRect.width) {
      x = clientPosition.x - menuRect.width;
    }
    if (y + menuRect.height > wrapperRect.top + wrapperRect.height) {
      y = clientPosition.y - menuRect.height;
    }
    x = Math.max(wrapperRect.left, x);
    y = Math.max(wrapperRect.top, y);

    this.menuElement.style.left = `${x - wrapperRect.left}px`;
    this.menuElement.style.top = `${y - wrapperRect.top}px`;
    this.menuElement.style.pointerEvents = 'auto';


    this.renderResults(''); // Render initial (or all) results
    this.inputElement.focus();
    this.events.emit('shown', clientPosition);
  }

  public hide(): void {
    if (this.menuElement) {
      this.menuElement.style.display = 'none';
      this.menuElement.style.pointerEvents = 'none';
      this.events.emit('hidden');
    }
    this.currentCanvasPosition = null;
    this.highlightedIndex = -1;
    this.filteredDefinitions = [];
  }

  private handleInput = (e: Event): void => {
    const searchTerm = (e.target as HTMLInputElement).value;
    this.highlightedIndex = -1; // Reset on new input
    this.renderResults(searchTerm);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    switch (e.key) {
      case 'Escape':
        this.hide();
        e.preventDefault();
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.moveHighlight(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.moveHighlight(-1);
        break;
      case 'Enter':
        e.preventDefault();
        if (this.highlightedIndex !== -1 && this.filteredDefinitions[this.highlightedIndex]) {
          this.selectItem(this.filteredDefinitions[this.highlightedIndex]);
        } else if (this.filteredDefinitions.length === 1 && this.highlightedIndex === -1) {
          // If only one result and nothing explicitly highlighted, select that one
          this.selectItem(this.filteredDefinitions[0]);
        }
        break;
    }
  };

  private selectItem(definition: NodeDefinition): void {
    if (this.currentCanvasPosition) {
      this.events.emit('itemSelected', definition, this.currentCanvasPosition);
    }
    this.hide();
  }

  private moveHighlight(direction: 1 | -1): void {
    if (this.filteredDefinitions.length === 0) return;

    this.highlightedIndex += direction;

    if (this.highlightedIndex >= this.filteredDefinitions.length) {
      this.highlightedIndex = 0; // Wrap around to the top
    } else if (this.highlightedIndex < 0) {
      this.highlightedIndex = this.filteredDefinitions.length - 1; // Wrap around to the bottom
    }
    this.updateHighlightInDOM();
    this.scrollIntoView(this.highlightedIndex);
  }

  private updateHighlightInDOM(): void {
    if (!this.resultsElement) return;
    const items = Array.from(this.resultsElement.children);
    items.forEach((item, index) => {
      if (item instanceof HTMLElement) { // Type guard
        item.classList.toggle('highlighted', index === this.highlightedIndex);
      }
    });
  }

  private scrollIntoView(index: number): void {
    if (!this.resultsElement) return;
    const itemElement = this.resultsElement.children[index] as HTMLElement;
    if (itemElement) {
      itemElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  private renderResults(searchTerm: string): void {
    if (!this.resultsElement) return;
    this.resultsElement.innerHTML = ''; // Clear previous results

    // Add Sticky Note to the list of definitions if not already there for searching
    const displayDefinitions = [...this.nodeDefinitions];
     if (!displayDefinitions.find(def => def.id === 'sticky-note-def')) {
        displayDefinitions.unshift({
            id: 'sticky-note-def', title: 'Sticky Note', description: 'Add an annotation.',
            category: 'Annotations', icon: 'ph-note',
        });
    }


    const lowerSearchTerm = searchTerm.toLowerCase();
    this.filteredDefinitions = displayDefinitions.filter(def =>
      def.title.toLowerCase().includes(lowerSearchTerm) ||
      (def.description && def.description.toLowerCase().includes(lowerSearchTerm)) ||
      (def.category && def.category.toLowerCase().includes(lowerSearchTerm))
    );

    if (this.filteredDefinitions.length === 0) {
      this.resultsElement.innerHTML = `<div class="quick-add-no-results">No matching nodes found.</div>`;
      return;
    }

    this.filteredDefinitions.forEach((def, index) => {
      const itemElement = document.createElement('div');
      itemElement.className = 'quick-add-item';
      itemElement.dataset.definitionId = def.id;

      const iconHTML = this.iconService.getIconHTMLString(def.icon, { className: 'quick-add-item-icon' });

      itemElement.innerHTML = `
        ${iconHTML}
        <div class="quick-add-item-info">
          <div class="quick-add-item-title">${def.title}</div>
          <div class="quick-add-item-category">${def.category}</div>
        </div>
      `;

      itemElement.addEventListener('click', () => {
        this.selectItem(def);
      });
      itemElement.addEventListener('mouseenter', () => { // Allow mouse hover to highlight
          this.highlightedIndex = index;
          this.updateHighlightInDOM();
      });

      this.resultsElement!.appendChild(itemElement);
    });

    // Auto-highlight first item if search term is not empty and items exist
    if (searchTerm && this.filteredDefinitions.length > 0) {
        this.highlightedIndex = 0;
        this.updateHighlightInDOM();
    } else {
        this.highlightedIndex = -1; // No auto-highlight if search is empty
        this.updateHighlightInDOM();
    }
  }

  private handleGlobalClick = (e: MouseEvent): void => {
    if (this.menuElement && this.menuElement.style.display === 'block') {
      // Hide if the click is outside the menuElement
      if (!this.menuElement.contains(e.target as Node)) {
        this.hide();
      }
    }
  };

  private setupGlobalClickListener(): void {
    document.addEventListener('mousedown', this.handleGlobalClick, true);
  }
  
  public updateNodeDefinitions(newNodeDefinitions: NodeDefinition[]): void {
    this.nodeDefinitions = newNodeDefinitions;
    // If visible, re-render results with the current search term
    if (this.menuElement && this.menuElement.style.display === 'block' && this.inputElement) {
        this.renderResults(this.inputElement.value);
    }
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
    if (this.inputElement) {
      this.inputElement.removeEventListener('input', this.handleInput);
      this.inputElement.removeEventListener('keydown', this.handleKeyDown);
    }
    this.menuElement?.remove();
    this.events.removeAllListeners();
  }
}