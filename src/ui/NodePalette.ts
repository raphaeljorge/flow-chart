// Mover para: src/ui/NodePalette.ts
import { EventEmitter } from 'eventemitter3';
import { NodeDefinition, Point } from '../core/Types'; // Ajuste o caminho para Types.ts
// O Canvas e NodeManager não são mais dependências diretas para a lógica da paleta em si.
// O NodeEditor irá coordenar a criação de nós.

export interface NodePaletteOptions {
  nodeDefinitions: NodeDefinition[];
}

export class NodePalette {
  private container: HTMLElement;
  private nodeDefinitions: NodeDefinition[];
  private favorites: Set<string>; // IDs das NodeDefinitions favoritas
  private currentCategory: string = 'All';
  private searchTerm: string = '';
  private events: EventEmitter;

  constructor(container: HTMLElement, options: NodePaletteOptions) {
    this.container = container;
    this.nodeDefinitions = options.nodeDefinitions;
    this.events = new EventEmitter();
    
    const savedFavorites = localStorage.getItem('nodePaletteFavorites');
    this.favorites = savedFavorites ? new Set(JSON.parse(savedFavorites)) : new Set();

    this.renderPalette();
  }

  private renderPalette(): void {
    const categories = ['All', 'Favorites', ...new Set(this.nodeDefinitions.map(def => def.category))];
    
    this.container.innerHTML = `
      <div class="palette-header">
        <input type="text" class="palette-search" placeholder="Search nodes..." value="${this.searchTerm}">
      </div>
      <div class="palette-categories">
        ${categories.map(category => `
          <div class="category-item ${category === this.currentCategory ? 'active' : ''}" data-category="${category}">
            <i class="ph ${this.getCategoryIcon(category)}"></i> ${category}
          </div>
        `).join('')}
      </div>
      <div class="palette-nodes"></div>
    `;

    const searchInput = this.container.querySelector('.palette-search') as HTMLInputElement;
    searchInput.addEventListener('input', (e) => {
      this.searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
      this.renderNodeItems();
    });

    const categoryItems = this.container.querySelectorAll('.category-item');
    categoryItems.forEach(item => {
      item.addEventListener('click', () => {
        this.currentCategory = (item as HTMLElement).dataset.category || 'All';
        categoryItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this.renderNodeItems();
      });
    });

    this.renderNodeItems();
  }

  private renderNodeItems(): void {
    const nodesContainer = this.container.querySelector('.palette-nodes');
    if (!nodesContainer) return;
    nodesContainer.innerHTML = '';
    
    const filteredDefinitions = this.getFilteredNodeDefinitions();
    
    filteredDefinitions.forEach(definition => {
      const nodeElement = document.createElement('div');
      nodeElement.className = 'node-item';
      nodeElement.draggable = true;
      // O dataTransfer deve conter o ID da NodeDefinition, que o NodeEditor usará
      // para saber qual tipo de nó (ou sticky note) criar.
      nodeElement.dataset.nodeDefinitionId = definition.id; 
      
      nodeElement.innerHTML = `
        <div class="node-icon">
          <i class="ph ${definition.icon}"></i>
        </div>
        <div class="node-info">
          <div class="node-title">${definition.title}</div>
          <div class="node-description">${definition.description}</div>
        </div>
        <button class="favorite-button ${this.favorites.has(definition.id) ? 'active' : ''}" data-definition-id="${definition.id}">
          <i class="ph ${this.favorites.has(definition.id) ? 'ph-star-fill' : 'ph-star'}"></i>
        </button>
      `;

      const favoriteButton = nodeElement.querySelector('.favorite-button') as HTMLButtonElement;
      favoriteButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Evita que o clique no botão dispare outros eventos do item
        this.toggleFavorite(definition.id);
      });

      nodeElement.addEventListener('dragstart', (e) => {
        // O NodeEditor será responsável por ouvir o 'drop' no canvas.
        // Ele usará 'nodeDefinitionId' para criar o nó correto.
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', definition.id); // Passa o ID da NodeDefinition
          e.dataTransfer.effectAllowed = 'copy';
        }
        this.events.emit('itemDragStart', definition);
      });

      nodesContainer.appendChild(nodeElement);
    });
  }

  private getFilteredNodeDefinitions(): NodeDefinition[] {
    return this.nodeDefinitions.filter(def => {
      const matchesSearch = this.searchTerm === '' ||
        def.title.toLowerCase().includes(this.searchTerm) ||
        def.description.toLowerCase().includes(this.searchTerm) ||
        def.category.toLowerCase().includes(this.searchTerm);

      const matchesCategory =
        this.currentCategory === 'All' ||
        (this.currentCategory === 'Favorites' && this.favorites.has(def.id)) ||
        def.category === this.currentCategory;

      return matchesSearch && matchesCategory;
    });
  }

  private toggleFavorite(definitionId: string): void {
    if (this.favorites.has(definitionId)) {
      this.favorites.delete(definitionId);
    } else {
      this.favorites.add(definitionId);
    }
    localStorage.setItem('nodePaletteFavorites', JSON.stringify(Array.from(this.favorites)));
    this.renderNodeItems(); // Re-renderiza para atualizar o estado do botão de favorito
    if (this.currentCategory === 'Favorites') { // Se estiver na categoria favoritos, atualiza a lista
        this.renderNodeItems();
    }
  }

  private getCategoryIcon(category: string): string {
    //
    const icons: { [key: string]: string } = {
      'All': 'ph-list',
      'Favorites': 'ph-star',
      'Annotations': 'ph-note', // Mantido para sticky note
      'Triggers': 'ph-play',
      'Actions': 'ph-lightning',
      'Logic': 'ph-flow-arrow',
      'Connectors': 'ph-plugs',
      'Custom Code': 'ph-code'
    };
    return icons[category] || 'ph-folder'; // Ícone padrão
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
    // Limpar event listeners adicionados aos elementos do DOM se necessário
    this.container.innerHTML = '';
    this.events.removeAllListeners();
  }
}