// src/editor/interaction/DndController.ts
import { EventEmitter } from 'eventemitter3';
import { CanvasEngine } from '../canvas/CanvasEngine';
import { ViewStore } from '../state/ViewStore';
import { NodeManager } from '../state/NodeManager';
import { StickyNoteManager } from '../state/StickyNoteManager';
import { SelectionManager } from '../state/SelectionManager';
import { NodeDefinition, Point } from '../core/types';
// import { PlatformDataService } from '../services/PlatformDataService'; // To get NodeDefinitions

export interface DndPayload {
  definitionId: string; // ID of the NodeDefinition or a special ID for sticky notes
  // offsetX: number; // Offset from mouse cursor to top-left of dragged preview (if any)
  // offsetY: number;
}

export class DndController {
  private events: EventEmitter;
  private canvasElement: HTMLCanvasElement;
  // private isDragging: boolean = false;
  // private dragPayload: DndPayload | null = null;
  // private dragPreviewElement: HTMLElement | null = null;

  constructor(
    private canvasEngine: CanvasEngine,
    private viewStore: ViewStore,
    private nodeManager: NodeManager,
    private stickyNoteManager: StickyNoteManager,
    private selectionManager: SelectionManager,
    private getNodeDefinitionById: (id: string) => NodeDefinition | undefined // Callback to get defs
    // private platformDataService: PlatformDataService, // Preferred way to get definitions
  ) {
    this.events = new EventEmitter();
    this.canvasElement = this.canvasEngine.getCanvasElement();
    this.setupCanvasListeners();
  }

  private setupCanvasListeners(): void {
    this.canvasElement.addEventListener('dragover', this.handleDragOver);
    this.canvasElement.addEventListener('drop', this.handleDrop);
    // 'dragleave' might be useful for removing visual feedback
    // this.canvasElement.addEventListener('dragleave', this.handleDragLeave);
  }

  private handleDragOver = (e: DragEvent): void => {
    e.preventDefault(); // Necessary to allow dropping
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'; // Show a "copy" cursor
    }
    // Optionally, provide visual feedback on the canvas for where the node would be dropped
    // const canvasPoint = this.canvasEngine.getClientToCanvasCoordinates({ x: e.clientX, y: e.clientY });
    // this.events.emit('dragOverCanvas', canvasPoint);
    // this.canvasEngine.requestRender(); // If drawing a preview on canvas
  };

  private handleDrop = (e: DragEvent): void => {
    e.preventDefault();
    if (!e.dataTransfer) return;

    const definitionId = e.dataTransfer.getData('text/plain'); // Standard way to transfer ID
    if (!definitionId) return;

    const definition = this.getNodeDefinitionById(definitionId);
    // Special handling for sticky notes if they have a reserved ID like 'sticky-note-def'
    const isStickyNote = definitionId === 'sticky-note-def'; // Example ID

    if (!definition && !isStickyNote) {
        console.warn(`DndController: No definition found for ID: ${definitionId}`);
        return;
    }

    const clientPoint = { x: e.clientX, y: e.clientY };
    const canvasPoint = this.canvasEngine.getClientToCanvasCoordinates(clientPoint);
    const viewState = this.viewStore.getState();
    let dropPosition = canvasPoint;

    if (viewState.snapToGrid) {
      dropPosition = {
        x: Math.round(canvasPoint.x / viewState.gridSize) * viewState.gridSize,
        y: Math.round(canvasPoint.y / viewState.gridSize) * viewState.gridSize,
      };
    }

    let newItem;
    if (isStickyNote) {
      newItem = this.stickyNoteManager.createNote(dropPosition);
    } else if (definition) {
      newItem = this.nodeManager.createNodeFromDefinition(definition, dropPosition);
       // After creating the node from definition, parse any default data for variables
      if (newItem && definition.config?.parameters) {
        const initialData: Record<string, any> = {};
        definition.config.parameters.forEach(param => {
            if (param.defaultValue !== undefined && (param.type === 'text' || param.type === 'code')) {
                initialData[param.id] = param.defaultValue;
            }
        });
        if (Object.keys(initialData).length > 0) {
            this.nodeManager.updateNodeDataAndParseVariables(newItem.id, {...initialData}, {});
        }
      }
    }

    if (newItem) {
      this.selectionManager.selectItem(newItem.id, false);
      this.events.emit('itemDropped', newItem, dropPosition); // Emit event with created item
    }
    this.canvasEngine.requestRender(); // Re-render to show the new item
  };

  // Public methods for components (like NodePalette) to initiate a drag
  // This assumes the palette items themselves handle the 'draggable="true"' and 'dragstart' event.
  // The 'dragstart' event on the palette item should use e.dataTransfer.setData('text/plain', definitionId);

  public on(event: string, listener: (...args: any[]) => void): this {
    this.events.on(event, listener);
    return this;
  }

  public off(event: string, listener: (...args: any[]) => void): this {
    this.events.off(event, listener);
    return this;
  }

  public destroy(): void {
    this.canvasElement.removeEventListener('dragover', this.handleDragOver);
    this.canvasElement.removeEventListener('drop', this.handleDrop);
    this.events.removeAllListeners();
  }
}