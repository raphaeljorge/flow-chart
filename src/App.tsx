import React, { useEffect, useState, useMemo, useCallback } from 'react';
import FlowEditor from './components/FlowEditor';
import NodePalette from './components/NodePalette';
import ConfigPanel from './components/ConfigPanel';
import PreferencesPanel from './components/PreferencesPanel';
import Breadcrumb from './components/Breadcrumb'; 
import { NodeEditorController } from './editor/app/NodeEditorController';
import { BreadcrumbEntry } from './editor/core/types';

const App: React.FC = () => {
  const [controller, setController] = useState<NodeEditorController | null>(null);
  const [isPrefsVisible, setIsPrefsVisible] = useState(false);
  const [navigationPath, setNavigationPath] = useState<BreadcrumbEntry[]>([]);

  const editorOptions = useMemo(() => ({
    defaultScale: 1,
    gridSize: 20,
    showGrid: true,
    snapToGrid: false,
    showPalette: false,
    showToolbar: true,
  }), []);

  const handleEditorReady = useCallback((editorController: NodeEditorController) => {
    setController(editorController);
    
    editorController.viewStore.on('viewchanged', (newState) => {
        setNavigationPath(newState.navigationPath);
    });

    editorController.loadGraphFromLocalStorage().then(() => {
        setNavigationPath(editorController.viewStore.getNavigationPath());
    }).catch(console.error);
    
  }, []);

  return (
    <div className="app-container">
      <NodePalette controller={controller} />
      <div className="editor-container">
        <FlowEditor 
          options={editorOptions}
          onEditorReady={handleEditorReady}
        />
        <Breadcrumb controller={controller} path={navigationPath} />
      </div>
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