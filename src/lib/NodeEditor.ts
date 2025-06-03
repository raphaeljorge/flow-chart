import { Canvas } from '../core/Canvas';
import { NodeManager } from '../core/NodeManager';
import { NodePalette } from '../core/NodePalette';
import { ConfigPanel } from '../core/ConfigPanel';
import { StickyNoteManager } from '../core/StickyNoteManager';
import { NodeEditorOptions, Node, Point } from '../core/Types';

export class NodeEditor {
  private canvas: Canvas;
  private nodeManager: NodeManager;
  private nodePalette: NodePalette | null = null;
  private configPanel: ConfigPanel;
  private stickyNoteManager: StickyNoteManager;
  private container: HTMLElement;
  private options: NodeEditorOptions;
  private tooltipElement: HTMLElement | null = null;

  constructor(container: HTMLElement, options: Partial<NodeEditorOptions> = {}) {
    this.container = container;
    this.options = {
      showPalette: true,
      showToolbar: true,
      defaultScale: 1,
      gridSize: 20,
      showGrid: true,
      snapToGrid: false,
      ...options
    };

    this.initialize();
  }

  private initialize() {
    // Create container structure
    this.container.innerHTML = `
      ${this.options.showPalette ? '<div class="node-palette"></div>' : ''}
      <div class="canvas-container"></div>
      ${this.options.showToolbar ? `
        <div class="floating-menu">
          <button class="menu-button active" id="toggle-grid" title="Toggle Grid">
            <i class="ph ph-grid-four"></i>
          </button>
          <button class="menu-button" id="toggle-snap" title="Toggle Snap to Grid">
            <i class="ph ph-magnet"></i>
          </button>
          <div class="menu-separator"></div>
          <button class="menu-button" id="zoom-to-fit" title="Zoom to Fit">
            <i class="ph ph-arrows-out"></i>
          </button>
          <button class="menu-button" id="reset-view" title="Reset View">
            <i class="ph ph-arrows-in"></i>
          </button>
        </div>
      ` : ''}
      <div id="selection-box" class="selection-box"></div>
      <div class="tooltip" style="display: none;"></div>
      <div class="config-panel-container"></div>
    `;

    // Initialize core components
    this.canvas = new Canvas(this.container.querySelector('.canvas-container')!);
    this.nodeManager = new NodeManager();
    this.stickyNoteManager = new StickyNoteManager();
    this.tooltipElement = this.container.querySelector('.tooltip');
    this.configPanel = new ConfigPanel(this.container.querySelector('.config-panel-container')!);

    // Connect Canvas and NodeManager
    this.nodeManager.on('nodesUpdated', (nodes) => {
      this.canvas.setNodes(nodes);
    });

    // Handle node selection events
    this.canvas.on('nodeSelect', (node) => {
      this.nodeManager.deselectAll();
      this.nodeManager.selectNode(node.id);
      this.stickyNoteManager.selectNote(null);
      this.configPanel.show(node);
    });

    this.canvas.on('nodeMultiSelect', (node) => {
      this.nodeManager.selectNode(node.id, true);
    });

    this.canvas.on('clearSelection', () => {
      this.nodeManager.deselectAll();
      this.stickyNoteManager.selectNote(null);
      this.configPanel.hide();
    });

    // Update Canvas with selected nodes
    this.nodeManager.on('selectionChanged', (selectedNodeIds) => {
      const selectedNodes = selectedNodeIds.map(id => this.nodeManager.getNodes().find(n => n.id === id)).filter(Boolean);
      this.canvas.setSelectedNodes(selectedNodes);
    });

    // Handle config panel events
    this.configPanel.on('configChanged', (node: Node) => {
      this.canvas.render();
    });

    this.configPanel.on('configSaved', (node: Node) => {
      this.canvas.render();
    });

    // Set up node rendering
    this.canvas.on('render', (ctx: CanvasRenderingContext2D, viewState: any) => {
      // Render nodes
      for (const node of this.nodeManager.getNodes()) {
        this.renderNode(ctx, node, viewState);
      }

      // Render sticky notes
      for (const note of this.stickyNoteManager.getNotes()) {
        this.renderStickyNote(ctx, note, viewState);
      }
    });

    // Initialize palette if enabled
    if (this.options.showPalette) {
      const paletteContainer = this.container.querySelector('.node-palette')!;
      this.nodePalette = new NodePalette(paletteContainer, this.nodeManager, this.canvas);
      this.nodePalette.initialize();
    }

    // Initialize toolbar if enabled
    if (this.options.showToolbar) {
      this.initializeToolbar();
    }

    // Initialize keyboard shortcuts
    this.initializeKeyboardShortcuts();

    // Setup tooltip handling
    this.setupTooltipHandling();

    // Setup sticky note interaction
    this.setupStickyNoteInteraction();

    // Initial render
    this.canvas.render();
  }

  private setupStickyNoteInteraction() {
    const canvas = this.canvas.getCanvas();
    let lastClickTime = 0;

    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const viewState = this.canvas.getViewState();
      const point = {
        x: (e.clientX - rect.left - viewState.offset.x) / viewState.scale,
        y: (e.clientY - rect.top - viewState.offset.y) / viewState.scale
      };

      const noteAndRegion = this.stickyNoteManager.findNoteAtPoint(point);
      
      if (noteAndRegion) {
        const { note, region } = noteAndRegion;
        
        // Handle selection
        this.nodeManager.deselectAll();
        this.stickyNoteManager.selectNote(note.id);

        // Handle dragging or resizing
        if (region === 'body') {
          this.stickyNoteManager.startDrag(note.id, point);
        } else if (region !== 'toolbar') {
          this.stickyNoteManager.startResize(note.id, point, region);
        }
      } else {
        const now = Date.now();
        if (now - lastClickTime < 300) {
          // Double click - create new sticky note
          const note = this.stickyNoteManager.createNote(point);
          this.stickyNoteManager.selectNote(note.id);
        }
        lastClickTime = now;
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const viewState = this.canvas.getViewState();
      const point = {
        x: (e.clientX - rect.left - viewState.offset.x) / viewState.scale,
        y: (e.clientY - rect.top - viewState.offset.y) / viewState.scale
      };

      const noteAndRegion = this.stickyNoteManager.findNoteAtPoint(point);
      
      // Update cursor based on region
      if (noteAndRegion) {
        const { region } = noteAndRegion;
        switch (region) {
          case 'body':
            canvas.style.cursor = 'move';
            break;
          case 'e':
          case 'w':
            canvas.style.cursor = 'ew-resize';
            break;
          case 'n':
          case 's':
            canvas.style.cursor = 'ns-resize';
            break;
          case 'nw':
          case 'se':
            canvas.style.cursor = 'nwse-resize';
            break;
          case 'ne':
          case 'sw':
            canvas.style.cursor = 'nesw-resize';
            break;
          default:
            canvas.style.cursor = 'default';
        }
      } else {
        canvas.style.cursor = 'default';
      }

      this.stickyNoteManager.handleDrag(point);
      this.stickyNoteManager.handleResize(point);
      this.canvas.render();
    });

    canvas.addEventListener('mouseup', () => {
      this.stickyNoteManager.stopDragAndResize();
      canvas.style.cursor = 'default';
    });

    // Handle sticky note updates
    this.stickyNoteManager.on('notesUpdated', () => {
      this.canvas.render();
    });
  }

  private renderStickyNote(ctx: CanvasRenderingContext2D, note: any, viewState: any) {
    const x = note.position.x * viewState.scale + viewState.offset.x;
    const y = note.position.y * viewState.scale + viewState.offset.y;
    const width = note.width * viewState.scale;
    const height = note.height * viewState.scale;
    
    // Draw note background
    ctx.fillStyle = note.style.backgroundColor;
    ctx.strokeStyle = this.stickyNoteManager.getSelectedNote()?.id === note.id ? '#6366f1' : '#3a3a3a';
    ctx.lineWidth = this.stickyNoteManager.getSelectedNote()?.id === note.id ? 2 : 1;
    
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 8);
    ctx.fill();
    ctx.stroke();

    // Draw note content
    ctx.fillStyle = note.style.textColor;
    ctx.font = `${note.style.fontSize * viewState.scale}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    
    const padding = 12 * viewState.scale;
    const lines = note.content.split('\n');
    const lineHeight = note.style.fontSize * 1.2 * viewState.scale;
    
    lines.forEach((line: string, index: number) => {
      ctx.fillText(
        line,
        x + padding,
        y + padding + (index + 1) * lineHeight
      );
    });

    // Draw resize handles if selected
    if (this.stickyNoteManager.getSelectedNote()?.id === note.id) {
      const handleSize = 8;
      const handles = [
        { x: x, y: y, cursor: 'nw-resize' },
        { x: x + width/2, y: y, cursor: 'n-resize' },
        { x: x + width, y: y, cursor: 'ne-resize' },
        { x: x, y: y + height/2, cursor: 'w-resize' },
        { x: x + width, y: y + height/2, cursor: 'e-resize' },
        { x: x, y: y + height, cursor: 'sw-resize' },
        { x: x + width/2, y: y + height, cursor: 's-resize' },
        { x: x + width, y: y + height, cursor: 'se-resize' }
      ];

      handles.forEach(handle => {
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.arc(handle.x, handle.y, handleSize/2, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  private renderNode(ctx: CanvasRenderingContext2D, node: Node, viewState: any) {
    const x = node.position.x * viewState.scale + viewState.offset.x;
    const y = node.position.y * viewState.scale + viewState.offset.y;
    const width = node.width * viewState.scale;
    const height = node.height * viewState.scale;
    const headerHeight = 40 * viewState.scale;
    
    // Draw main node body
    ctx.fillStyle = '#1a1a1a';
    ctx.strokeStyle = this.nodeManager.isSelected(node.id) ? '#6366f1' : '#2a2a2a';
    ctx.lineWidth = this.nodeManager.isSelected(node.id) ? 2 : 1;
    
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 8);
    ctx.fill();
    ctx.stroke();
    
    // Draw header
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.roundRect(x, y, width, headerHeight, { tl: 8, tr: 8, bl: 0, br: 0 });
    ctx.fill();

    // Draw icon
    if (node.icon) {
      ctx.fillStyle = '#4a4a4a';
      const iconX = x + 8 * viewState.scale;
      const iconY = y + 8 * viewState.scale;
      const iconSize = 24 * viewState.scale;
      
      ctx.beginPath();
      ctx.roundRect(iconX, iconY, iconSize, iconSize, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `${16 * viewState.scale}px Phosphor`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const iconContent = this.getPhosphorIconContent(node.icon);
      ctx.fillText(iconContent, iconX + iconSize/2, iconY + iconSize/2);
    }

    // Draw title
    ctx.fillStyle = '#ffffff';
    ctx.font = `${12 * viewState.scale}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(node.title, x + (node.icon ? 40 : 12) * viewState.scale, y + 24 * viewState.scale);

    // Draw status indicator
    if (node.status) {
      const statusColors = {
        success: '#22c55e',
        error: '#ef4444',
        running: '#3b82f6',
        warning: '#f59e0b',
        unsaved: '#8b5cf6'
      };
      
      const statusX = x + width - 20 * viewState.scale;
      const statusY = y + 20 * viewState.scale;
      const statusSize = 8 * viewState.scale;
      
      ctx.fillStyle = statusColors[node.status];
      ctx.beginPath();
      ctx.arc(statusX, statusY, statusSize/2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw node ID
    ctx.fillStyle = '#666666';
    ctx.font = `${10 * viewState.scale}px Inter, sans-serif`;
    ctx.fillText(`#${node.id.slice(0, 8)}`, x + 12 * viewState.scale, y + height - 12 * viewState.scale);
    
    // Draw ports
    const portSize = 12 * viewState.scale;
    const portSpacing = 24 * viewState.scale;
    
    // Input ports
    node.inputs.forEach((port, index) => {
      const portX = x;
      const portY = y + headerHeight + portSpacing * (index + 1);
      
      // Port circle
      ctx.fillStyle = '#2a2a2a';
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(portX, portY, portSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Port label
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.font = `${11 * viewState.scale}px Inter, sans-serif`;
      ctx.fillText(port.name, portX + portSize, portY + 4);
    });
    
    // Output ports
    node.outputs.forEach((port, index) => {
      const portX = x + width;
      const portY = y + headerHeight + portSpacing * (index + 1);
      
      // Port circle
      ctx.fillStyle = '#2a2a2a';
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(portX, portY, portSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Port label
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.font = `${11 * viewState.scale}px Inter, sans-serif`;
      ctx.fillText(port.name, portX - portSize, portY + 4);
    });
  }

  private getPhosphorIconContent(iconClass: string): string {
    const iconMap: { [key: string]: string } = {
      'ph-globe': '\uf33d',
      'ph-clock': '\uf24b',
      'ph-arrows-in-line-horizontal': '\uf13c',
      'ph-envelope': '\uf2e7',
      'ph-git-fork': '\uf334',
      'ph-repeat': '\uf47b',
      'ph-database': '\uf282',
      'ph-plugs': '\uf44d',
      'ph-file-js': '\uf2f7',
      'ph-file-py': '\uf2fc'
    };

    const iconName = iconClass.replace('ph-', '');
    return iconMap[`ph-${iconName}`] || '';
  }

  private setupTooltipHandling() {
    if (!this.tooltipElement) return;

    const canvas = this.canvas.getCanvas();
    let tooltipTimeout: number;

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const viewState = this.canvas.getViewState();
      const point = {
        x: (e.clientX - rect.left - viewState.offset.x) / viewState.scale,
        y: (e.clientY - rect.top - viewState.offset.y) / viewState.scale
      };

      clearTimeout(tooltipTimeout);

      const nodeAndRegion = this.canvas.findNodeAndRegionAtPoint(point);
      if (nodeAndRegion) {
        const { node, region } = nodeAndRegion;
        
        tooltipTimeout = window.setTimeout(() => {
          this.showTooltip(e.clientX, e.clientY, node);
        }, 500);
      } else {
        this.hideTooltip();
      }
    });

    canvas.addEventListener('mouseleave', () => {
      clearTimeout(tooltipTimeout);
      this.hideTooltip();
    });
  }

  private showTooltip(x: number, y: number, node: Node) {
    if (!this.tooltipElement) return;

    const tooltipContent = `
      <div class="tooltip-title">${node.title}</div>
      <div class="tooltip-type">${node.type || 'Unknown Type'}</div>
      ${node.description ? `<div class="tooltip-description">${node.description}</div>` : ''}
      <div class="tooltip-id">ID: ${node.id}</div>
    `;

    this.tooltipElement.innerHTML = tooltipContent;
    this.tooltipElement.style.display = 'block';
    this.tooltipElement.style.left = `${x + 10}px`;
    this.tooltipElement.style.top = `${y + 10}px`;
  }

  private hideTooltip() {
    if (this.tooltipElement) {
      this.tooltipElement.style.display = 'none';
    }
  }

  private initializeToolbar() {
    const gridButton = this.container.querySelector('#toggle-grid') as HTMLButtonElement;
    const snapButton = this.container.querySelector('#toggle-snap') as HTMLButtonElement;
    const zoomToFitButton = this.container.querySelector('#zoom-to-fit') as HTMLButtonElement;
    const resetViewButton = this.container.querySelector('#reset-view') as HTMLButtonElement;

    gridButton?.addEventListener('click', () => {
      gridButton.classList.toggle('active');
      this.canvas.toggleGrid();
    });

    snapButton?.addEventListener('click', () => {
      snapButton.classList.toggle('active');
      this.canvas.toggleSnap();
    });

    zoomToFitButton?.addEventListener('click', () => {
      const nodes = this.nodeManager.getNodes();
      if (nodes.length === 0) return;

      const bounds = nodes.reduce((acc, node) => ({
        minX: Math.min(acc.minX, node.position.x),
        minY: Math.min(acc.minY, node.position.y),
        maxX: Math.max(acc.maxX, node.position.x + node.width),
        maxY: Math.max(acc.maxY, node.position.y + node.height)
      }), {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
      });

      this.canvas.zoomToFit(bounds);
    });

    resetViewButton?.addEventListener('click', () => {
      this.canvas.resetView();
    });
  }

  private initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        this.nodeManager.copySelectedNodes();
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        this.nodeManager.pasteNodes();
        this.canvas.render();
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        this.nodeManager.deleteSelectedNodes();
        this.canvas.render();
      }

      if (e.key === 'r' || e.key === 'R') {
        this.canvas.resetView();
      }
    });
  }

  public getCanvas(): Canvas {
    return this.canvas;
  }

  public getNodeManager(): NodeManager {
    return this.nodeManager;
  }

  public getNodePalette(): NodePalette | null {
    return this.nodePalette;
  }
}