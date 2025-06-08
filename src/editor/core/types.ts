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

export type CanvasBackgroundPattern = 'solid' | 'dots' | 'lines';

export interface NodePort {
  id: string;
  type: "input" | "output";
  name: string;
  nodeId: string;
  connections: string[]; 
  maxConnections?: number;
  description?: string;
  isDynamic?: boolean;
  variableName?: string;
  isHidden?: boolean;
  outputValue?: string;
}

export interface Node {
  id: string;
  title: string;
  type: string;
  description?: string;
  position: Point;
  width: number;
  height: number;
  fixedInputs: NodePort[];
  fixedOutputs: NodePort[];
  dynamicInputs: NodePort[];
  dynamicOutputs: NodePort[];
  data?: any;
  minWidth?: number;
  minHeight?: number;
  status?: "success" | "error" | "running" | "warning" | "unsaved";
  icon?: string;
  config?: NodeConfig;
  color?: string;
  groupId?: string;
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
  minWidth?: number;
  minHeight?: number;
}

export interface NodeGroup {
  id: string;
  title: string;
  position: Point;
  width: number;
  height: number;
  childNodes: Set<string>;
  style: {
    backgroundColor: string;
    borderColor: string;
    titleColor: string;
  };
  minWidth?: number;
  minHeight?: number;
}

export interface NodeConfig {
  id: string;
  itemType: ConfigurableItemType;
  parameters: ConfigParameter[];
  tabs?: ConfigTab[];
}

export interface ConfigTab {
  id: string;
  label: string;
  icon?: string;
}

export interface ConfigParameter {
  id: string;
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
    | "button";
  label: string;
  description?: string;
  defaultValue?: any;
  required?: boolean;
  options?: { label: string; value: any }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    custom?: (value: any, itemData?: any) => boolean | string;
  };
  tabId?: string;
}

export interface Connection {
  id: string;
  sourcePortId: string;
  targetPortId: string;
  sourceNodeId: string;
  targetNodeId: string;
  data?: {
    label?: string;
    color?: string;
  };
}

export interface ViewState {
  scale: number;
  offset: Point;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  backgroundPattern: CanvasBackgroundPattern;
}

export interface NodeDefinition {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  config?: NodeConfig;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  color?: string;
  defaultInputs?: Array<
    Omit<
      NodePort,
      "id" | "nodeId" | "connections" | "isDynamic" | "variableName" | "isHidden" | "outputValue"
    >
  >;
  defaultOutputs?: Array<
    Omit<
      NodePort,
      "id" | "nodeId" | "connections" | "isDynamic" | "variableName" | "isHidden" | "outputValue"
    >
  >;
}

export interface NodeEditorOptions {
  showPalette: boolean;
  showToolbar: boolean;
  showConfigPanel?: boolean;
  showMinimap?: boolean;
  defaultScale: number;
  gridSize: number;
  showGrid: boolean;
  snapToGrid: boolean;
  nodeDefinitions?: NodeDefinition[];
}

export interface CanvasPointerEvent {
  canvasPoint: Point;
  clientPoint: Point;
  originalEvent: MouseEvent | TouchEvent;
}

export interface CanvasWheelEvent {
  deltaY: number;
  clientPoint: Point;
  originalEvent: WheelEvent;
}

export type InteractiveElementType =
  | "node"
  | "stickyNote"
  | "port"
  | "resizeHandle"
  | "connection"
  | "group"
  | "canvas";

export interface ReconnectingConnectionInfo {
  originalConnection: Connection;
  draggedEnd: "source" | "target";
  fixedPort: NodePort;
  fixedNode: Node;
}

export type ConfigurableItem = Node | StickyNote | Connection | NodeGroup;
export type ConfigurableItemType = "node" | "stickyNote" | "connection" | "group";

export interface NodeDataVariableParseEvent {
  nodeId: string;
  oldData: any;
  newData: any;
}

export type ClipboardableItemType = "node" | "stickyNote";

export interface ClipboardItem {
  id: string;
  originalId: string;
  type: ClipboardableItemType;
  data: Node | StickyNote;
  relativeOffset?: Point;
}

export interface GraphState {
  nodes: Node[];
  stickyNotes: StickyNote[];
  connections: Connection[];
  nodeGroups: NodeGroup[];
  viewState: ViewState;
}