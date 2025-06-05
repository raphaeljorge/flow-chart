// src/platform/node_catalog/node.types.ts

// This file defines types related to node definitions as the "platform" sees them.
// Initially, it might be identical to the editor's NodeDefinition, but it can diverge
// if the backend stores/provides node metadata in a different structure.

import { NodeConfig, NodePort } from '../../editor/core/types'; // Re-use editor's core types where applicable

// Represents the metadata for a node type as defined by the platform/backend.
// This is what NodeDefinitionService would typically fetch or provide.
export interface PlatformNodeDefinition {
  id: string; // Unique identifier for the node type (e.g., 'trigger-webhook')
  title: string; // User-friendly title
  description: string;
  category: string; // Helps organize nodes in the palette
  icon: string; // Icon identifier (e.g., 'ph-globe', refers to EditorIconService)

  // Configuration structure for instances of this node type
  // This uses the editor's NodeConfig type for compatibility.
  config?: NodeConfig;

  // Default visual properties for the editor
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  color?: string;

  // Default fixed ports for this node type.
  // Uses a simplified version of NodePort, as detailed instance properties (like connections, nodeId)
  // are handled by the editor's NodeManager when a node instance is created.
  defaultFixedInputs?: Array<Omit<NodePort, 'id' | 'nodeId' | 'connections' | 'isDynamic' | 'variableName' | 'isHidden' | 'outputValue'>>;
  defaultFixedOutputs?: Array<Omit<NodePort, 'id' | 'nodeId' | 'connections' | 'isDynamic' | 'variableName' | 'isHidden' | 'outputValue'>>;

  // Additional platform-specific metadata could go here:
  // version?: string;
  // tags?: string[];
  // helpUrl?: string;
  // executionLogicPath?: string; // Path to backend execution logic if relevant for frontend info
}

// Example of how this might differ: If backend sends port definitions in a simpler format.
// export interface PlatformPortDefinition {
//   name: string;
//   type: 'input' | 'output';
//   dataType?: string; // e.g., 'string', 'number', 'boolean', 'object', 'any'
//   description?: string;
//   maxConnections?: number;
// }
//
// export interface PlatformNodeDefinitionWithSimplePorts {
//   // ... other properties ...
//   defaultInputs?: PlatformPortDefinition[];
//   defaultOutputs?: PlatformPortDefinition[];
// }

// For now, we'll align PlatformNodeDefinition closely with the editor's NodeDefinition
// by re-using the Omit<NodePort, ...> approach.
// The key is that `src/platform/node_catalog/_definitions/PlatformNodeDefinitions.ts`
// will use `PlatformNodeDefinition[]` as its type.