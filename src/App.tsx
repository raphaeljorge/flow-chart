import React, { useEffect, useRef } from 'react';
import { NodeEditorController } from './editor/app/NodeEditorController';
import './editor/styles/main.css';

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
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div ref={editorContainerRef} style={{ flex: 1, position: 'relative' }} />
      
      <div style={{ position: 'fixed', bottom: '20px', left: '20px', zIndex: 1001, display: 'flex', gap: '10px' }}>
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