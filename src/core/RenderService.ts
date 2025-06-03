// src/core/RenderService.ts
import { CanvasEngine } from './CanvasEngine';
import { NodeManager } from './NodeManager';
import { StickyNoteManager } from './StickyNoteManager';
import { SelectionManager } from './SelectionManager';
import { InteractionManager, PendingConnectionState } from './InteractionManager';
import { Node, StickyNote, ViewState, Rect, NodePort, Connection, Point, ReconnectingConnectionInfo } from './Types';

export class RenderService {
  private ctx: CanvasRenderingContext2D | null = null;
  private viewState: ViewState | null = null;
  private hoveredCompatiblePortId: string | null = null;
  private hoveredPortIdIdle: string | null = null;

  constructor(
    private canvasEngine: CanvasEngine,
    private nodeManager: NodeManager,
    private stickyNoteManager: StickyNoteManager,
    private selectionManager: SelectionManager,
    private interactionManager: InteractionManager
  ) {
    this.canvasEngine.on('beforerender', this.handleBeforeRender);
    this.interactionManager.on('compatiblePortHoverChanged', this.handleCompatiblePortHoverChanged);
    this.interactionManager.on('portHoverChanged', this.handlePortHoverIdleChanged);
  }

  private handleBeforeRender = (ctx: CanvasRenderingContext2D, viewState: ViewState): void => {
    this.ctx = ctx; this.viewState = viewState;
    this.renderConnections();
    this.renderStickyNotes();
    this.renderNodes();
    this.renderPendingOrReconnectingConnection();
    this.renderSelectionHighlights();
    this.renderResizeHandles();
    this.renderBoxSelect();
    this.ctx = null; this.viewState = null;
  };

  private renderNodes(): void {
    if (!this.ctx || !this.viewState) return;
    const nodes = this.nodeManager.getNodes();
    nodes.forEach(node => this.drawNode(this.ctx!, node, this.viewState!));
  }

  private renderStickyNotes(): void {
    if (!this.ctx || !this.viewState) return;
    const notes = this.stickyNoteManager.getNotes();
    notes.forEach(note => this.drawStickyNote(this.ctx!, note, this.viewState!));
  }

  private renderSelectionHighlights(): void {
    if (!this.ctx || !this.viewState) return;
    const selectedIds = this.selectionManager.getSelectedItems();
    if (selectedIds.length === 0) return;

    selectedIds.forEach(id => {
      const node = this.nodeManager.getNode(id);
      if (node) {
        this.ctx!.strokeStyle = '#6366f1'; this.ctx!.lineWidth = 2 / this.viewState!.scale; 
        this.ctx!.strokeRect(node.position.x, node.position.y, node.width, node.height);
      } else {
        const stickyNote = this.stickyNoteManager.getNote(id);
        if (stickyNote) {
          this.ctx!.strokeStyle = '#6366f1'; this.ctx!.lineWidth = 2 / this.viewState!.scale; 
          this.ctx!.strokeRect(stickyNote.position.x, stickyNote.position.y, stickyNote.width, stickyNote.height);
        }
        // Destaque para conexões é feito em renderConnections
      }
    });
  }
  
  private renderResizeHandles(): void {
    if (!this.ctx || !this.viewState) return;
    const selectedIds = this.selectionManager.getSelectedItems();
    if (selectedIds.length !== 1) return; 
    const item = this.interactionManager.findDraggableItemById(selectedIds[0]);
    if (!item || (item.type !== 'node' && item.type !== 'stickyNote')) return;
    const { x, y } = item.position; const itemWidth = item.width; const itemHeight = item.height;
    const handleSize = 8 / this.viewState.scale; this.ctx.fillStyle = '#6366f1';
    const handlesPoints: Point[] = [
        { x: x, y: y }, { x: x + itemWidth / 2, y: y }, { x: x + itemWidth, y: y },
        { x: x, y: y + itemHeight / 2 }, { x: x + itemWidth, y: y + itemHeight / 2 },
        { x: x, y: y + itemHeight }, { x: x + itemWidth / 2, y: y + itemHeight }, { x: x + itemWidth, y: y + itemHeight },
    ];
    handlesPoints.forEach(p => { this.ctx!.beginPath(); this.ctx!.arc(p.x, p.y, handleSize / 2, 0, Math.PI * 2); this.ctx!.fill(); });
  }

  private renderBoxSelect(): void {
    if (!this.ctx || !this.viewState) return;
    const boxRect = this.interactionManager.getBoxSelectRect();
    if (boxRect) {
      this.ctx.fillStyle = 'rgba(99, 102, 241, 0.1)'; this.ctx.fillRect(boxRect.x, boxRect.y, boxRect.width, boxRect.height);
      this.ctx.strokeStyle = '#6366f1'; this.ctx.lineWidth = 1 / this.viewState.scale;
      this.ctx.strokeRect(boxRect.x, boxRect.y, boxRect.width, boxRect.height);
    }
  }

  private drawNode(ctx: CanvasRenderingContext2D, node: Node, viewState: ViewState): void {
    const x = node.position.x; const y = node.position.y;
    const width = node.width; const height = node.height; const headerHeight = 40; 
    ctx.fillStyle = '#1a1a1a';
    const isSelected = this.selectionManager.isSelected(node.id);
    ctx.strokeStyle = isSelected ? '#6366f1' : '#2a2a2a';
    ctx.lineWidth = (isSelected ? 2 : 1) / viewState.scale; 
    ctx.beginPath(); ctx.rect(x, y, width, height); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x, y, width, headerHeight);
    if (node.icon) {
        ctx.fillStyle = '#4a4a4a'; const iconX = x + 8; const iconY = y + 8; const iconSize = 24;
        ctx.fillRect(iconX, iconY, iconSize, iconSize); 
        ctx.fillStyle = '#ffffff'; ctx.font = `${12 / viewState.scale}px Inter, sans-serif`; 
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(node.icon.substring(0,2).toUpperCase(), iconX + iconSize / 2, iconY + iconSize / 2);
    }
    ctx.fillStyle = '#ffffff'; ctx.font = `${12 / viewState.scale}px Inter, sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(node.title, x + (node.icon ? 40 : 12), y + headerHeight / 2);
    if (node.status) {
        const sc: Record<string,string> = { success: '#22c55e', error: '#ef4444', running: '#3b82f6', warning: '#f59e0b', unsaved: '#8b5cf6' };
        ctx.fillStyle = sc[node.status] || '#888';
        ctx.beginPath(); ctx.arc(x + width - (15/viewState.scale), y + headerHeight/2, 5/viewState.scale, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = '#666666'; ctx.font = `${10 / viewState.scale}px Inter, sans-serif`;
    ctx.fillText(`#${node.id.slice(0, 8)}`, x + (12/viewState.scale), y + height - (12/viewState.scale));
    const portSize = 10 / viewState.scale;
    node.inputs.forEach((port) => {
        const portAbsPos = this.interactionManager.getPortAbsolutePosition(node, port, viewState);
        this.drawPort(ctx, port, portAbsPos.x, portAbsPos.y, portSize, viewState, 
            this.pendingConnection?.compatibleTargetPortId === port.id || this.hoveredPortIdIdle === port.id
        );
    });
    node.outputs.forEach((port) => {
        const portAbsPos = this.interactionManager.getPortAbsolutePosition(node, port, viewState);
        this.drawPort(ctx, port, portAbsPos.x, portAbsPos.y, portSize, viewState,
            this.pendingConnection?.compatibleTargetPortId === port.id || this.hoveredPortIdIdle === port.id
        );
    });
  }

  private drawPort(ctx: CanvasRenderingContext2D, port: NodePort, canvasX: number, canvasY: number, size: number, viewState: ViewState, isHighlighted: boolean = false): void {
    ctx.lineWidth = (isHighlighted ? 2 : 1) / viewState.scale;
    ctx.strokeStyle = isHighlighted ? '#5A93E4' : '#3a3a3a';
    ctx.fillStyle = isHighlighted ? '#3c6493' : '#2a2a2a';
    ctx.beginPath(); ctx.arc(canvasX, canvasY, size / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = `${11 / viewState.scale}px Inter, sans-serif`;
    ctx.textBaseline = 'middle'; const labelOffset = size;
    if (port.type === 'input') { ctx.textAlign = 'left'; ctx.fillText(port.name, canvasX + labelOffset, canvasY); }
    else { ctx.textAlign = 'right'; ctx.fillText(port.name, canvasX - labelOffset, canvasY); }
  }
  
  private drawStickyNote(ctx: CanvasRenderingContext2D, note: StickyNote, viewState: ViewState): void {
    const x=note.position.x; const y=note.position.y; const width=note.width; const height=note.height;
    ctx.fillStyle = note.style.backgroundColor; const isSelected = this.selectionManager.isSelected(note.id);
    ctx.strokeStyle = isSelected ? '#6366f1' : '#3a3a3a'; ctx.lineWidth = (isSelected ? 2 : 1) / viewState.scale;
    ctx.beginPath(); ctx.rect(x,y,width,height); ctx.fill(); ctx.stroke();
    ctx.fillStyle = note.style.textColor; const fontSize = note.style.fontSize / viewState.scale;
    ctx.font = `${fontSize}px Inter, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const padding = 12 / viewState.scale; const lines = note.content.split('\n'); const lineHeight = fontSize * 1.2;
    lines.forEach((line, index) => { ctx.fillText(line, x + padding, y + padding + index * lineHeight); });
  }

  private renderPendingOrReconnectingConnection(): void {
    if (!this.ctx || !this.viewState) return;
    const pendingConn = this.interactionManager.getPendingConnection();
    if (pendingConn) {
      this.ctx.beginPath();
      this.ctx.moveTo(pendingConn.fromPosition.x, pendingConn.fromPosition.y);
      const isOutputLike = pendingConn.reconnectingInfo ? 
        pendingConn.reconnectingInfo.fixedPort.type === 'output' : 
        pendingConn.sourcePort.type === 'output';
      const curveFactor = isOutputLike ? 1 : -1;
      const endPoint = pendingConn.currentMousePosition;
      const cp1x = pendingConn.fromPosition.x + (50 / this.viewState.scale) * curveFactor;
      const cp1y = pendingConn.fromPosition.y;
      const cp2x = endPoint.x - (50 / this.viewState.scale) * curveFactor;
      const cp2y = endPoint.y;
      this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endPoint.x, endPoint.y);
      this.ctx.strokeStyle = pendingConn.compatibleTargetPortId ? '#4CAF50' : (pendingConn.reconnectingInfo ? '#FF9800' : '#5A93E4');
      this.ctx.lineWidth = 2 / this.viewState.scale;
      this.ctx.setLineDash([4 / this.viewState.scale, 2 / this.viewState.scale]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }
  
  private renderConnections(): void {
    if (!this.ctx || !this.viewState) return;
    const connections = this.nodeManager.getConnections();
    const pendingReconInfo = this.interactionManager.getPendingConnection()?.reconnectingInfo;
    connections.forEach(conn => {
        if (pendingReconInfo && pendingReconInfo.originalConnection.id === conn.id) {
            this.drawBezierConnection(conn, this.viewState!, this.ctx!, true); return;
        }
        const isSelected = this.selectionManager.isSelected(conn.id);
        this.drawBezierConnection(conn, this.viewState!, this.ctx!, false, isSelected);
    });
  }

  private drawBezierConnection(conn: Connection, viewState: ViewState, ctx: CanvasRenderingContext2D, isGhosted: boolean = false, isSelected: boolean = false): void {
    const sourceNode = this.nodeManager.getNode(conn.sourceNodeId);
    const targetNode = this.nodeManager.getNode(conn.targetNodeId);
    const sourcePort = this.nodeManager.getPort(conn.sourcePortId);
    const targetPort = this.nodeManager.getPort(conn.targetPortId);
    if (sourceNode && targetNode && sourcePort && targetPort) {
        const p0 = this.interactionManager.getPortAbsolutePosition(sourceNode, sourcePort, viewState);
        const p3 = this.interactionManager.getPortAbsolutePosition(targetNode, targetPort, viewState);
        if (isGhosted) {
            ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1 / viewState.scale;
            ctx.setLineDash([3 / viewState.scale, 3 / viewState.scale]);
        } else {
            ctx.strokeStyle = isSelected ? '#5A93E4' : '#666';
            ctx.lineWidth = (isSelected ? 3 : 2) / viewState.scale;
            ctx.setLineDash([]);
        }
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
        const offset = Math.min(Math.abs(p3.x - p0.x) * 0.4, 150 / viewState.scale) + 30 / viewState.scale;
        const cp1x = p0.x + offset; const cp1y = p0.y;
        const cp2x = p3.x - offset; const cp2y = p3.y;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p3.x, p3.y); ctx.stroke();
        if (isGhosted) ctx.setLineDash([]);
    }
  }

  public destroy(): void {
    this.canvasEngine.off('beforerender', this.handleBeforeRender);
    this.interactionManager.off('compatiblePortHoverChanged', this.handleCompatiblePortHoverChanged);
    this.interactionManager.off('portHoverChanged', this.handlePortHoverIdleChanged);
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
}