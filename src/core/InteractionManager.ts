import { EventEmitter } from 'eventemitter3';
import { CanvasEngine } from './CanvasEngine';
import { NodeManager } from './NodeManager';
import { StickyNoteManager } from './StickyNoteManager';
import { SelectionManager } from './SelectionManager';
import { Point, Node, StickyNote, CanvasPointerEvent, CanvasWheelEvent, Rect, ViewState, NodePort, Connection, InteractiveElementType, ReconnectingConnectionInfo } from './Types';

type InteractionMode =
  | 'idle'
  | 'panning'
  | 'draggingItems'
  | 'resizingItem'
  | 'boxSelecting'
  | 'draggingConnection' // Para criar uma nova conexão
  | 'reconnectingConnection'; // Para reconectar uma existente

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

interface InteractiveElement {
  type: InteractiveElementType;
  id?: string;
  item?: DraggableItem;
  portDetails?: NodePort;
  connectionDetails?: Connection;
  resizeHandleType?: ResizeHandle['type'];
  region?: string; // 'header', 'body', 'sourceHandle', 'targetHandle'
}

export interface PendingConnectionState {
  sourcePort: NodePort; // Porta de onde o arraste iniciou (pode ser a fixa na reconexão)
  sourceNode: Node;     // Nó da sourcePort
  fromPosition: Point;
  currentMousePosition: Point;
  compatibleTargetPortId: string | null;
  reconnectingInfo?: ReconnectingConnectionInfo;
}

export class InteractionManager {
  private events: EventEmitter;
  private mode: InteractionMode = 'idle';

  private panStartPoint: Point | null = null;
  private dragStartPoint: Point | null = null;
  private dragStartItemOffsets: Map<string, Point> = new Map();

  private activeDragItems: DraggableItem[] = [];
  private activeResizeItem: DraggableItem | null = null;
  private activeResizeHandle: ResizeHandle['type'] | null = null;
  private originalResizeItemRect: Rect | null = null;

  private boxSelectStartPoint: Point | null = null;
  private boxSelectRect: Rect | null = null;

  private pendingConnection: PendingConnectionState | null = null;
  private lastPointerDownCanvasPoint: Point | null = null;

  private readonly RECONNECT_HANDLE_RADIUS = 10; // Raio para detectar clique na extremidade da conexão


  constructor(
    private canvasEngine: CanvasEngine,
    private nodeManager: NodeManager,
    private stickyNoteManager: StickyNoteManager,
    private selectionManager: SelectionManager
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
        this.events.emit('canvasContextMenu', e)
    });
  }
  
  public getLastPointerDownCanvasPoint(): Point | null {
      return this.lastPointerDownCanvasPoint;
  }

  public isInteracting(): boolean {
    return this.mode !== 'idle';
  }
  
  public getPortAbsolutePosition(node: Node, port: NodePort, viewState: ViewState): Point {
    const headerHeight = 40; 
    const portVerticalSpacing = 24; 

    let portIndex = -1;
    let portsList: NodePort[];

    if (port.isDynamic) {
        if (port.type === 'input') {
            portsList = node.dynamicInputs.filter(p => !p.isHidden);
            portIndex = portsList.findIndex(p => p.id === port.id);
        } else { // dynamic output
            portsList = node.dynamicOutputs;
            portIndex = portsList.findIndex(p => p.id === port.id);
        }
    } else { // fixed port
        if (port.type === 'input') {
            portsList = node.fixedInputs;
            portIndex = portsList.findIndex(p => p.id === port.id);
        } else { // fixed output
            portsList = node.fixedOutputs;
            portIndex = portsList.findIndex(p => p.id === port.id);
        }
    }

    // Se a porta estiver oculta, não deve ter uma posição "clicável" visualmente
    if (port.isHidden && port.isDynamic) {
        // Retorna uma posição fora da tela ou um ponto de referência para que não seja interativo
        return { x: -9999, y: -9999 }; 
    }

    // Fallback caso a porta não seja encontrada na lista ou se o index for inválido
    if (portIndex === -1) { 
        console.warn(`Port ${port.id} not found in node ${node.id} lists for position calculation.`);
        return { x: node.position.x + (port.type === 'input' ? 0 : node.width), y: node.position.y + node.height / 2 };
    }

    // Cálculo da posição vertical baseado na quantidade de portas *visíveis*
    // Portas fixas vêm primeiro, depois as dinâmicas
    let totalPortsBeforeThisSection = 0;
    if (port.isDynamic) {
        if (port.type === 'input') {
            totalPortsBeforeThisSection = node.fixedInputs.length;
        } else { // dynamic output
            totalPortsBeforeThisSection = node.fixedOutputs.length;
        }
    }
    
    // A altura de renderização de um nó deve acomodar todas as portas.
    // O cálculo de Y é baseado na ordem na lista (fixa ou dinâmica) e na posição relativa
    const portRelativeY = headerHeight + portVerticalSpacing * (totalPortsBeforeThisSection + portIndex + 0.5);
    const portRelativeX = port.type === 'input' ? 0 : node.width;

    return {
        x: node.position.x + portRelativeX,
        y: node.position.y + portRelativeY,
    };
  }

  private getInteractiveElementAtPoint(canvasPoint: Point): InteractiveElement {
    const viewState = this.canvasEngine.getViewState();
    const portHitRadius = 8 / viewState.scale;
    const connectionHitThreshold = 5 / viewState.scale;
    const reconnectHandleRadiusScaled = this.RECONNECT_HANDLE_RADIUS / viewState.scale;

    const selectedIds = this.selectionManager.getSelectedItems();
    if (selectedIds.length === 1) {
        const selectedItem = this.findDraggableItemById(selectedIds[0]);
        if (selectedItem) {
            const resizeHandle = this.getResizeHandleForSelectedItem(canvasPoint, selectedItem, viewState);
            if (resizeHandle) {
                return { type: 'resizeHandle', item: selectedItem, resizeHandleType: resizeHandle.type, id: selectedItem.id };
            }
        }
    }
    
    const nodes = this.nodeManager.getNodes().slice().reverse();
    for (const node of nodes) {
      // Modificado: Itera sobre todos os tipos de portas
      const allPorts = [...node.fixedInputs, ...node.fixedOutputs, ...node.dynamicInputs, ...node.dynamicOutputs];
      for (const port of allPorts) {
        // Ignora portas ocultas para detecção de clique
        if (port.isHidden) continue; 

        const portAbsPos = this.getPortAbsolutePosition(node, port, viewState);
        const dx = canvasPoint.x - portAbsPos.x; const dy = canvasPoint.y - portAbsPos.y;
        if (dx * dx + dy * dy < portHitRadius * portHitRadius) {
          return { type: 'port', id: port.id, portDetails: port, item: this.nodeToDraggableItem(node) };
        }
      }
    }

    const connections = this.nodeManager.getConnections();
    for (const conn of connections) {
        const sourceNode = this.nodeManager.getNode(conn.sourceNodeId);
        const targetNode = this.nodeManager.getNode(conn.targetNodeId);
        const sourcePort = this.nodeManager.getPort(conn.sourcePortId);
        const targetPort = this.nodeManager.getPort(conn.targetPortId);
        if (sourceNode && targetNode && sourcePort && targetPort) {
            const p0 = this.getPortAbsolutePosition(sourceNode, sourcePort, viewState);
            const p3 = this.getPortAbsolutePosition(targetNode, targetPort, viewState);
            const distToP0Sq = (canvasPoint.x - p0.x)**2 + (canvasPoint.y - p0.y)**2;
            const distToP3Sq = (canvasPoint.x - p3.x)**2 + (canvasPoint.y - p3.y)**2;
            if (distToP0Sq < reconnectHandleRadiusScaled**2) return { type: 'connection', id: conn.id, connectionDetails: conn, region: 'sourceHandle' };
            if (distToP3Sq < reconnectHandleRadiusScaled**2) return { type: 'connection', id: conn.id, connectionDetails: conn, region: 'targetHandle' };
            if (this.isPointNearBezierConnection(canvasPoint, p0, p3, connectionHitThreshold)) return { type: 'connection', id: conn.id, connectionDetails: conn, region: 'body' };
        }
    }
    
    const itemHit = this.getItemBodyAtPoint(canvasPoint);
    if (itemHit) {
        if (itemHit.type === 'node') {
            const node = this.nodeManager.getNode(itemHit.id);
            if(node) { 
                // Assumimos que o cabeçalho sempre tem 40px de altura
                const headerHeight = 40; 
                // A posição Y é relativa ao topo do nó.
                // Se o ponto clicado estiver dentro do cabeçalho, é 'header'.
                const region = canvasPoint.y < node.position.y + headerHeight ? 'header' : 'body';
                return { type: 'node', id: itemHit.id, item: itemHit, region };
            }
        }
        return { type: itemHit.type, id: itemHit.id, item: itemHit, region: 'body' };
    }
    
    return { type: 'canvas' };
  }

  private isPointNearBezierConnection(point: Point, p0: Point, p3: Point, threshold: number): boolean {
    const minX = Math.min(p0.x, p3.x) - threshold; const maxX = Math.max(p0.x, p3.x) + threshold;
    const minY = Math.min(p0.y, p3.y) - threshold * 5; const maxY = Math.max(p0.y, p3.y) + threshold * 5;
    if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) return false;
    const lenSq = (p3.x - p0.x) ** 2 + (p3.y - p0.y) ** 2;
    if (lenSq === 0) return Math.sqrt((point.x - p0.x) ** 2 + (point.y - p0.y) ** 2) < threshold;
    let t = ((point.x - p0.x) * (p3.x - p0.x) + (point.y - p0.y) * (p3.y - p0.y)) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = p0.x + t * (p3.x - p0.x); const projY = p0.y + t * (p3.y - p0.y);
    const distSq = (point.x - projX) ** 2 + (point.y - projY) ** 2;
    const midX = (p0.x + p3.x) / 2; const midY = (p0.y + p3.y) / 2;
    const distToMidSq = (point.x - midX) ** 2 + (point.y - midY) ** 2;
    const curveLengthApprox = Math.abs(p0.x - p3.x) + Math.abs(p0.y - p3.y);
    if (distSq < threshold ** 2 || (distToMidSq < (curveLengthApprox/3)**2 && distSq < (threshold*2)**2) ) return true;
    return false;
  }
  
  private nodeToDraggableItem(node: Node): DraggableItem {
    return { id: node.id, type: 'node', position: node.position, width: node.width, height: node.height };
  }

  private handlePointerDown = (e: CanvasPointerEvent): void => {
    const { canvasPoint, originalEvent } = e;
    this.lastPointerDownCanvasPoint = canvasPoint;
    const interactiveElement = this.getInteractiveElementAtPoint(canvasPoint);

    if (this.mode === 'draggingConnection' || this.mode === 'reconnectingConnection') {
        if (originalEvent.button === 2) { this.cancelPendingOrReconnectingConnection(); originalEvent.preventDefault(); return; }
    }

    switch (interactiveElement.type) {
      case 'resizeHandle':
        if (interactiveElement.item && interactiveElement.resizeHandleType) {
          this.mode = 'resizingItem'; this.activeResizeItem = interactiveElement.item;
          this.activeResizeHandle = interactiveElement.resizeHandleType; this.dragStartPoint = canvasPoint;
          this.originalResizeItemRect = { ...this.activeResizeItem.position, width: this.activeResizeItem.width, height: this.activeResizeItem.height };
          this.events.emit('resizeStart', this.activeResizeItem);
        }
        break;
      case 'port':
        // NÃO PERMITIR INICIAR CONEXÃO DE PORTAS OCULTAS
        if (interactiveElement.portDetails?.isHidden && interactiveElement.portDetails.isDynamic) {
             this.mode = 'idle'; // Reinicia o modo para idle
             return; // Ignora o clique
        }

        if (interactiveElement.portDetails && interactiveElement.item && this.mode === 'idle') {
          this.mode = 'draggingConnection';
          const sourceNode = this.nodeManager.getNode(interactiveElement.portDetails.nodeId);
          if (!sourceNode) { this.mode = 'idle'; break; }
          this.pendingConnection = {
            sourcePort: interactiveElement.portDetails, sourceNode,
            fromPosition: this.getPortAbsolutePosition(sourceNode, interactiveElement.portDetails, this.canvasEngine.getViewState()),
            currentMousePosition: canvasPoint, compatibleTargetPortId: null,
          };
          this.events.emit('pendingConnectionStart', this.pendingConnection); this.canvasEngine.requestRender();
        }
        break;
      case 'connection':
        if (interactiveElement.id && interactiveElement.connectionDetails) {
            if (interactiveElement.region === 'sourceHandle' || interactiveElement.region === 'targetHandle') {
                this.mode = 'reconnectingConnection'; const conn = interactiveElement.connectionDetails;
                const viewState = this.canvasEngine.getViewState();
                let fixedPort: NodePort, fixedNode: Node, sourcePortForPending: NodePort, sourceNodeForPending: Node;
                let fromPos: Point;
                if (interactiveElement.region === 'sourceHandle') {
                    fixedPort = this.nodeManager.getPort(conn.targetPortId)!; fixedNode = this.nodeManager.getNode(conn.targetNodeId)!;
                    sourcePortForPending = fixedPort; sourceNodeForPending = fixedNode;
                    fromPos = this.getPortAbsolutePosition(fixedNode, fixedPort, viewState);
                } else { 
                    fixedPort = this.nodeManager.getPort(conn.sourcePortId)!; fixedNode = this.nodeManager.getNode(conn.sourceNodeId)!;
                    sourcePortForPending = fixedPort; sourceNodeForPending = fixedNode;
                    fromPos = this.getPortAbsolutePosition(fixedNode, fixedPort, viewState);
                }
                if(!fixedPort || !fixedNode) { this.mode = 'idle'; break;}
                this.pendingConnection = {
                    sourcePort: sourcePortForPending, sourceNode: sourceNodeForPending, fromPosition: fromPos,
                    currentMousePosition: canvasPoint, compatibleTargetPortId: null,
                    reconnectingInfo: { originalConnection: conn, draggedEnd: interactiveElement.region === 'sourceHandle' ? 'source' : 'target', fixedPort, fixedNode }
                };
                this.selectionManager.selectItem(conn.id, false);
                this.events.emit('reconnectionStart', this.pendingConnection); this.canvasEngine.requestRender();
            } else if (interactiveElement.region === 'body') {
                if (originalEvent.metaKey || originalEvent.ctrlKey) this.selectionManager.toggleSelection(interactiveElement.id);
                else this.selectionManager.selectItem(interactiveElement.id, false);
                this.events.emit('connectionSelected', interactiveElement.id);
            }
        }
        break;
      case 'node': case 'stickyNote':
        if (interactiveElement.item) {
          this.mode = 'draggingItems'; this.dragStartPoint = canvasPoint;
          if (originalEvent.metaKey || originalEvent.ctrlKey) this.selectionManager.toggleSelection(interactiveElement.item.id);
          else if (!this.selectionManager.isSelected(interactiveElement.item.id)) this.selectionManager.selectItem(interactiveElement.item.id, false);
          this.activeDragItems = this.selectionManager.getSelectedItems().map(id => this.findDraggableItemById(id)).filter(item => item !== null) as DraggableItem[];
          if (this.activeDragItems.length === 0 && interactiveElement.item) this.activeDragItems = [interactiveElement.item];
          this.dragStartItemOffsets.clear(); this.activeDragItems.forEach(item => this.dragStartItemOffsets.set(item.id, { ...item.position }));
          this.events.emit('itemsDragStart', this.activeDragItems);
        }
        break;
      case 'canvas': default:
        if (originalEvent.button === 1 || (originalEvent.button === 0 && originalEvent.altKey)) { this.mode = 'panning'; this.panStartPoint = { x: originalEvent.clientX, y: originalEvent.clientY }; }
        else if (originalEvent.button === 0) {
          if (!originalEvent.shiftKey && !originalEvent.metaKey && !originalEvent.ctrlKey) this.selectionManager.clearSelection();
          this.mode = 'boxSelecting'; this.boxSelectStartPoint = canvasPoint;
          this.boxSelectRect = { ...canvasPoint, width: 0, height: 0 };
          this.events.emit('boxSelectStart', this.boxSelectRect); this.canvasEngine.requestRender();
        }
        break;
    }
  };

  private handlePointerMove = (e: CanvasPointerEvent): void => {
    const { canvasPoint, clientPoint } = e;
    if ((this.mode === 'draggingConnection' || this.mode === 'reconnectingConnection') && this.pendingConnection) {
      let potentialTargetPort: NodePort | undefined;
      const targetElement = this.getInteractiveElementAtPoint(canvasPoint);
      let compatiblePortId: string | null = null;
      if (targetElement.type === 'port' && targetElement.portDetails) {
          // Ignora portas ocultas como targets
          if (targetElement.portDetails.isHidden) {
              this.pendingConnection.currentMousePosition = canvasPoint; // Continua a linha para o mouse
          } else {
              potentialTargetPort = targetElement.portDetails;
              if (this.isConnectionCompatible(this.pendingConnection.sourcePort, potentialTargetPort, this.mode === 'reconnectingConnection' ? this.pendingConnection.reconnectingInfo : undefined)) {
                  compatiblePortId = potentialTargetPort.id;
              }
          }
      }
      if (compatiblePortId && potentialTargetPort) {
          const targetNode = this.nodeManager.getNode(potentialTargetPort.nodeId);
          if(targetNode) this.pendingConnection.currentMousePosition = this.getPortAbsolutePosition(targetNode, potentialTargetPort, this.canvasEngine.getViewState());
      } else { this.pendingConnection.currentMousePosition = canvasPoint; }
      if (this.pendingConnection.compatibleTargetPortId !== compatiblePortId) {
          this.pendingConnection.compatibleTargetPortId = compatiblePortId;
          this.events.emit('compatiblePortHoverChanged', compatiblePortId);
      }
      this.events.emit('pendingConnectionUpdate', this.pendingConnection); this.canvasEngine.requestRender(); this.setCursor('crosshair');
    } else if (this.mode === 'idle') {
        const interactiveElement = this.getInteractiveElementAtPoint(canvasPoint);
        switch (interactiveElement.type) {
            case 'resizeHandle': if(interactiveElement.resizeHandleType) this.setCursor(this.getCursorForResizeHandle(interactiveElement.resizeHandleType)); break;
            case 'port': 
                // Não muda o cursor para portas ocultas
                if (!interactiveElement.portDetails?.isHidden) {
                    this.setCursor('pointer'); 
                } else {
                    this.setCursor('default');
                }
                break;
            case 'connection': this.setCursor('pointer'); break;
            case 'node': case 'stickyNote': this.setCursor('move'); break;
            default: this.setCursor('default');
        }
        // Emite hover para portas visíveis
        if(interactiveElement.type === 'port' && interactiveElement.portDetails && !interactiveElement.portDetails.isHidden) {
            this.events.emit('portHoverChanged', interactiveElement.portDetails.id);
        } else {
            this.events.emit('portHoverChanged', null);
        }
    } else if (this.mode === 'panning' && this.panStartPoint) {
      const dx = clientPoint.x - this.panStartPoint.x; const dy = clientPoint.y - this.panStartPoint.y;
      this.canvasEngine.pan(dx, dy); this.panStartPoint = clientPoint;
    } else if (this.mode === 'draggingItems' && this.dragStartPoint && this.activeDragItems.length > 0) {
      const viewState = this.canvasEngine.getViewState(); const dx = canvasPoint.x - this.dragStartPoint.x; const dy = canvasPoint.y - this.dragStartPoint.y;
      this.activeDragItems.forEach(item => {
        const initialPos = this.dragStartItemOffsets.get(item.id); if (!initialPos) return;
        let newX = initialPos.x + dx; let newY = initialPos.y + dy;
        if (viewState.snapToGrid) { newX = Math.round(newX / viewState.gridSize) * viewState.gridSize; newY = Math.round(newY / viewState.gridSize) * viewState.gridSize; }
        if (item.type === 'node') this.nodeManager.moveNode(item.id, { x: newX, y: newY });
        else if (item.type === 'stickyNote') this.stickyNoteManager.updateNote(item.id, { position: { x: newX, y: newY } });
      });
      this.events.emit('itemsDrag', this.activeDragItems); this.canvasEngine.requestRender();
    } else if (this.mode === 'resizingItem' && this.dragStartPoint && this.activeResizeItem && this.activeResizeHandle && this.originalResizeItemRect) {
        this.performResize(canvasPoint); this.events.emit('itemResize', this.activeResizeItem); this.canvasEngine.requestRender();
    } else if (this.mode === 'boxSelecting' && this.boxSelectStartPoint) {
      this.boxSelectRect = { x: Math.min(this.boxSelectStartPoint.x, canvasPoint.x), y: Math.min(this.boxSelectStartPoint.y, canvasPoint.y), width: Math.abs(this.boxSelectStartPoint.x - canvasPoint.x), height: Math.abs(this.boxSelectStartPoint.y - canvasPoint.y) };
      this.events.emit('boxSelectUpdate', this.boxSelectRect); this.canvasEngine.requestRender();
    }
  };

  private isConnectionCompatible(sourcePortForPending: NodePort, targetPortCandidate: NodePort, reconInfo?: ReconnectingConnectionInfo): boolean {
    // Nova verificação: Não permite conectar em portas ocultas
    if (targetPortCandidate.isHidden) return false;

    // Lógica existente de compatibilidade de tipos e nós
    if (reconInfo) {
        if (targetPortCandidate.id === sourcePortForPending.id) return false;
        if (targetPortCandidate.nodeId === sourcePortForPending.nodeId) return false;
        if (reconInfo.draggedEnd === 'source') return targetPortCandidate.type === 'output' && sourcePortForPending.type === 'input';
        else return targetPortCandidate.type === 'input' && sourcePortForPending.type === 'output';
    } else {
        if (sourcePortForPending.nodeId === targetPortCandidate.nodeId) return false;
        if (sourcePortForPending.type === 'output' && targetPortCandidate.type === 'input') return true;
        if (sourcePortForPending.type === 'input' && targetPortCandidate.type === 'output') return true;
        return false;
    }
  }

  private handlePointerUp = (e: CanvasPointerEvent): void => {
    const { canvasPoint, originalEvent } = e;
    if ((this.mode === 'draggingConnection' || this.mode === 'reconnectingConnection') && this.pendingConnection) {
      const targetElement = this.getInteractiveElementAtPoint(canvasPoint);
      // Completa a conexão APENAS se o target for uma porta compatível E NÃO OCULTA
      if (targetElement.type === 'port' && targetElement.portDetails && !targetElement.portDetails.isHidden && this.pendingConnection.compatibleTargetPortId === targetElement.portDetails.id) {
          if (this.mode === 'reconnectingConnection' && this.pendingConnection.reconnectingInfo) {
              this.tryCompleteReconnection(this.pendingConnection.reconnectingInfo, targetElement.portDetails);
          } else { this.tryCompleteConnection(this.pendingConnection.sourcePort, targetElement.portDetails); }
      }
      this.cancelPendingOrReconnectingConnection();
    } else if (this.mode === 'draggingItems') { this.events.emit('itemsDragEnd', this.activeDragItems); }
    else if (this.mode === 'resizingItem' && this.activeResizeItem) { this.events.emit('itemResizeEnd', this.activeResizeItem); }
    else if (this.mode === 'boxSelecting' && this.boxSelectRect) {
      const items = this.getItemsInRect(this.boxSelectRect).map(item => this.findDraggableItemById(item.id)).filter(item => item !== null) as DraggableItem[];
      this.selectionManager.selectItems(items.map(item => item.id), originalEvent.ctrlKey || originalEvent.metaKey);
      this.events.emit('boxSelectEnd', this.boxSelectRect, items); this.boxSelectRect = null; this.canvasEngine.requestRender();
    }
    this.mode = 'idle';
    this.panStartPoint = null; this.dragStartPoint = null; this.activeDragItems = []; this.dragStartItemOffsets.clear();
    this.activeResizeItem = null; this.activeResizeHandle = null; this.originalResizeItemRect = null;
    this.boxSelectStartPoint = null; this.setCursor('default');
  };
  
  private handlePointerLeave = (e: CanvasPointerEvent): void => {
    if (this.mode !== 'idle' && this.mode !== 'draggingConnection' && this.mode !== 'reconnectingConnection') { this.handlePointerUp(e); }
    if(this.mode !== 'draggingConnection' && this.mode !== 'reconnectingConnection') { this.setCursor('default'); }
  };

  private tryCompleteReconnection(reconInfo: ReconnectingConnectionInfo, newPort: NodePort): void {
    this.nodeManager.deleteConnection(reconInfo.originalConnection.id);
    let finalSourcePort: NodePort, finalTargetPort: NodePort;
    if (reconInfo.draggedEnd === 'source') { finalSourcePort = newPort; finalTargetPort = reconInfo.fixedPort; }
    else { finalSourcePort = reconInfo.fixedPort; finalTargetPort = newPort; }
    const newConnection = this.nodeManager.createConnection(finalSourcePort.id, finalTargetPort.id);
    if (newConnection) { this.events.emit('connectionRecompleted', newConnection, reconInfo.originalConnection); this.selectionManager.selectItem(newConnection.id, false); }
    
    else { this.nodeManager.createConnection(reconInfo.originalConnection.sourcePortId, reconInfo.originalConnection.targetPortId); this.events.emit('reconnectionFailed', reconInfo.originalConnection); }
  }

  private cancelPendingOrReconnectingConnection(): void {
    if (this.pendingConnection) {
        if(this.pendingConnection.reconnectingInfo) this.events.emit('reconnectionCancel', this.pendingConnection);
        else this.events.emit('pendingConnectionCancel', this.pendingConnection);
    }
    this.pendingConnection = null; this.events.emit('compatiblePortHoverChanged', null); this.canvasEngine.requestRender();
  }

  private tryCompleteConnection(portA: NodePort, portB: NodePort): void {
    let sourcePort: NodePort | null = null; let targetPort: NodePort | null = null;
    if (portA.nodeId === portB.nodeId) { this.events.emit('connectionFailed', { reason: "Self-connection", portA, portB }); return; }
    if (portA.type === 'output' && portB.type === 'input') { sourcePort = portA; targetPort = portB; }
    else if (portB.type === 'output' && portA.type === 'input') { sourcePort = portB; targetPort = portA; }
    else { this.events.emit('connectionFailed', { reason: "Invalid port types", portA, portB }); return; }
    const connection = this.nodeManager.createConnection(sourcePort.id, targetPort.id);
    if (connection) this.events.emit('connectionCompleted', connection);
    else this.events.emit('connectionFailed', { reason: "NodeManager validation failed", sourcePort, targetPort });
  }
  
  public getPendingConnection(): PendingConnectionState | null { return this.pendingConnection; }

  private performResize(currentCanvasPoint: Point): void {
    if (!this.activeResizeItem || !this.activeResizeHandle || !this.dragStartPoint || !this.originalResizeItemRect) return;
    const viewState = this.canvasEngine.getViewState();
    const itemData = this.activeResizeItem.type === 'node' ? this.nodeManager.getNode(this.activeResizeItem.id) : this.stickyNoteManager.getNote(this.activeResizeItem.id);
    
    // Altura mínima ajustada para acomodar portas dinâmicas
    // A altura padrão do cabeçalho é 40px, e cada porta visível ocupa 24px verticalmente.
    // O rodapé do nó também tem um padding de 12px para o ID.
    const baseMinHeight = 40 + (itemData?.minHeight || 50); 
    let dynamicPortHeight = 0;
    if (itemData?.type === 'node') {
        // Soma a altura das portas fixas + dinâmicas visíveis
        const visibleInputPorts = itemData.fixedInputs.length + itemData.dynamicInputs.filter(p => !p.isHidden).length;
        const visibleOutputPorts = itemData.fixedOutputs.length + itemData.dynamicOutputs.length;
        dynamicPortHeight = Math.max(visibleInputPorts, visibleOutputPorts) * 24; // 24px por porta
    }
    const minHeight = baseMinHeight + dynamicPortHeight;
    
    const minWidth = (itemData && 'minWidth' in itemData && itemData.minWidth !== undefined ? itemData.minWidth : 50);

    let newX = this.originalResizeItemRect.x;
    let newY = this.originalResizeItemRect.y;
    let newWidth = this.originalResizeItemRect.width;
    let newHeight = this.originalResizeItemRect.height;
    
    const dx = currentCanvasPoint.x - this.dragStartPoint.x;
    const dy = currentCanvasPoint.y - this.dragStartPoint.y;

    switch (this.activeResizeHandle) {
        case 'e':
            newWidth = Math.max(minWidth, this.originalResizeItemRect.width + dx);
            break;
        case 'w':
            const potentialWidth = this.originalResizeItemRect.width - dx;
            newWidth = Math.max(minWidth, potentialWidth);
            newX = this.originalResizeItemRect.x + (this.originalResizeItemRect.width - newWidth);
            break;
        case 's':
            newHeight = Math.max(minHeight, this.originalResizeItemRect.height + dy);
            break;
        case 'n':
            const potentialHeight = this.originalResizeItemRect.height - dy;
            newHeight = Math.max(minHeight, potentialHeight);
            newY = this.originalResizeItemRect.y + (this.originalResizeItemRect.height - newHeight);
            break;
        case 'se':
            newWidth = Math.max(minWidth, this.originalResizeItemRect.width + dx);
            newHeight = Math.max(minHeight, this.originalResizeItemRect.height + dy);
            break;
        case 'sw':
            newHeight = Math.max(minHeight, this.originalResizeItemRect.height + dy);
            const potentialWidthSW = this.originalResizeItemRect.width - dx;
            newWidth = Math.max(minWidth, potentialWidthSW);
            newX = this.originalResizeItemRect.x + (this.originalResizeItemRect.width - newWidth);
            break;
        case 'ne':
            newWidth = Math.max(minWidth, this.originalResizeItemRect.width + dx);
            const potentialHeightNE = this.originalResizeItemRect.height - dy;
            newHeight = Math.max(minHeight, potentialHeightNE);
            newY = this.originalResizeItemRect.y + (this.originalResizeItemRect.height - newHeight);
            break;
        case 'nw':
            const potentialWidthNW = this.originalResizeItemRect.width - dx;
            const potentialHeightNW = this.originalResizeItemRect.height - dy;
            newWidth = Math.max(minWidth, potentialWidthNW);
            newHeight = Math.max(minHeight, potentialHeightNW);
            newX = this.originalResizeItemRect.x + (this.originalResizeItemRect.width - newWidth);
            newY = this.originalResizeItemRect.y + (this.originalResizeItemRect.height - newHeight);
            break;
    }

    if (viewState.snapToGrid) {
        const gs = viewState.gridSize;
        newX = Math.round(newX / gs) * gs;
        newY = Math.round(newY / gs) * gs;
        newWidth = Math.round(newWidth / gs) * gs;
        newHeight = Math.round(newHeight / gs) * gs;
    }
    const newRect = { x: newX, y: newY, width: newWidth, height: newHeight };
    if (this.activeResizeItem.type === 'node') this.nodeManager.resizeNode(this.activeResizeItem.id, newRect);
    else if (this.activeResizeItem.type === 'stickyNote') this.stickyNoteManager.updateNoteRect(this.activeResizeItem.id, newRect);
   }

  private handleWheel = (e: CanvasWheelEvent): void => { this.canvasEngine.zoom(e.deltaY, e.clientPoint); };

  public findDraggableItemById(id: string): DraggableItem | null {
    const node = this.nodeManager.getNode(id);
    if (node) return { id: node.id, type: 'node', position: node.position, width: node.width, height: node.height };
    const stickyNote = this.stickyNoteManager.getNote(id);
    if (stickyNote) return { id: stickyNote.id, type: 'stickyNote', position: stickyNote.position, width: stickyNote.width, height: stickyNote.height };
    return null;
  }
  
  public getItemAtPoint(canvasPoint: Point): DraggableItem | null {
      const interactive = this.getInteractiveElementAtPoint(canvasPoint);
      return interactive.item || null;
  }

  private getItemBodyAtPoint(point: Point): DraggableItem | null {
    // Primeiro notas adesivas (mais fácil de sobrepor)
    const stickyNotes = this.stickyNoteManager.getNotes().slice().reverse();
    for (const note of stickyNotes) {
      if (this.isPointInRect(point, note.position, { width: note.width, height: note.height })) {
        return { id: note.id, type: 'stickyNote', position: note.position, width: note.width, height: note.height };
      }
    }
    // Depois nós
    const nodes = this.nodeManager.getNodes().slice().reverse();
    for (const node of nodes) {
      if (this.isPointInRect(point, node.position, { width: node.width, height: node.height })) {
        return { id: node.id, type: 'node', position: node.position, width: node.width, height: node.height };
      }
    }
    return null;
  }

  private getResizeHandleForSelectedItem(point: Point, item: DraggableItem, viewState: ViewState): ResizeHandle | null {
    const handleVisualSize = 8; const handleHitRadius = handleVisualSize / viewState.scale; 
    const { x, y, width, height } = item.position;
    const handlesDef: { type: ResixwzeHandle['type'], x: number, y: number }[] = [
        { type: 'nw', x: x, y: y }, { type: 'n', x: x + width / 2, y: y }, { type: 'ne', x: x + width, y: y },
        { type: 'w', x: x, y: y + height / 2 }, { type: 'e', x: x + width, y: y + height / 2 },
        { type: 'sw', x: x, y: y + height }, { type: 's', x: x + width / 2, y: y + height }, { type: 'se', x: x + width, y: y + height },
    ];
    for (const handle of handlesDef) {
        const dx = point.x - handle.x; const dy = point.y - handle.y;
        if (dx * dx + dy * dy < handleHitRadius * handleHitRadius) return { type: handle.type, item };
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

  private getItemsInRect(rect: Rect): Array<DraggableItem> {
    const allItems: Array<DraggableItem> = [
      ...this.nodeManager.getNodes().map(n => ({ id: n.id, type: 'node', position: n.position, width: n.width, height: n.height })),
      ...this.stickyNoteManager.getNotes().map(sn => ({ id: sn.id, type: 'stickyNote', position: sn.position, width: sn.width, height: sn.height })),
    ];
    // Adicionar conexões aqui se quisermos selecioná-las com box select
    return allItems.filter(item => {
      const itemRect = { ...item.position, width: item.width, height: item.height };
      return (itemRect.x < rect.x + rect.width && itemRect.x + itemRect.width > rect.x && itemRect.y < rect.y + rect.height && itemRect.y + itemRect.height > rect.y);
    });
  }
  
  public getBoxSelectRect(): Rect | null { return this.boxSelectRect; }

  public on(event: string, listener: (...args: any[]) => void): this { this.events.on(event, listener); return this; }
  public off(event: string, listener: (...args: any[]) => void): this { this.events.off(event, listener); return this; }
  
  public destroy(): void { this.events.removeAllListeners(); }
}