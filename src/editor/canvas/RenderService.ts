// src/editor/canvas/RenderService.ts
import { CanvasEngine } from './CanvasEngine';
import { NodeManager } from '../state/NodeManager';
import { StickyNoteManager } from '../state/StickyNoteManager';
import { SelectionManager } from '../state/SelectionManager';
import { InteractionManager } // '../interaction/InteractionManager';
  from '../interaction/InteractionManager'; // Circular dependency if InteractionManager imports RenderService
import { ConnectionManager } from '../state/ConnectionManager';
import { ViewStore } from '../state/ViewStore';
import { Node, StickyNote, ViewState, NodePort, Connection, Point } from '../core/types';
import {
  NODE_HEADER_HEIGHT, NODE_PORT_VERTICAL_SPACING, NODE_PORT_SIZE,
  RECONNECT_HANDLE_RADIUS, RESIZE_HANDLE_SIZE,
  EVENT_CANVAS_BEFORE_RENDER, EVENT_CANVAS_POINTER_MOVE, EVENT_CANVAS_POINTER_LEAVE,
  // Constants for hovered port IDs, etc.
} from '../core/constants';


export class RenderService {
  private ctx: CanvasRenderingContext2D | null = null;
  private currentViewState: ViewState | null = null; // Renamed from viewState to avoid conflict
  private hoveredCompatiblePortId: string | null = null;
  private hoveredPortIdIdle: string | null = null;

  // Theme colors will be fetched from CSS variables
  private themeColors: Record<string, string> = {};


  constructor(
    private canvasEngine: CanvasEngine,
    private nodeManager: NodeManager,
    private connectionManager: ConnectionManager,
    private stickyNoteManager: StickyNoteManager,
    private selectionManager: SelectionManager,
    private interactionManager: InteractionManager, // Consider passing only necessary parts or using events
    private viewStore: ViewStore,
  ) {
    this.canvasEngine.on(EVENT_CANVAS_BEFORE_RENDER, this.handleBeforeRender);
    // Listen to InteractionManager events for hover states
    this.interactionManager.on('compatiblePortHoverChanged', this.handleCompatiblePortHoverChanged);
    this.interactionManager.on('portHoverChanged', this.handlePortHoverIdleChanged);

    this.loadThemeColors();
  }

  private loadThemeColors(): void {
    const computedStyles = getComputedStyle(this.canvasEngine.getCanvasElement());
    this.themeColors = {
      nodeBackground: computedStyles.getPropertyValue('--node-background-color').trim(),
      nodeBorder: computedStyles.getPropertyValue('--node-border-color').trim(),
      nodeHeaderBackground: computedStyles.getPropertyValue('--node-header-background-color').trim(),
      nodeIconBackground: computedStyles.getPropertyValue('--node-icon-background-color').trim(),
      nodeIconText: computedStyles.getPropertyValue('--node-icon-text-color').trim(),
      nodeTitleText: computedStyles.getPropertyValue('--node-title-text-color').trim(),
      nodeIdText: computedStyles.getPropertyValue('--node-id-text-color').trim(),
      nodePortBackground: computedStyles.getPropertyValue('--node-port-background-color').trim(),
      nodePortBorder: computedStyles.getPropertyValue('--node-port-border-color').trim(),
      nodePortText: computedStyles.getPropertyValue('--node-port-text-color').trim(),
      nodePortDynamicBackground: computedStyles.getPropertyValue('--node-port-dynamic-background-color').trim(),
      nodePortDynamicBorder: computedStyles.getPropertyValue('--node-port-dynamic-border-color').trim(),

      connectionDefault: computedStyles.getPropertyValue('--connection-default-color').trim(),
      connectionPending: computedStyles.getPropertyValue('--connection-pending-color').trim(),
      connectionPendingCompatible: computedStyles.getPropertyValue('--connection-pending-compatible-color').trim(),
      connectionReconnecting: computedStyles.getPropertyValue('--connection-reconnecting-color').trim(),
      connectionGhosted: computedStyles.getPropertyValue('--connection-ghosted-color').trim(),

      selectionHighlight: computedStyles.getPropertyValue('--selection-highlight-color').trim(),
      selectionBoxFill: computedStyles.getPropertyValue('--selection-highlight-color-transparent').trim(),
      portHighlightBorder: computedStyles.getPropertyValue('--port-highlight-border-color').trim(),
      portHighlightFill: computedStyles.getPropertyValue('--port-highlight-fill-color').trim(),

      statusSuccess: computedStyles.getPropertyValue('--status-success-color').trim(),
      statusError: computedStyles.getPropertyValue('--status-error-color').trim(),
      statusRunning: computedStyles.getPropertyValue('--status-running-color').trim(),
      statusWarning: computedStyles.getPropertyValue('--status-warning-color').trim(),
      statusUnsaved: computedStyles.getPropertyValue('--status-unsaved-color').trim(),

      stickyNoteDefaultBackground: computedStyles.getPropertyValue('--sticky-note-default-background-color').trim(),
      stickyNoteDefaultText: computedStyles.getPropertyValue('--sticky-note-default-text-color').trim(),
      stickyNoteBorder: computedStyles.getPropertyValue('--sticky-note-border-color').trim(),
    };
  }


  private handleBeforeRender = (ctx: CanvasRenderingContext2D, viewState: ViewState): void => {
    this.ctx = ctx;
    this.currentViewState = viewState; // Store current view state for rendering methods

    this.renderConnections();
    this.renderStickyNotes();
    this.renderNodes();
    // Selection highlights are drawn per item type to ensure correct layering
    // this.renderSelectionHighlights(); // Combined into individual render methods
    this.renderPorts(); // Ports are part of nodes but drawn on top
    this.renderPendingOrReconnectingConnection();
    this.renderResizeHandles();
    this.renderBoxSelect();

    this.ctx = null;
    this.currentViewState = null;
  };

  private renderNodes(): void {
    if (!this.ctx || !this.currentViewState) return;
    const nodes = this.nodeManager.getNodes();
    nodes.forEach(node => this.drawNode(this.ctx!, node, this.currentViewState!));
  }

  private renderStickyNotes(): void {
    if (!this.ctx || !this.currentViewState) return;
    const notes = this.stickyNoteManager.getNotes();
    notes.forEach(note => this.drawStickyNote(this.ctx!, note, this.currentViewState!));
  }

  private renderResizeHandles(): void {
    if (!this.ctx || !this.currentViewState) return;
    const selectedIds = this.selectionManager.getSelectedItems();
    if (selectedIds.length !== 1) return;

    const item = this.interactionManager.findDraggableItemById(selectedIds[0]);
    if (!item || (item.type !== 'node' && item.type !== 'stickyNote')) return;

    const { x, y } = item.position;
    const itemWidth = item.width;
    const itemHeight = item.height;
    const handleScaledSize = RESIZE_HANDLE_SIZE / this.currentViewState.scale;

    this.ctx.fillStyle = this.themeColors.selectionHighlight || '#6366f1';
    const handlesPoints: Point[] = [
      { x: x, y: y }, { x: x + itemWidth / 2, y: y }, { x: x + itemWidth, y: y },
      { x: x, y: y + itemHeight / 2 }, { x: x + itemWidth, y: y + itemHeight / 2 },
      { x: x, y: y + itemHeight }, { x: x + itemWidth / 2, y: y + itemHeight }, { x: x + itemWidth, y: y + itemHeight },
    ];
    handlesPoints.forEach(p => {
      this.ctx!.beginPath();
      this.ctx!.arc(p.x, p.y, handleScaledSize / 2, 0, Math.PI * 2);
      this.ctx!.fill();
    });
  }

  private renderBoxSelect(): void {
    if (!this.ctx || !this.currentViewState) return;
    const boxRect = this.interactionManager.getBoxSelectRect();
    if (boxRect) {
      this.ctx.fillStyle = this.themeColors.selectionBoxFill || 'rgba(99, 102, 241, 0.1)';
      this.ctx.fillRect(boxRect.x, boxRect.y, boxRect.width, boxRect.height);
      this.ctx.strokeStyle = this.themeColors.selectionHighlight || '#6366f1';
      this.ctx.lineWidth = 1 / this.currentViewState.scale;
      this.ctx.strokeRect(boxRect.x, boxRect.y, boxRect.width, boxRect.height);
    }
  }

  private drawNode(ctx: CanvasRenderingContext2D, node: Node, viewState: ViewState): void {
    const x = node.position.x;
    const y = node.position.y;
    const width = node.width;
    const height = node.height;
    const headerHeight = NODE_HEADER_HEIGHT;
    const isSelected = this.selectionManager.isSelected(node.id);
    const cornerRadius = 8 / viewState.scale;

    // Use a cor do nó ou um fallback padrão
    const nodeCustomColor = node.color || this.themeColors.nodeBorder; // Fallback para a cor da borda do tema se não houver cor customizada

    // 1. Desenha o corpo do nó com cantos arredondados e cor de fundo
    ctx.fillStyle = this.themeColors.nodeBackground; // Fundo fixo preto
    ctx.strokeStyle = isSelected ? this.themeColors.selectionHighlight : nodeCustomColor; // Borda usa a cor customizada
    ctx.lineWidth = (isSelected ? 2 : 1) / viewState.scale;

    ctx.beginPath();
    ctx.moveTo(x + cornerRadius, y);
    ctx.lineTo(x + width - cornerRadius, y);
    ctx.arcTo(x + width, y, x + width, y + cornerRadius, cornerRadius);
    ctx.lineTo(x + width, y + height - cornerRadius);
    ctx.arcTo(x + width, y + height, x + width - cornerRadius, y + height, cornerRadius);
    ctx.lineTo(x + cornerRadius, y + height);
    ctx.arcTo(x, y + height, x, y + height - cornerRadius, cornerRadius);
    ctx.lineTo(x, y + cornerRadius);
    ctx.arcTo(x, y, x + cornerRadius, y, cornerRadius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Desenha o cabeçalho do nó
    ctx.fillStyle = this.themeColors.nodeHeaderBackground;
    ctx.fillRect(x, y, width, headerHeight);

    // 3. Draw only the left, top, and right borders of the header
    ctx.beginPath();
    // Start at the bottom-left of the header
    ctx.moveTo(x, y + headerHeight);
    // Draw up to the top-left corner (left border)
    ctx.lineTo(x, y);
    // Draw across to the top-right corner (top border)
    ctx.lineTo(x + width, y);
    // Draw down to the bottom-right corner (right border)
    ctx.lineTo(x + width, y + headerHeight);
    // Apply the stroke to the path we just defined
    ctx.stroke();

    // 3. Desenha os elementos do cabeçalho (ícone, título, status)
    // Icon
    if (node.icon) {
      ctx.fillStyle = nodeCustomColor; // Ícone usa a cor customizada
      const iconX = x + 8 / viewState.scale;
      const iconY = y + 8 / viewState.scale;
      const iconSize = 24 / viewState.scale;
      // Para o fundo do ícone, podemos usar a mesma cor customizada, mas um pouco mais escura/transparente
      // Ou usar o nodeIconBackground do tema para um contraste consistente
      ctx.fillRect(iconX, iconY, iconSize, iconSize);
      ctx.fillStyle = this.themeColors.nodeIconText; // Texto do ícone permanece branco
      ctx.font = `bold ${12 / viewState.scale}px ${getComputedStyle(this.canvasEngine.getCanvasElement()).fontFamily}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(node.icon.substring(0, 2).toUpperCase(), iconX + iconSize / 2, iconY + iconSize / 2);
    }

    // Title
    ctx.fillStyle = this.themeColors.nodeTitleText; // Título do nó permanece branco
    ctx.font = `${12 / viewState.scale}px ${getComputedStyle(this.canvasEngine.getCanvasElement()).fontFamily}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(node.title, x + (node.icon ? 40 / viewState.scale : 12 / viewState.scale), y + headerHeight / 2);

    // Status (mantém as cores de status do tema)
    if (node.status) {
      const statusColorMap: Record<string, string> = {
        success: this.themeColors.statusSuccess, error: this.themeColors.statusError,
        running: this.themeColors.statusRunning, warning: this.themeColors.statusWarning,
        unsaved: this.themeColors.statusUnsaved
      };
      ctx.fillStyle = statusColorMap[node.status] || '#888';
      ctx.beginPath();
      ctx.arc(x + width - (15 / viewState.scale), y + headerHeight / 2, 5 / viewState.scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // Node ID (mantém a cor do tema, um cinza mais escuro)
    ctx.fillStyle = this.themeColors.nodeIdText;
    ctx.font = `${10 / viewState.scale}px ${getComputedStyle(this.canvasEngine.getCanvasElement()).fontFamily}`;
    ctx.fillText(`#${node.id.slice(0, 8)}`, x + (12 / viewState.scale), y + height - (12 / viewState.scale));
  }

  private drawPort(ctx: CanvasRenderingContext2D, port: NodePort, canvasX: number, canvasY: number, viewState: ViewState, isHighlighted: boolean = false): void {
    if (port.isHidden) return;

    const portScaledSize = NODE_PORT_SIZE / viewState.scale;
    ctx.lineWidth = (isHighlighted ? 2 : 1) / viewState.scale;

    // Obtenha a cor do nó pai para as portas, se for um nó.
    // Você precisará passar o objeto Node para drawPort, ou buscar ele aqui.
    // Uma forma é buscar o nó aqui, assumindo que port.nodeId está sempre disponível e é um ID de nó válido.
    const parentNode = this.nodeManager.getNode(port.nodeId);
    const nodeCustomColor = parentNode?.color || this.themeColors.nodePortBorder; // Fallback

    const borderColor = port.isDynamic
        ? this.themeColors.nodePortDynamicBorder
        : (isHighlighted ? this.themeColors.portHighlightBorder : nodeCustomColor); // Borda da porta usa a cor customizada
    const fillColor = port.isDynamic
        ? this.themeColors.nodePortDynamicBackground
        : (isHighlighted ? this.themeColors.portHighlightFill : nodeCustomColor); // Preenchimento da porta usa a cor customizada

    ctx.strokeStyle = borderColor;
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, portScaledSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  private drawStickyNote(ctx: CanvasRenderingContext2D, note: StickyNote, viewState: ViewState): void {
    const x = note.position.x;
    const y = note.position.y;
    const width = note.width;
    const height = note.height;
    const isSelected = this.selectionManager.isSelected(note.id);
    const cornerRadius = 8 / viewState.scale; // Raio dos cantos para sticky note

    ctx.fillStyle = note.style.backgroundColor || this.themeColors.stickyNoteDefaultBackground;
    ctx.strokeStyle = isSelected ? this.themeColors.selectionHighlight : (this.themeColors.stickyNoteBorder || '#3a3a3a');
    ctx.lineWidth = (isSelected ? 2 : 1) / viewState.scale;

    // --- Início da alteração para cantos arredondados na sticky note ---
    ctx.beginPath();
    ctx.moveTo(x + cornerRadius, y);
    ctx.lineTo(x + width - cornerRadius, y);
    ctx.arcTo(x + width, y, x + width, y + cornerRadius, cornerRadius);
    ctx.lineTo(x + width, y + height - cornerRadius);
    ctx.arcTo(x + width, y + height, x + width - cornerRadius, y + height, cornerRadius);
    ctx.lineTo(x + cornerRadius, y + height);
    ctx.arcTo(x, y + height, x, y + height - cornerRadius, cornerRadius);
    ctx.lineTo(x, y + cornerRadius);
    ctx.arcTo(x, y, x + cornerRadius, y, cornerRadius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // --- Fim da alteração ---

    // Content
    ctx.fillStyle = note.style.textColor || this.themeColors.stickyNoteDefaultText;
    const fontSize = (note.style.fontSize || 14) / viewState.scale;
    ctx.font = `${fontSize}px ${getComputedStyle(this.canvasEngine.getCanvasElement()).fontFamily}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const padding = 12 / viewState.scale;
    const lines = note.content.split('\n');
    const lineHeight = fontSize * 1.2;
    lines.forEach((line, index) => {
      ctx.fillText(line, x + padding, y + padding + index * lineHeight, width - 2 * padding);
    });
  }

  private renderPendingOrReconnectingConnection(): void {
    if (!this.ctx || !this.currentViewState) return;
    const pendingConn = this.interactionManager.getPendingConnection(); // Assumes InteractionManager provides this
    if (pendingConn) {
      this.ctx.beginPath();
      this.ctx.moveTo(pendingConn.fromPosition.x, pendingConn.fromPosition.y);

      const isOutputLike = pendingConn.reconnectingInfo
        ? pendingConn.reconnectingInfo.fixedPort.type === 'output'
        : pendingConn.sourcePort.type === 'output';
      const curveFactor = isOutputLike ? 1 : -1;
      const endPoint = pendingConn.currentMousePosition;

      const cp1x = pendingConn.fromPosition.x + (50 / this.currentViewState.scale) * curveFactor;
      const cp1y = pendingConn.fromPosition.y;
      const cp2x = endPoint.x - (50 / this.currentViewState.scale) * curveFactor;
      const cp2y = endPoint.y;

      this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endPoint.x, endPoint.y);

      let strokeColor = this.themeColors.connectionPending;
      if (pendingConn.reconnectingInfo) strokeColor = this.themeColors.connectionReconnecting;
      if (pendingConn.compatibleTargetPortId) strokeColor = this.themeColors.connectionPendingCompatible;

      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = 2 / this.currentViewState.scale;
      this.ctx.setLineDash([4 / this.currentViewState.scale, 2 / this.currentViewState.scale]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  private renderConnections(): void {
    if (!this.ctx || !this.currentViewState) return;
    const connections = this.connectionManager.getConnections();
    const pendingReconInfo = this.interactionManager.getPendingConnection()?.reconnectingInfo;

    connections.forEach(conn => {
      if (pendingReconInfo && pendingReconInfo.originalConnection.id === conn.id) {
        this.drawBezierConnection(conn, this.currentViewState!, this.ctx!, true); // Ghosted
        return;
      }
      const isSelected = this.selectionManager.isSelected(conn.id);
      this.drawBezierConnection(conn, this.currentViewState!, this.ctx!, false, isSelected);
    });
  }

  private drawBezierConnection(conn: Connection, viewState: ViewState, ctx: CanvasRenderingContext2D, isGhosted: boolean = false, isSelected: boolean = false): void {
    const sourceNode = this.nodeManager.getNode(conn.sourceNodeId);
    const targetNode = this.nodeManager.getNode(conn.targetNodeId);
    const sourcePort = this.nodeManager.getPort(conn.sourcePortId);
    const targetPort = this.nodeManager.getPort(conn.targetPortId);

    if (!sourceNode || !targetNode || !sourcePort || !targetPort) return;

    const p0 = this.interactionManager.getPortAbsolutePosition(sourceNode, sourcePort, viewState);
    const p3 = this.interactionManager.getPortAbsolutePosition(targetNode, targetPort, viewState);

    if (!isGhosted && (sourcePort.isHidden || targetPort.isHidden)) return;

    if (isGhosted) {
      ctx.strokeStyle = this.themeColors.connectionGhosted;
      ctx.lineWidth = 1 / viewState.scale;
      ctx.setLineDash([3 / viewState.scale, 3 / viewState.scale]);
    } else {
      ctx.strokeStyle = isSelected ? this.themeColors.selectionHighlight : (conn.data?.color || this.themeColors.connectionDefault);
      ctx.lineWidth = (isSelected ? 3 : 2) / viewState.scale;
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    const offset = Math.min(Math.abs(p3.x - p0.x) * 0.4, 150 / viewState.scale) + 30 / viewState.scale;
    const cp1x = p0.x + offset; const cp1y = p0.y;
    const cp2x = p3.x - offset; const cp2y = p3.y;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p3.x, p3.y);
    ctx.stroke();

    if (isGhosted) ctx.setLineDash([]);

    if (conn.data?.label && !isGhosted) {
      const midX = (p0.x + cp1x + cp2x + p3.x) / 4; // Approximate midpoint of Bezier
      const midY = (p0.y + cp1y + cp2y + p3.y) / 4;
      ctx.save();
      ctx.translate(midX, midY);
      // Basic rotation, could be improved for Bezier curves
      const angle = Math.atan2(p3.y - p0.y, p3.x - p0.x);
      if (angle > Math.PI / 2 || angle < -Math.PI / 2) { // Flip text if upside down
        ctx.rotate(angle + Math.PI);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(conn.data.label, 0, 5 / viewState.scale);
      } else {
        ctx.rotate(angle);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(conn.data.label, 0, -5 / viewState.scale);
      }
      ctx.fillStyle = this.themeColors.nodeTitleText; // Use a readable color
      ctx.font = `${10 / viewState.scale}px ${getComputedStyle(this.canvasEngine.getCanvasElement()).fontFamily}`;
      ctx.restore();
    }
  }

  private renderPorts(): void { // Renamed from renderPorts to avoid conflict
    if (!this.ctx || !this.currentViewState || !this.interactionManager) return;

    const nodes = this.nodeManager.getNodes();

    nodes.forEach(node => {
      const allInputPorts = [...node.fixedInputs, ...node.dynamicInputs.filter(p => !p.isHidden)];
      const allOutputPorts = [...node.fixedOutputs, ...node.dynamicOutputs.filter(p => !p.isHidden)];

      allInputPorts.forEach((port) => {
        const portAbsPos = this.interactionManager.getPortAbsolutePosition(node, port, this.currentViewState!);
        this.drawPort(this.ctx!, port, portAbsPos.x, portAbsPos.y, this.currentViewState!,
          this.hoveredCompatiblePortId === port.id || this.hoveredPortIdIdle === port.id);

        // Port label
        this.ctx!.fillStyle = this.themeColors.nodePortText;
        this.ctx!.font = `${11 / this.currentViewState!.scale}px ${getComputedStyle(this.canvasEngine.getCanvasElement()).fontFamily}`;
        this.ctx!.textAlign = 'left';
        this.ctx!.textBaseline = 'middle';
        const labelText = port.variableName || port.name;
        if (labelText) {
          this.ctx!.fillText(labelText, portAbsPos.x + (NODE_PORT_SIZE / this.currentViewState!.scale) + (4 / this.currentViewState!.scale), portAbsPos.y);
        }
      });

      allOutputPorts.forEach((port) => {
        const portAbsPos = this.interactionManager.getPortAbsolutePosition(node, port, this.currentViewState!);
        this.drawPort(this.ctx!, port, portAbsPos.x, portAbsPos.y, this.currentViewState!,
          this.hoveredCompatiblePortId === port.id || this.hoveredPortIdIdle === port.id);

        this.ctx!.fillStyle = this.themeColors.nodePortText;
        this.ctx!.font = `${11 / this.currentViewState!.scale}px ${getComputedStyle(this.canvasEngine.getCanvasElement()).fontFamily}`;
        this.ctx!.textAlign = 'right';
        this.ctx!.textBaseline = 'middle';
        let labelText = port.name;
        if (port.isDynamic && port.outputValue) {
          labelText = `${port.name} (${port.outputValue.substring(0, 10)}...)`;
        }
        if (labelText) {
          this.ctx!.fillText(labelText, portAbsPos.x - (NODE_PORT_SIZE / this.currentViewState!.scale) - (4 / this.currentViewState!.scale), portAbsPos.y);
        }
      });
    });
  }

  private handleCompatiblePortHoverChanged = (portId: string | null) => {
    if (this.hoveredCompatiblePortId !== portId) {
      this.hoveredCompatiblePortId = portId;
      this.canvasEngine.requestRender();
    }
  }
  private handlePortHoverIdleChanged = (portId: string | null) => {
    if (this.hoveredPortIdIdle !== portId) {
      this.hoveredPortIdIdle = portId;
      this.canvasEngine.requestRender();
    }
  }

  public destroy(): void {
    this.canvasEngine.off(EVENT_CANVAS_BEFORE_RENDER, this.handleBeforeRender);
    this.interactionManager.off('compatiblePortHoverChanged', this.handleCompatiblePortHoverChanged);
    this.interactionManager.off('portHoverChanged', this.handlePortHoverIdleChanged);
  }
}