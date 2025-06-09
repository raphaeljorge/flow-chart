import { nanoid } from "nanoid";
import { EventEmitter } from "eventemitter3";
import { Connection, NodePort } from "../core/types";
import { NodeManager } from "./NodeManager";
import { EVENT_CONNECTIONS_UPDATED } from "../core/constants";

export class ConnectionManager {
  private connections: Map<string, Connection>;
  private events: EventEmitter;

  constructor(private nodeManager: NodeManager) {
    this.connections = new Map<string, Connection>();
    this.events = new EventEmitter();

    // Listen to NodeManager events to handle cascading deletes
    this.nodeManager.on("nodeDeleted", this.handleNodeDeleted);
    this.nodeManager.on("nodesDeleted", this.handleNodesDeleted);
    this.nodeManager.on("portRemoved", this.handlePortRemoved);
  }

  private handleNodeDeleted = (node: any /* Node */): void => {
    const nodeId = node.id;
    const connectionsToRemove = Array.from(this.connections.values()).filter(
      (conn) => conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId
    );
    connectionsToRemove.forEach((conn) => this.deleteConnection(conn.id, true)); // silent = true to batch update
    if (connectionsToRemove.length > 0) this.emitConnectionsUpdated();
  };

  private handleNodesDeleted = (nodes: any[] /* Node[] */): void => {
    let changed = false;
    nodes.forEach((node) => {
      const nodeId = node.id;
      const connectionsToRemove = Array.from(this.connections.values()).filter(
        (conn) => conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId
      );
      connectionsToRemove.forEach((conn) => {
        this.deleteConnection(conn.id, true);
        changed = true;
      });
    });
    if (changed) this.emitConnectionsUpdated();
  };

  private handlePortRemoved = (_node: any /* Node */, port: NodePort): void => {
    const portId = port.id;
    const connectionsToRemove = Array.from(this.connections.values()).filter(
      (conn) => conn.sourcePortId === portId || conn.targetPortId === portId
    );
    connectionsToRemove.forEach((conn) => this.deleteConnection(conn.id, true));
    if (connectionsToRemove.length > 0) this.emitConnectionsUpdated();
  };

  public createConnection(
    sourcePortId: string,
    targetPortId: string
  ): Connection | null {
    const sourcePort = this.nodeManager.getPort(sourcePortId);
    const targetPort = this.nodeManager.getPort(targetPortId);

    if (!sourcePort || !targetPort) {
      console.error(
        "ConnectionManager: Source or target port not found for connection creation."
      );
      this.events.emit("connectionFailed", {
        reason: "Port not found",
        sourcePortId,
        targetPortId,
      });
      return null;
    }

    if (!this.isValidConnection(sourcePort, targetPort)) {
      return null;
    }

    const connection: Connection = {
      id: nanoid(),
      sourcePortId,
      targetPortId,
      sourceNodeId: sourcePort.nodeId,
      targetNodeId: targetPort.nodeId,
      data: {},
      style: {
        lineStyle: "solid",
        color: "#FFFFFF",
        animated: false,
      },
    };

    this.connections.set(connection.id, connection);
    this.nodeManager._updatePortConnectionList(
      sourcePortId,
      connection.id,
      "add"
    );
    this.nodeManager._updatePortConnectionList(
      targetPortId,
      connection.id,
      "add"
    );

    this.emitConnectionsUpdated();
    this.events.emit("connectionCreated", connection);
    return connection;
  }

  public isValidConnection(
    sourcePort: NodePort,
    targetPort: NodePort
  ): boolean {
    if (sourcePort.nodeId === targetPort.nodeId) {
      console.warn("ConnectionManager: Cannot connect a node to itself.");
      this.events.emit("connectionFailed", {
        reason: "Self-connection not allowed",
        sourcePort,
        targetPort,
      });
      return false;
    }
    if (sourcePort.type !== "output" || targetPort.type !== "input") {
      console.error(
        "ConnectionManager: Invalid connection types. Must be output to input."
      );
      this.events.emit("connectionFailed", {
        reason: "Invalid port types (must be output to input)",
        sourcePort,
        targetPort,
      });
      return false;
    }
    const targetMaxConns = targetPort.maxConnections ?? 1;
    if (targetPort.connections.length >= targetMaxConns) {
      console.warn(
        `ConnectionManager: Target port ${targetPort.name} (${targetPort.id}) has reached its max connections limit of ${targetMaxConns}.`
      );
      this.events.emit("connectionFailed", {
        reason: `Target port max connections (${targetMaxConns}) reached`,
        sourcePort,
        targetPort,
      });
      return false;
    }
    const sourceMaxConns = sourcePort.maxConnections ?? Infinity;
    if (sourcePort.connections.length >= sourceMaxConns) {
      console.warn(
        `ConnectionManager: Source port ${sourcePort.name} (${sourcePort.id}) has reached its max connections limit of ${sourceMaxConns}.`
      );
      this.events.emit("connectionFailed", {
        reason: `Source port max connections (${sourceMaxConns}) reached`,
        sourcePort,
        targetPort,
      });
      return false;
    }

    const existing = Array.from(this.connections.values()).find(
      (c) =>
        (c.sourcePortId === sourcePort.id &&
          c.targetPortId === targetPort.id) ||
        (c.sourcePortId === targetPort.id && c.targetPortId === sourcePort.id)
    );
    if (existing) {
      console.warn(
        "ConnectionManager: Connection between these ports already exists."
      );
      this.events.emit("connectionFailed", {
        reason: "Connection already exists",
        sourcePort,
        targetPort,
      });
      return false;
    }

    return true;
  }

  public getConnection(connectionId: string): Connection | undefined {
    return this.connections.get(connectionId);
  }

  public getConnections(): Connection[] {
    return Array.from(this.connections.values());
  }

  public deleteConnection(connectionId: string, silent: boolean = false): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.nodeManager._updatePortConnectionList(
        connection.sourcePortId,
        connection.id,
        "remove"
      );
      this.nodeManager._updatePortConnectionList(
        connection.targetPortId,
        connection.id,
        "remove"
      );
      this.connections.delete(connectionId);

      if (!silent) {
        this.emitConnectionsUpdated();
      }
      this.events.emit("connectionDeleted", connection);
    }
  }

  public deleteConnections(connectionIds: string[]): void {
    let changed = false;
    connectionIds.forEach((id) => {
      const connection = this.connections.get(id);
      if (connection) {
        this.nodeManager._updatePortConnectionList(
          connection.sourcePortId,
          id,
          "remove"
        );
        this.nodeManager._updatePortConnectionList(
          connection.targetPortId,
          id,
          "remove"
        );
        this.connections.delete(id);
        this.events.emit("connectionDeleted", connection);
        changed = true;
      }
    });
    if (changed) {
      this.emitConnectionsUpdated();
    }
  }

  public getConnectionsForNode(nodeId: string): Connection[] {
    return Array.from(this.connections.values()).filter(
      (conn) => conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId
    );
  }

  public getConnectionsForPort(portId: string): Connection[] {
    return Array.from(this.connections.values()).filter(
      (conn) => conn.sourcePortId === portId || conn.targetPortId === portId
    );
  }

  public updateConnectionData(
    connectionId: string,
    data: Partial<Connection["data"]>
  ): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.data = { ...connection.data, ...data };
      this.emitConnectionsUpdated();
      this.events.emit("connectionUpdated", connection);
    }
  }

  public updateConnectionStyle(
    connectionId: string,
    style: Partial<Connection["style"]>
  ): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.style = { ...connection.style, ...style };
      this.emitConnectionsUpdated();
      this.events.emit("connectionUpdated", connection);
    }
  }

  private emitConnectionsUpdated(): void {
    this.events.emit(EVENT_CONNECTIONS_UPDATED, this.getConnections());
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
    this.connections.clear();
    this.events.removeAllListeners();
    this.nodeManager.off("nodeDeleted", this.handleNodeDeleted);
    this.nodeManager.off("nodesDeleted", this.handleNodesDeleted);
    this.nodeManager.off("portRemoved", this.handlePortRemoved);
  }

  public loadConnections(connections: Connection[]): void {
    this.connections.clear();
    connections.forEach((conn) => {
      const clonedConn = JSON.parse(JSON.stringify(conn));
      clonedConn.style = clonedConn.style || {
        lineStyle: "solid",
        color: "#FFFFFF",
        animated: false,
      };
      this.connections.set(clonedConn.id, clonedConn);
      this.nodeManager._updatePortConnectionList(
        clonedConn.sourcePortId,
        clonedConn.id,
        "add"
      );
      this.nodeManager._updatePortConnectionList(
        clonedConn.targetPortId,
        clonedConn.id,
        "add"
      );
    });
    this.emitConnectionsUpdated();
  }
}
