// src/core/NodeManager.ts
import { nanoid } from 'nanoid';
import { EventEmitter } from 'eventemitter3';
import { Node, NodePort, Connection, Point, Rect, NodeDefinition } from './Types';

export class NodeManager {
  private nodes: Map<string, Node>;
  private connections: Map<string, Connection>;
  private events: EventEmitter;

  constructor() {
    this.nodes = new Map<string, Node>();
    this.connections = new Map<string, Connection>();
    this.events = new EventEmitter();
  }

  public createNodeFromDefinition(definition: NodeDefinition, position: Point): Node {
    const newNode: Node = {
      id: nanoid(), title: definition.title, type: definition.id, description: definition.description,
      position, width: definition.defaultWidth || 200, height: definition.defaultHeight || 100,
      inputs: [], outputs: [], data: {}, status: 'unsaved', icon: definition.icon,
      config: definition.config, minWidth: definition.minWidth || 100, minHeight: definition.minHeight || 50,
    };
    (definition.defaultInputs || []).forEach(inputDef => this.addPort(newNode.id, 'input', inputDef.name, inputDef.description, inputDef.maxConnections));
    (definition.defaultOutputs || []).forEach(outputDef => this.addPort(newNode.id, 'output', outputDef.name, outputDef.description, outputDef.maxConnections));
    this.nodes.set(newNode.id, newNode);
    this.emitNodesUpdated(); this.events.emit('nodeCreated', newNode);
    return newNode;
  }
  
  public createNode(title: string, position: Point, type: string = 'default', width: number = 200, height: number = 100): Node {
    const node: Node = { id: nanoid(), title, type, position, width, height, inputs: [], outputs: [], data: {}, status: 'unsaved' };
    this.nodes.set(node.id, node);
    this.emitNodesUpdated(); this.events.emit('nodeCreated', node);
    return node;
  }

  public getNode(nodeId: string): Node | undefined { return this.nodes.get(nodeId); }
  public getNodes(): Node[] { return Array.from(this.nodes.values()); }

  public updateNode(nodeId: string, updates: Partial<Omit<Node, 'id' | 'inputs' | 'outputs'>>): void {
    const node = this.nodes.get(nodeId);
    if (node) { Object.assign(node, updates); this.emitNodesUpdated(); this.events.emit('nodeUpdated', node); }
  }
  
  public moveNode(nodeId: string, position: Point): void {
    const node = this.nodes.get(nodeId);
    if (node) { node.position = position; this.emitNodesUpdated(); this.events.emit('nodeMoved', node); }
  }

  public resizeNode(nodeId: string, newRect: Rect): void {
    const node = this.nodes.get(nodeId);
    if (node) { node.position.x = newRect.x; node.position.y = newRect.y; node.width = newRect.width; node.height = newRect.height;
      this.emitNodesUpdated(); this.events.emit('nodeResized', node); }
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

  public addPort(nodeId: string, type: 'input' | 'output', name: string, description?: string, maxConnections?: number): NodePort | null {
    const node = this.nodes.get(nodeId); if (!node) { console.error(`Node not found: ${nodeId}`); return null; }
    const port: NodePort = { id: nanoid(), type, name, nodeId, position: { x: 0, y: 0 }, connections: [], description, maxConnections: maxConnections === undefined ? (type === 'input' ? 1 : Infinity) : maxConnections };
    if (type === 'input') node.inputs.push(port); else node.outputs.push(port);
    this.emitNodesUpdated(); this.events.emit('portAdded', node, port);
    return port;
  }
  
  public getPort(portId: string): NodePort | undefined {
    for (const node of this.nodes.values()) { const port = [...node.inputs, ...node.outputs].find(p => p.id === portId); if (port) return port; } return undefined;
  }
  
  public removePort(portId: string): void {
    for (const node of this.nodes.values()) {
        const inputIdx = node.inputs.findIndex(p => p.id === portId);
        if (inputIdx !== -1) { const removed = node.inputs.splice(inputIdx, 1)[0]; this.cleanupPortConnections(removed); this.emitNodesUpdated(); this.events.emit('portRemoved', node, removed); return; }
        const outputIdx = node.outputs.findIndex(p => p.id === portId);
        if (outputIdx !== -1) { const removed = node.outputs.splice(outputIdx, 1)[0]; this.cleanupPortConnections(removed); this.emitNodesUpdated(); this.events.emit('portRemoved', node, removed); return; }
    }
  }

  private cleanupPortConnections(port: NodePort): void { port.connections.forEach(connId => { const conn = this.connections.get(connId); if (conn) this.deleteConnection(connId); }); }

  public createConnection(sourcePortId: string, targetPortId: string): Connection | null {
    const sourcePort = this.getPort(sourcePortId); const targetPort = this.getPort(targetPortId);
    if (!sourcePort || !targetPort) { console.error('Source or target port not found.'); return null; }
    if (sourcePort.nodeId === targetPort.nodeId) { console.warn('Cannot connect a node to itself.'); return null; }
    if (sourcePort.type !== 'output' || targetPort.type !== 'input') { console.error('Invalid connection: Must connect output to input.'); return null; }
    if (targetPort.connections.length >= (targetPort.maxConnections ?? 1)) { console.warn(`Target port ${targetPort.name} max connections reached.`); return null; }
    if (sourcePort.connections.length >= (sourcePort.maxConnections ?? Infinity)) { console.warn(`Source port ${sourcePort.name} max connections reached.`); return null; }
    const existing = Array.from(this.connections.values()).find(c => c.sourcePortId === sourcePortId && c.targetPortId === targetPortId);
    if (existing) { console.warn('Connection already exists.'); return null; }

    const connection: Connection = {
      id: nanoid(), sourcePortId, targetPortId,
      sourceNodeId: sourcePort.nodeId, targetNodeId: targetPort.nodeId,
      data: { label: '' }, // Inicializa 'data' para conexões
    };
    this.connections.set(connection.id, connection);
    sourcePort.connections.push(connection.id); targetPort.connections.push(connection.id);
    this.emitConnectionsUpdated(); this.events.emit('connectionCreated', connection);
    return connection;
  }

  public getConnection(connectionId: string): Connection | undefined { return this.connections.get(connectionId); }
  public getConnections(): Connection[] { return Array.from(this.connections.values()); }

  public deleteConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      const sourcePort = this.getPort(connection.sourcePortId); const targetPort = this.getPort(connection.targetPortId);
      if (sourcePort) sourcePort.connections = sourcePort.connections.filter(id => id !== connectionId);
      if (targetPort) targetPort.connections = targetPort.connections.filter(id => id !== connectionId);
      this.connections.delete(connectionId);
      this.emitConnectionsUpdated(); this.events.emit('connectionDeleted', connection);
    }
  }
  
  public getConnectionsForNode(nodeId: string): Connection[] {
    return Array.from(this.connections.values()).filter(conn => conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId);
  }

  // Novo: Método para atualizar dados de uma conexão
  public updateConnection(connectionId: string, updates: Partial<Omit<Connection, 'id' | 'sourcePortId' | 'targetPortId' | 'sourceNodeId' | 'targetNodeId'>>): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      Object.assign(connection, updates);
      // Se 'data' for atualizado, Object.assign lida com a mesclagem se 'updates.data' for um objeto
      this.emitConnectionsUpdated();
      this.events.emit('connectionUpdated', connection);
    }
  }

  private emitNodesUpdated(): void { this.events.emit('nodesUpdated', this.getNodes()); }
  private emitConnectionsUpdated(): void { this.events.emit('connectionsUpdated', this.getConnections()); }
  public on(event: string, listener: (...args: any[]) => void): this { this.events.on(event, listener); return this; }
  public off(event: string, listener: (...args: any[]) => void): this { this.events.off(event, listener); return this; }
  public destroy(): void { this.nodes.clear(); this.connections.clear(); this.events.removeAllListeners(); }
}