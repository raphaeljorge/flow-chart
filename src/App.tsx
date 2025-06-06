import React, { useEffect, useRef } from 'react';
import FlowEditor from './components/FlowEditor';
import { NodeEditorController } from './editor/app/NodeEditorController';

const App: React.FC = () => {
  const handleEditorReady = (controller: NodeEditorController) => {
    // Load saved graph if exists
    controller.loadGraphFromLocalStorage().catch(console.error);
  };

  return (
    <div className="app-container">
      <FlowEditor 
        options={{
          defaultScale: 1,
          gridSize: 20,
          showGrid: true,
          snapToGrid: false,
        }}
        onEditorReady={handleEditorReady}
      />
      
      <div className="button-container">
        <button
          onClick={() => document.querySelector<HTMLDivElement>('.editor-container')?.querySelector<HTMLCanvasElement>('canvas')?.toBlob(blob => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'flow.png';
              a.click();
              URL.revokeObjectURL(url);
            }
          })}
          className="btn btn-primary"
        >
          Save Graph
        </button>
        <button
          onClick={() => document.querySelector<HTMLDivElement>('.editor-container')?.querySelector<HTMLCanvasElement>('canvas')?.toBlob(blob => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'flow.png';
              a.click();
              URL.revokeObjectURL(url);
            }
          })}
          className="btn btn-secondary"
        >
          Load Graph
        </button>
        <button
          className="btn btn-danger"
        >
          Clear Graph
        </button>
      </div>
    </div>
  );
};

export default App;