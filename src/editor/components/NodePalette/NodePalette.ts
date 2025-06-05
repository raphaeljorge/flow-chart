// src/editor/components/NodePalette/NodePalette.ts
import { EventEmitter } from 'eventemitter3';
import { NodeDefinition } from '../../core/types';
import { EditorIconService } from '../../services/EditorIconService'; // Corrected path
import { LOCAL_STORAGE_FAVORITES_KEY } from '../../core/constants';
import './NodePalette.css'; // Co-located CSS

export interface NodePaletteOptions {
  nodeDefinitions: NodeDefinition[];
}

export class NodePalette {
  private container: HTMLElement; // The wrapper element for the palette
  private paletteElement: HTMLElement; // The main palette div created by this component
  private nodeDefinitions: NodeDefinition[];
  private favorites: Set<string>; // IDs of favorite NodeDefinitions
  private currentCategory: string = "All";
  private searchTerm: string = "";
  private events: EventEmitter;

  constructor(
    containerElement: HTMLElement, // e.g., the .node-palette-wrapper div
    options: NodePaletteOptions,
    private iconService: EditorIconService
  ) {
    this.container = containerElement;
    this.nodeDefinitions = options.nodeDefinitions;
    this.events = new EventEmitter();

    const savedFavorites = localStorage.getItem(LOCAL_STORAGE_FAVORITES_KEY);
    this.favorites = savedFavorites
      ? new Set(JSON.parse(savedFavorites))
      : new Set();

    this.paletteElement = document.createElement('div');
    this.paletteElement.className = 'node-palette'; // Main class for styling
    this.container.appendChild(this.paletteElement);

    this.renderPalette();
  }

  private renderPalette(): void {
    // Ensure nodeDefinitions includes a placeholder for sticky notes if it's to be draggable from palette
    const displayDefinitions = [...this.nodeDefinitions];
    if (!displayDefinitions.find(def => def.id === 'sticky-note-def')) {
        displayDefinitions.unshift({ // Add to the beginning or a specific category
            id: 'sticky-note-def',
            title: 'Sticky Note',
            description: 'Add a resizable sticky note for annotations.',
            category: 'Annotations', // Or a general category
            icon: 'ph-note', // From EditorIconService
        });
    }


    const categories = [
      "All",
      "Favorites",
      ...new Set(displayDefinitions.map((def) => def.category || "Uncategorized")),
    ].filter((value, index, self) => self.indexOf(value) === index); // Unique categories

    this.paletteElement.innerHTML = `
      <div class="palette-header">
        <input type="text" class="palette-search" placeholder="Search nodes..." value="${this.searchTerm}">
      </div>
      <div class="palette-categories">
        ${categories
          .map(
            (category) => `
          <div class="category-item ${category === this.currentCategory ? "active" : ""}" data-category="${category}">
            ${this.iconService.getIconHTMLString(this.getCategoryIcon(category))} ${category}
          </div>`
          )
          .join("")}
      </div>
      <div class="palette-nodes"></div>
    `;

    const searchInput = this.paletteElement.querySelector(
      ".palette-search"
    ) as HTMLInputElement;
    searchInput.addEventListener("input", (e) => {
      this.searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
      this.renderNodeItems(displayDefinitions);
    });
    // Ensure focus doesn't trigger global shortcuts
    searchInput.addEventListener('focus', (e) => e.stopPropagation());


    const categoryItems = this.paletteElement.querySelectorAll(".category-item");
    categoryItems.forEach((item) => {
      item.addEventListener("click", () => {
        this.currentCategory = (item as HTMLElement).dataset.category || "All";
        categoryItems.forEach((i) => i.classList.remove("active"));
        item.classList.add("active");
        this.renderNodeItems(displayDefinitions);
      });
    });

    this.renderNodeItems(displayDefinitions);
  }

  private renderNodeItems(definitionsToRender: NodeDefinition[]): void {
    const nodesContainer = this.paletteElement.querySelector(".palette-nodes");
    if (!nodesContainer) return;
    nodesContainer.innerHTML = "";

    const filteredDefinitions = this.getFilteredNodeDefinitions(definitionsToRender);

    filteredDefinitions.forEach((definition) => {
      const nodeElement = document.createElement("div");
      nodeElement.className = "node-item";
      nodeElement.draggable = true;
      nodeElement.dataset.nodeDefinitionId = definition.id; // Used for drag data

      const nodeIconHtml = this.iconService.getIconHTMLString(definition.icon);
      const favoriteIconClass = this.favorites.has(definition.id) ? "star-fill" : "star";
      const favoriteIconHtml = this.iconService.getIconHTMLString(favoriteIconClass);

      nodeElement.innerHTML = `
        <div class.node-icon-wrapper">
          ${nodeIconHtml}
        </div>
        <div class="node-info">
          <div class="node-title">${definition.title}</div>
          <div class="node-description">${definition.description}</div>
        </div>
        <button class="favorite-button ${this.favorites.has(definition.id) ? "active" : ""}" data-definition-id="${definition.id}" title="Toggle favorite">
          ${favoriteIconHtml}
        </button>
      `;

      const favoriteButton = nodeElement.querySelector(".favorite-button") as HTMLButtonElement;
      favoriteButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent dragstart or other parent events
        this.toggleFavorite(definition.id);
        this.renderNodeItems(definitionsToRender); // Re-render to update favorite icon and list if in "Favorites"
      });

      nodeElement.addEventListener("dragstart", (e) => {
        if (e.dataTransfer) {
          e.dataTransfer.setData("text/plain", definition.id);
          e.dataTransfer.effectAllowed = "copy";
        }
        this.events.emit("itemDragStart", definition); // For NodeEditorController if needed
      });
      nodesContainer.appendChild(nodeElement);
    });
  }

  private getFilteredNodeDefinitions(sourceDefinitions: NodeDefinition[]): NodeDefinition[] {
    return sourceDefinitions.filter(def => {
      const matchesSearch = this.searchTerm === '' ||
        def.title.toLowerCase().includes(this.searchTerm) ||
        (def.description && def.description.toLowerCase().includes(this.searchTerm)) ||
        (def.category && def.category.toLowerCase().includes(this.searchTerm));

      const categoryToMatch = def.category || "Uncategorized";
      const matchesCategory =
        this.currentCategory === 'All' ||
        (this.currentCategory === 'Favorites' && this.favorites.has(def.id)) ||
        categoryToMatch === this.currentCategory;

      return matchesSearch && matchesCategory;
    });
  }

  private toggleFavorite(definitionId: string): void {
    if (this.favorites.has(definitionId)) {
      this.favorites.delete(definitionId);
    } else {
      this.favorites.add(definitionId);
    }
    localStorage.setItem(LOCAL_STORAGE_FAVORITES_KEY, JSON.stringify(Array.from(this.favorites)));
    // Re-rendering is handled by the caller of this method (renderNodeItems)
  }

  private getCategoryIcon(category: string): string {
    // Default icons for categories
    const icons: { [key: string]: string } = {
      'All': 'ph-list',
      'Favorites': 'ph-star',
      'Annotations': 'ph-note-pencil', // Updated icon
      'Triggers': 'ph-play-circle', // Updated icon
      'Actions': 'ph-lightning',
      'Logic': 'ph-git-fork', // Updated icon
      'Connectors': 'ph-plugs',
      'Custom Code': 'ph-code-block', // Updated icon
      'Uncategorized': 'ph-folder-simple'
    };
    return icons[category] || 'ph-folder'; // Default folder icon
  }

  public updateNodeDefinitions(newNodeDefinitions: NodeDefinition[]): void {
    this.nodeDefinitions = newNodeDefinitions;
    this.renderPalette(); // Re-render the entire palette
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
    this.container.innerHTML = ''; // Clear the container this component was mounted in
    this.events.removeAllListeners();
  }
}