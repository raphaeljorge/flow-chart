import { CanvasEngine } from './CanvasEngine';
import { NodeManager } from '../state/NodeManager';
import { StickyNoteManager } from '../state/StickyNoteManager';
import { SelectionManager } from '../state/SelectionManager';
import { InteractionManager } from '../interaction/InteractionManager';
import { ConnectionManager } from '../state/ConnectionManager';
import { ViewStore } from '../state/ViewStore';
import { 
  Node, StickyNote, ViewState, NodePort, Connection, NodeGroup, 
  Point, ConnectionRoutingMode 
} from '../core/types';
import {
  NODE_HEADER_HEIGHT,
  NODE_PORT_SIZE,
  EVENT_CANVAS_BEFORE_RENDER,
  EVENT_VIEW_CHANGED
} from '../core/constants';
import { NodeGroupManager, GROUP_HEADER_HEIGHT } from '../state/NodeGroupManager';

export class RenderService {
  private ctx: CanvasRenderingContext2D | null = null;
  private currentViewState: ViewState | null = null;
  private hoveredCompatiblePortId: string | null = null;
  private hoveredPortIdIdle: string | null = null;
  private themeColors: Record<string, string> = {};
  private animationFrameId: number | null = null;

  constructor(
    private canvasEngine: CanvasEngine,
    private nodeManager: NodeManager,
    private connectionManager: ConnectionManager,
    private stickyNoteManager: StickyNoteManager,
    private nodeGroupManager: NodeGroupManager,
    private selectionManager: SelectionManager,
    private interactionManager: InteractionManager,
    viewStore: ViewStore,
  ) {
    this.canvasEngine.on(EVENT_CANVAS_BEFORE_RENDER, this.handleBeforeRender);
    this.interactionManager.on('compatiblePortHoverChanged', this.handleCompatiblePortHoverChanged);
    this.interactionManager.on('portHoverChanged', this.handlePortHoverIdleChanged);
    this.loadThemeColors();
    
    viewStore.on(EVENT_VIEW_CHANGED, this.handleViewChange);
  }

  private handleViewChange = (newState: ViewState, oldState?: ViewState) => {
    const needsAnimation = newState.preferences.connectionAppearance.animateFlow;
    const wasAnimating = oldState?.preferences.connectionAppearance.animateFlow ?? false;

    if (needsAnimation && !wasAnimating) {
        this.startAnimationLoop();
    } else if (!needsAnimation && wasAnimating) {
        this.stopAnimationLoop();
    }
    this.canvasEngine.requestRender();
  }

  private startAnimationLoop = () => {
    if (this.animationFrameId) return; // Already running
    const animate = () => {
        this.canvasEngine.requestRender();
        this.animationFrameId = requestAnimationFrame(animate);
    };
    this.animationFrameId = requestAnimationFrame(animate);
  }

  private stopAnimationLoop = () => {
      if (this.animationFrameId) {
          cancelAnimationFrame(this.animationFrameId);
          this.animationFrameId = null;
      }
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

    this.renderGroups();
    this.renderConnections();
    this.renderStickyNotes();
    this.renderNodes();
    this.renderPorts(); 
    this.renderPendingOrReconnectingConnection();
    this.renderResizeHandles();
    this.renderBoxSelect();

    this.ctx = null;
    this.currentViewState = null;
  };

  private renderGroups(): void {
    if (!this.ctx || !this.currentViewState) return;
    const groups = this.nodeGroupManager.getGroups();
    groups.forEach(group => this.drawGroup(this.ctx!, group, this.currentViewState!));
  }

  private drawGroup(ctx: CanvasRenderingContext2D, group: NodeGroup, viewState: ViewState): void {
    const { position: { x, y }, width, height, title, style } = group;
    const isSelected = this.selectionManager.isSelected(group.id);
    const cornerRadius = 12;
    const headerHeight = GROUP_HEADER_HEIGHT;

    ctx.fillStyle = style.backgroundColor || 'rgba(148, 163, 184, 0.1)';
    ctx.strokeStyle = style.borderColor || '#94a3b8';
    ctx.lineWidth = (isSelected ? 2.5 : 1) / viewState.scale;
    
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y + headerHeight);
    ctx.lineTo(x + width, y + headerHeight);
    ctx.stroke();

    ctx.fillStyle = style.titleColor || '#e2e8f0';
    ctx.font = `bold 14px ${getComputedStyle(this.canvasEngine.getCanvasElement()).fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, x + 15, y + headerHeight / 2);
  }

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
    // if (!this.ctx || !this.currentViewState) return;
    // const selectedIds = this.selectionManager.getSelectedItems();
    // if (selectedIds.length !== 1) return;

    // const item = this.interactionManager.findDraggableItemById(selectedIds[0]);
    // if (!item || (item.type !== 'node' && item.type !== 'stickyNote')) return;

    // const { x, y } = item.position;
    // const itemWidth = item.width;
    // const itemHeight = item.height;
    // const handleScaledSize = RESIZE_HANDLE_SIZE / this.currentViewState.scale;

    // this.ctx.fillStyle = this.themeColors.selectionHighlight || '#6366f1';
    // const handlesPoints: Point[] = [
    //   { x: x, y: y }, { x: x + itemWidth / 2, y: y }, { x: x + itemWidth, y: y },
    //   { x: x, y: y + itemHeight / 2 }, { x: x + itemWidth, y: y + itemHeight / 2 },
    //   { x: x, y: y + itemHeight }, { x: x + itemWidth / 2, y: y + itemHeight }, { x: x + itemWidth, y: y + itemHeight },
    // ];
    // handlesPoints.forEach(p => {
    //   this.ctx!.beginPath();
    //   this.ctx!.arc(p.x, p.y, handleScaledSize / 2, 0, Math.PI * 2);
    //   this.ctx!.fill();
    // });
    return;
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
    const cornerRadius = 8;

    // Use a cor do nó ou um fallback padrão
    const nodeCustomColor = node.color || this.themeColors.nodeBorder; // Fallback para a cor da borda do tema se não houver cor customizada

    // ETAPA 1: Desenhar os preenchimentos de fundo (sem bordas)

    // Fundo do corpo principal (retângulo arredondado completo)
    ctx.fillStyle = this.themeColors.nodeBackground;
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

    // Fundo do cabeçalho (desenhado por cima do fundo do corpo)
    ctx.fillStyle = this.themeColors.nodeHeaderBackground;
    ctx.beginPath();
    ctx.moveTo(x, y + headerHeight);
    ctx.lineTo(x, y + cornerRadius);
    ctx.arcTo(x, y, x + cornerRadius, y, cornerRadius);
    ctx.lineTo(x + width - cornerRadius, y);
    ctx.arcTo(x + width, y, x + width, y + cornerRadius, cornerRadius);
    ctx.lineTo(x + width, y + headerHeight);
    ctx.closePath();
    ctx.fill();

    // ETAPA 2: Desenhar TODAS as bordas com a nova lógica de seleção
    // A COR da borda é sempre a cor do nó.
    ctx.strokeStyle = nodeCustomColor;
    // A ESPESSURA da borda aumenta se estiver selecionado.
    ctx.lineWidth = (isSelected ? 2.5 : 1.5) / viewState.scale;
    
    ctx.beginPath();
    
    // Caminho para a borda externa completa
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
    
    // Adiciona a linha de separação ao mesmo caminho
    // ctx.moveTo(x, y + headerHeight);
    // ctx.lineTo(x + width, y + headerHeight);

    // Executa o comando 'stroke' uma única vez para desenhar tudo com o mesmo estilo
    ctx.stroke();

    // ETAPA 3: Desenhar o conteúdo do cabeçalho (permanece igual)
    const fontFamily = getComputedStyle(this.canvasEngine.getCanvasElement()).fontFamily;
    
    if (node.icon) {
      const iconSize = 24;
      const iconX = x + 10;
      const iconY = y + (headerHeight - iconSize) / 2;
      
      ctx.fillStyle = nodeCustomColor;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(iconX, iconY, iconSize, iconSize, 4);
      } else {
        ctx.rect(iconX, iconY, iconSize, iconSize);
      }
      ctx.fill();

      ctx.fillStyle = this.themeColors.nodeIconText;
      ctx.font = `bold 14px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.icon.substring(0, 2).toUpperCase(), iconX + iconSize / 2, iconY + iconSize / 2 + 1);
    }

    ctx.fillStyle = this.themeColors.nodeTitleText;
    ctx.font = `bold 14px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.title, x + (node.icon ? 44 : 16), y + headerHeight / 2);

    // if (node.status) {
    //   const statusColorMap: Record<string, string> = {
    //     success: this.themeColors.statusSuccess, error: this.themeColors.statusError,
    //     running: this.themeColors.statusRunning, warning: this.themeColors.statusWarning,
    //     unsaved: this.themeColors.statusUnsaved
    //   };
    //   ctx.fillStyle = statusColorMap[node.status] || '#888';
    //   ctx.beginPath();
    //   ctx.arc(x + width - 16, y + headerHeight / 2, 5, 0, Math.PI * 2);
    //   ctx.fill();
    // }

    // ID do Nó
    ctx.fillStyle = this.themeColors.nodeIdText;
    ctx.font = `10px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`#${node.id.slice(0, 8)}`, x + 12, y + height - 8);
  }

  private drawPort(ctx: CanvasRenderingContext2D, port: NodePort, canvasX: number, canvasY: number, viewState: ViewState, isHighlighted: boolean = false): void {
    if (port.isHidden) return;

    // USA O TAMANHO CONSTANTE DA PORTA. A escala global do canvas cuidará do redimensionamento.
    const portRadius = NODE_PORT_SIZE / 2;

    // A espessura da borda da porta continua sendo ajustada para parecer sempre nítida na tela.
    ctx.lineWidth = (isHighlighted ? 2 : 1.5) / viewState.scale;

    const parentNode = this.nodeManager.getNode(port.nodeId);
    const nodeCustomColor = parentNode?.color || this.themeColors.nodePortBorder;

    const borderColor = port.isDynamic
        ? this.themeColors.nodePortDynamicBorder
        : (isHighlighted ? this.themeColors.portHighlightBorder : nodeCustomColor);
    
    const fillColor = isHighlighted 
        ? this.themeColors.portHighlightFill 
        : (port.isDynamic ? this.themeColors.nodePortDynamicBackground : nodeCustomColor);

    ctx.strokeStyle = borderColor;
    ctx.fillStyle = fillColor;

    ctx.beginPath();
    // O raio do arco agora usa o valor não escalado.
    ctx.arc(canvasX, canvasY, portRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke()
  }

  private drawStickyNote(ctx: CanvasRenderingContext2D, note: StickyNote, viewState: ViewState): void {
    const x = note.position.x;
    const y = note.position.y;
    const width = note.width;
    const height = note.height;
    const isSelected = this.selectionManager.isSelected(note.id);
    const cornerRadius = 8; // Raio dos cantos para sticky note

    ctx.fillStyle = note.style.backgroundColor || this.themeColors.stickyNoteDefaultBackground;
    // A COR da borda é sempre a padrão da anotação.
    ctx.strokeStyle = this.themeColors.stickyNoteBorder || '#3a3a3a';
    // A ESPESSURA aumenta se estiver selecionado.
    ctx.lineWidth = (isSelected ? 2.5 : 1) / viewState.scale;

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

    // Content
    ctx.fillStyle = note.style.textColor || this.themeColors.stickyNoteDefaultText;
    const fontSize = (note.style.fontSize || 14);
    ctx.font = `${fontSize}px ${getComputedStyle(this.canvasEngine.getCanvasElement()).fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const padding = 12;
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
        this.drawConnection(conn, this.currentViewState!, this.ctx!, true); // Ghosted
        return;
      }
      const isSelected = this.selectionManager.isSelected(conn.id);
      this.drawConnection(conn, this.currentViewState!, this.ctx!, false, isSelected);
    });
  }

  private drawConnection(conn: Connection, viewState: ViewState, ctx: CanvasRenderingContext2D, isGhosted: boolean = false, isSelected: boolean = false): void {
    const sourceNode = this.nodeManager.getNode(conn.sourceNodeId);
    const targetNode = this.nodeManager.getNode(conn.targetNodeId);
    const sourcePort = this.nodeManager.getPort(conn.sourcePortId);
    const targetPort = this.nodeManager.getPort(conn.targetPortId);

    if (!sourceNode || !targetNode || !sourcePort || !targetPort || sourcePort.isHidden || targetPort.isHidden) return;

    const p0 = this.interactionManager.getPortAbsolutePosition(sourceNode, sourcePort, viewState);
    const p3 = this.interactionManager.getPortAbsolutePosition(targetNode, targetPort, viewState);

    ctx.beginPath();
    
    // Setup line style
    this.setupConnectionStyle(ctx, conn, viewState, isGhosted, isSelected);

    // --- NEW: Routing Logic ---
    const routingMode = viewState.preferences.connectionRouting;
    let midPoint;
    switch (routingMode) {
        case ConnectionRoutingMode.STRAIGHT:
            midPoint = this.drawStraightPath(ctx, p0, p3);
            break;
        case ConnectionRoutingMode.ORTHOGONAL:
            midPoint = this.drawOrthogonalPath(ctx, p0, p3);
            break;
        case ConnectionRoutingMode.BEZIER:
        default:
            midPoint = this.drawBezierPath(ctx, p0, p3, viewState);
            break;
    }
    
    ctx.stroke();

    if (conn.data?.label) {
        this.drawConnectionLabel(ctx, conn.data.label, midPoint);
    }

    // Reset line dash for other rendering operations
    ctx.setLineDash([]);
  }

  private setupConnectionStyle(ctx: CanvasRenderingContext2D, conn: Connection, viewState: ViewState, isGhosted: boolean, isSelected: boolean): void {
    if (isGhosted) {
        ctx.strokeStyle = this.themeColors.connectionGhosted;
        ctx.lineWidth = 1 / viewState.scale;
        ctx.setLineDash([3 / viewState.scale, 3 / viewState.scale]);
        return;
    }
    
    // NEW: Animated flow
    if (viewState.preferences.connectionAppearance.animateFlow) {
        const lineDash = [8 / viewState.scale, 10 / viewState.scale];
        ctx.setLineDash(lineDash);
        const time = Date.now() / 50;
        ctx.lineDashOffset = -time % (lineDash[0] + lineDash[1]);
    } else {
        ctx.setLineDash([]);
    }
    
    ctx.strokeStyle = conn.data?.color || this.themeColors.connectionDefault;
    ctx.lineWidth = (isSelected ? 3 : 1.5) / viewState.scale;
  }

  private drawStraightPath(ctx: CanvasRenderingContext2D, p0: Point, p3: Point): Point {
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p3.x, p3.y);
    return { x: (p0.x + p3.x) / 2, y: (p0.y + p3.y) / 2 };
  }

  private drawBezierPath(ctx: CanvasRenderingContext2D, p0: Point, p3: Point, viewState: ViewState): Point {
    ctx.moveTo(p0.x, p0.y);
    const offset = Math.min(Math.abs(p3.x - p0.x) * 0.4, 150 / viewState.scale) + 30 / viewState.scale;
    const cp1x = p0.x + offset; const cp1y = p0.y;
    const cp2x = p3.x - offset; const cp2y = p3.y;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p3.x, p3.y);
     // Calculate the midpoint of the Bezier curve
    const t = 0.5;
    const x = Math.pow(1 - t, 3) * p0.x + 3 * Math.pow(1 - t, 2) * t * cp1x + 3 * (1 - t) * Math.pow(t, 2) * cp2x + Math.pow(t, 3) * p3.x;
    const y = Math.pow(1 - t, 3) * p0.y + 3 * Math.pow(1 - t, 2) * t * cp1y + 3 * (1 - t) * Math.pow(t, 2) * cp2y + Math.pow(t, 3) * p3.y;

    return { x, y };
  }

  private drawOrthogonalPath(ctx: CanvasRenderingContext2D, p0: Point, p3: Point): Point {
    const midX = (p0.x + p3.x) / 2;
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(midX, p0.y); // Primeiro segmento horizontal
    ctx.lineTo(midX, p3.y);  // Segmento vertical
    ctx.lineTo(p3.x, p3.y);  // Segundo segmento horizontal
    return { x: midX, y: (p0.y + p3.y) / 2 };
  }
  
  private drawConnectionLabel(ctx: CanvasRenderingContext2D, label: string, position: Point) {
    const padding = 4;
    ctx.font = `12px ${getComputedStyle(this.canvasEngine.getCanvasElement()).fontFamily}`;
    const textMetrics = ctx.measureText(label);
    const textWidth = textMetrics.width;
    const textHeight = 12;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(position.x - textWidth / 2 - padding, position.y - textHeight / 2 - padding, textWidth + padding * 2, textHeight + padding * 2);

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, position.x, position.y);
  }

  private renderPorts(): void {
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
        this.ctx!.font = `11px ${getComputedStyle(this.canvasEngine.getCanvasElement()).fontFamily}`;
        this.ctx!.textAlign = 'left';
        this.ctx!.textBaseline = 'middle';
        const labelText = port.variableName || port.name;
        if (labelText) {
          this.ctx!.fillText(labelText, portAbsPos.x + NODE_PORT_SIZE + 4, portAbsPos.y);
        }
      });

      allOutputPorts.forEach((port) => {
        const portAbsPos = this.interactionManager.getPortAbsolutePosition(node, port, this.currentViewState!);
        this.drawPort(this.ctx!, port, portAbsPos.x, portAbsPos.y, this.currentViewState!,
          this.hoveredCompatiblePortId === port.id || this.hoveredPortIdIdle === port.id);

        this.ctx!.fillStyle = this.themeColors.nodePortText;
        this.ctx!.font = `11px ${getComputedStyle(this.canvasEngine.getCanvasElement()).fontFamily}`;
        this.ctx!.textAlign = 'right';
        this.ctx!.textBaseline = 'middle';
        let labelText = port.name;
        if (port.isDynamic && port.outputValue) {
          labelText = `${port.name} (${port.outputValue.substring(0, 10)}...)`;
        }
        if (labelText) {
          this.ctx!.fillText(labelText, portAbsPos.x - NODE_PORT_SIZE - 4, portAbsPos.y);
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
    this.stopAnimationLoop();
    this.canvasEngine.off(EVENT_CANVAS_BEFORE_RENDER, this.handleBeforeRender);
    this.interactionManager.off('compatiblePortHoverChanged', this.handleCompatiblePortHoverChanged);
    this.interactionManager.off('portHoverChanged', this.handlePortHoverIdleChanged);
  }
}