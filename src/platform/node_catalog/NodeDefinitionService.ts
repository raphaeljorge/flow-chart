// src/platform/node_catalog/NodeDefinitionService.ts
import { PlatformNodeDefinition } from './node.types';
import { ALL_PLATFORM_NODE_DEFINITIONS } from './_definitions/PlatformNodeDefinitions';
import { NodeDefinition } from '../../editor/core/types'; // Editor's internal type

/**
 * NodeDefinitionService is responsible for providing node definitions to the editor.
 * Initially, it reads from a local static file (PlatformNodeDefinitions.ts).
 * In the future, this service (or rather, PlatformDataService calling a backend equivalent)
 * would fetch these definitions from a backend Node Catalog Service.
 */
export class NodeDefinitionService {
  private definitions: PlatformNodeDefinition[];

  constructor() {
    // In a real application, this might involve an async fetch.
    // For now, we directly use the imported definitions.
    this.definitions = ALL_PLATFORM_NODE_DEFINITIONS;
  }

  /**
   * Gets all available node definitions.
   * This method also transforms PlatformNodeDefinition to the editor's NodeDefinition type.
   */
  public getAllDefinitions(): NodeDefinition[] {
    return this.definitions.map(this.mapToEditorNodeDefinition);
  }

  /**
   * Gets a specific node definition by its ID.
   * Transforms to the editor's NodeDefinition type.
   */
  public getDefinitionById(id: string): NodeDefinition | undefined {
    const platformDef = this.definitions.find(def => def.id === id);
    return platformDef ? this.mapToEditorNodeDefinition(platformDef) : undefined;
  }

  /**
   * Maps the PlatformNodeDefinition to the editor's internal NodeDefinition type.
   * This is where any necessary transformations would occur if the types diverge.
   */
  private mapToEditorNodeDefinition(platformDef: PlatformNodeDefinition): NodeDefinition {
    // For now, the structures are very similar, so direct mapping with potential spread.
    // The key difference might be how `defaultInputs` and `defaultOutputs` are structured
    // if `PlatformPortDefinition` was used in `PlatformNodeDefinition`.
    // Since we used Omit<NodePort,...> for defaultFixedInputs/Outputs in PlatformNodeDefinition,
    // they are directly compatible with NodeDefinition's defaultInputs/Outputs.
    return {
      id: platformDef.id,
      title: platformDef.title,
      description: platformDef.description,
      category: platformDef.category,
      icon: platformDef.icon,
      config: platformDef.config, // Assumes NodeConfig structure is compatible
      defaultWidth: platformDef.defaultWidth,
      defaultHeight: platformDef.defaultHeight,
      minWidth: platformDef.minWidth,
      minHeight: platformDef.minHeight,
      defaultInputs: platformDef.defaultFixedInputs, // Map from defaultFixedInputs
      defaultOutputs: platformDef.defaultFixedOutputs, // Map from defaultFixedOutputs
    };
  }

  // In a real scenario with a backend:
  // public async fetchAllDefinitions(): Promise<PlatformNodeDefinition[]> {
  //   // const response = await fetch('/api/node-definitions');
  //   // return await response.json();
  //   return ALL_PLATFORM_NODE_DEFINITIONS; // Placeholder
  // }
}