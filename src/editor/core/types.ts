// src/editor/core/types.ts
export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

export interface NodePort {
  id: string;
  type: "input" | "output";
  name: string;
  nodeId: string;
  // position: Point; // Position is now calculated dynamically by InteractionManager/RenderService
  connections: string[]; // IDs of connections linked to this port
  maxConnections?: number; // Max number of connections (1 for input by default, Infinity for output)
  description?: string;
  isDynamic?: boolean; // True if the port was added dynamically (e.g., based on node data)
  variableName?: string; // For dynamic inputs, the variable it represents
  isHidden?: boolean; // For dynamic ports that might be temporarily hidden
  outputValue?: string; // For dynamic outputs, a way to define or preview its value
}

export interface Node {
  id: string;
  title: string;
  type: string; // Corresponds to a NodeDefinition id
  description?: string;
  position: Point;
  width: number;
  height: number;

  fixedInputs: NodePort[]; // Ports defined by the NodeDefinition
  fixedOutputs: NodePort[];
  dynamicInputs: NodePort[]; // Ports added dynamically by the user or node logic
  dynamicOutputs: NodePort[];

  data?: any; // User-configurable data specific to this node instance
  minWidth?: number;
  minHeight?: number;
  status?: "success" | "error" | "running" | "warning" | "unsaved";
  icon?: string; // Icon identifier (e.g., 'ph-globe')
  config?: NodeConfig; // Configuration structure for this node type (from NodeDefinition)
  color?: string;
}

export interface StickyNote {
  id: string;
  content: string;
  position: Point;
  width: number;
  height: number;
  style: {
    backgroundColor: string;
    textColor: string;
    fontSize: number;
  };
}

// Represents the structure for configuring a Node, Connection, or potentially other items
export interface NodeConfig {
  // Renamed from ItemConfig for clarity, but can still apply to connections etc.
  id: string; // ID of the configuration set (e.g., 'webhook-config')
  itemType: ConfigurableItemType; // 'node', 'stickyNote', 'connection'
  parameters: ConfigParameter[];
  tabs?: ConfigTab[]; // Optional tabs for organizing parameters
}

export interface ConfigTab {
  id: string; // e.g., 'basic', 'advanced', 'security'
  label: string;
  icon?: string; // Icon for the tab
}

export interface ConfigParameter {
  id: string; // Key within the item's 'data' object (for Nodes) or specific properties
  type:
    | "text"
    | "number"
    | "boolean"
    | "select"
    | "multiselect"
    | "code"
    | "file"
    | "color"
    | "datetime"
    | "secret"
    | "button"; // Added 'button' type
  label: string;
  description?: string;
  defaultValue?: any;
  required?: boolean;
  options?: { label: string; value: any }[]; // For 'select' or 'multiselect'
  validation?: {
    // Basic validation rules
    min?: number;
    max?: number; // For 'number'
    pattern?: string; // For 'text' (regex)
    custom?: (value: any, itemData?: any) => boolean | string; // Custom validation function
  };
  tabId?: string; // Associates parameter with a specific tab
}

export interface Connection {
  id: string;
  sourcePortId: string;
  targetPortId: string;
  sourceNodeId: string; // Denormalized for easier access
  targetNodeId: string; // Denormalized for easier access
  data?: {
    // User-configurable data for the connection
    label?: string;
    color?: string; // e.g., to visually group connections
    // Potentially other connection-specific settings
  };
  // config?: NodeConfig; // Connections can also have configurations
}

// Specific to the CanvasEngine and ViewStore
export interface ViewState {
  scale: number;
  offset: Point;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
}

// Definition of a node type available in the palette
export interface NodeDefinition {
  id: string; // Unique identifier for the node type (e.g., 'trigger-webhook')
  title: string;
  description: string;
  category: string;
  icon: string; // Icon identifier (e.g., 'ph-globe')
  config?: NodeConfig; // Default configuration structure for this node type
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  color?: string;
  // Default fixed ports
  ddefaultInputs?: Array<
    Omit<
      NodePort,
      | "id"
      | "nodeId"
      | "connections"
      | "isDynamic"
      | "variableName"
      | "isHidden"
      | "outputValue"
    >
  >;
  defaultOutputs?: Array<
    Omit<
      NodePort,
      | "id"
      | "nodeId"
      | "connections"
      | "isDynamic"
      | "variableName"
      | "isHidden"
      | "outputValue"
    >
  >;
}

// Options for initializing the NodeEditorController
export interface NodeEditorOptions {
  showPalette: boolean;
  showToolbar: boolean;
  showMinimap?: boolean;
  defaultScale: number;
  gridSize: number;
  showGrid: boolean;
  snapToGrid: boolean;
  nodeDefinitions?: NodeDefinition[]; // Initial set of node definitions
}

// Event types for CanvasEngine
export interface CanvasPointerEvent {
  canvasPoint: Point; // Coordinates relative to the canvas content (considering pan/zoom)
  clientPoint: Point; // Coordinates relative to the browser window/client area
  originalEvent: MouseEvent | TouchEvent;
}

export interface CanvasWheelEvent {
  deltaY: number;
  clientPoint: Point;
  originalEvent: WheelEvent;
}

// Types for identifying interactive elements on the canvas
export type InteractiveElementType =
  | "node"
  | "stickyNote"
  | "port"
  | "resizeHandle"
  | "connection"
  | "canvas";

// Information needed when starting to reconnect an existing connection
export interface ReconnectingConnectionInfo {
  originalConnection: Connection;
  draggedEnd: "source" | "target"; // Which end of the connection is being dragged
  fixedPort: NodePort; // The port that remains connected
  fixedNode: Node; // The node of the fixed port
}

// Union type for items that can be configured via ConfigPanel
export type ConfigurableItem = Node | StickyNote | Connection;
export type ConfigurableItemType = "node" | "stickyNote" | "connection";

// Event payload for when node data changes and might contain variables
export interface NodeDataVariableParseEvent {
  nodeId: string;
  oldData: any; // Data before the change
  newData: any; // Data after the change, potentially with new variables
}

// Used for clipboard operations
export type ClipboardableItemType = "node" | "stickyNote";

export interface ClipboardItem {
  id: string; // New ID for the item when it's pasted
  originalId: string; // ID of the item that was copied
  type: ClipboardableItemType;
  data: Node | StickyNote; // A deep copy of the original item's data
  relativeOffset?: Point; // For multi-item copy, to maintain spacing
}

// Graph state for HistoryManager
export interface GraphState {
  nodes: Node[];
  stickyNotes: StickyNote[];
  connections: Connection[];
  viewState: ViewState; // To restore pan/zoom state as well
}
