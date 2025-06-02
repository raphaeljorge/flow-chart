export interface Point {
  x: number;
  y: number;
}

export interface NodePort {
  id: string;
  type: 'input' | 'output';
  name: string;
  nodeId: string;
  position: Point;
  connections: string[];
  maxConnections?: number;
  description?: string;
}

export interface Node {
  id: string;
  title: string;
  type: string;
  description?: string;
  position: Point;
  width: number;
  height: number;
  inputs: NodePort[];
  outputs: NodePort[];
  data?: any;
  minWidth?: number;
  minHeight?: number;
  status?: 'success' | 'error' | 'running' | 'warning' | 'unsaved';
  icon?: string;
  config?: NodeConfig;
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
  config?: NodeConfig;
}

export interface NodeConfig {
  id: string;
  nodeType: string;
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
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'code' | 'file' | 'color' | 'datetime' | 'secret';
  label: string;
  description?: string;
  defaultValue?: any;
  required?: boolean;
  options?: { label: string; value: any }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    custom?: (value: any) => boolean | string;
  };
}

export interface Connection {
  id: string;
  sourcePortId: string;
  targetPortId: string;
  sourceNode: string;
  targetNode: string;
}

export interface ViewState {
  scale: number;
  offset: Point;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
}

export interface NodeDefinition {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  config?: NodeConfig;
}

export interface NodeEditorOptions {
  showPalette: boolean;
  showToolbar: boolean;
  defaultScale: number;
  gridSize: number;
  showGrid: boolean;
  snapToGrid: boolean;
}