import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import FlowEditor from './components/FlowEditor';
import NodePalette from './components/NodePalette';
import ConfigPanel from './components/ConfigPanel';
import PreferencesPanel from './components/PreferencesPanel';
import Breadcrumb from './components/Breadcrumb'; 
import { NodeEditorController } from './editor/app/NodeEditorController';
import { TabController } from './editor/app/TabController';
import { BreadcrumbEntry } from './editor/core/types';
import { FlowTab } from './editor/state/TabManager';
import './editor/components/TabBar/TabBar.css';

const App: React.FC = () => {
  const [tabController, setTabController] = useState<TabController | null>(null);
  const [currentController, setCurrentController] = useState<NodeEditorController | null>(null);
  const [isPrefsVisible, setIsPrefsVisible] = useState(false);
  const [navigationPath, setNavigationPath] = useState<BreadcrumbEntry[]>([]);
  const [tabs, setTabs] = useState<FlowTab[]>([]);
  const [activeTab, setActiveTab] = useState<FlowTab | null>(null);
  
  const tabBarRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const editorOptions = useMemo(() => ({
    defaultScale: 1,
    gridSize: 20,
    showGrid: true,
    snapToGrid: false,
    showPalette: false,
    showToolbar: true,
  }), []);

  useEffect(() => {
    if (tabBarRef.current && canvasContainerRef.current && !tabController) {
      const controller = new TabController(
        tabBarRef.current,
        canvasContainerRef.current,
        editorOptions
      );

      controller.on('activeTabChanged', (tab: FlowTab) => {
        setActiveTab(tab);
        const currentCtrl = controller.getCurrentController();
        setCurrentController(currentCtrl);
        
        if (currentCtrl) {
          setNavigationPath(currentCtrl.viewStore.getNavigationPath());
          
          // Set up navigation path updates
          currentCtrl.viewStore.off('viewchanged', handleViewChanged);
          currentCtrl.viewStore.on('viewchanged', handleViewChanged);
        }
      });

      controller.on('tabStateChanged', (allTabs: FlowTab[], active: FlowTab | null) => {
        setTabs(allTabs);
        setActiveTab(active);
      });

      setTabController(controller);
    }

    return () => {
      if (tabController) {
        tabController.destroy();
      }
    };
  }, [tabController, editorOptions]);

  const handleViewChanged = useCallback((newState: any) => {
    setNavigationPath(newState.navigationPath);
  }, []);

  return (
    <div className="app-container">
      <NodePalette controller={currentController} />
      <div className="editor-container">
        {/* Tab Bar */}
        <div ref={tabBarRef} className="tab-bar-container"></div>
        
        {/* Canvas Container for Multiple Tabs */}
        <div ref={canvasContainerRef} className="tabs-canvas-container"></div>
        
        {/* Breadcrumb */}
        <Breadcrumb controller={currentController} path={navigationPath} />
      </div>
      <ConfigPanel controller={currentController} />

      <PreferencesPanel 
        controller={currentController}
        isVisible={isPrefsVisible}
        onClose={() => setIsPrefsVisible(false)}
      />
      
      <div className="button-container">
        <button
          onClick={() => tabController?.saveCurrentTab()}
          className="btn btn-primary"
          disabled={!activeTab}
        >
          Save Tab
        </button>
        <button
          onClick={() => tabController?.saveAllTabs()}
          className="btn btn-success"
          disabled={tabs.length === 0}
        >
          Save All
        </button>
        <button
          onClick={() => currentController?.clearGraph()}
          className="btn btn-danger"
          disabled={!currentController}
        >
          Clear Tab
        </button>
        <button
          onClick={() => setIsPrefsVisible(true)}
          className="btn btn-secondary"
          title="Settings"
        >
          <i className="ph ph-gear-six"></i>
        </button>
        
        {/* Tab info */}
        {activeTab && (
          <div className="tab-info">
            <span className="tab-name">{activeTab.name}</span>
            {activeTab.isDirty && <span className="dirty-indicator">●</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;