import { EventEmitter } from "eventemitter3";
import { nanoid } from "nanoid";
import {
  NodeEditorOptions,
  Node,
  Point,
  NodeDefinition,
  CanvasPointerEvent,
  Rect,
  StickyNote,
  Connection,
  ConfigurableItem,
  ConfigurableItemType,
  GraphState,
  InteractiveElementType,
  NodePort,
  ClipboardableItemType,
  EditorPreferences,
} from "../core/types";
import {
  EVENT_VIEW_CHANGED,
  EVENT_SELECTION_CHANGED,
  EVENT_HISTORY_CHANGED,
  EVENT_CLIPBOARD_CHANGED,
  EVENT_NODES_UPDATED,
  EVENT_CONNECTIONS_UPDATED,
  EVENT_NOTES_UPDATED,
  EVENT_GROUPS_UPDATED,
  LOCAL_STORAGE_GRAPH_KEY,
  ALL_NODE_DEFINITIONS as FALLBACK_NODE_DEFINITIONS,
  EVENT_CONFIG_APPLIED,
  EVENT_NODE_TEST_REQUESTED,
  EVENT_NODE_DATA_CHANGED_WITH_VARIABLES,
} from "../core/constants";

import { CanvasEngine } from "../canvas/CanvasEngine";
import { RenderService } from "../canvas/RenderService";
import { NodeManager } from "../state/NodeManager";
import { ConnectionManager } from "../state/ConnectionManager";
import { StickyNoteManager } from "../state/StickyNoteManager";
import { SelectionManager } from "../state/SelectionManager";
import { NodeGroupManager } from "../state/NodeGroupManager";
import { ClipboardManager } from "../state/ClipboardManager";
import { HistoryManager } from "../state/HistoryManager";
import { ViewStore } from "../state/ViewStore";
import { InteractionManager } from "../interaction/InteractionManager";
import { ShortcutManager } from "../interaction/ShortcutManager";
import { DndController } from "../interaction/DndController";
import { EditorIconService } from "../services/EditorIconService";
import { PlatformDataService } from "../services/PlatformDataService";
import { AutoLayoutService } from "../services/AutoLayoutService";
import { NodePalette } from "../components/NodePalette/NodePalette";
import { ConfigPanel } from "../components/ConfigPanel/ConfigPanel";
import { Toolbar } from "../components/Toolbar/Toolbar";
import {
  ContextMenu,
  ContextMenuItemAction,
  ContextMenuContext,
} from "../components/ContextMenu/ContextMenu";
import { QuickAddMenu } from "../components/QuickAddMenu/QuickAddMenu";
import { Tooltip, TooltipContent } from "../components/Tooltip/Tooltip";

export class NodeEditorController {
  private container: HTMLElement;
  private options: NodeEditorOptions;
  private events: EventEmitter;

  public viewStore: ViewStore;
  public canvasEngine: CanvasEngine;
  public renderService: RenderService;

  public nodeManager: NodeManager;
  public connectionManager: ConnectionManager;
  public stickyNoteManager: StickyNoteManager;
  public nodeGroupManager: NodeGroupManager;
  public selectionManager: SelectionManager;
  public clipboardManager: ClipboardManager;
  public historyManager: HistoryManager;

  public interactionManager: InteractionManager;
  public shortcutManager: ShortcutManager;
  public dndController: DndController;

  public iconService: EditorIconService;
  public platformDataService: PlatformDataService;
  private autoLayoutService: AutoLayoutService;

  private nodePalette: NodePalette | null = null;
  public configPanel: ConfigPanel | null = null;
  private toolbar: Toolbar | null = null;
  private contextMenu: ContextMenu | null = null;
  private quickAddMenu: QuickAddMenu | null = null;
  public tooltip: Tooltip | null = null;

  private paletteWrapper: HTMLElement | null = null;
  private canvasWrapper: HTMLElement | null = null;
  private configPanelWrapper: HTMLElement | null = null;
  private toolbarWrapper: HTMLElement | null = null;
  private overlayWrapper: HTMLElement | null = null;

  private availableNodeDefinitions: NodeDefinition[] = [];

  private fullGraphState: GraphState;

  constructor(
    container: HTMLElement,
    options: Partial<NodeEditorOptions> = {}
  ) {
    this.container = container;
    this.options = {
      showPalette: true,
      showToolbar: true,
      showConfigPanel: true,
      defaultScale: 1,
      gridSize: 20,
      showGrid: true,
      snapToGrid: false,
      nodeDefinitions: [],
      ...options,
    };
    this.events = new EventEmitter();
    this.validateContainer();

    this.setupDOMStructure();

    this.iconService = new EditorIconService();
    this.platformDataService = new PlatformDataService();
    this.viewStore = new ViewStore({});
    this.autoLayoutService = new AutoLayoutService();

    this.nodeManager = new NodeManager();
    this.connectionManager = new ConnectionManager(this.nodeManager);
    this.stickyNoteManager = new StickyNoteManager();
    this.nodeGroupManager = new NodeGroupManager(this.nodeManager);
    this.selectionManager = new SelectionManager();
    this.clipboardManager = new ClipboardManager();
    this.historyManager = new HistoryManager();

    if (!this.canvasWrapper) throw new Error("Canvas wrapper not initialized.");
    this.canvasEngine = new CanvasEngine(this.canvasWrapper, this.viewStore);

    this.interactionManager = new InteractionManager(
      this.canvasEngine,
      this.viewStore,
      this.nodeManager,
      this.connectionManager,
      this.stickyNoteManager,
      this.nodeGroupManager,
      this.selectionManager
    );

    this.shortcutManager = new ShortcutManager(this.container);

    this.dndController = new DndController(
      this.canvasEngine,
      this.viewStore,
      this.nodeManager,
      this.stickyNoteManager,
      this.selectionManager,
      (id: string) => this.availableNodeDefinitions.find((def) => def.id === id)
    );

    this.renderService = new RenderService(
      this.canvasEngine,
      this.nodeManager,
      this.connectionManager,
      this.stickyNoteManager,
      this.nodeGroupManager,
      this.selectionManager,
      this.interactionManager,
      this.viewStore
    );

    this.fullGraphState = this.getCurrentGraphState(); // Inicializar

    this.initializeUIComponents();
    this.wireUpCoreEvents();
    this.wireUpShortcuts();
    this.wireUpNavigationEvents(); // Adicionar esta chamada

    this.loadInitialNodeDefinitions().then(() => {
      this.recordInitialHistoryState();
      this.canvasEngine.requestRender();
      console.log("NodeEditorController initialized.");
      this.events.emit("ready");
    });
  }

  private wireUpNavigationEvents(): void {
    this.interactionManager.on("nodeDoubleClick", (nodeId: string) => {
      const node = this.nodeManager.getNode(nodeId);
      if (node && node.subgraph) {
        this.navigateToSubgraph(node);
      }
    });
  }

  private navigateToSubgraph(node: Node): void {
    const currentGraphId = this.viewStore.getCurrentGraphId();
    const parentNode = this.findNodeInFullState(currentGraphId);

    const stateToSave = this.getCurrentGraphState();

    if (parentNode) {
      // Agora esta atribuição está correta tipograficamente
      parentNode.subgraph = stateToSave;
    } else {
      this.fullGraphState = stateToSave;
    }

    this.viewStore.navigateTo(node.id, node.title);

    const subgraphState: GraphState = node.subgraph || {
      nodes: [],
      connections: [],
      stickyNotes: [],
      nodeGroups: [],
      viewState: {
        ...this.viewStore.getState(),
        offset: { x: 40, y: 40 },
        scale: 1,
      },
    };

    this.loadGraphState(subgraphState, true, false);
  }

  public navigateToGraphId(graphId: string): void {
    const currentGraphId = this.viewStore.getCurrentGraphId();
    if (currentGraphId === graphId) return;

    const currentNode = this.findNodeInFullState(currentGraphId);
    if (currentNode) {
      currentNode.subgraph = this.getCurrentGraphState();
    } else {
      this.fullGraphState = this.getCurrentGraphState();
    }

    const targetNode = this.findNodeInFullState(graphId);
    let targetState: GraphState;

    if (graphId === "root" || !targetNode) {
      targetState = this.fullGraphState;
    } else {
      targetState = targetNode.subgraph || {
        nodes: [],
        connections: [],
        stickyNotes: [],
        nodeGroups: [],
        viewState: this.fullGraphState.viewState,
      };
    }

    this.viewStore.navigateUpTo(graphId);
    this.loadGraphState(targetState, true, false);
  }

  private findNodeInFullState(nodeId: string): Node | undefined {
    if (nodeId === "root") return undefined;
    const find = (nodes: Node[]): Node | undefined => {
      for (const node of nodes) {
        if (node.id === nodeId) return node;
        if (node.subgraph?.nodes) {
          const found = find(node.subgraph.nodes);
          if (found) return found;
        }
      }
      return undefined;
    };
    return find(this.fullGraphState.nodes);
  }

  private validateContainer(): void {
    if (!this.container)
      throw new Error("NodeEditorController: Container element not found.");
  }

  private setupDOMStructure(): void {
    this.container.innerHTML = "";
    this.container.style.position = "relative";
    this.container.style.width = "100%";
    this.container.style.height = "100%";

    this.canvasWrapper = document.createElement("div");
    this.canvasWrapper.className = "canvas-container";
    this.container.appendChild(this.canvasWrapper);

    if (this.options.showPalette) {
      this.paletteWrapper = document.createElement("div");
      this.paletteWrapper.className = "node-palette-wrapper";
      this.container.prepend(this.paletteWrapper);
    }

    if (this.options.showConfigPanel) {
      this.configPanelWrapper = document.createElement("div");
      this.configPanelWrapper.className = "config-panel-wrapper";
      this.container.appendChild(this.configPanelWrapper);
    }

    if (this.options.showToolbar && this.canvasWrapper) {
      this.toolbarWrapper = document.createElement("div");
      this.toolbarWrapper.className = "toolbar-wrapper";
      this.canvasWrapper.appendChild(this.toolbarWrapper);
    }

    this.overlayWrapper = document.createElement("div");
    this.overlayWrapper.className = "editor-overlay-container";
    this.canvasWrapper.appendChild(this.overlayWrapper);
  }

  private async loadInitialNodeDefinitions(): Promise<void> {
    try {
      this.availableNodeDefinitions =
        await this.platformDataService.getNodeDefinitions();
    } catch (error) {
      console.error("Failed to load node definitions, using fallback:", error);
      this.availableNodeDefinitions = FALLBACK_NODE_DEFINITIONS.map((pd) => ({
        ...pd,
      }));
    }
    this.nodePalette?.updateNodeDefinitions(this.availableNodeDefinitions);
    this.quickAddMenu?.updateNodeDefinitions(this.availableNodeDefinitions);
  }

  private initializeUIComponents(): void {
    if (this.options.showPalette && this.paletteWrapper) {
      this.nodePalette = new NodePalette(
        this.paletteWrapper,
        { nodeDefinitions: this.availableNodeDefinitions },
        this.iconService
      );
    }
    if (this.configPanelWrapper) {
      this.configPanel = new ConfigPanel(
        this.configPanelWrapper,
        this.selectionManager,
        this.nodeManager,
        this.connectionManager,
        this.stickyNoteManager,
        this.nodeGroupManager,
        this.iconService
      );
    }
    if (this.options.showToolbar && this.toolbarWrapper) {
      this.toolbar = new Toolbar(this.toolbarWrapper, this.iconService);
      this.initializeToolbarButtons();
    }
    if (this.overlayWrapper) {
      this.contextMenu = new ContextMenu(this.overlayWrapper, this.iconService);
      this.quickAddMenu = new QuickAddMenu(
        this.overlayWrapper,
        { nodeDefinitions: this.availableNodeDefinitions },
        this.iconService
      );
      this.tooltip = new Tooltip(this.overlayWrapper);
    }
  }

  public autoLayout(): void {
    const nodes = this.nodeManager.getNodes();
    const connections = this.connectionManager.getConnections();

    if (nodes.length === 0) {
      return;
    }

    // Calcula as novas posições
    const newPositions = this.autoLayoutService.layoutGraph(nodes, connections);

    // Atualiza as posições dos nós
    newPositions.forEach((pos, nodeId) => {
      this.nodeManager.moveNode(nodeId, pos);
    });

    // Cria um ponto no histórico para que a ação possa ser desfeita
    this.historyManager.push(this.getCurrentGraphState());

    // Centraliza a visão no conteúdo recém-organizado
    this.zoomToFitContent();

    // Solicita uma nova renderização do canvas
    this.canvasEngine.requestRender();
    this.events.emit("layoutApplied");
  }

  private initializeToolbarButtons(): void {
    if (!this.toolbar) return;

    // 1. Botões de Histórico (Undo/Redo)
    this.toolbar.addButton({
      id: "undo",
      title: "Undo (Ctrl+Z)",
      iconName: "ph-arrow-counter-clockwise",
      action: () => this.handleUndo(),
      disabled: () => !this.historyManager.canUndo(),
    });
    this.toolbar.addButton({
      id: "redo",
      title: "Redo (Ctrl+Y)",
      iconName: "ph-arrow-clockwise",
      action: () => this.handleRedo(),
      disabled: () => !this.historyManager.canRedo(),
    });
    this.toolbar.addSeparator();

    // 2. Botões de Visualização do Canvas
    this.toolbar.addButton({
      id: "toggle-grid",
      title: "Toggle Grid (G)",
      iconName: "ph-grid-four",
      isToggle: true,
      action: () => this.viewStore.toggleGrid(),
      isActive: () => this.viewStore.getState().showGrid,
    });
    this.toolbar.addButton({
      id: "toggle-snap",
      title: "Toggle Snap to Grid (S)",
      iconName: "ph-magnet",
      isToggle: true,
      action: () => this.viewStore.toggleSnapToGrid(),
      isActive: () => this.viewStore.getState().snapToGrid,
    });
    this.toolbar.addSeparator();

    this.toolbar.addButton({
      id: "bg-solid",
      title: "Solid Background",
      iconName: "ph-square",
      isToggle: true,
      action: () => {
        this.viewStore.toggleGrid(false);
      },
      isActive: () => !this.viewStore.getState().showGrid,
    });
    this.toolbar.addButton({
      id: "bg-dots",
      title: "Dotted Background",
      iconName: "ph-dots-nine",
      isToggle: true,
      action: () => {
        this.viewStore.toggleGrid(true);
        this.viewStore.setBackgroundPattern("dots");
      },
      isActive: () =>
        this.viewStore.getState().showGrid &&
        this.viewStore.getState().backgroundPattern === "dots",
    });
    this.toolbar.addButton({
      id: "bg-lines",
      title: "Lined Background",
      iconName: "ph-grid-four",
      isToggle: true,
      action: () => {
        this.viewStore.toggleGrid(true);
        this.viewStore.setBackgroundPattern("lines");
      },
      isActive: () =>
        this.viewStore.getState().showGrid &&
        this.viewStore.getState().backgroundPattern === "lines",
    });

    this.toolbar.addSeparator();

    // 3. Botões de Controlo de Zoom
    this.toolbar.addButton({
      id: "zoom-to-fit",
      title: "Zoom to Fit Content (F)",
      iconName: "ph-arrows-out",
      action: () => this.zoomToFitContent(),
    });
    this.toolbar.addButton({
      id: "zoom-to-selection",
      title: "Zoom to Selection (Shift+F)",
      iconName: "ph-magnifying-glass",
      action: () => this.zoomToSelection(),
      disabled: () => this.selectionManager.getSelectionCount() === 0,
    });
    this.toolbar.addButton({
      id: "reset-view",
      title: "Reset View (100%)",
      iconName: "ph-frame-corners", // Ícone alternativo para "reset"
      action: () => this.viewStore.resetView(),
    });

    // O nosso novo display de zoom, agora agrupado com os outros controlos de zoom
    this.toolbar.addDisplay({
      id: "zoom-display",
      title: "Current Zoom Level",
      text: () => `${Math.round(this.viewStore.getState().scale * 100)}%`,
    });

    this.toolbar.addSeparator();

    // Botão de Auto-Layout
    this.toolbar.addButton({
      id: "auto-layout",
      title: "Auto-Layout (L)",
      iconName: "ph-graph", // Um ícone adequado
      action: () => this.autoLayout(),
    });

    // O método refresh() irá renderizar e atualizar todos os itens na ordem em que foram adicionados.
    this.toolbar.refresh();
  }

  private wireUpCoreEvents(): void {
    this.nodeManager.on(EVENT_NODES_UPDATED, () =>
      this.canvasEngine.requestRender()
    );
    this.connectionManager.on(EVENT_CONNECTIONS_UPDATED, () =>
      this.canvasEngine.requestRender()
    );
    this.stickyNoteManager.on(EVENT_NOTES_UPDATED, () =>
      this.canvasEngine.requestRender()
    );
    this.nodeGroupManager.on(EVENT_GROUPS_UPDATED, () =>
      this.canvasEngine.requestRender()
    );

    this.viewStore.on(EVENT_VIEW_CHANGED, () => this.toolbar?.refresh());
    this.historyManager.on(EVENT_HISTORY_CHANGED, () =>
      this.toolbar?.refresh()
    );
    this.clipboardManager.on(EVENT_CLIPBOARD_CHANGED, () =>
      this.toolbar?.refresh()
    );
    this.selectionManager.on(EVENT_SELECTION_CHANGED, () =>
      this.toolbar?.refresh()
    );

    this.interactionManager.on(
      "canvasContextMenu",
      this.handleCanvasContextMenu
    );
    this.interactionManager.on(
      "canvasDoubleClick",
      this.handleCanvasDoubleClick
    );

    const makeHistoryCheckpoint = () => {
      if (!this.historyManager.isRestoringState()) {
        this.historyManager.push(this.getCurrentGraphState());
      }
    };

    this.nodeManager.on("nodeCreated", makeHistoryCheckpoint);
    this.nodeManager.on("nodeMoved", makeHistoryCheckpoint);
    this.nodeManager.on("nodeResized", makeHistoryCheckpoint);
    this.nodeManager.on("nodeDeleted", makeHistoryCheckpoint);
    this.nodeManager.on("nodesDeleted", makeHistoryCheckpoint);
    this.nodeManager.on("portAdded", makeHistoryCheckpoint);
    this.nodeManager.on("portRemoved", makeHistoryCheckpoint);
    this.nodeManager.on("portUpdated", makeHistoryCheckpoint);
    this.nodeManager.on("nodeDataUpdated", makeHistoryCheckpoint);
    this.connectionManager.on("connectionCreated", makeHistoryCheckpoint);
    this.connectionManager.on("connectionDeleted", makeHistoryCheckpoint);
    this.connectionManager.on("connectionUpdated", makeHistoryCheckpoint);
    this.stickyNoteManager.on("noteCreated", makeHistoryCheckpoint);
    this.stickyNoteManager.on("noteUpdated", makeHistoryCheckpoint);
    this.stickyNoteManager.on("noteDeleted", makeHistoryCheckpoint);
    this.nodeGroupManager.on("groupCreated", makeHistoryCheckpoint);
    this.nodeGroupManager.on("groupMoved", makeHistoryCheckpoint);
    this.nodeGroupManager.on("groupResized", makeHistoryCheckpoint);
    this.nodeGroupManager.on("groupDeleted", makeHistoryCheckpoint);
    this.nodeGroupManager.on("nodeAddedToGroup", makeHistoryCheckpoint);
    this.nodeGroupManager.on("nodeRemovedFromGroup", makeHistoryCheckpoint);

    let tooltipHoverTimeout: number | null = null;
    this.interactionManager.on(
      "elementHoverStart",
      (
        elementInfo: {
          type: InteractiveElementType;
          id?: string;
          item?: any;
          portDetails?: NodePort;
          connectionDetails?: Connection;
        },
        clientPoint: Point
      ) => {
        if (tooltipHoverTimeout) clearTimeout(tooltipHoverTimeout);
        tooltipHoverTimeout = window.setTimeout(() => {
          let content: TooltipContent | null = null;
          if (elementInfo.type === "node" && elementInfo.item) {
            const n = this.nodeManager.getNode(elementInfo.item.id);
            if (n)
              content = {
                title: n.title,
                type: n.type,
                description: n.description,
                id: n.id.slice(0, 8),
              };
          } else if (elementInfo.type === "stickyNote" && elementInfo.item) {
            const n = this.stickyNoteManager.getNote(elementInfo.item.id);
            if (n)
              content = {
                title: "Sticky Note",
                description:
                  n.content.substring(0, 100) +
                  (n.content.length > 100 ? "..." : ""),
                id: n.id.slice(0, 8),
              };
          } else if (
            elementInfo.type === "connection" &&
            elementInfo.connectionDetails
          ) {
            const c = elementInfo.connectionDetails;
            const sP = this.nodeManager.getPort(c.sourcePortId);
            const tP = this.nodeManager.getPort(c.targetPortId);
            content = {
              title: c.data?.label || "Connection",
              description: `From: ${sP?.name || "?"} To: ${tP?.name || "?"}`,
              id: c.id.slice(0, 8),
            };
          } else if (elementInfo.type === "port" && elementInfo.portDetails) {
            const p = elementInfo.portDetails;
            content = {
              title: p.name,
              type: `${p.type} port (${p.isDynamic ? "dynamic" : "fixed"})`,
              description: p.description,
              id: p.id.slice(0, 8),
            };
          }

          if (elementInfo.type === "group" && elementInfo.item) {
            const g = this.nodeGroupManager.getGroup(elementInfo.item.id);
            if (g)
              content = {
                title: g.title,
                type: "Group",
                description: `${g.childNodes.size} nodes`,
                id: g.id.slice(0, 8),
              };
          }

          if (content && this.tooltip)
            this.tooltip.scheduleShow(clientPoint, content);
        }, 500);
      }
    );
    this.interactionManager.on("elementHoverEnd", () => {
      if (tooltipHoverTimeout) clearTimeout(tooltipHoverTimeout);
      this.tooltip?.hide();
    });

    this.quickAddMenu?.on("itemSelected", this.handleQuickAddItemChosen);
    this.contextMenu?.on("itemClicked", this.handleContextMenuItemClicked);

    this.dndController.on("itemDropped", (item: Node | StickyNote) => {
      this.events.emit("itemAdded", item);
    });

    this.configPanel?.on(EVENT_CONFIG_APPLIED, (item: ConfigurableItem) => {
      this.events.emit("itemConfigApplied", item);
      if (
        this.configPanel &&
        this.selectionManager.getSingleSelectedItem() === item.id
      ) {
        const itemType = item.hasOwnProperty("childNodes")
          ? "group"
          : item.hasOwnProperty("fixedInputs")
          ? "node"
          : item.hasOwnProperty("content")
          ? "stickyNote"
          : "connection";
        this.configPanel.show(item, itemType as ConfigurableItemType);
      }
      makeHistoryCheckpoint();
    });

    this.configPanel?.on(EVENT_NODE_TEST_REQUESTED, (node: Node) => {
      this.events.emit("testNodeRequested", node);
    });

    this.configPanel?.on(
      EVENT_NODE_DATA_CHANGED_WITH_VARIABLES,
      (event: { nodeId: string; newData: any; oldData: any }) => {
        this.nodeManager.updateNodeDataAndParseVariables(
          event.nodeId,
          event.newData,
          event.oldData
        );
      }
    );
  }

  private wireUpShortcuts(): void {
    this.shortcutManager.on("copy", this.handleCopy);
    this.shortcutManager.on("paste", this.handlePaste);
    this.shortcutManager.on("cut", this.handleCut);
    this.shortcutManager.on("delete", this.handleDelete);
    this.shortcutManager.on("undo", this.handleUndo);
    this.shortcutManager.on("redo", this.handleRedo);
    this.shortcutManager.on("selectAll", this.handleSelectAll);
    this.shortcutManager.on("escape", this.handleEscape);
    this.shortcutManager.on("toggleSnapToGrid", () =>
      this.viewStore.toggleSnapToGrid()
    );
    this.shortcutManager.on("zoomToFit", () => this.zoomToFitContent());
    this.shortcutManager.on("zoomToSelection", () => this.zoomToSelection());
    this.shortcutManager.on("resetView", () => this.viewStore.resetView());
    this.shortcutManager.on("autoLayout", this.autoLayout.bind(this));
  }

  private handleCopy = (): void => {
    const selectedIds = this.selectionManager.getSelectedItems();
    if (selectedIds.length === 0) return;
    const itemsToCopy: Array<{
      originalId: string;
      type: ClipboardableItemType;
      data: Node | StickyNote;
    }> = [];
    selectedIds.forEach((id) => {
      const node = this.nodeManager.getNode(id);
      if (node) itemsToCopy.push({ originalId: id, type: "node", data: node });
      else {
        const stickyNote = this.stickyNoteManager.getNote(id);
        if (stickyNote)
          itemsToCopy.push({
            originalId: id,
            type: "stickyNote",
            data: stickyNote,
          });
      }
    });
    if (itemsToCopy.length > 0) {
      this.clipboardManager.copy(itemsToCopy);
      this.events.emit("itemsCopied", itemsToCopy);
    }
  };

  private handlePaste = (): void => {
    if (!this.clipboardManager.canPaste()) return;
    const pasteCenterCanvas = this.canvasEngine.getClientToCanvasCoordinates({
      x: this.canvasEngine.getCanvasElement().width / 2,
      y: this.canvasEngine.getCanvasElement().height / 2,
    });
    const itemsToPaste =
      this.clipboardManager.preparePasteData(pasteCenterCanvas);
    const newPastedItemIds: string[] = [];

    itemsToPaste.forEach((clipboardItem) => {
      let pastedItem: Node | StickyNote | null = null;
      const { type, data } = clipboardItem;
      if (type === "node") {
        const nodeData = data as Node;
        const definition = this.availableNodeDefinitions.find(
          (def) => def.id === nodeData.type
        );
        if (definition) {
          pastedItem = this.nodeManager.createNodeFromDefinition(
            definition,
            nodeData.position
          );

          nodeData.dynamicInputs?.forEach((p) =>
            this.nodeManager.addDynamicInputPort(
              pastedItem!.id,
              p.variableName || p.name,
              p.isHidden
            )
          );
          nodeData.dynamicOutputs?.forEach((p) =>
            this.nodeManager.addDynamicOutputPort(
              pastedItem!.id,
              p.name,
              p.outputValue || ""
            )
          );

          this.nodeManager.updateNode(pastedItem.id, {
            title: nodeData.title,
            width: nodeData.width,
            height: nodeData.height,
            data: JSON.parse(JSON.stringify(nodeData.data || {})),
            status: "unsaved",
          });
        }
      } else if (type === "stickyNote") {
        const noteData = data as StickyNote;
        pastedItem = this.stickyNoteManager.createNote(
          noteData.position,
          noteData.content,
          noteData.width,
          noteData.height
        );
        this.stickyNoteManager.updateNoteStyle(pastedItem.id, noteData.style);
      }
      if (pastedItem) newPastedItemIds.push(pastedItem.id);
    });

    if (newPastedItemIds.length > 0) {
      this.selectionManager.selectItems(newPastedItemIds, false);
      this.events.emit("itemsPasted", newPastedItemIds);
    }
    this.canvasEngine.requestRender();
  };

  private handleCut = (): void => {
    this.handleCopy();
    this.handleDelete();
  };

  private handleDelete = (): void => {
    const selectedIds = this.selectionManager.getSelectedItems();
    if (selectedIds.length === 0) return;
    const nodesToDelete: string[] = [];
    const stickiesToDelete: string[] = [];
    const connectionsToDelete: string[] = [];
    const groupsToDelete: string[] = [];

    selectedIds.forEach((id) => {
      if (this.nodeManager.getNode(id)) nodesToDelete.push(id);
      else if (this.stickyNoteManager.getNote(id)) stickiesToDelete.push(id);
      else if (this.connectionManager.getConnection(id))
        connectionsToDelete.push(id);
      else if (this.nodeGroupManager.getGroup(id)) groupsToDelete.push(id);
    });

    if (connectionsToDelete.length > 0)
      this.connectionManager.deleteConnections(connectionsToDelete);
    if (nodesToDelete.length > 0) this.nodeManager.deleteNodes(nodesToDelete);
    if (stickiesToDelete.length > 0)
      this.stickyNoteManager.deleteNotes(stickiesToDelete);
    if (groupsToDelete.length > 0) {
      groupsToDelete.forEach((id) => this.nodeGroupManager.deleteGroup(id));
    }

    this.selectionManager.clearSelection();
    this.events.emit("itemsDeleted", selectedIds);
    this.canvasEngine.requestRender();
  };

  private handleUndo = (): void => {
    const prevState = this.historyManager.undo();
    if (prevState) {
      this.loadGraphState(prevState, false);
      this.events.emit("undone", prevState);
    }
  };

  private handleRedo = (): void => {
    const nextState = this.historyManager.redo();
    if (nextState) {
      this.loadGraphState(nextState, false);
      this.events.emit("redone", nextState);
    }
  };

  private handleSelectAll = (): void => {
    const allNodeIds = this.nodeManager.getNodes().map((n) => n.id);
    const allStickyIds = this.stickyNoteManager.getNotes().map((s) => s.id);
    const allGroupIds = this.nodeGroupManager.getGroups().map((g) => g.id);
    this.selectionManager.selectItems(
      [...allNodeIds, ...allStickyIds, ...allGroupIds],
      false
    );
    this.canvasEngine.requestRender();
  };

  private handleEscape = (): void => {
    if (this.interactionManager.getPendingConnection())
      this.interactionManager.cancelPendingOrReconnectingConnection();
    else if (this.selectionManager.getSelectionCount() > 0)
      this.selectionManager.clearSelection();
    else if (
      this.quickAddMenu &&
      (this.quickAddMenu as any).isVisible &&
      (this.quickAddMenu as any).isVisible()
    )
      this.quickAddMenu.hide();
    else if (
      this.contextMenu &&
      (this.contextMenu as any).isVisible &&
      (this.contextMenu as any).isVisible()
    )
      this.contextMenu.hide();
    else if (
      this.configPanel &&
      (this.configPanel as any).isVisible &&
      (this.configPanel as any).isVisible()
    )
      this.configPanel.hide();
    this.events.emit("escapePressed");
  };

  private handleCanvasContextMenu = (e: CanvasPointerEvent): void => {
    if (!this.contextMenu) return;
    const { clientPoint, canvasPoint } = e;
    const iElem =
      this.interactionManager.getInteractiveElementAtPoint(canvasPoint);
    if (
      iElem.item &&
      !this.selectionManager.isSelected(iElem.item.id) &&
      (iElem.type === "node" ||
        iElem.type === "stickyNote" ||
        iElem.type === "connection" ||
        iElem.type === "group") // NEW
    ) {
      this.selectionManager.selectItem(iElem.item.id, false);
    } else if (
      iElem.type === "canvas" &&
      this.selectionManager.getSelectionCount() === 0
    )
      this.selectionManager.clearSelection();
    const context: ContextMenuContext = {
      targetType: iElem.type,
      targetId: iElem.id,
      canvasPoint,
      clientPoint,
    };
    const menuItems = this.getContextMenuItemsForContext(context);
    if (menuItems.length > 0)
      this.contextMenu.show(clientPoint, context, menuItems);
  };

  private getContextMenuItemsForContext(
    context: ContextMenuContext
  ): ContextMenuItemAction[] {
    const items: ContextMenuItemAction[] = [];
    const { targetType, targetId } = context;
    const selCount = this.selectionManager.getSelectionCount();

    if (selCount > 0) {
      const selectedNodes = this.selectionManager
        .getSelectedItems()
        .map((id) => this.nodeManager.getNode(id))
        .filter((n): n is Node => !!n);

      if (selectedNodes.length > 1) {
        items.push({
          id: "group-selection",
          label: `Group ${selectedNodes.length} Nodes`,
          iconName: "ph-selection-plus",
          action: () => {
            const newGroup = this.nodeGroupManager.createGroup(selectedNodes);
            if (newGroup) {
              this.selectionManager.selectItem(newGroup.id, false);
            }
          },
          separatorBefore: true,
        });
      }
    }

    // Actions for when a group is right-clicked
    if (targetType === "group" && targetId) {
      const group = this.nodeGroupManager.getGroup(targetId);
      if (group) {
        items.push({
          id: "config-group",
          label: `Configure Group '${group.title}'`,
          iconName: "ph-paint-brush",
          action: () => this.configPanel?.show(group, "group"),
        });
        items.push({
          id: "convert-to-composite",
          label: "Convert to Composite Node",
          iconName: "ph-stack", // Um ícone adequado
          action: () => this.convertGroupToCompositeNode(targetId),
        });
        items.push({
          id: "ungroup",
          label: "Ungroup",
          iconName: "ph-selection-slash",
          action: () => this.nodeGroupManager.deleteGroup(targetId, false),
        });
      }
    }

    if (targetType === "node" && targetId) {
      const node = this.nodeManager.getNode(targetId);
      if (node) {
        if (node.groupId) {
          const group = this.nodeGroupManager.getGroup(node.groupId);
          if (group) {
            items.push({
              id: "ungroup-node",
              label: `Ungroup from '${group.title}'`,
              iconName: "ph-selection-slash",
              action: () =>
                this.nodeGroupManager.removeNodeFromGroup(
                  node.groupId!,
                  node.id
                ),
              separatorBefore: items.length > 0,
            });
          }
        }

        items.push({
          id: "config-node",
          label: `Configure '${node.title}'`,
          iconName: "ph-gear",
          action: () => this.configPanel?.show(node, "node"),
        });
        items.push({
          id: "duplicate-node",
          label: "Duplicate Node",
          iconName: "ph-copy",
          action: () => this.duplicateSelectedItems(),
        });
      }
    } else if (targetType === "stickyNote" && targetId) {
      const note = this.stickyNoteManager.getNote(targetId);
      if (note) {
        items.push({
          id: "config-note",
          label: "Configure Note Style",
          iconName: "ph-paint-brush",
          action: () => this.configPanel?.show(note, "stickyNote"),
        });
        items.push({
          id: "duplicate-note",
          label: "Duplicate Note",
          iconName: "ph-copy",
          action: () => this.duplicateSelectedItems(),
        });
      }
    } else if (targetType === "connection" && targetId) {
      const conn = this.connectionManager.getConnection(targetId);
      if (conn)
        items.push({
          id: "config-connection",
          label: "Configure Connection",
          iconName: "ph-pencil-simple",
          action: () => this.configPanel?.show(conn, "connection"),
        });
    } else if (targetType === "canvas") {
      const pointForAdd =
        context.canvasPoint || this.canvasEngine.getCenterCanvasPoint();
      const clientPointForAdd =
        this.canvasEngine.getCanvasToClientCoordinates(pointForAdd);
      items.push({
        id: "add-node-ctx",
        label: "Add Node...",
        iconName: "ph-plus-circle",
        action: () => {
          this.quickAddMenu?.show(clientPointForAdd, pointForAdd);
        },
      });
      items.push({
        id: "add-sticky-ctx",
        label: "Add Sticky Note",
        iconName: "ph-note-pencil",
        action: () => {
          const note = this.stickyNoteManager.createNote(pointForAdd);
          this.selectionManager.selectItem(note.id, false);
        },
      });
      if (this.clipboardManager.canPaste())
        items.push({
          id: "paste-ctx",
          label: "Paste",
          iconName: "ph-clipboard-text",
          action: this.handlePaste,
          separatorBefore: true,
        });
    }
    if (selCount > 0) {
      let deleteLabel = `Delete ${
        selCount > 1 ? `${selCount} Items` : "Selected"
      }`;
      if (
        selCount === 1 &&
        targetId &&
        this.selectionManager.isSelected(targetId)
      ) {
        if (targetType === "node") deleteLabel = "Delete Node";
        else if (targetType === "stickyNote") deleteLabel = "Delete Note";
        else if (targetType === "connection") deleteLabel = "Delete Connection";
      }
      if (!items.some((i) => i.id.startsWith("delete-")))
        items.push({
          id: "delete-selected-ctx",
          label: deleteLabel,
          iconName: "ph-trash",
          action: this.handleDelete,
          separatorBefore: items.length > 0,
        });
    }
    return items;
  }

  private duplicateSelectedItems(): void {
    if (this.selectionManager.getSelectionCount() > 0) {
      this.handleCopy();
      this.handlePaste();
    }
  }

  private handleContextMenuItemClicked = (
    actionId: string,
    context?: ContextMenuContext
  ): void => {
    this.events.emit("contextActionTriggered", actionId, context);
  };

  private handleCanvasDoubleClick = (e: CanvasPointerEvent): void => {
    const iElem = this.interactionManager.getInteractiveElementAtPoint(
      e.canvasPoint
    );
    if (iElem.type === "canvas")
      this.quickAddMenu?.show(e.clientPoint, e.canvasPoint);
  };

  private handleQuickAddItemChosen = (
    definition: NodeDefinition,
    canvasPosition: Point
  ): void => {
    const viewState = this.viewStore.getState();
    let dropPos = canvasPosition;
    if (viewState.snapToGrid)
      dropPos = {
        x:
          Math.round(canvasPosition.x / viewState.gridSize) *
          viewState.gridSize,
        y:
          Math.round(canvasPosition.y / viewState.gridSize) *
          viewState.gridSize,
      };
    let newItem: Node | StickyNote | null = null;
    if (definition.id === "sticky-note-def")
      newItem = this.stickyNoteManager.createNote(dropPos);
    else
      newItem = this.nodeManager.createNodeFromDefinition(definition, dropPos);
    if (newItem) {
      this.selectionManager.selectItem(newItem.id, false);
      this.events.emit("itemAddedFromQuickAdd", newItem);
    }
    this.canvasEngine.requestRender();
  };

  public updatePreferences(newPrefs: Partial<EditorPreferences>): void {
    this.viewStore.updatePreferences(newPrefs);
  }

  public async saveGraphToLocalStorage(): Promise<void> {
    const currentGraphId = this.viewStore.getCurrentGraphId();
    const stateToSave = this.getCurrentGraphState();

    // Atualizar o estado correto no grafo completo antes de salvar
    if (currentGraphId === "root") {
      this.fullGraphState = stateToSave;
    } else {
      const parentNode = this.findNodeInFullState(currentGraphId);
      if (parentNode) {
        parentNode.subgraph = stateToSave;
      }
    }

    await this.platformDataService.saveGraph(this.fullGraphState);
  }

  public async loadGraphFromLocalStorage(): Promise<boolean> {
    const loadedState = await this.platformDataService.loadGraph();
    if (loadedState) {
      this.fullGraphState = JSON.parse(JSON.stringify(loadedState));
      this.viewStore.navigateUpTo("root"); // Resetar a navegação para a raiz
      this.loadGraphState(this.fullGraphState, true);
      return true;
    }
    return false;
  }

  public getLocalStorageKey(): string {
    return LOCAL_STORAGE_GRAPH_KEY;
  }

  public async clearGraph(): Promise<void> {
    this.loadGraphState(
      {
        nodes: [],
        connections: [],
        stickyNotes: [],
        nodeGroups: [], // NEW
        viewState: this.viewStore.getState(),
      },
      true
    );
    await this.platformDataService.clearSavedGraph();
  }

  private getCurrentGraphState(): GraphState {
    const pureState = {
      nodes: this.nodeManager.getNodes(),
      connections: this.connectionManager.getConnections(),
      stickyNotes: this.stickyNoteManager.getNotes(),
      nodeGroups: this.nodeGroupManager.getGroups(),
      viewState: this.viewStore.getState(),
    };
    return JSON.parse(JSON.stringify(pureState));
  }

  private loadGraphState(
    graphState: GraphState,
    pushToHistory: boolean = true,
    saveToFullState: boolean = true
  ): void {
    this.selectionManager.clearSelection();
    this.nodeManager.loadNodes(graphState.nodes || []);
    this.connectionManager.loadConnections(graphState.connections || []);
    this.stickyNoteManager.loadNotes(graphState.stickyNotes || []);
    this.nodeGroupManager.loadGroups(graphState.nodeGroups || []);

    if (graphState.viewState) {
      this.viewStore.setState(graphState.viewState);
    } else {
      this.zoomToFitContent();
    }

    if (saveToFullState) {
      const currentGraphId = this.viewStore.getCurrentGraphId();
      if (currentGraphId === "root") {
        this.fullGraphState = JSON.parse(JSON.stringify(graphState));
      } else {
        const parentNode = this.findNodeInFullState(currentGraphId);
        if (parentNode) {
          parentNode.subgraph = this.getCurrentGraphState();
        }
      }
    }

    if (pushToHistory && !this.historyManager.isRestoringState()) {
      this.historyManager.push(this.getCurrentGraphState());
    }

    this.toolbar?.refresh();
    this.canvasEngine.requestRender();
    this.events.emit("graphLoaded", graphState);
  }

  private recordInitialHistoryState(): void {
    if (!this.historyManager.canUndo() && !this.historyManager.canRedo())
      this.historyManager.recordInitialState(this.getCurrentGraphState());
  }

  public zoomToFitContent(): void {
    const allItems: Array<{ position: Point; width: number; height: number }> =
      [...this.nodeManager.getNodes(), ...this.stickyNoteManager.getNotes()];
    if (allItems.length === 0) {
      this.viewStore.resetView();
      return;
    }
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    allItems.forEach((item) => {
      minX = Math.min(minX, item.position.x);
      minY = Math.min(minY, item.position.y);
      maxX = Math.max(maxX, item.position.x + item.width);
      maxY = Math.max(maxY, item.position.y + item.height);
    });
    if (isFinite(minX)) {
      const contentRect: Rect = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
      this.canvasEngine.zoomToFit(contentRect, 50);
    } else this.viewStore.resetView();
  }

  public zoomToSelection(): void {
    const selectedIds = this.selectionManager.getSelectedItems();
    if (selectedIds.length === 0) return;
    const selectedItems: Array<{
      position: Point;
      width: number;
      height: number;
    }> = [];
    selectedIds.forEach((id) => {
      const node = this.nodeManager.getNode(id);
      if (node) selectedItems.push(node);
      else {
        const sticky = this.stickyNoteManager.getNote(id);
        if (sticky) selectedItems.push(sticky);
      }
    });
    if (selectedItems.length === 0) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    selectedItems.forEach((item) => {
      minX = Math.min(minX, item.position.x);
      minY = Math.min(minY, item.position.y);
      maxX = Math.max(maxX, item.position.x + item.width);
      maxY = Math.max(maxY, item.position.y + item.height);
    });
    if (isFinite(minX)) {
      const selectionRect: Rect = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
      this.canvasEngine.zoomToFit(selectionRect, 80);
    }
  }

  public async getNodeDefinitions(): Promise<NodeDefinition[]> {
    if (this.availableNodeDefinitions.length === 0) {
      await this.loadInitialNodeDefinitions();
    }
    return this.availableNodeDefinitions;
  }

  public applyItemConfig(
    itemId: string,
    itemType: ConfigurableItemType,
    data: any
  ): void {
    if (itemType === "node") {
      this.nodeManager.updateNode(itemId, { data });
    } else if (itemType === "stickyNote") {
      this.stickyNoteManager.updateNote(itemId, { style: data });
    } else if (itemType === "connection") {
      this.connectionManager.updateConnectionData(itemId, data);
    }
    this.historyManager.push(this.getCurrentGraphState());
  }

  public on(eventName: string, listener: (...args: any[]) => void): this {
    this.events.on(eventName, listener);
    return this;
  }
  public off(eventName: string, listener: (...args: any[]) => void): this {
    this.events.off(eventName, listener);
    return this;
  }

  public convertGroupToCompositeNode(groupId: string): void {
    this.historyManager.beginTransaction();
    try {
      const group = this.nodeGroupManager.getGroup(groupId);
      if (!group) {
        this.historyManager.endTransaction();
        return;
      }
  
      const childNodeIds = new Set(group.childNodes);
      if (childNodeIds.size === 0) {
        this.historyManager.endTransaction();
        return;
      }

      const childNodes = Array.from(childNodeIds).map(id => this.nodeManager.getNode(id)).filter(n => n) as Node[];
      
      // Calculate bounds of the group to normalize positions
      let minX = Infinity, minY = Infinity;
      childNodes.forEach(node => {
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
      });
  
      // --- Lógica de Clonagem Segura ---
      const cloneNode = (node: Node): Node => ({
        ...node,
        // Normalize position relative to group bounds and clear groupId
        position: { 
          x: node.position.x - minX + 40, 
          y: node.position.y - minY + 40 
        },
        groupId: undefined, // Clear the groupId since it's no longer part of the original group
        data: node.data ? JSON.parse(JSON.stringify(node.data)) : {},
        config: node.config ? JSON.parse(JSON.stringify(node.config)) : undefined,
        fixedInputs: node.fixedInputs.map(p => ({ ...p, connections: [...p.connections] })),
        fixedOutputs: node.fixedOutputs.map(p => ({ ...p, connections: [...p.connections] })),
        dynamicInputs: node.dynamicInputs.map(p => ({ ...p, connections: [...p.connections] })),
        dynamicOutputs: node.dynamicOutputs.map(p => ({ ...p, connections: [...p.connections] })),
        subgraph: node.subgraph ? JSON.parse(JSON.stringify(node.subgraph)) : undefined,
      });
  
      const cloneConnection = (conn: Connection): Connection => ({
        ...conn,
        data: conn.data ? { ...conn.data } : undefined,
        style: conn.style ? { ...conn.style } : undefined,
      });
      // --- Fim da Lógica de Clonagem Segura ---
  
      const allConnections = this.connectionManager.getConnections();
      const internalConnections: Connection[] = [];
      const externalConnections: Connection[] = [];
  
      allConnections.forEach(c => {
        const sourceInGroup = childNodeIds.has(c.sourceNodeId);
        const targetInGroup = childNodeIds.has(c.targetNodeId);
        if (sourceInGroup && targetInGroup) {
          internalConnections.push(c);
        } else if (sourceInGroup !== targetInGroup) {
          externalConnections.push(c);
        }
      });

      // Create composite node ID first to use in navigation path
      const compositeNodeId = nanoid();
  
      const subgraphState: GraphState = {
        nodes: childNodes.map(cloneNode), // Usando a clonagem segura
        connections: internalConnections.map(cloneConnection), // Usando a clonagem segura
        stickyNotes: [],
        nodeGroups: [],
        viewState: { 
          ...this.viewStore.getState(), 
          offset: { x: 0, y: 0 }, 
          scale: 1, 
          navigationPath: [...this.viewStore.getState().navigationPath, { graphId: compositeNodeId, label: group.title }]
        }
      };
  
      const compositeNode: Node = {
        id: compositeNodeId,
        title: group.title,
        type: 'composite-node',
        description: 'A composite node containing a subgraph.',
        position: { ...group.position },
        width: group.width,
        height: group.height,
        color: group.style.borderColor,
        icon: 'ph-stack',
        isComposite: true,
        subgraph: subgraphState,
        fixedInputs: [],
        fixedOutputs: [],
        dynamicInputs: [],
        dynamicOutputs: [],
        data: {}
      };
  
      const portMap = new Map<string, string>();
      
      externalConnections.forEach(conn => {
        if (childNodeIds.has(conn.targetNodeId)) {
          const internalPortId = conn.targetPortId;
          if (!portMap.has(internalPortId)) {
            const internalPort = this.nodeManager.getPort(internalPortId);
            if (internalPort) {
              const newPort: NodePort = { id: nanoid(), nodeId: compositeNode.id, name: internalPort.name, type: 'input', connections: [], isDynamic: false };
              compositeNode.fixedInputs.push(newPort);
              portMap.set(internalPortId, newPort.id);
            }
          }
        } else if (childNodeIds.has(conn.sourceNodeId)) {
          const internalPortId = conn.sourcePortId;
          if (!portMap.has(internalPortId)) {
            const internalPort = this.nodeManager.getPort(internalPortId);
            if (internalPort) {
              const newPort: NodePort = { id: nanoid(), nodeId: compositeNode.id, name: internalPort.name, type: 'output', connections: [], isDynamic: false };
              compositeNode.fixedOutputs.push(newPort);
              portMap.set(internalPortId, newPort.id);
            }
          }
        }
      });
      
      // First delete the child nodes and group
      this.nodeManager.deleteNodes(Array.from(childNodeIds));
      this.nodeGroupManager.deleteGroup(groupId, false);
      
      // Then add the composite node
      this.nodeManager._addNodeObject(compositeNode);
      
      // Recreate external connections
      externalConnections.forEach(conn => {
        const newSourceId = portMap.get(conn.sourcePortId) || conn.sourcePortId;
        const newTargetId = portMap.get(conn.targetPortId) || conn.targetPortId;
        if (this.nodeManager.getPort(newSourceId) && this.nodeManager.getPort(newTargetId)) {
          this.connectionManager.createConnection(newSourceId, newTargetId);
        }
      });
      
      // Update the current graph state in fullGraphState to include the new composite node
      const currentGraphId = this.viewStore.getCurrentGraphId();
      if (currentGraphId === "root") {
        // We're at the root level, update fullGraphState directly
        const currentState = this.getCurrentGraphState();
        this.fullGraphState = currentState;
      } else {
        // We're in a subgraph, find the parent node and update its subgraph
        const parentNode = this.findNodeInFullState(currentGraphId);
        if (parentNode) {
          parentNode.subgraph = this.getCurrentGraphState();
        }
      }
      
      // Manually trigger events since _addNodeObject doesn't
      this.nodeManager['events'].emit('nodeCreated', compositeNode);
      this.nodeManager['events'].emit(EVENT_NODES_UPDATED, this.nodeManager.getNodes());
  
      this.selectionManager.selectItem(compositeNode.id, false);
      this.events.emit('groupConverted', { groupId, compositeNodeId: compositeNode.id });

    } finally {
      this.historyManager.endTransaction(this.getCurrentGraphState());
      this.canvasEngine.requestRender();
    }
  }

  public destroy(): void {
    this.shortcutManager.destroy();
    this.dndController.destroy();
    this.interactionManager.destroy();
    this.renderService.destroy();
    this.canvasEngine.destroy();
    this.nodePalette?.destroy();
    this.configPanel?.destroy();
    this.toolbar?.destroy();
    this.contextMenu?.destroy();
    this.quickAddMenu?.destroy();
    this.tooltip?.destroy();
    this.historyManager.destroy();
    this.clipboardManager.destroy();
    this.selectionManager.destroy();
    this.connectionManager.destroy();
    this.nodeManager.destroy();
    this.viewStore.destroy();
    this.container.innerHTML = "";
    this.events.removeAllListeners();
    console.log("NodeEditorController destroyed.");
  }
}
