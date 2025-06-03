import { EventEmitter } from 'eventemitter3';

export class SelectionManager {
  private selectedItemIds: Set<string>;
  private events: EventEmitter;

  constructor() {
    this.selectedItemIds = new Set<string>();
    this.events = new EventEmitter();
  }

  public selectItem(itemId: string, addToSelection: boolean = false): void {
    if (!addToSelection) {
      // Se não for para adicionar e o item já for o único selecionado, não faz nada.
      // Se houver outros, limpa e seleciona este.
      if (this.selectedItemIds.size !== 1 || !this.selectedItemIds.has(itemId)) {
        this.clearSelectionSilent(); // Limpa sem emitir evento ainda
        this.selectedItemIds.add(itemId);
        this.emitSelectionChanged();
      }
    } else {
      if (!this.selectedItemIds.has(itemId)) {
        this.selectedItemIds.add(itemId);
        this.emitSelectionChanged();
      }
    }
  }

  public deselectItem(itemId: string): void {
    if (this.selectedItemIds.has(itemId)) {
      this.selectedItemIds.delete(itemId);
      this.emitSelectionChanged();
    }
  }

  public toggleSelection(itemId: string): void {
    if (this.selectedItemIds.has(itemId)) {
      this.selectedItemIds.delete(itemId);
    } else {
      this.selectedItemIds.add(itemId);
    }
    this.emitSelectionChanged();
  }

  public selectItems(itemIds: string[], addToSelection: boolean = false): void {
    if (!addToSelection) {
      this.clearSelectionSilent();
    }
    let changed = false;
    itemIds.forEach(id => {
      if (!this.selectedItemIds.has(id)) {
        this.selectedItemIds.add(id);
        changed = true;
      }
    });
    if (changed || !addToSelection) { // Emite se algo mudou ou se limpamos a seleção
        this.emitSelectionChanged();
    }
  }

  public clearSelection(): void {
    if (this.selectedItemIds.size > 0) {
      this.clearSelectionSilent();
      this.emitSelectionChanged();
    }
  }

  private clearSelectionSilent(): void {
    this.selectedItemIds.clear();
  }

  public isSelected(itemId: string): boolean {
    return this.selectedItemIds.has(itemId);
  }

  public getSelectedItems(): string[] {
    return Array.from(this.selectedItemIds);
  }

  public getSelectionCount(): number {
    return this.selectedItemIds.size;
  }
  
  public getSingleSelectedItem(): string | null {
    return this.selectedItemIds.size === 1 ? this.selectedItemIds.values().next().value : null;
  }

  private emitSelectionChanged(): void {
    this.events.emit('selectionChanged', this.getSelectedItems());
  }

  public on(event: 'selectionChanged', listener: (selectedIds: string[]) => void): this {
    this.events.on(event, listener);
    return this;
  }

  public off(event: 'selectionChanged', listener: (selectedIds: string[]) => void): this {
    this.events.off(event, listener);
    return this;
  }

  public destroy(): void {
    this.events.removeAllListeners();
    this.selectedItemIds.clear();
  }
}