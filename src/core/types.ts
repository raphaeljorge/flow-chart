// src/core/Types.ts
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
}

export interface NodeConfig { // Usado também para configurar outros itens como Conexões
  id: string; // ID da configuração (ex: 'connection-default-config')
  itemType: InteractiveElementType; // Tipo do item ao qual esta configuração se aplica
  parameters: ConfigParameter[];
  tabs?: ConfigTab[];
}

export interface ConfigTab {
  id: string;
  label: string;
  icon?: string;
}

export interface ConfigParameter {
  id: string; // Chave dentro do objeto 'data' do item
  type:
    | 'text' | 'number' | 'boolean' | 'select' | 'multiselect'
    | 'code' | 'file' | 'color' | 'datetime' | 'secret';
  label: string;
  description?: string;
  defaultValue?: any;
  required?: boolean;
  options?: { label: string; value: any }[];
  validation?: { min?: number; max?: number; pattern?: string; custom?: (value: any) => boolean | string; };
  tabId?: string;
}

export interface Connection {
  id: string;
  sourcePortId: string;
  targetPortId: string;
  sourceNodeId: string;
  targetNodeId: string;
  data?: any; // Adicionado para propriedades configuráveis (ex: label, cor)
  // Adicionar 'config?: NodeConfig;' se quisermos uma estrutura de configuração dedicada para conexões.
  // Por ora, 'data' será usado diretamente.
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
  config?: NodeConfig; // NodeConfig aqui se refere à config do NÓ
  defaultWidth?: number;
  defaultHeight?: number;
  defaultInputs?: Array<Omit<NodePort, 'id' | 'nodeId' | 'position' | 'connections'>>;
  defaultOutputs?: Array<Omit<NodePort, 'id' | 'nodeId' | 'position' | 'connections'>>;
}

export interface NodeEditorOptions {
  showPalette: boolean;
  showToolbar: boolean;
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

export type InteractiveElementType = 'node' | 'stickyNote' | 'port' | 'resizeHandle' | 'connection' | 'canvas';

export interface ReconnectingConnectionInfo {
    originalConnection: Connection;
    draggedEnd: 'source' | 'target';
    fixedPort: NodePort;
    fixedNode: Node;
}

// Novo: Tipo para itens que podem ser configurados pelo ConfigPanel
export type ConfigurableItem = Node | StickyNote | Connection;
export type ConfigurableItemType = 'node' | 'stickyNote' | 'connection';