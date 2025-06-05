import React, { useEffect, useRef } from 'react';
import { NodeEditorController } from './editor/app/NodeEditorController';

const App: React.FC = () => {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorControllerRef = useRef<NodeEditorController | null>(null);

  useEffect(() => {
    if (editorContainerRef.current && !editorControllerRef.current) {
      const controller = new NodeEditorController(editorContainerRef.current, {
        showPalette: true,
        showToolbar: true,
        defaultScale: 1,
        gridSize: 20,
        showGrid: true,
        snapToGrid: false,
      });

      editorControllerRef.current = controller;

      // Load saved graph if exists
      controller.loadGraphFromLocalStorage().catch(console.error);

      // Cleanup on unmount
      return () => {
        controller.destroy();
        editorControllerRef.current = null;
      };
    }
  }, []);

  return (
    <div className="app-container">
      <div ref={editorContainerRef} className="editor-container" />
      
      <div className="button-container">
        <button
          onClick={() => editorControllerRef.current?.saveGraphToLocalStorage()}
          className="btn btn-primary"
        >
          Save Graph
        </button>
        <button
          onClick={() => editorControllerRef.current?.loadGraphFromLocalStorage()}
          className="btn btn-secondary"
        >
          Load Graph
        </button>
        <button
          onClick={() => editorControllerRef.current?.clearGraph()}
          className="btn btn-danger"
        >
          Clear Graph
        </button>
      </div>
    </div>
  );
};

export default App;