// src/editor/NodeEditor.ts
import { EventEmitter } from 'eventemitter3';
import { 
    NodeEditorOptions, Node, Point, NodeDefinition, 
    CanvasPointerEvent, Rect, ViewState, StickyNote, 
    Connection, NodePort, InteractiveElementType, ConfigurableItem, ConfigurableItemType,
    NodeDataVariableParseEvent
} from '../core/Types';
import { ALL_NODE_DEFINITIONS } from './NodeDefinitions';
import { CanvasEngine } from '../core/CanvasEngine';
import { NodeManager } from '../core/NodeManager';
import { StickyNoteManager } from '../core/StickyNoteManager';
import { SelectionManager } from '../core/SelectionManager';
import { InteractionManager } from '../core/InteractionManager';
import { RenderService } from '../core/RenderService';
import { ClipboardManager } from '../core/ClipboardManager';
import { ShortcutManager } from '../core/ShortcutManager';
import { IconService } from './IconService';
import { NodePalette } from '../ui/NodePalette';
import { ConfigPanel } from '../ui/ConfigPanel';
import { Toolbar } from '../ui/Toolbar';
import { ContextMenu, ContextMenuItemAction, ContextMenuContext } from '../ui/ContextMenu';
import { QuickAddMenu } from '../ui/QuickAddMenu';
import { Tooltip, TooltipContent } from '../ui/Tooltip';

export class NodeEditor {
  private container: HTMLElement;
  private options: NodeEditorOptions;
  private events: EventEmitter;

  private canvasEngine: CanvasEngine;
  private nodeManager: NodeManager;
  private stickyNoteManager: StickyNoteManager;
  private selectionManager: SelectionManager;
  private interactionManager: InteractionManager;
  private renderService: RenderService;
  private clipboardManager: ClipboardManager;
  private shortcutManager: ShortcutManager;
  private iconService: IconService;

  private nodePalette: NodePalette | null = null;
  private configPanel: ConfigPanel | null = null;
  private toolbar: Toolbar | null = null;
  private contextMenu: ContextMenu | null = null;
  private quickAddMenu: QuickAddMenu | null = null;
  private tooltip: Tooltip | null = null;
  
  private paletteContainer: HTMLElement | null = null;
  private canvasContainer: HTMLElement | null = null;
  private configPanelContainer: HTMLElement | null = null;
  private toolbarContainer: HTMLElement | null = null;
  private overlayContainer: HTMLElement | null = null; 

  constructor(container: HTMLElement, options: Partial<NodeEditorOptions> = {}) {
    this.container = container;
    this.options = {
      showPalette: true, showToolbar: true, defaultScale: 1, gridSize: 20,
      showGrid: true, snapToGrid: false, nodeDefinitions: ALL_NODE_DEFINITIONS, ...options,
    };
    this.events = new EventEmitter();
    this.validateContainer(); this.setupDOMStructure();
    this.iconService = new IconService();
    this.canvasEngine = new CanvasEngine(this.canvasContainer!, {
        scale: this.options.defaultScale, gridSize: this.options.gridSize,
        showGrid: this.options.showGrid, snapToGrid: this.options.snapToGrid,
    });
    this.nodeManager = new NodeManager();
    this.stickyNoteManager = new StickyNoteManager();
    this.selectionManager = new SelectionManager();
    this.clipboardManager = new ClipboardManager();
    this.interactionManager = new InteractionManager(this.canvasEngine, this.nodeManager, this.stickyNoteManager, this.selectionManager);
    this.renderService = new RenderService(this.canvasEngine, this.nodeManager, this.stickyNoteManager, this.selectionManager, this.interactionManager);
    this.shortcutManager = new ShortcutManager(this.container);
    if (this.options.showPalette && this.paletteContainer) this.nodePalette = new NodePalette(this.paletteContainer, { nodeDefinitions: this.options.nodeDefinitions || [] }, this.iconService);    if (this.configPanelContainer) this.configPanel = new ConfigPanel(this.configPanelContainer, this.selectionManager, this.nodeManager, this.stickyNoteManager);
    if (this.options.showToolbar && this.toolbarContainer) { this.toolbar = new Toolbar(this.toolbarContainer); this.initializeToolbarButtons(); }
    if (this.overlayContainer) {
        this.contextMenu = new ContextMenu(this.overlayContainer);
        this.quickAddMenu = new QuickAddMenu(this.overlayContainer, { nodeDefinitions: this.options.nodeDefinitions || [] });
        this.tooltip = new Tooltip(this.overlayContainer);
    }
    this.wireUpEvents(); this.canvasEngine.requestRender();
    console.log('NodeEditor initialized.');
  }

  private validateContainer(): void { if (!this.container) throw new Error('NodeEditor: Container not found.'); }
  private setupDOMStructure(): void {
    this.container.innerHTML = ''; this.container.style.display = 'flex'; this.container.style.width = '100%';
    this.container.style.height = '100%'; this.container.style.position = 'relative';
    if (this.options.showPalette) { this.paletteContainer = document.createElement('div'); this.paletteContainer.className = 'node-palette'; this.container.appendChild(this.paletteContainer); }
    this.canvasContainer = document.createElement('div'); this.canvasContainer.className = 'canvas-container';
    this.canvasContainer.style.flexGrow = '1'; this.canvasContainer.style.position = 'relative'; this.container.appendChild(this.canvasContainer);
    this.configPanelContainer = document.createElement('div'); this.configPanelContainer.className = 'config-panel-wrapper'; this.container.appendChild(this.configPanelContainer); 
    if (this.options.showToolbar && this.canvasContainer) {
        this.toolbarContainer = document.createElement('div'); this.toolbarContainer.className = 'toolbar-wrapper';
        this.toolbarContainer.style.position = 'absolute'; this.toolbarContainer.style.top = '20px'; this.toolbarContainer.style.left = '20px';
        this.toolbarContainer.style.zIndex = '900'; this.canvasContainer.appendChild(this.toolbarContainer);
    }
    this.overlayContainer = document.createElement('div'); this.overlayContainer.className = 'editor-overlay-container';
    Object.assign(this.overlayContainer.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '1000'});
    this.container.appendChild(this.overlayContainer);
  }
  private initializeToolbarButtons(): void {
    if (!this.toolbar) return;
    this.toolbar.addButton({ id: 'toggle-grid', title: 'Toggle Grid (G)', iconClass: 'ph-grid-four', isToggle: true, action: () => this.canvasEngine.setViewState({ showGrid: !this.canvasEngine.getViewState().showGrid }), isActive: () => this.canvasEngine.getViewState().showGrid });
    this.toolbar.addButton({ id: 'toggle-snap', title: 'Toggle Snap (S)', iconClass: 'ph-magnet', isToggle: true, action: () => this.canvasEngine.setViewState({ snapToGrid: !this.canvasEngine.getViewState().snapToGrid }), isActive: () => this.canvasEngine.getViewState().snapToGrid });
    this.toolbar.addSeparator();
    this.toolbar.addButton({ id: 'zoom-to-fit', title: 'Zoom to Fit (F)', iconClass: 'ph-arrows-out', action: () => this.zoomToFitContent() });
    this.toolbar.addButton({ id: 'reset-view', title: 'Reset View (R)', iconClass: 'ph-arrows-in', action: () => this.canvasEngine.resetView() });
    this.canvasEngine.on('viewchanged', (vs: ViewState) => { this.toolbar?.updateButtonActiveState('toggle-grid', vs.showGrid); this.toolbar?.updateButtonActiveState('toggle-snap', vs.snapToGrid); });
  }

  private wireUpEvents(): void {
    this.shortcutManager.on('copy', this.handleCopyShortcut);
    this.shortcutManager.on('paste', this.handlePasteShortcut);
    this.shortcutManager.on('delete', this.handleDeleteShortcut);
    this.shortcutManager.on('resetView', () => this.canvasEngine.resetView());
    this.shortcutManager.on('toggleGrid', () => this.canvasEngine.setViewState({ showGrid: !this.canvasEngine.getViewState().showGrid }));
    this.shortcutManager.on('toggleSnapToGrid', () => this.canvasEngine.setViewState({ snapToGrid: !this.canvasEngine.getViewState().snapToGrid }));
    this.shortcutManager.on('zoomToFit', () => this.zoomToFitContent());

    const canvasEl = this.canvasEngine.getCanvasElement();
    canvasEl.addEventListener('dragover', (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';});
    canvasEl.addEventListener('drop', this.handleCanvasDrop);
    
    this.interactionManager.on('canvasContextMenu', this.handleCanvasContextMenu);
    this.interactionManager.on('canvasDoubleClick', this.handleCanvasDoubleClickForQuickAdd);
    this.interactionManager.on('connectionCompleted', (conn: Connection) => { this.events.emit('connectionCreated', conn); });
    this.interactionManager.on('connectionFailed', (data: any) => { this.events.emit('connectionFailed', data); });
    this.interactionManager.on('reconnectionStart', (pendingConn: PendingConnectionState) => this.events.emit('reconnectionStart', pendingConn));
    this.interactionManager.on('connectionRecompleted', (newConn: Connection, oldConn: Connection) => this.events.emit('connectionRecompleted', newConn, oldConn));
    this.interactionManager.on('reconnectionFailed', (originalConn: Connection) => this.events.emit('reconnectionFailed', originalConn));


    this.canvasEngine.on('pointermove', this.handleTooltipPointerMove);
    this.canvasEngine.on('pointerleave', () => this.tooltip?.hide());

    this.contextMenu?.on('itemClicked', this.handleContextMenuItemClicked);
    this.quickAddMenu?.on('itemSelected', this.handleQuickAddItemChosen);

    this.configPanel?.on('configApplied', (item: ConfigurableItem) => { 
        this.canvasEngine.requestRender(); 
        this.events.emit('itemConfigApplied', item);
        // Se o título de um nó ou o label de uma conexão mudar, o painel de config precisa ser atualizado
        // Adicionalmente, se for um nó e as portas dinâmicas mudaram, o painel precisa ser re-renderizado
        if (item && item.hasOwnProperty('fixedInputs')) { // É um nó
            this.configPanel?.show(item, 'node'); // Força re-render do painel de config para atualizar portas dinâmicas
        } else if (item && ((item as Node).title || (item as Connection).data?.label)) {
            this.configPanel?.show(item, item.hasOwnProperty('sourcePortId') ? 'connection' : (item.hasOwnProperty('content') ? 'stickyNote' : 'node') );
        }
    });
    this.configPanel?.on('testNode', (node: Node) => { this.events.emit('testNodeRequested', node); });
    // NOVO: Listener para o evento de mudança de dados com variáveis
    this.configPanel?.on('nodeDataChangedWithVariables', (event: NodeDataVariableParseEvent) => {
        this.nodeManager.updateNodeDataAndParseVariables(event.nodeId, event.newData, event.oldData);
    });
    
    this.nodeManager.on('nodesUpdated', () => this.canvasEngine.requestRender());
    this.nodeManager.on('connectionsUpdated', () => this.canvasEngine.requestRender());
    this.stickyNoteManager.on('notesUpdated', () => this.canvasEngine.requestRender());
  }
  
  private handleCanvasDrop = (e: DragEvent): void => {
      e.preventDefault(); if (!e.dataTransfer) return;
      const defId = e.dataTransfer.getData('text/plain'); if (!defId) return;
      const def = this.options.nodeDefinitions?.find(d => d.id === defId); if (!def) return;
      const canvasPt = this.canvasEngine.getClientToCanvasCoordinates({x: e.clientX, y: e.clientY});
      let dropPos = canvasPt; const vs = this.canvasEngine.getViewState();
      if (vs.snapToGrid) dropPos = { x: Math.round(canvasPt.x / vs.gridSize) * vs.gridSize, y: Math.round(canvasPt.y / vs.gridSize) * vs.gridSize };
      let newItem: Node | StickyNote | null = null;
      if (def.id === 'sticky-note-def') newItem = this.stickyNoteManager.createNote(dropPos, "New Note...");
      else {
        newItem = this.nodeManager.createNodeFromDefinition(def, dropPos);
        // Após a criação do nó, se houver dados padrão que possam conter variáveis, parseie
        if (newItem.type === 'node' && def.config?.parameters) {
            const initialData = {};
            def.config.parameters.forEach(p => {
                if (p.type === 'text' || p.type === 'code') { // Assumindo que apenas texto e código podem ter variáveis
                    initialData[p.id] = p.defaultValue || '';
                }
            });
            this.nodeManager.updateNodeDataAndParseVariables(newItem.id, initialData, {});
        }
      }
      if (newItem) { this.selectionManager.selectItem(newItem.id, false); this.events.emit('itemDropped', newItem); }
      this.canvasEngine.requestRender();
   };

  private handleCopyShortcut = (): void => {
    const ids = this.selectionManager.getSelectedItems(); if (ids.length === 0) return;
    const items = ids.map(id => {
      const n = this.nodeManager.getNode(id); 
      if (n) {
          // Copia as portas dinâmicas também
          return { 
              originalId: id, 
              type: 'node' as 'node', 
              data: { 
                  ...n, 
                  fixedInputs: JSON.parse(JSON.stringify(n.fixedInputs)),
                  fixedOutputs: JSON.parse(JSON.stringify(n.fixedOutputs)),
                  dynamicInputs: JSON.parse(JSON.stringify(n.dynamicInputs)), // Clona portas dinâmicas
                  dynamicOutputs: JSON.parse(JSON.stringify(n.dynamicOutputs)), // Clona portas dinâmicas
                  data: JSON.parse(JSON.stringify(n.data || {})) // Clona o data
              } 
          };
      }
      const sn = this.stickyNoteManager.getNote(id); 
      if (sn) return { originalId: id, type: 'stickyNote' as 'stickyNote', data: sn };
      return null;
    }).filter(i => i !== null && (i.type === 'node' || i.type === 'stickyNote')) as Array<{ originalId: string, type: 'node' | 'stickyNote', data: any }>;
    if (items.length > 0) { this.clipboardManager.copy(items); this.events.emit('itemsCopied', items); }
   };

   private handlePasteShortcut = (): void => {
    if (!this.clipboardManager.canPaste()) return;
    const vs = this.canvasEngine.getViewState(); const el = this.canvasEngine.getCanvasElement();
    const cx = (el.width / 2 - vs.offset.x) / vs.scale; const cy = (el.height / 2 - vs.offset.y) / vs.scale;
    const items = this.clipboardManager.preparePasteData({ x: cx, y: cy }); 
    const newIds: string[] = [];

    items.forEach(item => {
      const { type, data } = item; let pasted: Node | StickyNote | null = null;
      if (type === 'node') { 
        const d = data as Node; 
        const def = this.options.nodeDefinitions?.find(df => df.id === d.type);
        if (def) { 
            // Cria o nó da definição original
            pasted = this.nodeManager.createNodeFromDefinition(def, d.position); 
            // Atualiza o nó colado com os dados (incluindo portas dinâmicas clonadas)
            this.nodeManager.updateNode(pasted.id, { 
                title: d.title, 
                data: d.data || {}, 
                status: 'unsaved', 
                icon: d.icon, 
                width: d.width, 
                height: d.height,
                // Copia as portas dinâmicas clonadas
                dynamicInputs: d.dynamicInputs, 
                dynamicOutputs: d.dynamicOutputs 
            }); 
        } else { // Caso seja um nó genérico sem definição explícita
             pasted = this.nodeManager.createNode(d.title, d.position, d.type, d.width, d.height);
             this.nodeManager.updateNode(pasted.id, { 
                ...d, 
                id: pasted.id, // Garante que o ID é o novo
                fixedInputs: d.fixedInputs,
                fixedOutputs: d.fixedOutputs,
                dynamicInputs: d.dynamicInputs, 
                dynamicOutputs: d.dynamicOutputs,
                data: d.data || {}
            });
        }
      } else if (type === 'stickyNote') { 
        const d = data as StickyNote; 
        pasted = this.stickyNoteManager.createNote(d.position, d.content, d.width, d.height); 
        this.stickyNoteManager.updateNote(pasted.id, { style: d.style }); 
      }
      if (pasted) newIds.push(pasted.id);
    });
    if (newIds.length > 0) this.selectionManager.selectItems(newIds, false);
    this.canvasEngine.requestRender(); this.events.emit('itemsPasted', items);
   };

   private handleDeleteShortcut = (): void => {
    const ids = this.selectionManager.getSelectedItems(); if (ids.length === 0) return;
    const nodesDel:string[]=[]; const notesDel:string[]=[]; const connsDel:string[]=[];
    ids.forEach(id => {
      if (this.nodeManager.getNode(id)) nodesDel.push(id);
      else if (this.stickyNoteManager.getNote(id)) notesDel.push(id);
      else if (this.nodeManager.getConnection(id)) connsDel.push(id);
    });
    connsDel.forEach(id => this.nodeManager.deleteConnection(id));
    if (nodesDel.length > 0) this.nodeManager.deleteNodes(nodesDel);
    if (notesDel.length > 0) this.stickyNoteManager.deleteNotes(notesDel);
    this.selectionManager.clearSelection(); this.canvasEngine.requestRender();
    this.events.emit('itemsDeleted', ids);
   };

  private handleCanvasContextMenu = (e: CanvasPointerEvent): void => {
    if (!this.contextMenu) return; const { clientPoint, canvasPoint } = e;
    const iElem = this.interactionManager.getInteractiveElementAtPoint(canvasPoint);
    let ctxType: ContextMenuContext['targetType'] = iElem.type; let targetId = iElem.id;
    if (iElem.item && !this.selectionManager.isSelected(iElem.item.id) && (iElem.type==='node'||iElem.type==='stickyNote'||iElem.type==='connection')) {
        this.selectionManager.selectItem(iElem.item.id, false);
    } else if (iElem.type === 'canvas' && this.selectionManager.getSelectionCount() === 0) { this.selectionManager.clearSelection(); }
    const ctx: ContextMenuContext = { targetType: ctxType, targetId };
    const menuItems = this.getContextMenuItems(ctx);
    if(menuItems.length > 0) this.contextMenu.show(clientPoint, ctx, menuItems);
  };
  
  private getContextMenuItems(context: ContextMenuContext): ContextMenuItemAction[] {
    const items: ContextMenuItemAction[] = []; const selCount = this.selectionManager.getSelectionCount();
    const {targetId, targetType} = context;
    let itemData: ConfigurableItem | undefined;

    if (targetType === 'node' && targetId) {
        itemData = this.nodeManager.getNode(targetId);
        if(itemData) items.push({ id: 'config-node', label: 'Configure Node', iconClass: 'ph-gear', action: () => this.configPanel?.show(itemData!, 'node') });
        items.push({ id: 'duplicate-node', label: 'Duplicate Node', iconClass: 'ph-copy', action: () => this.duplicateSelected() });
    } else if (targetType === 'stickyNote' && targetId) {
        itemData = this.stickyNoteManager.getNote(targetId);
        if(itemData) items.push({ id: 'config-note', label: 'Configure Note Style', iconClass: 'ph-paint-brush', action: () => this.configPanel?.show(itemData!, 'stickyNote') });
    } else if (targetType === 'connection' && targetId) {
        itemData = this.nodeManager.getConnection(targetId);
        if(itemData) items.push({ id: 'config-connection', label: 'Configure Connection', iconClass: 'ph-pencil-simple', action: () => this.configPanel?.show(itemData!, 'connection') });
    } else if (targetType === 'canvas') {
        const lp = this.interactionManager.getLastPointerDownCanvasPoint() || this.canvasEngine.getCenterCanvasPoint();
        const cp = this.canvasEngine.getCanvasToClientCoordinates(lp);
        items.push({ id: 'add-node-ctx', label: 'Add Node...', iconClass: 'ph-plus', action: () => { this.quickAddMenu?.show(cp, lp); }});
        if (this.clipboardManager.canPaste()) items.push({ id: 'paste-ctx', label: 'Paste', iconClass: 'ph-clipboard', action: () => this.handlePasteShortcut() });
    }
    if (selCount > 0) {
        let delLabel = `Delete ${selCount > 1 ? selCount + " Items" : "Selected"}`;
        if (selCount === 1 && targetId && this.selectionManager.isSelected(targetId)) {
            if(targetType === 'node')delLabel="Delete Node"; else if(targetType === 'stickyNote')delLabel="Delete Note"; else if(targetType === 'connection')delLabel="Delete Connection";
        }
        if(!items.find(i=>i.id.startsWith("delete-") && i.id.includes(targetType || ""))) {
             items.push({ id: 'delete-selected-ctx', label: delLabel, iconClass: 'ph-trash', action: () => this.handleDeleteShortcut(), separatorBefore: items.length > 0 && !items.some(i=>i.id.startsWith("delete-")) });
        }
    }
    return items;
  }
  
  private duplicateSelected(): void { if(this.selectionManager.getSelectionCount() > 0) { this.handleCopyShortcut(); this.handlePasteShortcut(); } }
  private handleContextMenuItemClicked = (actionId: string, context?: ContextMenuContext): void => { this.events.emit('contextAction', actionId, context); };
  private handleCanvasDoubleClickForQuickAdd = (e: CanvasPointerEvent): void => { if (this.quickAddMenu) this.quickAddMenu.show(e.clientPoint, e.canvasPoint); };
  private handleQuickAddItemChosen = (definition: NodeDefinition, canvasPosition: Point): void => {
    let dropPos = canvasPosition; const vs = this.canvasEngine.getViewState();
    if (vs.snapToGrid) dropPos = { x: Math.round(canvasPosition.x / vs.gridSize) * vs.gridSize, y: Math.round(canvasPosition.y / vs.gridSize) * vs.gridSize };
    let newItem: Node | StickyNote | null = null;
    if (definition.id === 'sticky-note-def') newItem = this.stickyNoteManager.createNote(dropPos, "New Note...");
    else {
        newItem = this.nodeManager.createNodeFromDefinition(definition, dropPos);
        // Após a criação do nó via quick add, se houver dados padrão com variáveis, parseie
        if (newItem.type === 'node' && definition.config?.parameters) {
            const initialData = {};
            definition.config.parameters.forEach(p => {
                if (p.type === 'text' || p.type === 'code') {
                    initialData[p.id] = p.defaultValue || '';
                }
            });
            this.nodeManager.updateNodeDataAndParseVariables(newItem.id, initialData, {});
        }
    }
    if(newItem) { this.selectionManager.selectItem(newItem.id, false); this.events.emit('itemAdded', newItem); }
    this.canvasEngine.requestRender();
  };
  
  private tooltipHoverTimeout: number | null = null;
  private currentHoveredItemId: string | null = null;
  private handleTooltipPointerMove = (e: CanvasPointerEvent): void => {
    if (!this.tooltip || this.interactionManager.isInteracting()) { this.tooltip?.hide(); return; }
    const iElem = this.interactionManager.getInteractiveElementAtPoint(e.canvasPoint);
    const itemId = iElem.id; 
    if (itemId) {
        if (this.currentHoveredItemId !== itemId) {
            this.tooltip.hide(); this.currentHoveredItemId = itemId;
            if (this.tooltipHoverTimeout) clearTimeout(this.tooltipHoverTimeout);
            this.tooltipHoverTimeout = window.setTimeout(() => {
                if (this.currentHoveredItemId === itemId) { 
                    let content: TooltipContent | null = null;
                    if (iElem.type === 'node' && iElem.item) { const n = this.nodeManager.getNode(iElem.item.id); if (n) content = { title: n.title, type: n.type, description: n.description, id: n.id.slice(0,8) }; }
                    else if (iElem.type === 'stickyNote' && iElem.item) { const n = this.stickyNoteManager.getNote(iElem.item.id); if (n) content = { title: "Sticky Note", description: n.content.substring(0,100)+(n.content.length>100?'...':''), id: n.id.slice(0,8) }; }
                    else if (iElem.type === 'connection' && iElem.connectionDetails) { const c = iElem.connectionDetails; const sP = this.nodeManager.getPort(c.sourcePortId); const tP = this.nodeManager.getPort(c.targetPortId); content = {title: c.data?.label || "Connection", description: `From: ${sP?.name||'?'} To: ${tP?.name||'?'}`, id: c.id.slice(0,8)}; }
                    else if (iElem.type === 'port' && iElem.portDetails) { const p = iElem.portDetails; content = {title: p.name, type: `${p.type} port`, description: p.description, id: p.id.slice(0,8) }; }
                    if (content) this.tooltip!.scheduleShow(e.clientPoint, content);
                }
            }, 500);
        }
    } else {
        if (this.tooltipHoverTimeout) clearTimeout(this.tooltipHoverTimeout);
        this.tooltipHoverTimeout = null; this.tooltip.hide(); this.currentHoveredItemId = null;
    }
  };
  
  public zoomToFitContent(): void {
    const allNodes = this.nodeManager.getNodes(); const allStickyNotes = this.stickyNoteManager.getNotes();
    const allItems: Array<{position: Point, width: number, height: number}> = [...allNodes, ...allStickyNotes];
    if (allItems.length === 0) { this.canvasEngine.resetView(); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    allItems.forEach(item => { minX = Math.min(minX, item.position.x); minY = Math.min(minY, item.position.y); maxX = Math.max(maxX, item.position.x + item.width); maxY = Math.max(maxY, item.position.y + item.height); });
    if(isFinite(minX)) { const rect: Rect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY }; this.canvasEngine.zoomToFit(rect, 50); }
    else { this.canvasEngine.resetView(); }
   }

   public loadGraph(data: {nodes?: Node[], stickyNotes?: StickyNote[], connections?: Connection[], viewState?: Partial<ViewState>}): void {
    this.nodeManager.destroy(); this.stickyNoteManager.destroy(); this.selectionManager.clearSelection();
    this.nodeManager = new NodeManager(); this.stickyNoteManager = new StickyNoteManager();
    this.interactionManager = new InteractionManager(this.canvasEngine, this.nodeManager, this.stickyNoteManager, this.selectionManager);
    this.renderService = new RenderService(this.canvasEngine, this.nodeManager, this.stickyNoteManager, this.selectionManager, this.interactionManager);
    this.nodeManager.on('nodesUpdated', () => this.canvasEngine.requestRender());
    this.nodeManager.on('connectionsUpdated', () => this.canvasEngine.requestRender());
    this.stickyNoteManager.on('notesUpdated', () => this.canvasEngine.requestRender());
    // Reconecta o listener do ConfigPanel ao novo NodeManager
    if(this.configPanel) { 
        this.configPanel.destroy(); 
        this.configPanel = new ConfigPanel(this.configPanelContainer!, this.selectionManager, this.nodeManager, this.stickyNoteManager); 
        this.configPanel.on('nodeDataChangedWithVariables', (event: NodeDataVariableParseEvent) => {
            this.nodeManager.updateNodeDataAndParseVariables(event.nodeId, event.newData, event.oldData);
        });
        this.configPanel.on('configApplied', (item: ConfigurableItem) => { 
            this.canvasEngine.requestRender(); 
            this.events.emit('itemConfigApplied', item);
            if (item && item.hasOwnProperty('fixedInputs')) {
                this.configPanel?.show(item, 'node'); 
            } else if (item && ((item as Node).title || (item as Connection).data?.label)) {
                this.configPanel?.show(item, item.hasOwnProperty('sourcePortId') ? 'connection' : (item.hasOwnProperty('content') ? 'stickyNote' : 'node') );
            }
        });
        this.configPanel.on('testNode', (node: Node) => { this.events.emit('testNodeRequested', node); });
    }


    if(data.nodes) { 
        data.nodes.forEach(nd => { 
            const def = this.options.nodeDefinitions?.find(d => d.id === nd.type); 
            let createdNode: Node;
            if (def) { 
                // Cria com base na definição, mas depois sobrescreve com dados do save
                createdNode = this.nodeManager.createNodeFromDefinition(def, nd.position); 
                this.nodeManager.updateNode(createdNode.id, { 
                    ...nd, 
                    id: createdNode.id, // Mantém o novo ID gerado
                    fixedInputs: nd.fixedInputs || [], // Carrega portas fixas do save
                    fixedOutputs: nd.fixedOutputs || [], // Carrega portas fixas do save
                    dynamicInputs: nd.dynamicInputs || [], // Carrega portas dinâmicas do save
                    dynamicOutputs: nd.dynamicOutputs || [], // Carrega portas dinâmicas do save
                    config: def.config 
                }); 
            } else { 
                // Cria nó genérico e carrega tudo do save
                createdNode = this.nodeManager.createNode(nd.title, nd.position, nd.type, nd.width, nd.height); 
                this.nodeManager.updateNode(createdNode.id, {
                    ...nd, 
                    id: createdNode.id,
                    fixedInputs: nd.fixedInputs || [],
                    fixedOutputs: nd.fixedOutputs || [],
                    dynamicInputs: nd.dynamicInputs || [],
                    dynamicOutputs: nd.dynamicOutputs || [],
                }); 
            } 
        });
    }
    if(data.stickyNotes) { data.stickyNotes.forEach(nd => { const n = this.stickyNoteManager.createNote(nd.position, nd.content, nd.width, nd.height); this.stickyNoteManager.updateNote(n.id, {...nd, id: n.id}); });}
    if(data.connections) { data.connections.forEach(cd => { const conn = this.nodeManager.createConnection(cd.sourcePortId, cd.targetPortId); if(conn && cd.data) this.nodeManager.updateConnection(conn.id, {data: cd.data}); });}
    if(data.viewState) this.canvasEngine.setViewState(data.viewState); else this.zoomToFitContent();
    this.canvasEngine.requestRender(); this.events.emit('graphLoaded');
   }

   public saveGraph(): any {
       return {
          nodes: this.nodeManager.getNodes().map(n => ({
              ...n, 
              data: n.data ? {...n.data} : undefined, 
              // Garante que portas fixas e dinâmicas sejam salvas
              fixedInputs: n.fixedInputs.map(p=>({...p})), 
              fixedOutputs: n.fixedOutputs.map(p=>({...p})),
              dynamicInputs: n.dynamicInputs.map(p=>({...p})), 
              dynamicOutputs: n.dynamicOutputs.map(p=>({...p}))
          })), 
          stickyNotes: this.stickyNoteManager.getNotes().map(sn => ({...sn, style: {...sn.style}})),
          connections: this.nodeManager.getConnections().map(c => ({...c, data: c.data ? {...c.data} : undefined })),
          viewState: {...this.canvasEngine.getViewState(), offset: {...this.canvasEngine.getViewState().offset}},
        };
   }
   
   public on(eventName: string, listener: (...args: any[]) => void): void { this.events.on(eventName, listener); }
   public off(eventName: string, listener: (...args: any[]) => void): void { this.events.off(eventName, listener); }

  public destroy(): void {
    this.shortcutManager.destroy();
    this.configPanel?.destroy(); this.toolbar?.destroy(); this.nodePalette?.destroy();
    this.contextMenu?.destroy(); this.quickAddMenu?.destroy(); this.tooltip?.destroy();
    this.renderService.destroy(); this.interactionManager.destroy(); 
    this.selectionManager.destroy(); this.clipboardManager.destroy();
    this.stickyNoteManager.destroy(); this.nodeManager.destroy();
    this.canvasEngine.destroy();
    this.container.innerHTML = ''; this.events.removeAllListeners();
    console.log('NodeEditor destroyed');
  }
}