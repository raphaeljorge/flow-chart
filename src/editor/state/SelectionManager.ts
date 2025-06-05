// src/editor/state/SelectionManager.ts
import { EventEmitter } from 'eventemitter3';
import { EVENT_SELECTION_CHANGED } from '../core/constants';

export class SelectionManager {
  private selectedItemIds: Set<string>;
  private events: EventEmitter;

  constructor() {
    this.selectedItemIds = new Set<string>();
    this.events = new EventEmitter();
  }

  public selectItem(itemId: string, addToSelection: boolean = false): void {
    if (!addToSelection) {
      if (this.selectedItemIds.size !== 1 || !this.selectedItemIds.has(itemId)) {
        this.clearSelectionSilent();
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
    if (changed || (!addToSelection && itemIds.length > 0) || (itemIds.length === 0 && !addToSelection && this.selectedItemIds.size > 0) ) {
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
    this.events.emit(EVENT_SELECTION_CHANGED, this.getSelectedItems());
  }

  public on(event: string, listener: (selectedIds: string[]) => void): this {
    if (event === EVENT_SELECTION_CHANGED) {
        this.events.on(event, listener);
    } else {
        this.events.on(event, listener as (...args: any[]) => void);
    }
    return this;
  }

  public off(event: string, listener: (selectedIds: string[]) => void): this {
    if (event === EVENT_SELECTION_CHANGED) {
        this.events.off(event, listener);
    } else {
        this.events.off(event, listener as (...args: any[]) => void);
    }
    return this;
  }

  public destroy(): void {
    this.events.removeAllListeners();
    this.selectedItemIds.clear();
  }
}