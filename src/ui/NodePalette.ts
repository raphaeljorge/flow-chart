// Mover para: src/ui/NodePalette.ts
import { EventEmitter } from "eventemitter3";
import { NodeDefinition, Point } from "../core/Types";
import { IconService } from "../editor/IconService";

export interface NodePaletteOptions {
	nodeDefinitions: NodeDefinition[];
}

export class NodePalette {
	private container: HTMLElement;
	private nodeDefinitions: NodeDefinition[];
	private favorites: Set<string>; // IDs das NodeDefinitions favoritas
	private currentCategory: string = "All";
	private searchTerm: string = "";
	private events: EventEmitter;

	constructor(
		container: HTMLElement,
		options: NodePaletteOptions,
		private iconService: IconService
	) {
		this.container = container;
		this.nodeDefinitions = options.nodeDefinitions;
		this.events = new EventEmitter();

		const savedFavorites = localStorage.getItem("nodePaletteFavorites");
		this.favorites = savedFavorites
			? new Set(JSON.parse(savedFavorites))
			: new Set();

		this.renderPalette();
	}

	private renderPalette(): void {
		const categories = [
			"All",
			"Favorites",
			...new Set(this.nodeDefinitions.map((def) => def.category)),
		];

		this.container.innerHTML = `
          <div class="palette-header">
            <input type="text" class="palette-search" placeholder="Search nodes..." value="${this.searchTerm
			}">
          </div>
          <div class="palette-categories">
            ${categories
				.map(
					(category) => `
              <div class="category-item ${category === this.currentCategory ? "active" : ""
						}" data-category="${category}">
                ${this.iconService.getIconHTML(
							this.getCategoryIcon(category)
						)} ${category}
              </div>
            `
				)
				.join("")}
          </div>
          <div class="palette-nodes"></div>
        `;

		const searchInput = this.container.querySelector(
			".palette-search"
		) as HTMLInputElement;
		searchInput.addEventListener("input", (e) => {
			this.searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
			this.renderNodeItems();
		});

		const categoryItems = this.container.querySelectorAll(".category-item");
		categoryItems.forEach((item) => {
			item.addEventListener("click", () => {
				this.currentCategory = (item as HTMLElement).dataset.category || "All";
				categoryItems.forEach((i) => i.classList.remove("active"));
				item.classList.add("active");
				this.renderNodeItems();
			});
		});

		this.renderNodeItems();
	}

	private renderNodeItems(): void {
		const nodesContainer = this.container.querySelector(".palette-nodes");
		if (!nodesContainer) return;
		nodesContainer.innerHTML = "";

		const filteredDefinitions = this.getFilteredNodeDefinitions();

		filteredDefinitions.forEach((definition) => {
			const nodeElement = document.createElement("div");
			nodeElement.className = "node-item";
			nodeElement.draggable = true;
			nodeElement.dataset.nodeDefinitionId = definition.id;

			// Usar IconService para o ícone do nó
			const nodeIconHtml = this.iconService.getIconHTML(definition.icon);

			// Usar IconService para o ícone de favorito
			const favoriteIconClass = this.favorites.has(definition.id)
				? "star-fill"
				: "star";
			const favoriteIconHtml = this.iconService.getIconHTML(favoriteIconClass);

			nodeElement.innerHTML = `
            <div class="node-icon">
              ${nodeIconHtml}
            </div>
            <div class="node-info">
              <div class="node-title">${definition.title}</div>
              <div class="node-description">${definition.description}</div>
            </div>
            <button class="favorite-button ${this.favorites.has(definition.id) ? "active" : ""
				}" data-definition-id="${definition.id}">
              ${favoriteIconHtml}
            </button>
          `;

			const favoriteButton = nodeElement.querySelector(
				".favorite-button"
			) as HTMLButtonElement;
			favoriteButton.addEventListener("click", (e) => {
				e.stopPropagation();
				this.toggleFavorite(definition.id);
			});

			nodeElement.addEventListener("dragstart", (e) => {
				if (e.dataTransfer) {
					e.dataTransfer.setData("text/plain", definition.id);
					e.dataTransfer.effectAllowed = "copy";
				}
				this.events.emit("itemDragStart", definition);
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
		this.renderNodeItems();
		if (this.currentCategory === 'Favorites') {
			this.renderNodeItems();
		}
	}

	private getCategoryIcon(category: string): string {
		const icons: { [key: string]: string } = {
			'All': 'list', // Apenas o nome do ícone, o serviço adicionará 'ph-'
			'Favorites': 'star',
			'Annotations': 'note',
			'Triggers': 'play',
			'Actions': 'lightning',
			'Logic': 'flow-arrow',
			'Connectors': 'plugs',
			'Custom Code': 'code'
		};
		return icons[category] || 'folder';
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
		this.container.innerHTML = '';
		this.events.removeAllListeners();
	}
}
