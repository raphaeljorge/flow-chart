// src/main.ts
import './editor/styles/main.css'; // Global styles for the editor
import './editor/styles/theme-variables.css'; // Theme variables
import { NodeEditorController } from './editor/app/NodeEditorController';
import '@phosphor-icons/web/regular'; // Ensure Phosphor icons CSS/font is loaded

const appElement = document.querySelector<HTMLDivElement>('#app');

if (!appElement) {
  throw new Error('Root application element #app not found in the DOM.');
}

const editorController = new NodeEditorController(appElement, {
  showPalette: true,
  showToolbar: true,
  defaultScale: 1,
  gridSize: 20,
  showGrid: true,
  snapToGrid: false,
  // nodeDefinitions can be loaded dynamically via PlatformDataService in NodeEditorController
});

// --- Save/Load/Clear Graph Button Logic ---
const saveGraphBtn = document.getElementById('saveGraphBtn');
const loadGraphBtn = document.getElementById('loadGraphBtn');
const clearGraphBtn = document.getElementById('clearGraphBtn');

if (saveGraphBtn) {
  saveGraphBtn.addEventListener('click', async () => {
    try {
      await editorController.saveGraphToLocalStorage();
      console.log('Graph Saved to LocalStorage via Controller');
      alert('Graph saved to LocalStorage!');
    } catch (error) {
      console.error('Error saving graph:', error);
      alert('Failed to save graph.');
    }
  });
}

if (loadGraphBtn) {
  loadGraphBtn.addEventListener('click', async () => {
    try {
      const loaded = await editorController.loadGraphFromLocalStorage();
      if (loaded) {
        console.log('Graph Loaded from LocalStorage via Controller');
        alert('Graph loaded from LocalStorage!');
      } else {
        alert('No saved graph data found in LocalStorage.');
      }
    } catch (error) {
      console.error('Error loading graph:', error);
      alert('Failed to load graph.');
    }
  });
}

if (clearGraphBtn) {
    clearGraphBtn.addEventListener('click', async () => {
        try {
            await editorController.clearGraph();
            alert('Graph cleared!');
        } catch (error) {
            console.error('Error clearing graph:', error);
            alert('Failed to clear graph.');
        }
    });
}

// Optional: Automatically load the last saved graph on startup
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const loaded = await editorController.loadGraphFromLocalStorage();
        if (loaded) {
            console.log('Automatically loaded saved graph from LocalStorage.');
        }
    } catch (e) {
        console.error('Failed to automatically load graph from LocalStorage:', e);
        // Optionally clear corrupted data from localStorage
        // localStorage.removeItem(editorController.getLocalStorageKey());
    }
});

// Expose editor instance for debugging or external control if needed
(window as any).editorController = editorController;