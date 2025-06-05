// src/editor/services/PlatformDataService.ts
import { NodeDefinition } from '../core/types';
import { GraphState } from '../core/types'; // Assuming GraphState is defined for save/load
import { NodeDefinitionService } from '../../platform/node_catalog/NodeDefinitionService';
import { ProjectSerializer } from '../../platform/project_management/ProjectSerializer';
import { LOCAL_STORAGE_GRAPH_KEY } from '../core/constants';

/**
 * PlatformDataService acts as an abstraction layer for all interactions
 * that would typically go to a backend. Initially, it will use local
 * services (NodeDefinitionService, ProjectSerializer with localStorage).
 * In the future, this service will make HTTP requests to the backend API.
 */
export class PlatformDataService {
  private nodeDefinitionService: NodeDefinitionService;
  private projectSerializer: ProjectSerializer;

  constructor() {
    // Instantiate the local/stubbed services
    this.nodeDefinitionService = new NodeDefinitionService();
    this.projectSerializer = new ProjectSerializer(LOCAL_STORAGE_GRAPH_KEY);
  }

  /**
   * Fetches all available node definitions.
   * In the future, this would make an API call.
   */
  public async getNodeDefinitions(): Promise<NodeDefinition[]> {
    // Simulate async call
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network latency
    return this.nodeDefinitionService.getAllDefinitions();
  }

  /**
   * Fetches a single node definition by its ID.
   * In the future, this would make an API call.
   */
  public async getNodeDefinitionById(id: string): Promise<NodeDefinition | undefined> {
    await new Promise(resolve => setTimeout(resolve, 20));
    return this.nodeDefinitionService.getDefinitionById(id);
  }

  /**
   * Saves the current graph state.
   * In the future, this would send data to a backend project management service.
   * @param graphState The current state of the graph to save.
   */
  public async saveGraph(graphState: GraphState): Promise<void> {
    // Simulate async save operation
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      this.projectSerializer.save(graphState);
      console.log('PlatformDataService: Graph saved via ProjectSerializer.');
    } catch (error) {
      console.error('PlatformDataService: Error saving graph via ProjectSerializer:', error);
      throw error; // Re-throw to be handled by the caller
    }
  }

  /**
   * Loads a graph state.
   * In the future, this would fetch data from a backend project management service.
   * @returns The loaded graph state, or null if no saved data.
   */
  public async loadGraph(): Promise<GraphState | null> {
    // Simulate async load operation
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      const loadedState = this.projectSerializer.load();
      if (loadedState) {
        console.log('PlatformDataService: Graph loaded via ProjectSerializer.');
      } else {
        console.log('PlatformDataService: No graph data found by ProjectSerializer.');
      }
      return loadedState;
    } catch (error) {
      console.error('PlatformDataService: Error loading graph via ProjectSerializer:', error);
      throw error; // Re-throw
    }
  }

  /**
   * Clears any saved graph state.
   * In the future, this might involve an API call to delete a project.
   */
  public async clearSavedGraph(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 50));
    try {
      this.projectSerializer.clear();
      console.log('PlatformDataService: Saved graph cleared via ProjectSerializer.');
    } catch (error) {
      console.error('PlatformDataService: Error clearing saved graph:', error);
      throw error;
    }
  }

  // Future methods:
  // async listProjects(): Promise<ProjectMetadata[]>
  // async loadProjectById(projectId: string): Promise<GraphState | null>
  // async createNewProject(projectName: string): Promise<ProjectMetadata>
  // etc.
}