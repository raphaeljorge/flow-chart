// src/editor/state/NodeGroupManager.ts
import { nanoid } from 'nanoid';
import { EventEmitter } from 'eventemitter3';
import { NodeGroup, Node, Point, Rect } from '../core/types';
import { NodeManager } from './NodeManager';

export const EVENT_GROUPS_UPDATED = 'groupsUpdated';
export const GROUP_HEADER_HEIGHT = 30;
export const GROUP_PADDING = 20;

export class NodeGroupManager {
  private groups = new Map<string, NodeGroup>();
  private events = new EventEmitter();

  constructor(private nodeManager: NodeManager) {}

  public createGroup(nodesToGroup: Node[], title: string = 'New Group'): NodeGroup | null {
    if (nodesToGroup.length === 0) return null;

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodesToGroup.forEach(node => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + node.width);
      maxY = Math.max(maxY, node.position.y + node.height);
    });

    const group: NodeGroup = {
      id: nanoid(),
      title,
      position: { x: minX - GROUP_PADDING, y: minY - GROUP_PADDING - GROUP_HEADER_HEIGHT },
      width: (maxX - minX) + (GROUP_PADDING * 2),
      height: (maxY - minY) + (GROUP_PADDING * 2) + GROUP_HEADER_HEIGHT,
      childNodes: new Set(nodesToGroup.map(n => n.id)),
      style: {
        backgroundColor: 'rgba(148, 163, 184, 0.1)',
        borderColor: '#94a3b8',
        titleColor: '#e2e8f0'
      },
      minWidth: 150,
      minHeight: 100
    };

    this.groups.set(group.id, group);

    // Update nodes to set their groupId
    nodesToGroup.forEach(node => {
      if (node.groupId) {
          const oldGroup = this.groups.get(node.groupId);
          if (oldGroup) {
            oldGroup.childNodes.delete(node.id);
          }
      }
      this.nodeManager.updateNode(node.id, { groupId: group.id });
    });

    this.events.emit(EVENT_GROUPS_UPDATED, this.getGroups());
    this.events.emit('groupCreated', group);
    return group;
  }
  
  public getGroup(groupId: string): NodeGroup | undefined {
    return this.groups.get(groupId);
  }

  public getGroups(): NodeGroup[] {
    return Array.from(this.groups.values());
  }

  public moveGroup(groupId: string, delta: Point): void {
    const group = this.groups.get(groupId);
    if (!group) return;

    group.position.x += delta.x;
    group.position.y += delta.y;
    
    // Move child nodes
    group.childNodes.forEach(nodeId => {
      const node = this.nodeManager.getNode(nodeId);
      if (node) {
        this.nodeManager.moveNode(nodeId, {
          x: node.position.x + delta.x,
          y: node.position.y + delta.y
        });
      }
    });
    this.events.emit('groupMoved', group);
    this.emitGroupsUpdated();
  }

  public resizeGroup(groupId: string, newRect: Rect): void {
      const group = this.groups.get(groupId);
      if (group) {
          group.position.x = newRect.x;
          group.position.y = newRect.y;
          group.width = Math.max(group.minWidth || 150, newRect.width);
          group.height = Math.max(group.minHeight || 100, newRect.height);
          this.emitGroupsUpdated();
          this.events.emit('groupResized', group);
      }
  }

  public addNodeToGroup(groupId: string, nodeId: string): void {
    const group = this.groups.get(groupId);
    const node = this.nodeManager.getNode(nodeId);
    if (group && node) {
      // Remove from old group if any
      if(node.groupId) {
        this.removeNodeFromGroup(node.groupId, nodeId);
      }
      group.childNodes.add(nodeId);
      this.nodeManager.updateNode(nodeId, { groupId });
      this.events.emit('nodeAddedToGroup', group, node);
      this.emitGroupsUpdated();
    }
  }

  public removeNodeFromGroup(groupId: string, nodeId: string): void {
    const group = this.groups.get(groupId);
    const node = this.nodeManager.getNode(nodeId);
    if (group && node && group.childNodes.has(nodeId)) {
      group.childNodes.delete(nodeId);
      this.nodeManager.updateNode(nodeId, { groupId: undefined });
      this.events.emit('nodeRemovedFromGroup', group, node);
      this.emitGroupsUpdated();
    }
  }

  public updateGroup(groupId: string, updates: Partial<Omit<NodeGroup, 'id' | 'childNodes'>>): void {
    const group = this.groups.get(groupId);
    if (group) {
        if (updates.style) {
            group.style = { ...group.style, ...updates.style };
            delete updates.style;
        }
        Object.assign(group, updates);
        this.emitGroupsUpdated();
        this.events.emit('groupUpdated', group);
    }
  }

  public deleteGroup(groupId: string, deleteChildNodes: boolean = false): void {
    const group = this.groups.get(groupId);
    if (group) {
      if(deleteChildNodes) {
        this.nodeManager.deleteNodes(Array.from(group.childNodes));
      } else {
        // Just ungroup
        group.childNodes.forEach(nodeId => {
            this.nodeManager.updateNode(nodeId, { groupId: undefined });
        });
      }
      this.groups.delete(groupId);
      this.events.emit('groupDeleted', group);
      this.emitGroupsUpdated();
    }
  }

  public loadGroups(groups: NodeGroup[]): void {
    this.groups.clear();
    groups.forEach(groupData => {
        // The `childNodes` from JSON will be an array, convert it to a Set
        const group: NodeGroup = {
            ...JSON.parse(JSON.stringify(groupData)),
            childNodes: new Set(groupData.childNodes || [])
        };
        this.groups.set(group.id, group);
    });
    this.emitGroupsUpdated();
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    this.events.on(event, listener);
    return this;
  }
  
  public off(event: string, listener: (...args: any[]) => void): this {
    this.events.off(event, listener);
    return this;
  }

  private emitGroupsUpdated() {
    this.events.emit(EVENT_GROUPS_UPDATED, this.getGroups());
  }

  public destroy(): void {
    this.groups.clear();
    this.events.removeAllListeners();
  }
}