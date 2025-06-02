import { EventEmitter } from 'eventemitter3';
import { Point, ViewState, Node } from './types';

export class Canvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private events: EventEmitter;
  private viewState: ViewState = {
    scale: 1,
    offset: { x: 0, y: 0 },
    showGrid: true,
    snapToGrid: false,
    gridSize: 20
  };
  private isDraggingNode: boolean = false;
  private isResizingNode: boolean = false;
  private resizeHandle: string = '';
  private dragStartPos: Point | null = null;
  private selectedNodes: Node[] = [];
  private nodes: Node[] = [];
  private contextMenu: HTMLElement | null = null;
  private searchBar: HTMLElement | null = null;
  private nodeStartPositions: Map<string, Point> = new Map();
  private nodeStartDimensions: Map<string, { width: number; height: number }> = new Map();
  private draggedNode: Node | null = null;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.events = new EventEmitter();
    
    container.appendChild(this.canvas);
    this.setupEventListeners();
    this.resize();
  }

  private setupEventListeners() {
    window.addEventListener('resize', () => this.resize());
    
    // Mouse event handling
    this.canvas.addEventListener('mousedown', (e) => {
      const point = this.getCanvasPoint(e);
      const nodeAndRegion = this.findNodeAndRegionAtPoint(point);

      if (nodeAndRegion) {
        const { node, region } = nodeAndRegion;
        
        // Handle selection first
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          this.events.emit('nodeMultiSelect', node);
        } else if (!this.selectedNodes.find(n => n.id === node.id)) {
          this.events.emit('nodeSelect', node);
        }

        // Handle dragging or resizing
        if (region === 'header') {
          this.startNodeDrag(node, point);
        } else if (region.startsWith('resize-')) {
          this.startNodeResize(node, point, region as string);
        }
      } else {
        // Clicking on empty canvas
        if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
          this.events.emit('clearSelection');
        }
        
        this.isDraggingNode = false;
        this.isResizingNode = false;
        this.draggedNode = null;
        this.nodeStartPositions.clear();
        this.nodeStartDimensions.clear();
        this.startPanning(e);
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const point = this.getCanvasPoint(e);
      
      if (this.isResizingNode && this.dragStartPos && this.draggedNode) {
        this.handleNodeResize(point);
      } else if (this.isDraggingNode && this.dragStartPos && this.draggedNode) {
        this.handleNodeDrag(point);
      } else if (this.isPanning) {
        this.handlePanning(e);
      }

      // Update cursor based on hover region
      this.updateCursor(point);
    });

    this.canvas.addEventListener('mouseup', () => {
      this.isDraggingNode = false;
      this.isResizingNode = false;
      this.dragStartPos = null;
      this.draggedNode = null;
      this.nodeStartPositions.clear();
      this.nodeStartDimensions.clear();
      this.stopPanning();
      this.canvas.style.cursor = 'default';
    });

    // Double click handling
    this.canvas.addEventListener('dblclick', (e) => {
      const point = this.getCanvasPoint(e);
      if (!this.findNodeAndRegionAtPoint(point)) {
        this.showQuickAddSearch(e.clientX, e.clientY);
      }
    });

    // Context menu handling
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const point = this.getCanvasPoint(e);
      if (!this.findNodeAndRegionAtPoint(point)) {
        this.showContextMenu(e.clientX, e.clientY);
      }
    });

    // Close menus when clicking outside
    window.addEventListener('click', (e) => {
      if (e.target !== this.contextMenu && e.target !== this.searchBar) {
        this.hideContextMenu();
        this.hideQuickAddSearch();
      }
    });

    // Zoom handling
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = -Math.sign(e.deltaY) * 0.1;
      const mousePos = { x: e.clientX, y: e.clientY };
      this.zoom(delta, mousePos);
    });
  }

  private startNodeDrag(node: Node, point: Point) {
    this.isDraggingNode = true;
    this.dragStartPos = point;
    this.draggedNode = node;
    
    // Store start positions for all selected nodes
    const isSelectedNode = this.selectedNodes.find(n => n.id === node.id);
    const nodesToTrack = isSelectedNode ? this.selectedNodes : [node];
    
    nodesToTrack.forEach(n => {
      this.nodeStartPositions.set(n.id, { ...n.position });
    });
  }

  private startNodeResize(node: Node, point: Point, handle: string) {
    this.isResizingNode = true;
    this.resizeHandle = handle;
    this.dragStartPos = point;
    this.draggedNode = node;
    
    // Store start dimensions
    this.nodeStartDimensions.set(node.id, {
      width: node.width,
      height: node.height
    });
  }

  private handleNodeDrag(currentPoint: Point) {
    if (!this.dragStartPos || !this.draggedNode) return;

    const dx = currentPoint.x - this.dragStartPos.x;
    const dy = currentPoint.y - this.dragStartPos.y;

    // Determine which nodes to move
    const nodesToMove = this.selectedNodes.find(n => n.id === this.draggedNode!.id)
      ? this.selectedNodes  // Move all selected nodes if dragging a selected node
      : [this.draggedNode]; // Move only the dragged node if it's not selected

    // Move all relevant nodes
    nodesToMove.forEach(node => {
      const startPos = this.nodeStartPositions.get(node.id);
      if (startPos) {
        let newX = startPos.x + dx;
        let newY = startPos.y + dy;

        if (this.viewState.snapToGrid) {
          const snapped = this.snapToGrid({ x: newX, y: newY });
          newX = snapped.x;
          newY = snapped.y;
        }

        node.position.x = newX;
        node.position.y = newY;
        this.events.emit('nodeMoved', node);
      }
    });
    
    this.render();
  }

  private handleNodeResize(currentPoint: Point) {
    if (!this.dragStartPos || !this.draggedNode) return;

    const startDimensions = this.nodeStartDimensions.get(this.draggedNode.id);
    if (!startDimensions) return;

    const dx = currentPoint.x - this.dragStartPos.x;
    const dy = currentPoint.y - this.dragStartPos.y;

    let newWidth = startDimensions.width;
    let newHeight = startDimensions.height;
    let newX = this.draggedNode.position.x;
    let newY = this.draggedNode.position.y;

    const minWidth = this.draggedNode.minWidth || 100;
    const minHeight = this.draggedNode.minHeight || 100;

    switch (this.resizeHandle) {
      case 'resize-e':
        newWidth = Math.max(minWidth, startDimensions.width + dx);
        break;
      case 'resize-w':
        const deltaW = Math.min(dx, startDimensions.width - minWidth);
        newWidth = Math.max(minWidth, startDimensions.width - deltaW);
        newX = this.draggedNode.position.x + deltaW;
        break;
      case 'resize-s':
        newHeight = Math.max(minHeight, startDimensions.height + dy);
        break;
      case 'resize-n':
        const deltaH = Math.min(dy, startDimensions.height - minHeight);
        newHeight = Math.max(minHeight, startDimensions.height - deltaH);
        newY = this.draggedNode.position.y + deltaH;
        break;
      case 'resize-se':
        newWidth = Math.max(minWidth, startDimensions.width + dx);
        newHeight = Math.max(minHeight, startDimensions.height + dy);
        break;
      case 'resize-sw':
        newHeight = Math.max(minHeight, startDimensions.height + dy);
        const deltaSW = Math.min(dx, startDimensions.width - minWidth);
        newWidth = Math.max(minWidth, startDimensions.width - deltaSW);
        newX = this.draggedNode.position.x + deltaSW;
        break;
      case 'resize-ne':
        newWidth = Math.max(minWidth, startDimensions.width + dx);
        const deltaNE = Math.min(dy, startDimensions.height - minHeight);
        newHeight = Math.max(minHeight, startDimensions.height - deltaNE);
        newY = this.draggedNode.position.y + deltaNE;
        break;
      case 'resize-nw':
        const deltaNW_W = Math.min(dx, startDimensions.width - minWidth);
        const deltaNW_H = Math.min(dy, startDimensions.height - minHeight);
        newWidth = Math.max(minWidth, startDimensions.width - deltaNW_W);
        newHeight = Math.max(minHeight, startDimensions.height - deltaNW_H);
        newX = this.draggedNode.position.x + deltaNW_W;
        newY = this.draggedNode.position.y + deltaNW_H;
        break;
    }

    if (this.viewState.snapToGrid) {
      const snapped = this.snapToGrid({ x: newX, y: newY });
      newX = snapped.x;
      newY = snapped.y;
      newWidth = Math.round(newWidth / this.viewState.gridSize) * this.viewState.gridSize;
      newHeight = Math.round(newHeight / this.viewState.gridSize) * this.viewState.gridSize;
    }

    this.draggedNode.position.x = newX;
    this.draggedNode.position.y = newY;
    this.draggedNode.width = newWidth;
    this.draggedNode.height = newHeight;

    this.events.emit('nodeResized', this.draggedNode);
    this.render();
  }

  private updateCursor(point: Point) {
    const nodeAndRegion = this.findNodeAndRegionAtPoint(point);
    
    if (nodeAndRegion) {
      const { region } = nodeAndRegion;
      switch (region) {
        case 'header':
          this.canvas.style.cursor = 'move';
          break;
        case 'resize-e':
        case 'resize-w':
          this.canvas.style.cursor = 'ew-resize';
          break;
        case 'resize-n':
        case 'resize-s':
          this.canvas.style.cursor = 'ns-resize';
          break;
        case 'resize-nw':
        case 'resize-se':
          this.canvas.style.cursor = 'nwse-resize';
          break;
        case 'resize-ne':
        case 'resize-sw':
          this.canvas.style.cursor = 'nesw-resize';
          break;
        default:
          this.canvas.style.cursor = 'default';
      }
    } else {
      this.canvas.style.cursor = 'default';
    }
  }

  private showContextMenu(x: number, y: number) {
    this.hideContextMenu();
    this.contextMenu = document.createElement('div');
    this.contextMenu.className = 'context-menu';
    this.contextMenu.innerHTML = `
      <div class="context-menu-item" data-action="add-node">
        <i class="ph ph-plus"></i> Add Node
      </div>
    `;

    document.body.appendChild(this.contextMenu);
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;

    const addNodeItem = this.contextMenu.querySelector('[data-action="add-node"]');
    if (addNodeItem) {
      addNodeItem.addEventListener('click', () => {
        this.hideContextMenu();
        this.showQuickAddSearch(x, y);
      });
    }
  }

  private hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
  }

  private showQuickAddSearch(x: number, y: number) {
    this.hideQuickAddSearch();
    const point = this.getCanvasPoint({ clientX: x, clientY: y } as MouseEvent);
    
    this.searchBar = document.createElement('div');
    this.searchBar.className = 'quick-add-search';
    this.searchBar.innerHTML = `
      <input type="text" placeholder="Search nodes..." class="quick-add-input">
      <div class="quick-add-results"></div>
    `;

    document.body.appendChild(this.searchBar);
    this.searchBar.style.left = `${x}px`;
    this.searchBar.style.top = `${y}px`;

    const input = this.searchBar.querySelector('input');
    if (input) {
      input.focus();
      input.addEventListener('input', (e) => {
        const searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
        this.events.emit('quickAddSearch', searchTerm, point);
      });
    }
  }

  private hideQuickAddSearch() {
    if (this.searchBar) {
      this.searchBar.remove();
      this.searchBar = null;
    }
  }

  private isPanning: boolean = false;
  private lastPanPoint: Point | null = null;

  private startPanning(e: MouseEvent) {
    if (e.button === 0) {
      this.isPanning = true;
      this.lastPanPoint = { x: e.clientX, y: e.clientY };
    }
  }

  private handlePanning(e: MouseEvent) {
    if (this.isPanning && this.lastPanPoint) {
      const dx = e.clientX - this.lastPanPoint.x;
      const dy = e.clientY - this.lastPanPoint.y;
      this.pan(dx, dy);
      this.lastPanPoint = { x: e.clientX, y: e.clientY };
    }
  }

  private stopPanning() {
    this.isPanning = false;
    this.lastPanPoint = null;
  }

  private getCanvasPoint(e: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - this.viewState.offset.x) / this.viewState.scale,
      y: (e.clientY - rect.top - this.viewState.offset.y) / this.viewState.scale
    };
  }

  public setNodes(nodes: Node[]) {
    this.nodes = nodes;
    this.render();
  }

  public setSelectedNodes(nodes: Node[]) {
    this.selectedNodes = nodes;
    this.render();
  }

  private findNodeAndRegionAtPoint(point: Point): { node: Node; region: string } | null {
    const resizeHandleSize = 8;
    
    // Iterate through nodes in reverse to check top-most nodes first
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i];
      const headerHeight = 30;
      
      // Check if point is within node bounds
      if (
        point.x >= node.position.x &&
        point.x <= node.position.x + node.width &&
        point.y >= node.position.y &&
        point.y <= node.position.y + node.height
      ) {
        // Check resize handles first
        const isNearTop = Math.abs(point.y - node.position.y) <= resizeHandleSize;
        const isNearBottom = Math.abs(point.y - (node.position.y + node.height)) <= resizeHandleSize;
        const isNearLeft = Math.abs(point.x - node.position.x) <= resizeHandleSize;
        const isNearRight = Math.abs(point.x - (node.position.x + node.width)) <= resizeHandleSize;

        if (isNearTop && isNearLeft) return { node, region: 'resize-nw' };
        if (isNearTop && isNearRight) return { node, region: 'resize-ne' };
        if (isNearBottom && isNearLeft) return { node, region: 'resize-sw' };
        if (isNearBottom && isNearRight) return { node, region: 'resize-se' };
        if (isNearTop) return { node, region: 'resize-n' };
        if (isNearBottom) return { node, region: 'resize-s' };
        if (isNearLeft) return { node, region: 'resize-w' };
        if (isNearRight) return { node, region: 'resize-e' };

        // Then check header
        if (point.y <= node.position.y + headerHeight) {
          return { node, region: 'header' };
        }

        // Finally, body
        return { node, region: 'body' };
      }
    }
    return null;
  }

  private resize() {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.render();
  }

  private pan(dx: number, dy: number) {
    this.viewState.offset.x += dx;
    this.viewState.offset.y += dy;
    this.render();
  }

  public zoom(delta: number, center: Point) {
    const newScale = Math.max(0.25, Math.min(4, this.viewState.scale + delta));
    
    if (newScale !== this.viewState.scale) {
      const factor = newScale / this.viewState.scale;
      const dx = center.x - this.viewState.offset.x;
      const dy = center.y - this.viewState.offset.y;
      
      this.viewState.offset.x = center.x - dx * factor;
      this.viewState.offset.y = center.y - dy * factor;
      this.viewState.scale = newScale;
      
      this.render();
    }
  }

  public resetView() {
    this.viewState.scale = 1;
    this.viewState.offset = { x: 0, y: 0 };
    this.render();
  }

  public zoomToFit(bounds: { minX: number; minY: number; maxX: number; maxY: number }) {
    const padding = 40;
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    
    if (width === 0 || height === 0) return;

    const scaleX = (this.canvas.width - padding * 2) / width;
    const scaleY = (this.canvas.height - padding * 2) / height;
    const scale = Math.min(scaleX, scaleY, 4);

    this.viewState.scale = scale;
    this.viewState.offset.x = -bounds.minX * scale + padding;
    this.viewState.offset.y = -bounds.minY * scale + padding;

    this.render();
  }

  public render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.viewState.showGrid) {
      this.drawGrid();
    }
    this.events.emit('render', this.ctx, this.viewState);
  }

  private drawGrid() {
    const { scale, offset, gridSize } = this.viewState;
    const scaledGridSize = gridSize * scale;
    const majorGridSize = gridSize * 5 * scale;

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.lineWidth = 1;

    // Draw minor grid lines
    for (let x = offset.x % scaledGridSize; x < this.canvas.width; x += scaledGridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    for (let y = offset.y % scaledGridSize; y < this.canvas.height; y += scaledGridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }

    // Draw major grid lines
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    for (let x = offset.x % majorGridSize; x < this.canvas.width; x += majorGridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    for (let y = offset.y % majorGridSize; y < this.canvas.height; y += majorGridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  public snapToGrid(point: Point): Point {
    if (!this.viewState.snapToGrid) return point;
    
    const { gridSize } = this.viewState;
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize
    };
  }

  public toggleGrid(show?: boolean) {
    this.viewState.showGrid = show ?? !this.viewState.showGrid;
    this.render();
  }

  public toggleSnap(enable?: boolean) {
    this.viewState.snapToGrid = enable ?? !this.viewState.snapToGrid;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  public getViewState(): ViewState {
    return this.viewState;
  }

  public on(event: string, callback: (...args: any[]) => void) {
    this.events.on(event, callback);
  }
}