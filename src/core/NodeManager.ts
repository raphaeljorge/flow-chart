import { nanoid } from 'nanoid';
import { EventEmitter } from 'eventemitter3';
import { Node, NodePort, Connection, Point } from './types';

export class NodeManager {
  private nodes: Map<string, Node> = new Map();
  private connections: Map<string, Connection> = new Map();
  private events: EventEmitter = new EventEmitter();
  private selectedNodes: Set<string> = new Set();
  private clipboard: Node[] = [];

  constructor() {}

  public createNode(title: string, position: Point): Node {
    const node: Node = {
      id: nanoid(),
      title,
      position,
      width: 200,
      height: 100,
      inputs: [],
      outputs: []
    };

    this.nodes.set(node.id, node);
    this.emitNodesUpdated();
    return node;
  }

  public addPort(nodeId: string, type: 'input' | 'output', name: string): NodePort {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error('Node not found');

    const port: NodePort = {
      id: nanoid(),
      type,
      name,
      nodeId,
      position: { x: 0, y: 0 },
      connections: []
    };

    if (type === 'input') {
      node.inputs.push(port);
    } else {
      node.outputs.push(port);
    }

    this.emitNodesUpdated();
    return port;
  }

  public connect(sourcePortId: string, targetPortId: string): Connection {
    const sourcePort = this.findPort(sourcePortId);
    const targetPort = this.findPort(targetPortId);

    if (!sourcePort || !targetPort) {
      throw new Error('Port not found');
    }

    if (sourcePort.type !== 'output' || targetPort.type !== 'input') {
      throw new Error('Invalid connection types');
    }

    const connection: Connection = {
      id: nanoid(),
      sourcePortId,
      targetPortId,
      sourceNode: sourcePort.nodeId,
      targetNode: targetPort.nodeId
    };

    this.connections.set(connection.id, connection);
    sourcePort.connections.push(connection.id);
    targetPort.connections.push(connection.id);

    this.emitNodesUpdated();
    return connection;
  }

  public moveNode(nodeId: string, position: Point) {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.position = position;
      this.emitNodesUpdated();
    }
  }

  public selectNode(nodeId: string, addToSelection = false) {
    if (!addToSelection) {
      this.selectedNodes.clear();
    }
    this.selectedNodes.add(nodeId);
    this.events.emit('selectionChanged', Array.from(this.selectedNodes));
    this.emitNodesUpdated();
  }

  public deselectNode(nodeId: string) {
    this.selectedNodes.delete(nodeId);
    this.events.emit('selectionChanged', Array.from(this.selectedNodes));
    this.emitNodesUpdated();
  }

  public deselectAll() {
    this.selectedNodes.clear();
    this.events.emit('selectionChanged', []);
    this.emitNodesUpdated();
  }

  public isSelected(nodeId: string): boolean {
    return this.selectedNodes.has(nodeId);
  }

  public getSelectedNodes(): Node[] {
    return Array.from(this.selectedNodes).map(id => this.nodes.get(id)!);
  }

  public copySelectedNodes() {
    this.clipboard = this.getSelectedNodes().map(node => ({
      ...node,
      id: nanoid(),
      position: { ...node.position }
    }));
  }

  public pasteNodes() {
    if (this.clipboard.length === 0) return;

    const offset = { x: 20, y: 20 };
    
    const newNodes = this.clipboard.map(node => ({
      ...node,
      id: nanoid(),
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y
      }
    }));

    this.selectedNodes.clear();
    newNodes.forEach(node => {
      this.nodes.set(node.id, node);
      this.selectedNodes.add(node.id);
    });

    this.emitNodesUpdated();
    this.events.emit('selectionChanged', Array.from(this.selectedNodes));
  }

  public deleteSelectedNodes() {
    const nodesToDelete = this.getSelectedNodes();
    
    nodesToDelete.forEach(node => {
      // Delete associated connections
      [...node.inputs, ...node.outputs].forEach(port => {
        port.connections.forEach(connectionId => {
          this.connections.delete(connectionId);
        });
      });
      
      this.nodes.delete(node.id);
    });

    this.selectedNodes.clear();
    this.emitNodesUpdated();
    this.events.emit('nodesDeleted', nodesToDelete);
    this.events.emit('selectionChanged', []);
  }

  private findPort(portId: string): NodePort | undefined {
    for (const node of this.nodes.values()) {
      const port = [...node.inputs, ...node.outputs].find(p => p.id === portId);
      if (port) return port;
    }
    return undefined;
  }

  private emitNodesUpdated() {
    this.events.emit('nodesUpdated', Array.from(this.nodes.values()));
  }

  public getNodes(): Node[] {
    return Array.from(this.nodes.values());
  }

  public getConnections(): Connection[] {
    return Array.from(this.connections.values());
  }

  public on(event: string, callback: (...args: any[]) => void) {
    this.events.on(event, callback);
  }
}