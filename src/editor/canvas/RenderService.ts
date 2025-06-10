import { CanvasEngine } from './CanvasEngine';
import { NodeManager } from '../state/NodeManager';
import { StickyNoteManager } from '../state/StickyNoteManager';
import { SelectionManager } from '../state/SelectionManager';
import { InteractionManager } from '../interaction/InteractionManager';
import { ConnectionManager } from '../state/ConnectionManager';
import { ViewStore } from '../state/ViewStore';
import { 
  Node, StickyNote, ViewState, NodePort, Connection, NodeGroup, 
  Point, ConnectionRoutingMode, LineStyle
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
  private viewStore: ViewStore;

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
    this.viewStore = viewStore;
    this.canvasEngine.on(EVENT_CANVAS_BEFORE_RENDER, this.handleBeforeRender);
    this.interactionManager.on('compatiblePortHoverChanged', this.handleCompatiblePortHoverChanged);
    this.interactionManager.on('portHoverChanged', this.handlePortHoverIdleChanged);
    this.loadThemeColors();
    
    viewStore.on(EVENT_VIEW_CHANGED, this.handleViewChange);
    
    // Listen for connection updates to restart animations when needed
    this.connectionManager.on('connectionUpdated', this.handleConnectionUpdated);
    this.connectionManager.on('connectionCreated', this.handleConnectionUpdated);

    if (viewStore.getState().preferences.connectionAppearance.animateFlow) {
      this.startAnimationLoop();
    }
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

  private handleConnectionUpdated = () => {
    // Restart animation loop when connections are updated, in case new animations were added
    const currentState = this.viewStore.getState();
    if (currentState.preferences.connectionAppearance.animateFlow) {
      this.startAnimationLoop();
    }
  }

  private startAnimationLoop = () => {
    if (this.animationFrameId) return; // Already running
    
    let lastFrameTime = 0;
    const targetFPS = 60; // Target 60 FPS for smooth animation
    const frameInterval = 1000 / targetFPS;
    
    const animate = (currentTime: number) => {
        // Check if animation is still needed
        const currentState = this.viewStore.getState();
        if (!currentState.preferences.connectionAppearance.animateFlow) {
            // Stop animation if global animation is disabled
            this.animationFrameId = null;
            return;
        }
        
        const hasAnimatedConnections = this.connectionManager.getConnections().some(
            conn => conn.style?.animated
        );
        
        if (hasAnimatedConnections) {
            // Throttle rendering to target FPS for better performance
            if (currentTime - lastFrameTime >= frameInterval) {
                this.canvasEngine.requestRender();
                lastFrameTime = currentTime;
            }
            this.animationFrameId = requestAnimationFrame(animate);
        } else {
            // Stop animation if no animated connections
            this.animationFrameId = null;
        }
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
    this.currentViewState = viewState;

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

    const nodeCustomColor = node.color || this.themeColors.nodeBorder;

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

    ctx.strokeStyle = nodeCustomColor;
    ctx.lineWidth = (isSelected ? 2.5 : 1.5) / viewState.scale;
    
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
    
    ctx.stroke();

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

    ctx.fillStyle = this.themeColors.nodeIdText;
    ctx.font = `10px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`#${node.id.slice(0, 8)}`, x + 12, y + height - 8);
  }

  private drawPort(ctx: CanvasRenderingContext2D, port: NodePort, canvasX: number, canvasY: number, viewState: ViewState, isHighlighted: boolean = false): void {
    if (port.isHidden) return;

    const portRadius = NODE_PORT_SIZE / 2;

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
    const cornerRadius = 8;

    ctx.fillStyle = note.style.backgroundColor || this.themeColors.stickyNoteDefaultBackground;
    ctx.strokeStyle = this.themeColors.stickyNoteBorder || '#3a3a3a';
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
    const pendingConn = this.interactionManager.getPendingConnection();
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
        this.drawConnection(conn, this.currentViewState!, this.ctx!, true);
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
    
    this.setupConnectionStyle(ctx, conn, viewState, isGhosted, isSelected, p0, p3);

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

    ctx.setLineDash([]);
  }

  private hexToRgb(hex: string): { r: number, g: number, b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 }; // Default to white on failure
  }

  private setupConnectionStyle(ctx: CanvasRenderingContext2D, conn: Connection, viewState: ViewState, isGhosted: boolean, isSelected: boolean, p0: Point, p3: Point): void {
    if (isGhosted) {
        ctx.strokeStyle = this.themeColors.connectionGhosted;
        ctx.lineWidth = 1 / viewState.scale;
        ctx.setLineDash([3 / viewState.scale, 3 / viewState.scale]);
        return;
    }
    
    const lineStyle = conn.style?.lineStyle || 'solid';
    const isAnimated = viewState.preferences.connectionAppearance.animateFlow && conn.style?.animated;

    const baseColor = conn.style?.color || this.themeColors.connectionDefault;
    ctx.lineWidth = (isSelected ? 3 : 2) / viewState.scale;
    
    if (isAnimated) {
        // Create a gradient along the connection path for animated connections
        const gradient = ctx.createLinearGradient(p0.x, p0.y, p3.x, p3.y);
        
        // Animation parameters
        const pulseWidth = 0.25; // Width of the bright pulse (0-1)
        const speed = 0.002; // Speed of animation (increased for more visible movement)
        const time = Date.now() * speed;
        const offset = (time % 1); // Current position of the pulse (0-1)
        
        // Parse base color to get RGB values
        const baseRgb = this.hexToRgb(baseColor);
        const brightRgb = { r: 255, g: 255, b: 255 }; // Bright white pulse
        
        // Create gradient stops for a moving pulse effect
        const numStops = 20;
        for (let i = 0; i <= numStops; i++) {
            const pos = i / numStops;
            
            // Calculate distance from current pulse center
            const distFromPulse = Math.abs(pos - offset);
            const wrappedDist = Math.min(distFromPulse, Math.abs(pos - offset + 1), Math.abs(pos - offset - 1));
            
            // Create smooth pulse using cosine interpolation
            let intensity = 0;
            if (wrappedDist < pulseWidth) {
                intensity = (1 + Math.cos(Math.PI * wrappedDist / pulseWidth)) / 2;
            }
            
            // Interpolate between base color and bright color
            const r = Math.round(baseRgb.r + (brightRgb.r - baseRgb.r) * intensity);
            const g = Math.round(baseRgb.g + (brightRgb.g - baseRgb.g) * intensity);
            const b = Math.round(baseRgb.b + (brightRgb.b - baseRgb.b) * intensity);
            
            gradient.addColorStop(pos, `rgb(${r},${g},${b})`);
        }
        
        ctx.strokeStyle = gradient;
        
        // Apply line style for animated connections
        let lineDash: number[] = [];
        if (lineStyle === 'dashed') {
            lineDash = [10 / viewState.scale, 8 / viewState.scale];
        } else if (lineStyle === 'dotted') {
            lineDash = [2 / viewState.scale, 6 / viewState.scale];
        }
        ctx.setLineDash(lineDash);

    } else {
        // Non-animated connections
        ctx.strokeStyle = baseColor;
        let lineDash: number[] = [];
        if (lineStyle === 'dashed') {
            lineDash = [10 / viewState.scale, 8 / viewState.scale];
        } else if (lineStyle === 'dotted') {
            lineDash = [2 / viewState.scale, 6 / viewState.scale];
        }
        ctx.setLineDash(lineDash);
        
        if (lineDash.length > 0) {
            const time = Date.now() / 50;
            const totalDashLength = lineDash.reduce((a, b) => a + b, 0);
            ctx.lineDashOffset = -time % totalDashLength;
        } else {
            ctx.lineDashOffset = 0;
        }
    }
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
    const t = 0.5;
    const x = Math.pow(1 - t, 3) * p0.x + 3 * Math.pow(1 - t, 2) * t * cp1x + 3 * (1 - t) * Math.pow(t, 2) * cp2x + Math.pow(t, 3) * p3.x;
    const y = Math.pow(1 - t, 3) * p0.y + 3 * Math.pow(1 - t, 2) * t * cp1y + 3 * (1 - t) * Math.pow(t, 2) * cp2y + Math.pow(t, 3) * p3.y;

    return { x, y };
  }

  private drawOrthogonalPath(ctx: CanvasRenderingContext2D, p0: Point, p3: Point): Point {
    const midX = (p0.x + p3.x) / 2;
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(midX, p0.y);
    ctx.lineTo(midX, p3.y);
    ctx.lineTo(p3.x, p3.y);
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
    this.viewStore.off(EVENT_VIEW_CHANGED, this.handleViewChange);
    this.connectionManager.off('connectionUpdated', this.handleConnectionUpdated);
    this.connectionManager.off('connectionCreated', this.handleConnectionUpdated);
  }
}