// src/editor/state/NodeManager.ts
import { nanoid } from 'nanoid';
import { EventEmitter } from 'eventemitter3';
import { Node, NodePort, Point, Rect, NodeDefinition } from '../core/types';
import {
    EVENT_NODES_UPDATED, NODE_DEFAULT_ICON, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT,
    MIN_NODE_WIDTH, MIN_NODE_HEIGHT
} from '../core/constants';

export class NodeManager {
  private nodes: Map<string, Node>;
  private events: EventEmitter;
  private readonly VARIABLE_REGEX = /\{\{([a-zA-Z0-9_.-]+)\}\}/g; // Allow dots and hyphens in var names

  constructor() {
    this.nodes = new Map<string, Node>();
    this.events = new EventEmitter();
  }

  public createNodeFromDefinition(definition: NodeDefinition, position: Point): Node {
    const newNode: Node = {
      id: nanoid(),
      title: definition.title,
      type: definition.id, // This 'type' links back to the definition ID
      description: definition.description,
      position,
      width: definition.defaultWidth || DEFAULT_NODE_WIDTH,
      height: definition.defaultHeight || DEFAULT_NODE_HEIGHT,
      fixedInputs: [],
      fixedOutputs: [],
      dynamicInputs: [],
      dynamicOutputs: [],
      data: {},
      status: 'unsaved',
      icon: definition.icon || NODE_DEFAULT_ICON,
      config: definition.config,
      minWidth: definition.minWidth || MIN_NODE_WIDTH,
      minHeight: definition.minHeight || MIN_NODE_HEIGHT,
      color: definition.color || '#666666',
    };

    (definition.defaultInputs || []).forEach(inputDef => {
      this.addPortToNodeInstance(newNode, 'input', inputDef.name, false, inputDef.description, inputDef.maxConnections);
    });
    (definition.defaultOutputs || []).forEach(outputDef => {
      this.addPortToNodeInstance(newNode, 'output', outputDef.name, false, outputDef.description, outputDef.maxConnections);
    });

    if (definition.config?.parameters) {
      newNode.data = {};
      definition.config.parameters.forEach(param => {
        if (param.defaultValue !== undefined) {
          newNode.data[param.id] = JSON.parse(JSON.stringify(param.defaultValue)); // Deep copy default value
        }
      });
      // Initial variable parsing based on default data.
      // Pass the node instance directly to avoid map lookup before it's added.
      this.parseVariablesAndUpdatePorts(newNode, {...newNode.data}, {});
    }

    this.nodes.set(newNode.id, newNode);
    this.emitNodesUpdated();
    this.events.emit('nodeCreated', newNode);
    return newNode;
  }

  public getNode(nodeId: string): Node | undefined {
    return this.nodes.get(nodeId);
  }

  public getNodes(): Node[] {
    return Array.from(this.nodes.values());
  }

  public updateNode(nodeId: string, updates: Partial<Omit<Node, 'id' | 'fixedInputs' | 'fixedOutputs' | 'dynamicInputs' | 'dynamicOutputs'>>): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      const oldData = updates.data ? { ...node.data } : undefined;
      // Certifique-se de que a cor pode ser atualizada também
      Object.assign(node, updates); 
      
      if (updates.data && oldData) {
          this.parseVariablesAndUpdatePorts(node, node.data, oldData);
      }
      this.emitNodesUpdated();
      this.events.emit('nodeUpdated', node);
    }
  }
  
  // This method is specifically for ConfigPanel to call when data changes.
  public updateNodeDataAndParseVariables(nodeId: string, newData: any, oldData: any): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.data = JSON.parse(JSON.stringify(newData)); // Ensure data is a fresh copy
    this.parseVariablesAndUpdatePorts(node, node.data, oldData);

    this.emitNodesUpdated(); // For visual updates
    this.events.emit('nodeDataUpdated', node); // Specific event
    this.events.emit('nodeUpdated', node); // General update
  }


  private parseVariablesAndUpdatePorts(node: Node, newData: any, oldData: any): void {
    const oldVariables = new Set<string>();
    const newVariables = new Set<string>();

    this.extractVariablesFromObject(oldData, oldVariables);
    this.extractVariablesFromObject(newData, newVariables);

    const portsToRemove: NodePort[] = [];
    node.dynamicInputs.forEach(port => {
      if (port.variableName && !newVariables.has(port.variableName)) {
        portsToRemove.push(port);
      }
    });

    portsToRemove.forEach(port => {
      const index = node.dynamicInputs.findIndex(p => p.id === port.id);
      if (index !== -1) {
        node.dynamicInputs.splice(index, 1);
        this.events.emit('portRemoved', node, port); // ConnectionManager listens to this
      }
    });

    newVariables.forEach(varName => {
      if (!node.dynamicInputs.some(p => p.variableName === varName)) {
        this.addPortToNodeInstance(node, 'input', varName, true, `Input for variable '${varName}'`, 1, varName, false);
      }
    });
  }

  private extractVariablesFromObject(obj: any, variableSet: Set<string>): void {
    if (!obj) return;
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        let match;
        const regex = new RegExp(this.VARIABLE_REGEX); // Create new RegExp instance for each use with 'g'
        while ((match = regex.exec(obj[key])) !== null) {
          variableSet.add(match[1]);
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.extractVariablesFromObject(obj[key], variableSet);
      }
    }
  }

  public moveNode(nodeId: string, position: Point): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.position = position;
      this.emitNodesUpdated();
      this.events.emit('nodeMoved', node);
    }
  }

  public resizeNode(nodeId: string, newRect: Rect): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.position.x = newRect.x;
      node.position.y = newRect.y;
      node.width = Math.max(node.minWidth || MIN_NODE_WIDTH, newRect.width);
      node.height = Math.max(node.minHeight || MIN_NODE_HEIGHT, newRect.height);
      this.emitNodesUpdated();
      this.events.emit('nodeResized', node);
    }
  }

  public deleteNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      this.nodes.delete(nodeId);
      this.emitNodesUpdated();
      this.events.emit('nodeDeleted', node); // ConnectionManager listens to this
    }
  }

  public deleteNodes(nodeIds: string[]): void {
    const deletedNodes: Node[] = [];
    nodeIds.forEach(id => {
      const node = this.nodes.get(id);
      if (node) {
        this.nodes.delete(id);
        deletedNodes.push(node);
      }
    });
    if (deletedNodes.length > 0) {
      this.emitNodesUpdated();
      this.events.emit('nodesDeleted', deletedNodes); // ConnectionManager listens to this
    }
  }

  private addPortToNodeInstance(
    node: Node,
    type: 'input' | 'output',
    name: string,
    isDynamic: boolean,
    description?: string,
    maxConnections?: number,
    variableName?: string,
    isHidden: boolean = false,
    outputValue?: string
  ): NodePort {
    const port: NodePort = {
      id: nanoid(),
      type,
      name: (isDynamic && type === 'input' && variableName) ? variableName : name,
      nodeId: node.id,
      connections: [],
      description,
      maxConnections: maxConnections === undefined ? (type === 'input' ? 1 : Infinity) : maxConnections,
      isDynamic,
      variableName: (isDynamic && type === 'input') ? variableName : undefined,
      isHidden: isDynamic ? isHidden : false,
      outputValue: (isDynamic && type === 'output') ? outputValue : undefined,
    };

    const portArray = isDynamic
      ? (type === 'input' ? node.dynamicInputs : node.dynamicOutputs)
      : (type === 'input' ? node.fixedInputs : node.fixedOutputs);
    portArray.push(port);

    this.events.emit('portAdded', node, port);
    // emitNodesUpdated will be called by the public methods that use this helper
    return port;
  }

  public addDynamicInputPort(nodeId: string, variableName: string, isHidden: boolean = false): NodePort | null {
    const node = this.getNode(nodeId);
    if (!node) return null;
    const existingPort = node.dynamicInputs.find(p => p.variableName === variableName);
    if (existingPort) {
        if (existingPort.isHidden && !isHidden) { // If it exists and was hidden, now make it visible
            existingPort.isHidden = false;
            this.emitNodesUpdated();
            this.events.emit('portUpdated', existingPort);
        }
        return existingPort;
    }
    const port = this.addPortToNodeInstance(node, 'input', variableName, true, `Input for '${variableName}'`, 1, variableName, isHidden);
    this.emitNodesUpdated();
    return port;
  }

  public addDynamicOutputPort(nodeId: string, name: string, outputValue: string = ''): NodePort | null {
    const node = this.getNode(nodeId);
    if (!node) return null;
     const existingPort = node.dynamicOutputs.find(p => p.name === name);
    if (existingPort) { // For dynamic outputs, maybe update value if it exists? Or just return.
        if (outputValue && existingPort.outputValue !== outputValue) {
            existingPort.outputValue = outputValue;
            this.emitNodesUpdated();
            this.events.emit('portUpdated', existingPort);
        }
        return existingPort;
    }
    const port = this.addPortToNodeInstance(node, 'output', name, true, `Output: ${name}`, Infinity, undefined, false, outputValue);
    this.emitNodesUpdated();
    return port;
  }

  /**
   * Adiciona um objeto Node pré-construído diretamente ao gerenciador.
   * Usado para operações complexas como a conversão de grupo.
   * @param node O objeto Node a ser adicionado.
   * @internal
   */
  public _addNodeObject(node: Node): void {
    if (!this.nodes.has(node.id)) {
      this.nodes.set(node.id, node);
    }
  }

  public getPort(portId: string): NodePort | undefined {
    for (const node of this.nodes.values()) {
      const port = [...node.fixedInputs, ...node.fixedOutputs, ...node.dynamicInputs, ...node.dynamicOutputs]
        .find(p => p.id === portId);
      if (port) return port;
    }
    return undefined;
  }

  public updatePort(portId: string, updates: Partial<Omit<NodePort, 'id' | 'nodeId' | 'connections'>>): void {
    const port = this.getPort(portId);
    if (port) {
      const node = this.getNode(port.nodeId);
      if (!node) return;

      Object.assign(port, updates);
      if (port.isDynamic && port.type === 'input' && updates.variableName) {
        port.name = updates.variableName; // Sync name for display
      }

      this.emitNodesUpdated(); // Node appearance might change (e.g. port name, visibility)
      this.events.emit('portUpdated', port);
      this.events.emit('nodeUpdated', node); // General update
    }
  }

  public removePort(portId: string): void { // Primarily for dynamic ports
    const port = this.getPort(portId);
    if (!port) return;
    if (!port.isDynamic) {
      console.warn(`Attempted to remove non-dynamic port: ${portId}. Fixed ports are part of node definition.`);
      return;
    }

    const node = this.nodes.get(port.nodeId);
    if (!node) return;

    const arrayToRemoveFrom = port.type === 'input' ? node.dynamicInputs : node.dynamicOutputs;
    const index = arrayToRemoveFrom.findIndex(p => p.id === portId);

    if (index !== -1) {
      const removedPort = arrayToRemoveFrom.splice(index, 1)[0];
      this.emitNodesUpdated();
      this.events.emit('portRemoved', node, removedPort); // ConnectionManager listens
    }
  }

  // Called by ConnectionManager to update the port's internal list of connection IDs
  public _updatePortConnectionList(portId: string, connectionId: string, action: 'add' | 'remove'): void {
    const port = this.getPort(portId);
    if (port) {
      if (action === 'add') {
        if (!port.connections.includes(connectionId)) {
          port.connections.push(connectionId);
        }
      } else { // remove
        port.connections = port.connections.filter(id => id !== connectionId);
      }
      // This internal update doesn't need to emit nodesUpdated itself,
      // as ConnectionManager will emit connectionsUpdated which triggers re-render.
    }
  }

  public getAllPortsForNode(nodeId: string): NodePort[] {
    const node = this.getNode(nodeId);
    if (!node) return [];
    return [...node.fixedInputs, ...node.fixedOutputs, ...node.dynamicInputs, ...node.dynamicOutputs];
  }

  private emitNodesUpdated(): void {
    this.events.emit(EVENT_NODES_UPDATED, this.getNodes());
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    this.events.on(event, listener);
    return this;
  }

  public off(event: string, listener: (...args: any[]) => void): this {
    this.events.off(event, listener);
    return this;
  }

  public destroy(): void {
    this.nodes.clear();
    this.events.removeAllListeners();
  }

  public loadNodes(nodes: Node[]): void {
    this.nodes.clear();
    nodes.forEach(nodeData => {
        // Certifique-se de que a cor é copiada ao carregar
        const clonedNode = JSON.parse(JSON.stringify(nodeData)) as Node;
        // Adicione uma cor padrão se a cor estiver faltando em nós antigos
        clonedNode.color = clonedNode.color || '#666666'; 
        this.nodes.set(clonedNode.id, clonedNode);
    });
    this.emitNodesUpdated();
  }
}