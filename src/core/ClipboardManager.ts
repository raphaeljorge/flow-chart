import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import { Point, Node, StickyNote } from './Types'; // Supondo que Node e StickyNote sejam os tipos copiáveis

// Define um tipo para os itens que podem estar na área de transferência
export type ClipboardableItemType = 'node' | 'stickyNote';

export interface ClipboardItem {
  id: string; // Novo ID para o item colado
  originalId: string;
  type: ClipboardableItemType;
  data: Node | StickyNote; // Uma cópia profunda dos dados do item original
  // Podemos adicionar um offset relativo se copiarmos múltiplos itens,
  // para manter seu espaçamento ao colar.
  relativeOffset?: Point;
}

export class ClipboardManager {
  private clipboardItems: ClipboardItem[] = [];
  private events: EventEmitter;

  constructor() {
    this.events = new EventEmitter();
  }

  public copy(itemsToCopy: Array<{ originalId: string, type: ClipboardableItemType, data: any }>): void {
    this.clipboardItems = [];
    if (!itemsToCopy || itemsToCopy.length === 0) {
        this.emitClipboardChanged();
        return;
    }

    // Para múltiplos itens, calcula o ponto de referência (ex: canto superior esquerdo do bounding box dos itens)
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
      // Cria uma cópia profunda dos dados para evitar mutações no objeto original
      // JSON.parse(JSON.stringify(...)) é uma forma simples, mas pode não funcionar para todos os tipos de dados (ex: Dates, Functions, undefined)
      // Uma biblioteca de clonagem profunda (lodash.cloneDeep) seria mais robusta.
      const clonedData = JSON.parse(JSON.stringify(item.data));
      
      let relativeOffset: Point | undefined;
      if (refPoint && clonedData.position) {
          relativeOffset = {
              x: clonedData.position.x - refPoint.x,
              y: clonedData.position.y - refPoint.y
          };
      }

      return {
        id: nanoid(), // Gera um novo ID para o item que será colado
        originalId: item.originalId,
        type: item.type,
        data: clonedData,
        relativeOffset
      };
    });
    this.emitClipboardChanged();
  }

  /**
   * Prepara os itens para serem colados.
   * Retorna uma lista de itens com novos IDs e posições ajustadas.
   * @param pasteCenterPoint Ponto no canvas onde o usuário deseja colar (ex: centro da view, posição do mouse)
   * @param offset Opcional: um deslocamento fixo para colar
   */
  public preparePasteData(pasteCenterPoint: Point, offset: Point = { x: 20, y: 20 }): ClipboardItem[] {
    if (this.clipboardItems.length === 0) {
      return [];
    }

    if (this.clipboardItems.length === 1) {
        // Para um único item, cola próximo ao pasteCenterPoint com um pequeno offset
        const itemToPaste = this.clipboardItems[0];
        const clonedData = JSON.parse(JSON.stringify(itemToPaste.data)); // Nova cópia para esta colagem
        clonedData.id = nanoid(); // Garante novo ID para cada colagem
        clonedData.position = {
            x: pasteCenterPoint.x + offset.x,
            y: pasteCenterPoint.y + offset.y,
        };
         return [{ ...itemToPaste, id: clonedData.id, data: clonedData }];
    } else {
        // Para múltiplos itens, usa o pasteCenterPoint como o novo ponto de referência para o grupo
         return this.clipboardItems.map(item => {
            const clonedData = JSON.parse(JSON.stringify(item.data));
            clonedData.id = nanoid(); // Garante novo ID para cada colagem
            
            if (item.relativeOffset) {
                clonedData.position = {
                    x: pasteCenterPoint.x + item.relativeOffset.x + offset.x,
                    y: pasteCenterPoint.y + item.relativeOffset.y + offset.y
                };
            } else { // Fallback se não houver relativeOffset (não deveria acontecer se copy foi feito corretamente)
                 clonedData.position = {
                    x: pasteCenterPoint.x + offset.x,
                    y: pasteCenterPoint.y + offset.y,
                };
            }
            return { ...item, id: clonedData.id, data: clonedData };
        });
    }
  }

  public canPaste(): boolean {
    return this.clipboardItems.length > 0;
  }

  public clear(): void {
    this.clipboardItems = [];
    this.emitClipboardChanged();
  }

  private emitClipboardChanged(): void {
    this.events.emit('clipboardChanged', this.canPaste());
  }

  public on(event: 'clipboardChanged', listener: (canPaste: boolean) => void): this {
    this.events.on(event, listener);
    return this;
  }

  public off(event: 'clipboardChanged', listener: (canPaste: boolean) => void): this {
    this.events.off(event, listener);
    return this;
  }
  
  public destroy(): void {
      this.clipboardItems = [];
      this.events.removeAllListeners();
  }
}