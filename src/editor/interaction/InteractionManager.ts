// src/editor/interaction/InteractionManager.ts
import { EventEmitter } from 'eventemitter3';
import { CanvasEngine } from '../canvas/CanvasEngine';
import { NodeManager } from '../state/NodeManager';
import { ConnectionManager } from '../state/ConnectionManager';
import { StickyNoteManager } from '../state/StickyNoteManager';
import { SelectionManager } from '../state/SelectionManager';
import { ViewStore } from '../state/ViewStore';
import {
  Point, Node, StickyNote, CanvasPointerEvent, CanvasWheelEvent, Rect, ViewState, NodePort, Connection,
  InteractiveElementType, ReconnectingConnectionInfo
} from '../core/types';
import {
    NODE_HEADER_HEIGHT, NODE_PORT_VERTICAL_SPACING, NODE_PORT_HIT_RADIUS,
    CONNECTION_HIT_THRESHOLD, RECONNECT_HANDLE_RADIUS, MIN_NODE_WIDTH, MIN_NODE_HEIGHT,
    RESIZE_HANDLE_SIZE // <<<---- ENSURED IMPORT IS PRESENT
} from '../core/constants';

type InteractionMode =
  | 'idle'
  | 'panning'
  | 'draggingItems'
  | 'resizingItem'
  | 'boxSelecting'
  | 'draggingConnection'
  | 'reconnectingConnection';

interface DraggableItem {
  id: string;
  type: 'node' | 'stickyNote';
  position: Point;
  width: number;
  height: number;
}

interface ResizeHandle {
  type: 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';
  item: DraggableItem;
}

interface ActiveResizeState {
    item: DraggableItem;
    handle: ResizeHandle['type'];
    originalRect: Rect;
    startCanvasPoint: Point;
}

interface IdentifiedInteractiveElement {
  type: InteractiveElementType;
  id?: string;
  item?: DraggableItem;
  portDetails?: NodePort;
  connectionDetails?: Connection;
  resizeHandleType?: ResizeHandle['type'];
  region?: string;
}

export interface PendingConnectionState {
  sourcePort: NodePort;
  sourceNode: Node;
  fromPosition: Point;
  currentMousePosition: Point;
  compatibleTargetPortId: string | null;
  reconnectingInfo?: ReconnectingConnectionInfo;
}


export class InteractionManager {
  private events: EventEmitter;
  private mode: InteractionMode = 'idle';

  private panStartClientPoint: Point | null = null;
  private dragStartCanvasPoint: Point | null = null;
  private activeDragItems: DraggableItem[] = [];
  private dragStartItemOffsets = new Map<string, Point>();
  private activeResizeState: ActiveResizeState | null = null;
  private boxSelectStartCanvasPoint: Point | null = null;
  private boxSelectRect: Rect | null = null;
  private pendingConnection: PendingConnectionState | null = null;
  private lastPointerDownCanvasPoint: Point | null = null;


  constructor(
    private canvasEngine: CanvasEngine,
    private viewStore: ViewStore,
    private nodeManager: NodeManager,
    private connectionManager: ConnectionManager,
    private stickyNoteManager: StickyNoteManager,
    private selectionManager: SelectionManager,
  ) {
    this.events = new EventEmitter();
    this.subscribeToCanvasEvents();
  }

  private subscribeToCanvasEvents(): void {
    this.canvasEngine.on('pointerdown', this.handlePointerDown);
    this.canvasEngine.on('pointermove', this.handlePointerMove);
    this.canvasEngine.on('pointerup', this.handlePointerUp);
    this.canvasEngine.on('pointerleave', this.handlePointerLeave);
    this.canvasEngine.on('wheel', this.handleWheel);
    this.canvasEngine.on('doubleclick', (e: CanvasPointerEvent) => this.events.emit('canvasDoubleClick', e));
    this.canvasEngine.on('contextmenu', (e: CanvasPointerEvent) => {
        this.lastPointerDownCanvasPoint = e.canvasPoint;
        this.events.emit('canvasContextMenu', e);
    });
  }
  
  public getLastPointerDownCanvasPoint(): Point | null { return this.lastPointerDownCanvasPoint; }
  public isInteracting(): boolean { return this.mode !== 'idle'; }

  public getPortAbsolutePosition(node: Node, port: NodePort, viewState: ViewState): Point {
    const portHeaderHeight = NODE_HEADER_HEIGHT;
    const portVerticalSpacing = NODE_PORT_VERTICAL_SPACING;
    let portIndex = -1;
    let portsInGroup: NodePort[];

    if (port.isDynamic) {
        portsInGroup = port.type === 'input' ? node.dynamicInputs.filter(p => !p.isHidden) : node.dynamicOutputs.filter(p => !p.isHidden);
        portIndex = portsInGroup.findIndex(p => p.id === port.id);
    } else {
        portsInGroup = port.type === 'input' ? node.fixedInputs : node.fixedOutputs;
        portIndex = portsInGroup.findIndex(p => p.id === port.id);
    }
    if (port.isHidden && port.isDynamic) return { x: -9999, y: -9999 };
    if (portIndex === -1) return { x: node.position.x + (port.type === 'input' ? 0 : node.width), y: node.position.y + node.height / 2 };
    let yOffset = portHeaderHeight;
    if (port.type === 'input') { if (port.isDynamic) yOffset += node.fixedInputs.length * portVerticalSpacing; }
    else { if (port.isDynamic) yOffset += node.fixedOutputs.length * portVerticalSpacing; }
    yOffset += (portIndex + 0.5) * portVerticalSpacing;
    const portRelativeX = port.type === 'input' ? 0 : node.width;
    return { x: node.position.x + portRelativeX, y: node.position.y + yOffset };
  }

  public getInteractiveElementAtPoint(canvasPoint: Point): IdentifiedInteractiveElement {
    const currentViewState = this.viewStore.getState();
    const portHitRad = NODE_PORT_HIT_RADIUS / currentViewState.scale;
    const connHitThresh = CONNECTION_HIT_THRESHOLD / currentViewState.scale;
    const reconHandleRadScaled = RECONNECT_HANDLE_RADIUS / currentViewState.scale;
    const selectedIds = this.selectionManager.getSelectedItems();

    if (selectedIds.length === 1) {
        const selectedItem = this.findDraggableItemById(selectedIds[0]);
        if (selectedItem) {
            const resizeHandleType = this.getResizeHandleTypeForPoint(canvasPoint, selectedItem, currentViewState);
            if (resizeHandleType) return { type: 'resizeHandle', item: selectedItem, resizeHandleType, id: selectedItem.id };
        }
    }

    const nodes = this.nodeManager.getNodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const allPorts = [...node.fixedInputs, ...node.fixedOutputs, ...node.dynamicInputs, ...node.dynamicOutputs];
        for (const port of allPorts) {
            if (port.isHidden) continue;
            const portAbsPos = this.getPortAbsolutePosition(node, port, currentViewState);
            const dx = canvasPoint.x - portAbsPos.x; const dy = canvasPoint.y - portAbsPos.y;
            if (dx * dx + dy * dy < portHitRad * portHitRad) return { type: 'port', id: port.id, portDetails: port, item: this.nodeToDraggableItem(node) };
        }
    }
    
    const connections = this.connectionManager.getConnections();
    for (const conn of connections) {
        const sourceNode = this.nodeManager.getNode(conn.sourceNodeId);
        const targetNode = this.nodeManager.getNode(conn.targetNodeId);
        const sourcePort = this.nodeManager.getPort(conn.sourcePortId);
        const targetPort = this.nodeManager.getPort(conn.targetPortId);
        if (sourceNode && targetNode && sourcePort && targetPort) {
            if (sourcePort.isHidden || targetPort.isHidden) continue;
            const p0 = this.getPortAbsolutePosition(sourceNode, sourcePort, currentViewState);
            const p3 = this.getPortAbsolutePosition(targetNode, targetPort, currentViewState);
            const distToP0Sq = (canvasPoint.x - p0.x)**2 + (canvasPoint.y - p0.y)**2;
            if (distToP0Sq < reconHandleRadScaled**2) return { type: 'connection', id: conn.id, connectionDetails: conn, region: 'sourceHandle' };
            const distToP3Sq = (canvasPoint.x - p3.x)**2 + (canvasPoint.y - p3.y)**2;
            if (distToP3Sq < reconHandleRadScaled**2) return { type: 'connection', id: conn.id, connectionDetails: conn, region: 'targetHandle' };
            if (this.isPointNearBezierConnection(canvasPoint, p0, p3, connHitThresh)) return { type: 'connection', id: conn.id, connectionDetails: conn, region: 'body' };
        }
    }

    const itemHit = this.getItemBodyAtPoint(canvasPoint);
    if (itemHit) {
        let region = 'body';
        if (itemHit.type === 'node') {
            const node = this.nodeManager.getNode(itemHit.id);
            if (node && canvasPoint.y < node.position.y + NODE_HEADER_HEIGHT) region = 'header';
        }
        return { type: itemHit.type, id: itemHit.id, item: itemHit, region };
    }
    return { type: 'canvas' };
  }

  private isPointNearBezierConnection(point: Point, p0: Point, p3: Point, threshold: number): boolean {
    const minX = Math.min(p0.x, p3.x) - threshold * 5; const maxX = Math.max(p0.x, p3.x) + threshold * 5;
    const minY = Math.min(p0.y, p3.y) - threshold * 5; const maxY = Math.max(p0.y, p3.y) + threshold * 5;
    if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) return false;
    const lenSq = (p3.x - p0.x) ** 2 + (p3.y - p0.y) ** 2;
    if (lenSq === 0) return Math.sqrt((point.x - p0.x) ** 2 + (point.y - p0.y) ** 2) < threshold;
    let t = ((point.x - p0.x) * (p3.x - p0.x) + (point.y - p0.y) * (p3.y - p0.y)) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = p0.x + t * (p3.x - p0.x); const projY = p0.y + t * (p3.y - p0.y);
    const distSq = (point.x - projX) ** 2 + (point.y - projY) ** 2;
    const curveLengthApprox = Math.abs(p0.x - p3.x) + Math.abs(p0.y - p3.y);
    const midX = (p0.x + p3.x) / 2; const midY = (p0.y + p3.y) / 2;
    const distToMidSq = (point.x - midX)**2 + (point.y - midY)**2;
    if (distSq < threshold ** 2 || (distToMidSq < (curveLengthApprox / 3)**2 && distSq < (threshold * 2)**2) ) return true;
    return false;
  }

  private nodeToDraggableItem(node: Node): DraggableItem { return { id: node.id, type: 'node', position: { ...node.position }, width: node.width, height: node.height }; }
  private stickyToDraggableItem(note: StickyNote): DraggableItem { return { id: note.id, type: 'stickyNote', position: { ...note.position }, width: note.width, height: note.height }; }

  private handlePointerDown = (e: CanvasPointerEvent): void => {
    const { canvasPoint, originalEvent, clientPoint } = e;
    this.lastPointerDownCanvasPoint = canvasPoint;
    const interactiveElement = this.getInteractiveElementAtPoint(canvasPoint);
    if (this.mode === 'draggingConnection' || this.mode === 'reconnectingConnection') {
        if (originalEvent.button === 2) { this.cancelPendingOrReconnectingConnection(); originalEvent.preventDefault(); return; }
    }
    switch (interactiveElement.type) {
      case 'resizeHandle':
        if (interactiveElement.item && interactiveElement.resizeHandleType) {
          this.mode = 'resizingItem';
          this.activeResizeState = {
              item: interactiveElement.item, handle: interactiveElement.resizeHandleType,
              originalRect: { ...interactiveElement.item.position, width: interactiveElement.item.width, height: interactiveElement.item.height },
              startCanvasPoint: canvasPoint
          };
          this.events.emit('resizeStart', this.activeResizeState.item);
        }
        break;
      case 'port':
        if (interactiveElement.portDetails && interactiveElement.item && this.mode === 'idle') {
            if (interactiveElement.portDetails.isHidden) { this.mode = 'idle'; return; }
            this.mode = 'draggingConnection';
            const sourceNode = this.nodeManager.getNode(interactiveElement.portDetails.nodeId);
            if (!sourceNode) { this.mode = 'idle'; break; }
            this.pendingConnection = {
                sourcePort: interactiveElement.portDetails, sourceNode,
                fromPosition: this.getPortAbsolutePosition(sourceNode, interactiveElement.portDetails, this.viewStore.getState()),
                currentMousePosition: canvasPoint, compatibleTargetPortId: null,
            };
            this.events.emit('pendingConnectionStart', this.pendingConnection);
            this.canvasEngine.requestRender();
        }
        break;
      case 'connection':
        if (interactiveElement.id && interactiveElement.connectionDetails && interactiveElement.region) {
            const conn = interactiveElement.connectionDetails;
            if (interactiveElement.region === 'sourceHandle' || interactiveElement.region === 'targetHandle') {
                this.mode = 'reconnectingConnection'; const viewState = this.viewStore.getState();
                let fixedPortDetails: NodePort, fixedNodeDetails: Node, dynamicPortForPending: NodePort;
                if (interactiveElement.region === 'sourceHandle') {
                    fixedPortDetails = this.nodeManager.getPort(conn.targetPortId)!; fixedNodeDetails = this.nodeManager.getNode(conn.targetNodeId)!;
                    dynamicPortForPending = { ...fixedPortDetails, type: 'input' };
                } else {
                    fixedPortDetails = this.nodeManager.getPort(conn.sourcePortId)!; fixedNodeDetails = this.nodeManager.getNode(conn.sourceNodeId)!;
                    dynamicPortForPending = { ...fixedPortDetails, type: 'output' };
                }
                if (!fixedPortDetails || !fixedNodeDetails || fixedPortDetails.isHidden) { this.mode = 'idle'; break; }
                this.pendingConnection = {
                    sourcePort: dynamicPortForPending, sourceNode: fixedNodeDetails,
                    fromPosition: this.getPortAbsolutePosition(fixedNodeDetails, fixedPortDetails, viewState),
                    currentMousePosition: canvasPoint, compatibleTargetPortId: null,
                    reconnectingInfo: { originalConnection: conn, draggedEnd: interactiveElement.region === 'sourceHandle' ? 'source' : 'target', fixedPort: fixedPortDetails, fixedNode: fixedNodeDetails }
                };
                this.selectionManager.selectItem(conn.id, false);
                this.events.emit('reconnectionStart', this.pendingConnection);
                this.canvasEngine.requestRender();
            } else if (interactiveElement.region === 'body') {
                if (originalEvent.metaKey || originalEvent.ctrlKey) this.selectionManager.toggleSelection(interactiveElement.id);
                else this.selectionManager.selectItem(interactiveElement.id, false);
                this.events.emit('connectionSelected', interactiveElement.id);
            }
        }
        break;
      case 'node': case 'stickyNote':
        if (interactiveElement.item) {
          this.mode = 'draggingItems'; this.dragStartCanvasPoint = canvasPoint;
          if (originalEvent.metaKey || originalEvent.ctrlKey) this.selectionManager.toggleSelection(interactiveElement.item.id);
          else if (!this.selectionManager.isSelected(interactiveElement.item.id)) this.selectionManager.selectItem(interactiveElement.item.id, false);
          this.activeDragItems = this.selectionManager.getSelectedItems().map(id => this.findDraggableItemById(id)).filter(item => item !== null) as DraggableItem[];
          if (this.activeDragItems.length === 0 && interactiveElement.item) this.activeDragItems = [interactiveElement.item];
          this.dragStartItemOffsets.clear(); this.activeDragItems.forEach(item => this.dragStartItemOffsets.set(item.id, { ...item.position }));
          this.events.emit('itemsDragStart', this.activeDragItems.map(i => i.id));
        }
        break;
      case 'canvas': default:
        if (originalEvent.button === 1 || (originalEvent.button === 0 && originalEvent.altKey)) {
          this.mode = 'panning'; this.panStartClientPoint = { x: clientPoint.x, y: clientPoint.y }; this.setCursor('grabbing');
        } else if (originalEvent.button === 0) {
          if (!originalEvent.shiftKey && !originalEvent.metaKey && !originalEvent.ctrlKey) this.selectionManager.clearSelection();
          this.mode = 'boxSelecting'; this.boxSelectStartCanvasPoint = canvasPoint;
          this.boxSelectRect = { ...canvasPoint, width: 0, height: 0 };
          this.events.emit('boxSelectStart', this.boxSelectRect); this.canvasEngine.requestRender();
        }
        break;
    }
  };

  private handlePointerMove = (e: CanvasPointerEvent): void => {
    const { canvasPoint, clientPoint } = e;
    if ((this.mode === 'draggingConnection' || this.mode === 'reconnectingConnection') && this.pendingConnection) {
      const targetElement = this.getInteractiveElementAtPoint(canvasPoint);
      let compatiblePortId: string | null = null; let potentialTargetPort: NodePort | undefined = undefined;
      if (targetElement.type === 'port' && targetElement.portDetails && !targetElement.portDetails.isHidden) {
          potentialTargetPort = targetElement.portDetails;
          if (this.isConnectionCompatible(this.pendingConnection.sourcePort, potentialTargetPort, this.pendingConnection.reconnectingInfo)) compatiblePortId = potentialTargetPort.id;
      }
      if (compatiblePortId && potentialTargetPort) {
          const targetNode = this.nodeManager.getNode(potentialTargetPort.nodeId);
          if (targetNode) this.pendingConnection.currentMousePosition = this.getPortAbsolutePosition(targetNode, potentialTargetPort, this.viewStore.getState());
      } else this.pendingConnection.currentMousePosition = canvasPoint;
      if (this.pendingConnection.compatibleTargetPortId !== compatiblePortId) {
          this.pendingConnection.compatibleTargetPortId = compatiblePortId;
          this.events.emit('compatiblePortHoverChanged', compatiblePortId);
      }
      this.events.emit('pendingConnectionUpdate', this.pendingConnection);
      this.canvasEngine.requestRender(); this.setCursor('crosshair'); return;
    }
    if (this.mode === 'idle') {
        const interactiveElement = this.getInteractiveElementAtPoint(canvasPoint);
        let newCursor = 'default'; let hoveredPort: string | null = null;
        switch (interactiveElement.type) {
            case 'resizeHandle': if(interactiveElement.resizeHandleType) newCursor = this.getCursorForResizeHandle(interactiveElement.resizeHandleType); break;
            case 'port': if (!interactiveElement.portDetails?.isHidden) { newCursor = 'pointer'; hoveredPort = interactiveElement.portDetails!.id; } break;
            case 'connection': newCursor = 'pointer'; break;
            case 'node': case 'stickyNote': newCursor = (interactiveElement.region === 'header' || interactiveElement.region === 'body') ? 'move' : 'default'; break;
        }
        this.setCursor(newCursor); this.events.emit('portHoverChanged', hoveredPort);
    }
    switch (this.mode) {
      case 'panning':
        if (this.panStartClientPoint) {
          const dx = clientPoint.x - this.panStartClientPoint.x; const dy = clientPoint.y - this.panStartClientPoint.y;
          this.canvasEngine.pan(dx, dy); this.panStartClientPoint = clientPoint; this.setCursor('grabbing');
        }
        break;
      case 'draggingItems':
        if (this.dragStartCanvasPoint && this.activeDragItems.length > 0) {
          const viewState = this.viewStore.getState(); const dx = canvasPoint.x - this.dragStartCanvasPoint.x; const dy = canvasPoint.y - this.dragStartCanvasPoint.y;
          this.activeDragItems.forEach(dragItem => {
            const initialPos = this.dragStartItemOffsets.get(dragItem.id); if (!initialPos) return;
            let newX = initialPos.x + dx; let newY = initialPos.y + dy;
            if (viewState.snapToGrid) { newX = Math.round(newX / viewState.gridSize) * viewState.gridSize; newY = Math.round(newY / viewState.gridSize) * viewState.gridSize; }
            if (dragItem.type === 'node') this.nodeManager.moveNode(dragItem.id, { x: newX, y: newY });
            else if (dragItem.type === 'stickyNote') this.stickyNoteManager.updateNote(dragItem.id, { position: { x: newX, y: newY } });
          });
          this.events.emit('itemsDrag', this.activeDragItems.map(i => i.id));
          this.canvasEngine.requestRender(); this.setCursor('grabbing');
        }
        break;
      case 'resizingItem':
        if (this.activeResizeState) {
            this.performResize(canvasPoint);
            const item = this.findDraggableItemById(this.activeResizeState.item.id);
            if (item) this.events.emit('itemResize', item);
            this.canvasEngine.requestRender(); this.setCursor(this.getCursorForResizeHandle(this.activeResizeState.handle));
        }
        break;
      case 'boxSelecting':
        if (this.boxSelectStartCanvasPoint) {
          this.boxSelectRect = {
            x: Math.min(this.boxSelectStartCanvasPoint.x, canvasPoint.x), y: Math.min(this.boxSelectStartCanvasPoint.y, canvasPoint.y),
            width: Math.abs(this.boxSelectStartCanvasPoint.x - canvasPoint.x), height: Math.abs(this.boxSelectStartCanvasPoint.y - canvasPoint.y),
          };
          this.events.emit('boxSelectUpdate', this.boxSelectRect);
          this.canvasEngine.requestRender(); this.setCursor('crosshair');
        }
        break;
    }
  };

  private isConnectionCompatible(sourcePortForPending: NodePort, targetPortCandidate: NodePort, reconInfo?: ReconnectingConnectionInfo): boolean {
    if (targetPortCandidate.isHidden) return false;
    if (reconInfo) {
        if (targetPortCandidate.id === reconInfo.fixedPort.id) return false;
        if (reconInfo.draggedEnd === 'source') return targetPortCandidate.type === 'output' && reconInfo.fixedPort.type === 'input' && targetPortCandidate.nodeId !== reconInfo.fixedPort.nodeId;
        else return targetPortCandidate.type === 'input' && reconInfo.fixedPort.type === 'output' && targetPortCandidate.nodeId !== reconInfo.fixedPort.nodeId;
    } else {
        if (sourcePortForPending.nodeId === targetPortCandidate.nodeId) return false;
        if (sourcePortForPending.type === 'output' && targetPortCandidate.type === 'input') return true;
        if (sourcePortForPending.type === 'input' && targetPortCandidate.type === 'output') return true;
        return false;
    }
  }

  private handlePointerUp = (e: CanvasPointerEvent): void => {
    const { canvasPoint, originalEvent } = e;

    // Handle connection dragging/reconnecting first
    if ((this.mode === 'draggingConnection' || this.mode === 'reconnectingConnection') && this.pendingConnection) {
      const currentPendingConnection = this.pendingConnection; // Copy for use after clearing
      const currentMode = this.mode;
      let connectionAttempted = false;

      // IMPORTANT: Reset pending state *before* trying to complete,
      // to prevent the line from being drawn in the render frame triggered by connection events.
      this.pendingConnection = null;
      this.mode = 'idle'; // Set mode to idle immediately
      this.setCursor('default');
      this.events.emit('compatiblePortHoverChanged', null); // Clear hover
      // Request a render to clear the pending line *before* connection events fire.
      this.canvasEngine.requestRender();


      try {
          const targetElement = this.getInteractiveElementAtPoint(canvasPoint);
          if (targetElement.type === 'port' && targetElement.portDetails && !targetElement.portDetails.isHidden &&
              currentPendingConnection.compatibleTargetPortId === targetElement.portDetails.id) {
            
            connectionAttempted = true;
            if (currentMode === 'reconnectingConnection' && currentPendingConnection.reconnectingInfo) {
                this.tryCompleteReconnection(currentPendingConnection.reconnectingInfo, targetElement.portDetails);
            } else if (currentMode === 'draggingConnection') {
                 const portA = currentPendingConnection.sourcePort;
                 const portB = targetElement.portDetails;
                 if (portA.type === 'output' && portB.type === 'input') this.tryCompleteConnection(portA, portB);
                 else if (portA.type === 'input' && portB.type === 'output') this.tryCompleteConnection(portB, portA);
                 else this.events.emit('connectionFailed', { reason: "Invalid port type combination on drop.", portA, portB});
            }
          }
      } finally {
          // If no connection was made (e.g., dropped on canvas or incompatible port)
          if (!connectionAttempted) {
              if (currentPendingConnection.reconnectingInfo) {
                  this.events.emit('reconnectionCancel', currentPendingConnection);
              } else {
                  this.events.emit('pendingConnectionCancel', currentPendingConnection);
              }
          }
          // State (pendingConnection, mode, cursor) is already reset.
          // A final render might be needed if other logic below changes things,
          // but the critical render to remove the line was done above.
      }
    } else if (this.mode === 'draggingItems' && this.activeDragItems.length > 0) {
      this.events.emit('itemsDragEnd', this.activeDragItems.map(i=> i.id));
    } else if (this.mode === 'resizingItem' && this.activeResizeState) {
      this.events.emit('itemResizeEnd', this.findDraggableItemById(this.activeResizeState.item.id));
    } else if (this.mode === 'boxSelecting' && this.boxSelectRect) {
      const itemsInRect = this.getItemsInRect(this.boxSelectRect);
      const itemIdsToSelect = itemsInRect.map(item => item.id);
      const addToSelection = originalEvent.shiftKey || originalEvent.ctrlKey || originalEvent.metaKey;
      this.selectionManager.selectItems(itemIdsToSelect, addToSelection);
      this.events.emit('boxSelectEnd', this.boxSelectRect, itemsInRect);
      this.boxSelectRect = null;
    }

    // General cleanup that should always happen on pointer up,
    // if not already handled by a specific mode's reset (like connection cancellation)
    if (this.mode !== 'idle') { // If mode wasn't reset by a specific handler above
        this.mode = 'idle';
        this.setCursor('default');
    }
    this.panStartClientPoint = null;
    this.dragStartCanvasPoint = null;
    this.activeDragItems = [];
    this.dragStartItemOffsets.clear();
    this.activeResizeState = null;
    this.boxSelectStartCanvasPoint = null;
    // this.boxSelectRect cleared above for its specific mode.

    this.canvasEngine.requestRender(); // Final render for any other state changes in pointerUp
  };

  private handlePointerLeave = (e: CanvasPointerEvent): void => {
    if (this.mode === 'draggingItems' || this.mode === 'panning' || this.mode === 'resizingItem' || this.mode === 'boxSelecting') {
        this.handlePointerUp(e); // Finalize ongoing interaction
    } else if (this.mode === 'draggingConnection' || this.mode === 'reconnectingConnection') {
        // If dragging a connection off canvas, treat it as a cancel
        this.cancelPendingOrReconnectingConnection();
    }
    // General cursor reset if mode is now idle
    if (this.mode === 'idle') {
        this.setCursor('default');
        this.events.emit('portHoverChanged', null);
    }
  };

  private tryCompleteReconnection(reconInfo: ReconnectingConnectionInfo, newPort: NodePort): void {
    this.connectionManager.deleteConnection(reconInfo.originalConnection.id, true);
    let finalSourcePort: NodePort, finalTargetPort: NodePort;
    if (reconInfo.draggedEnd === 'source') { finalSourcePort = newPort; finalTargetPort = reconInfo.fixedPort; }
    else { finalSourcePort = reconInfo.fixedPort; finalTargetPort = newPort; }
    const newConnection = this.connectionManager.createConnection(finalSourcePort.id, finalTargetPort.id);
    if (newConnection) { this.events.emit('connectionRecompleted', newConnection, reconInfo.originalConnection); this.selectionManager.selectItem(newConnection.id, false); }
    else { this.connectionManager.createConnection(reconInfo.originalConnection.sourcePortId, reconInfo.originalConnection.targetPortId); this.events.emit('reconnectionFailed', reconInfo.originalConnection); this.selectionManager.selectItem(reconInfo.originalConnection.id, false); }
  }

  // Now made public if NodeEditorController needs to call it (e.g. on Escape key)
  public cancelPendingOrReconnectingConnection(): void {
    const wasPending = !!this.pendingConnection;
    if (this.pendingConnection) {
        if(this.pendingConnection.reconnectingInfo) this.events.emit('reconnectionCancel', this.pendingConnection);
        else this.events.emit('pendingConnectionCancel', this.pendingConnection);
    }
    this.pendingConnection = null;
    this.mode = 'idle'; // CRITICAL: Reset mode here
    this.setCursor('default'); // CRITICAL: Reset cursor here
    if (wasPending) {
        this.events.emit('compatiblePortHoverChanged', null);
        this.canvasEngine.requestRender(); // Request render to clear the line
    }
  }

  private tryCompleteConnection(sourcePort: NodePort, targetPort: NodePort): void {
    const connection = this.connectionManager.createConnection(sourcePort.id, targetPort.id);
    if (connection) { this.events.emit('connectionCompleted', connection); this.selectionManager.selectItem(connection.id, false); }
  }
  
  public getPendingConnection(): PendingConnectionState | null { return this.pendingConnection; }

  private performResize(currentCanvasPoint: Point): void {
    if (!this.activeResizeState) return;
    const { item, handle, originalRect, startCanvasPoint } = this.activeResizeState;
    const viewState = this.viewStore.getState();
    let actualItem: Node | StickyNote | undefined;
    if (item.type === 'node') actualItem = this.nodeManager.getNode(item.id); else actualItem = this.stickyNoteManager.getNote(item.id);
    let minHeight = MIN_NODE_HEIGHT;
    if (actualItem && actualItem.type === 'node') {
        const node = actualItem as Node;
        const visibleInputs = [...node.fixedInputs, ...node.dynamicInputs.filter(p => !p.isHidden)].length;
        const visibleOutputs = [...node.fixedOutputs, ...node.dynamicOutputs.filter(p => !p.isHidden)].length;
        const requiredPortSpace = Math.max(visibleInputs, visibleOutputs) * NODE_PORT_VERTICAL_SPACING;
        minHeight = NODE_HEADER_HEIGHT + requiredPortSpace + NODE_PORT_VERTICAL_SPACING;
        minHeight = Math.max(minHeight, node.minHeight || MIN_NODE_HEIGHT);
    } else if (actualItem && actualItem.type === 'stickyNote') minHeight = (actualItem as StickyNote).style.fontSize * 2;
    const minWidth = actualItem?.minWidth || MIN_NODE_WIDTH;
    let newX = originalRect.x; let newY = originalRect.y;
    let newWidth = originalRect.width; let newHeight = originalRect.height;
    const dx = currentCanvasPoint.x - startCanvasPoint.x; const dy = currentCanvasPoint.y - startCanvasPoint.y;
    if (handle.includes('e')) newWidth = Math.max(minWidth, originalRect.width + dx);
    if (handle.includes('w')) { const pW = originalRect.width - dx; newWidth = Math.max(minWidth, pW); newX = originalRect.x + originalRect.width - newWidth; }
    if (handle.includes('s')) newHeight = Math.max(minHeight, originalRect.height + dy);
    if (handle.includes('n')) { const pH = originalRect.height - dy; newHeight = Math.max(minHeight, pH); newY = originalRect.y + originalRect.height - newHeight; }
    if (viewState.snapToGrid) {
        const gs = viewState.gridSize; newX = Math.round(newX / gs) * gs; newY = Math.round(newY / gs) * gs;
        const rE = Math.round((newX + newWidth) / gs) * gs; const bE = Math.round((newY + newHeight) / gs) * gs;
        newWidth = Math.max(minWidth, rE - newX); newHeight = Math.max(minHeight, bE - newY);
    }
    const newRect: Rect = { x: newX, y: newY, width: newWidth, height: newHeight };
    if (item.type === 'node') this.nodeManager.resizeNode(item.id, newRect);
    else if (item.type === 'stickyNote') this.stickyNoteManager.updateNoteRect(item.id, newRect);
  }

  private handleWheel = (e: CanvasWheelEvent): void => { this.canvasEngine.zoom(e.deltaY, e.clientPoint); };

  public findDraggableItemById(id: string): DraggableItem | null {
    const node = this.nodeManager.getNode(id); if (node) return this.nodeToDraggableItem(node);
    const stickyNote = this.stickyNoteManager.getNote(id); if (stickyNote) return this.stickyToDraggableItem(stickyNote);
    return null;
  }
  
  private getItemBodyAtPoint(canvasPoint: Point): DraggableItem | null {
    const stickyNotes = this.stickyNoteManager.getNotes();
    for (let i = stickyNotes.length - 1; i >= 0; i--) {
        const note = stickyNotes[i];
        if (this.isPointInRect(canvasPoint, note.position, { width: note.width, height: note.height })) return this.stickyToDraggableItem(note);
    }
    const nodes = this.nodeManager.getNodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        if (this.isPointInRect(canvasPoint, node.position, { width: node.width, height: node.height })) return this.nodeToDraggableItem(node);
    }
    return null;
  }

  private getResizeHandleTypeForPoint(point: Point, item: DraggableItem, viewState: ViewState): ResizeHandle['type'] | null {
    const handleHitRadius = RESIZE_HANDLE_SIZE / viewState.scale;
    const { x, y } = item.position; const { width, height } = item;
    const handlesDef: { type: ResizeHandle['type'], x: number, y: number }[] = [
        { type: 'nw', x: x, y: y }, { type: 'n', x: x + width / 2, y: y }, { type: 'ne', x: x + width, y: y },
        { type: 'w', x: x, y: y + height / 2 }, { type: 'e', x: x + width, y: y + height / 2 },
        { type: 'sw', x: x, y: y + height }, { type: 's', x: x + width / 2, y: y + height }, { type: 'se', x: x + width, y: y + height },
    ];
    for (const handle of handlesDef) {
        const dx = point.x - handle.x; const dy = point.y - handle.y;
        if (dx * dx + dy * dy < handleHitRadius * handleHitRadius) return handle.type;
    }
    return null;
  }

  private getCursorForResizeHandle(handleType: ResizeHandle['type']): string {
    switch (handleType) {
        case 'nw': case 'se': return 'nwse-resize'; case 'n': case 's': return 'ns-resize';
        case 'ne': case 'sw': return 'nesw-resize'; case 'w': case 'e': return 'ew-resize';
        default: return 'default';
    }
  }

  private setCursor(cursorStyle: string): void { this.canvasEngine.getCanvasElement().style.cursor = cursorStyle; }
  private isPointInRect(point: Point, rectPos: Point, rectSize: { width: number, height: number }): boolean {
    return (point.x >= rectPos.x && point.x <= rectPos.x + rectSize.width && point.y >= rectPos.y && point.y <= rectPos.y + rectSize.height);
  }
  private getItemsInRect(rect: Rect): DraggableItem[] {
    const allDraggableItems: DraggableItem[] = [
      ...this.nodeManager.getNodes().map(n => this.nodeToDraggableItem(n)),
      ...this.stickyNoteManager.getNotes().map(sn => this.stickyToDraggableItem(sn)),
    ];
    return allDraggableItems.filter(item => {
      const itemRect = { ...item.position, width: item.width, height: item.height };
      return (itemRect.x < rect.x + rect.width && itemRect.x + itemRect.width > rect.x && itemRect.y < rect.y + rect.height && itemRect.y + itemRect.height > rect.y);
    });
  }
  public getBoxSelectRect(): Rect | null { return this.boxSelectRect; }
  public on(event: string, listener: (...args: any[]) => void): this { this.events.on(event, listener); return this; }
  public off(event: string, listener: (...args: any[]) => void): this { this.events.off(event, listener); return this; }
  public destroy(): void { this.events.removeAllListeners(); }
}