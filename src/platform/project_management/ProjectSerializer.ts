// src/platform/project_management/ProjectSerializer.ts
import { GraphState, Node, StickyNote, Connection, ViewState } from '../../editor/core/types';

/**
 * ProjectSerializer handles the serialization (saving) and deserialization (loading)
 * of the editor's graph state. Initially, it uses localStorage.
 * In the future, this would interact with a backend Project Management Service
 * via PlatformDataService.
 */
export class ProjectSerializer {
  private storageKey: string;

  constructor(localStorageKey: string) {
    this.storageKey = localStorageKey;
  }

  /**
   * Saves the graph state to localStorage.
   * @param graphState The complete state of the graph.
   */
  public save(graphState: GraphState): void {
    try {
      // Perform a deep clone before saving to avoid any potential issues with references
      // and to ensure only plain data is stored.
      const stateToSave: GraphState = {
          nodes: graphState.nodes.map(n => ({ ...n, data: n.data ? JSON.parse(JSON.stringify(n.data)) : undefined })),
          stickyNotes: graphState.stickyNotes.map(sn => ({ ...sn, style: { ...sn.style }})),
          connections: graphState.connections.map(c => ({...c, data: c.data ? JSON.parse(JSON.stringify(c.data)) : undefined })),
          viewState: { ...graphState.viewState, offset: { ...graphState.viewState.offset } }
      };
      const serializedState = JSON.stringify(stateToSave);
      localStorage.setItem(this.storageKey, serializedState);
      console.log(`ProjectSerializer: Graph saved to localStorage key "${this.storageKey}".`);
    } catch (error) {
      console.error('ProjectSerializer: Error saving graph to localStorage:', error);
      throw new Error('Failed to save graph data.'); // Propagate error
    }
  }

  /**
   * Loads the graph state from localStorage.
   * @returns The deserialized GraphState, or null if no data is found or if data is corrupt.
   */
  public load(): GraphState | null {
    try {
      const serializedState = localStorage.getItem(this.storageKey);
      if (!serializedState) {
        console.log(`ProjectSerializer: No graph data found in localStorage key "${this.storageKey}".`);
        return null;
      }
      const parsedState = JSON.parse(serializedState);

      // Basic validation of the loaded structure (can be more thorough)
      if (parsedState && Array.isArray(parsedState.nodes) && Array.isArray(parsedState.connections) && parsedState.viewState) {
         // Ensure all parts of viewState are present, providing defaults if necessary
        const defaultViewState: ViewState = { scale: 1, offset: { x: 0, y: 0 }, showGrid: true, snapToGrid: false, gridSize: 20 };
        parsedState.viewState = { ...defaultViewState, ...parsedState.viewState };
        if (!parsedState.viewState.offset) parsedState.viewState.offset = { ...defaultViewState.offset };


        // Ensure nodes have port arrays initialized if missing from older saves
        parsedState.nodes.forEach((node: Node) => {
            node.fixedInputs = node.fixedInputs || [];
            node.fixedOutputs = node.fixedOutputs || [];
            node.dynamicInputs = node.dynamicInputs || [];
            node.dynamicOutputs = node.dynamicOutputs || [];
        });
        parsedState.stickyNotes = parsedState.stickyNotes || [];


        console.log(`ProjectSerializer: Graph loaded from localStorage key "${this.storageKey}".`);
        return parsedState as GraphState;
      } else {
        console.warn(`ProjectSerializer: Data in localStorage key "${this.storageKey}" is not a valid graph state.`);
        localStorage.removeItem(this.storageKey); // Clear corrupted data
        return null;
      }
    } catch (error) {
      console.error('ProjectSerializer: Error loading graph from localStorage:', error);
      // Optionally clear corrupted data: localStorage.removeItem(this.storageKey);
      return null; // Indicate failure to load
    }
  }

  /**
   * Clears the saved graph data from localStorage.
   */
  public clear(): void {
    try {
      localStorage.removeItem(this.storageKey);
      console.log(`ProjectSerializer: Cleared graph data from localStorage key "${this.storageKey}".`);
    } catch (error) {
      console.error('ProjectSerializer: Error clearing graph data from localStorage:', error);
      throw new Error('Failed to clear saved graph data.');
    }
  }
}