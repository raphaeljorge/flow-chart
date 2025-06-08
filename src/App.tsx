import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import FlowEditor from './components/FlowEditor';
import NodePalette from './components/NodePalette';
import ConfigPanel from './components/ConfigPanel';
import PreferencesPanel from './components/PreferencesPanel';
import { NodeEditorController } from './editor/app/NodeEditorController';

const App: React.FC = () => {
  const [controller, setController] = useState<NodeEditorController | null>(null);
  const [isPrefsVisible, setIsPrefsVisible] = useState(false);

  // 1. Memoize o objeto de opções para que ele não seja recriado em cada renderização.
  const editorOptions = useMemo(() => ({
    defaultScale: 1,
    gridSize: 20,
    showGrid: true,
    snapToGrid: false,
    showPalette: false,
    showToolbar: true,
  }), []);

  // 2. Envolva a função de callback em useCallback para garantir que ela não mude.
  const handleEditorReady = useCallback((editorController: NodeEditorController) => {
    setController(editorController);
    editorController.loadGraphFromLocalStorage().catch(console.error);
  }, []);

  return (
    <div className="app-container">
      <NodePalette controller={controller} />
      <FlowEditor 
        options={editorOptions}
        onEditorReady={handleEditorReady}
      />
      <ConfigPanel controller={controller} />

      <PreferencesPanel 
        controller={controller}
        isVisible={isPrefsVisible}
        onClose={() => setIsPrefsVisible(false)}
      />
      
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
        <button
          onClick={() => setIsPrefsVisible(true)}
          className="btn btn-secondary"
          title="Settings"
        >
          <i className="ph ph-gear-six"></i>
        </button>
      </div>
    </div>
  );
};

export default App;