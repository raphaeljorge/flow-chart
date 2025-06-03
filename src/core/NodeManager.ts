// src/core/NodeManager.ts
import { nanoid } from 'nanoid';
import { EventEmitter } from 'eventemitter3';
import { Node, NodePort, Connection, Point, Rect, NodeDefinition, NodeDataVariableParseEvent } from './Types';

export class NodeManager {
  private nodes: Map<string, Node>;
  private connections: Map<string, Connection>;
  private events: EventEmitter;

  // Regex para encontrar {{VAR_NAME}} em strings
  private readonly VARIABLE_REGEX = /\{\{([a-zA-Z0-9_]+)\}\}/g;

  constructor() {
    this.nodes = new Map<string, Node>();
    this.connections = new Map<string, Connection>();
    this.events = new EventEmitter();
  }

  public createNodeFromDefinition(definition: NodeDefinition, position: Point): Node {
    const newNode: Node = {
      id: nanoid(), title: definition.title, type: definition.id, description: definition.description,
      position, width: definition.defaultWidth || 200, height: definition.defaultHeight || 100,
      fixedInputs: [], fixedOutputs: [], dynamicInputs: [], dynamicOutputs: [],
      data: {}, status: 'unsaved', icon: definition.icon,
      config: definition.config, minWidth: definition.minWidth || 100, minHeight: definition.minHeight || 50,
    };

    (definition.defaultInputs || []).forEach(inputDef => this.addPort(newNode.id, 'input', inputDef.name, inputDef.description, inputDef.maxConnections, false));
    (definition.defaultOutputs || []).forEach(outputDef => this.addPort(newNode.id, 'output', outputDef.name, outputDef.description, outputDef.maxConnections, false));

    this.nodes.set(newNode.id, newNode);
    this.emitNodesUpdated(); this.events.emit('nodeCreated', newNode);
    return newNode;
  }
  
  public createNode(title: string, position: Point, type: string = 'default', width: number = 200, height: number = 100): Node {
    const node: Node = { id: nanoid(), title, type, position, width, height, fixedInputs: [], fixedOutputs: [], dynamicInputs: [], dynamicOutputs: [], data: {}, status: 'unsaved' };
    this.nodes.set(node.id, node);
    this.emitNodesUpdated(); this.events.emit('nodeCreated', node);
    return node;
  }

  public getNode(nodeId: string): Node | undefined { return this.nodes.get(nodeId); }
  public getNodes(): Node[] { return Array.from(this.nodes.values()); }

  public updateNodeDataAndParseVariables(nodeId: string, newData: any, oldData: any): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    const oldVariables = new Set<string>();
    const newVariables = new Set<string>();

    // Coleta variáveis do oldData
    this.extractVariablesFromObject(oldData, oldVariables);
    // Coleta variáveis do newData
    this.extractVariablesFromObject(newData, newVariables);

    // Remove portas dinâmicas que não são mais necessárias
    const removedVariables = Array.from(oldVariables).filter(v => !newVariables.has(v));
    removedVariables.forEach(varName => {
        const port = node.dynamicInputs.find(p => p.variableName === varName);
        if (port) {
            this.removePort(port.id); // Reutiliza o método removePort
        }
    });

    // Adiciona novas portas dinâmicas
    const addedVariables = Array.from(newVariables).filter(v => !oldVariables.has(v));
    addedVariables.forEach(varName => {
        if (!node.dynamicInputs.some(p => p.variableName === varName)) {
            this.addDynamicInputPort(nodeId, varName);
        }
    });

    // Atualiza o data do nó
    Object.assign(node, { data: newData });
    this.emitNodesUpdated();
    this.events.emit('nodeUpdated', node);
  }

  private extractVariablesFromObject(obj: any, variableSet: Set<string>): void {
      if (!obj) return;
      for (const key in obj) {
          if (typeof obj[key] === 'string') {
              let match;
              while ((match = this.VARIABLE_REGEX.exec(obj[key])) !== null) {
                  variableSet.add(match[1]);
              }
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
              this.extractVariablesFromObject(obj[key], variableSet);
          }
      }
  }

  public updateNode(nodeId: string, updates: Partial<Omit<Node, 'id' | 'fixedInputs' | 'fixedOutputs' | 'dynamicInputs' | 'dynamicOutputs'>>): void {
    const node = this.nodes.get(nodeId);
    if (node) { 
        Object.assign(node, updates); 
        this.emitNodesUpdated(); 
        this.events.emit('nodeUpdated', node); 
    }
  }
  
  public moveNode(nodeId: string, position: Point): void {
    const node = this.nodes.get(nodeId);
    if (node) { node.position = position; this.emitNodesUpdated(); this.events.emit('nodeMoved', node); }
  }

  public resizeNode(nodeId: string, newRect: Rect): void {
    const node = this.nodes.get(nodeId);
    if (node) { 
      node.position.x = newRect.x; node.position.y = newRect.y; node.width = newRect.width; node.height = newRect.height;
      this.emitNodesUpdated(); this.events.emit('nodeResized', node); 
    }
  }


  public deleteNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      const connectionsToRemove = Array.from(this.connections.values()).filter(conn => conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId);
      connectionsToRemove.forEach(conn => this.deleteConnection(conn.id));
      
      this.nodes.delete(nodeId);
      this.emitNodesUpdated(); this.events.emit('nodeDeleted', node);
    }
  }
  
  public deleteNodes(nodeIds: string[]): void { nodeIds.forEach(id => this.deleteNode(id)); }

  public addPort(nodeId: string, type: 'input' | 'output', name: string, description?: string, maxConnections?: number, isDynamic: boolean = false): NodePort | null {
    const node = this.nodes.get(nodeId); 
    if (!node) { console.error(`Node not found: ${nodeId}`); return null; }
    
    const port: NodePort = { 
        id: nanoid(), type, name, nodeId, position: { x: 0, y: 0 }, connections: [], description, 
        maxConnections: maxConnections === undefined ? (type === 'input' ? 1 : Infinity) : maxConnections,
        isDynamic: isDynamic
    };

    if (type === 'input') {
        if (isDynamic) node.dynamicInputs.push(port);
        else node.fixedInputs.push(port);
    } else { // 'output'
        if (isDynamic) node.dynamicOutputs.push(port);
        else node.fixedOutputs.push(port);
    }

    this.emitNodesUpdated(); this.events.emit('portAdded', node, port);
    return port;
  }

  public addDynamicInputPort(nodeId: string, variableName: string, isHidden: boolean = false): NodePort | null {
    const node = this.nodes.get(nodeId);
    if (!node) { console.error(`Node not found: ${nodeId}`); return null; }

    // Evita duplicatas se já existe uma porta dinâmica para esta variável
    if (node.dynamicInputs.some(p => p.variableName === variableName)) {
        console.warn(`Dynamic input port for variable '${variableName}' already exists on node ${nodeId}.`);
        return null;
    }

    const port = this.addPort(nodeId, 'input', variableName, `Input for variable '${variableName}'`, 1, true);
    if (port) {
        port.variableName = variableName;
        port.isHidden = isHidden;
        // Não precisamos de "position" aqui pois será calculado pelo renderizador
        this.emitNodesUpdated();
        this.events.emit('dynamicInputPortAdded', node, port);
    }
    return port;
  }

  public addDynamicOutputPort(nodeId: string, name: string, outputValue: string = ''): NodePort | null {
    const node = this.nodes.get(nodeId);
    if (!node) { console.error(`Node not found: ${nodeId}`); return null; }

    const port = this.addPort(nodeId, 'output', name, `Output: ${name}`, Infinity, true);
    if (port) {
        port.outputValue = outputValue;
        this.emitNodesUpdated();
        this.events.emit('dynamicOutputPortAdded', node, port);
    }
    return port;
  }

  public updatePort(portId: string, updates: Partial<NodePort>): void {
    const port = this.getPort(portId);
    if (port) {
        Object.assign(port, updates);
        this.emitNodesUpdated(); // Nodes updated para forçar re-renderização
        this.events.emit('portUpdated', port);
    }
  }
  
  public getPort(portId: string): NodePort | undefined {
    for (const node of this.nodes.values()) { 
        let port = node.fixedInputs.find(p => p.id === portId); if (port) return port;
        port = node.fixedOutputs.find(p => p.id === portId); if (port) return port;
        port = node.dynamicInputs.find(p => p.id === portId); if (port) return port;
        port = node.dynamicOutputs.find(p => p.id === portId); if (port) return port;
    } 
    return undefined;
  }
  
  public removePort(portId: string): void {
    for (const node of this.nodes.values()) {
        const inputIdx = node.fixedInputs.findIndex(p => p.id === portId);
        if (inputIdx !== -1) { const removed = node.fixedInputs.splice(inputIdx, 1)[0]; this.cleanupPortConnections(removed); this.emitNodesUpdated(); this.events.emit('portRemoved', node, removed); return; }
        const outputIdx = node.fixedOutputs.findIndex(p => p.id === portId);
        if (outputIdx !== -1) { const removed = node.fixedOutputs.splice(outputIdx, 1)[0]; this.cleanupPortConnections(removed); this.emitNodesUpdated(); this.events.emit('portRemoved', node, removed); return; }
        const dynamicInputIdx = node.dynamicInputs.findIndex(p => p.id === portId);
        if (dynamicInputIdx !== -1) { const removed = node.dynamicInputs.splice(dynamicInputIdx, 1)[0]; this.cleanupPortConnections(removed); this.emitNodesUpdated(); this.events.emit('portRemoved', node, removed); return; }
        const dynamicOutputIdx = node.dynamicOutputs.findIndex(p => p.id === portId);
        if (dynamicOutputIdx !== -1) { const removed = node.dynamicOutputs.splice(dynamicOutputIdx, 1)[0]; this.cleanupPortConnections(removed); this.emitNodesUpdated(); this.events.emit('portRemoved', node, removed); return; }
    }
  }

  private cleanupPortConnections(port: NodePort): void { 
      port.connections.forEach(connId => { 
          const conn = this.connections.get(connId); 
          if (conn) this.deleteConnection(connId); 
      }); 
  }

  public createConnection(sourcePortId: string, targetPortId: string): Connection | null {
    const sourcePort = this.getPort(sourcePortId); 
    const targetPort = this.getPort(targetPortId);

    if (!sourcePort || !targetPort) { console.error('Source or target port not found.'); return null; }
    if (sourcePort.nodeId === targetPort.nodeId) { console.warn('Cannot connect a node to itself.'); return null; }
    if (sourcePort.type !== 'output' || targetPort.type !== 'input') { console.error('Invalid connection: Must connect output to input.'); return null; }
    
    // Verifica se a porta de destino já atingiu o limite de conexões
    if (targetPort.connections.length >= (targetPort.maxConnections ?? 1)) { 
        console.warn(`Target port ${targetPort.name} max connections reached.`); 
        this.events.emit('connectionFailed', { reason: "Target port max connections reached", sourcePort, targetPort });
        return null; 
    }
    // Verifica se a porta de origem já atingiu o limite de conexões
    if (sourcePort.connections.length >= (sourcePort.maxConnections ?? Infinity)) { 
        console.warn(`Source port ${sourcePort.name} max connections reached.`); 
        this.events.emit('connectionFailed', { reason: "Source port max connections reached", sourcePort, targetPort });
        return null; 
    }

    // Evita conexões duplicadas
    const existing = Array.from(this.connections.values()).find(c => c.sourcePortId === sourcePortId && c.targetPortId === targetPortId);
    if (existing) { console.warn('Connection already exists.'); return null; }

    const connection: Connection = {
      id: nanoid(), sourcePortId, targetPortId,
      sourceNodeId: sourcePort.nodeId, targetNodeId: targetPort.nodeId,
      data: { label: '' },
    };
    this.connections.set(connection.id, connection);
    sourcePort.connections.push(connection.id); 
    targetPort.connections.push(connection.id);
    this.emitConnectionsUpdated(); 
    this.events.emit('connectionCreated', connection);
    return connection;
  }

  public getConnection(connectionId: string): Connection | undefined { return this.connections.get(connectionId); }
  public getConnections(): Connection[] { return Array.from(this.connections.values()); }

  public deleteConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      const sourcePort = this.getPort(connection.sourcePortId); 
      const targetPort = this.getPort(connection.targetPortId);
      if (sourcePort) sourcePort.connections = sourcePort.connections.filter(id => id !== connectionId);
      if (targetPort) targetPort.connections = targetPort.connections.filter(id => id !== connectionId);
      this.connections.delete(connectionId);
      this.emitConnectionsUpdated(); this.events.emit('connectionDeleted', connection);
    }
  }
  
  public getConnectionsForNode(nodeId: string): Connection[] {
    return Array.from(this.connections.values()).filter(conn => conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId);
  }

  public updateConnection(connectionId: string, updates: Partial<Omit<Connection, 'id' | 'sourcePortId' | 'targetPortId' | 'sourceNodeId' | 'targetNodeId'>>): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      Object.assign(connection, updates);
      this.emitConnectionsUpdated();
      this.events.emit('connectionUpdated', connection);
    }
  }

  private emitNodesUpdated(): void { this.events.emit('nodesUpdated', this.getNodes()); }
  private emitConnectionsUpdated(): void { this.events.emit('connectionsUpdated', this.getConnections()); }
  public on(event: string, listener: (...args: any[]) => void): this { this.events.on(event, listener); return this; }
  public off(event: string, listener: (...args: any[]) => void): this { this.events.off(event, listener); return this; }
  
  public destroy(): void { 
    this.nodes.clear(); 
    this.connections.clear(); 
    this.events.removeAllListeners(); 
  }
}