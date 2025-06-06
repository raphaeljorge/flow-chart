import React, { useEffect, useRef, useState } from 'react';
import FlowEditor from './components/FlowEditor';
import NodePalette from './components/NodePalette';
import ConfigPanel from './components/ConfigPanel';
import { NodeEditorController } from './editor/app/NodeEditorController';

const App: React.FC = () => {
  const [controller, setController] = useState<NodeEditorController | null>(null);

  const handleEditorReady = (editorController: NodeEditorController) => {
    setController(editorController);
    // Load saved graph if exists
    editorController.loadGraphFromLocalStorage().catch(console.error);
  };

  return (
    <div className="app-container">
      <NodePalette controller={controller} />
      <FlowEditor 
        options={{
          defaultScale: 1,
          gridSize: 20,
          showGrid: true,
          snapToGrid: false,
          showPalette: false,
          showToolbar: true,
        }}
        onEditorReady={handleEditorReady}
      />
      <ConfigPanel controller={controller} />
      
      <div className="button-container">
        <button
          onClick={() => controller?.saveGraphToLocalStorage()}
          className="btn btn-primary"
        >
          Save Graph
        </button>
        <button
          onClick={() => controller?.loadGraphFromLocalStorage()}
          className="btn btn-secondary"
        >
          Load Graph
        </button>
        <button
          onClick={() => controller?.clearGraph()}
          className="btn btn-danger"
        >
          Clear Graph
        </button>
      </div>
    </div>
  );
};

export default App;