// src/editor/state/ClipboardManager.ts
import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import { Point, Node, StickyNote, ClipboardItem, ClipboardableItemType } from '../core/types';
import { EVENT_CLIPBOARD_CHANGED } from '../core/constants';

export class ClipboardManager {
  private clipboardItems: ClipboardItem[] = [];
  private events: EventEmitter;

  constructor() {
    this.events = new EventEmitter();
  }

  public copy(itemsToCopy: Array<{ originalId: string, type: ClipboardableItemType, data: Node | StickyNote }>): void {
    this.clipboardItems = [];
    if (!itemsToCopy || itemsToCopy.length === 0) {
        this.emitClipboardChanged();
        return;
    }

    let refPoint: Point | null = null;
    if (itemsToCopy.length > 1) {
        let minX = Infinity, minY = Infinity;
        itemsToCopy.forEach(item => {
            if (item.data.position) {
                minX = Math.min(minX, item.data.position.x);
                minY = Math.min(minY, item.data.position.y);
            }
        });
        if (minX !== Infinity && minY !== Infinity) {
            refPoint = { x: minX, y: minY };
        }
    }

    this.clipboardItems = itemsToCopy.map(item => {
      const clonedData = JSON.parse(JSON.stringify(item.data));
      let relativeOffset: Point | undefined;
      if (refPoint && clonedData.position) {
          relativeOffset = {
              x: clonedData.position.x - refPoint.x,
              y: clonedData.position.y - refPoint.y
          };
      }

      return {
        id: nanoid(),
        originalId: item.originalId,
        type: item.type,
        data: clonedData,
        relativeOffset
      };
    });
    this.emitClipboardChanged();
  }

  public preparePasteData(pasteCenterPoint: Point, offset: Point = { x: 20, y: 20 }): ClipboardItem[] {
    if (this.clipboardItems.length === 0) {
      return [];
    }

    return this.clipboardItems.map(clipboardItem => {
        const clonedData = JSON.parse(JSON.stringify(clipboardItem.data));
        clonedData.id = nanoid(); 

        if (this.clipboardItems.length === 1 || !clipboardItem.relativeOffset) {
            clonedData.position = {
                x: pasteCenterPoint.x + offset.x,
                y: pasteCenterPoint.y + offset.y,
            };
        } else {
            clonedData.position = {
                x: pasteCenterPoint.x + clipboardItem.relativeOffset.x + offset.x,
                y: pasteCenterPoint.y + clipboardItem.relativeOffset.y + offset.y,
            };
        }
        return {
            ...clipboardItem,
            id: clonedData.id,
            data: clonedData,
        };
    });
  }


  public canPaste(): boolean {
    return this.clipboardItems.length > 0;
  }

  public clear(): void {
    this.clipboardItems = [];
    this.emitClipboardChanged();
  }

  private emitClipboardChanged(): void {
    this.events.emit(EVENT_CLIPBOARD_CHANGED, this.canPaste());
  }

  public on(event: string, listener: (canPaste: boolean) => void): this {
    if (event === EVENT_CLIPBOARD_CHANGED) {
        this.events.on(event, listener);
    }
    return this;
  }

  public off(event: string, listener: (canPaste: boolean) => void): this {
     if (event === EVENT_CLIPBOARD_CHANGED) {
        this.events.off(event, listener);
    }
    return this;
  }

  public destroy(): void {
      this.clipboardItems = [];
      this.events.removeAllListeners();
  }
}