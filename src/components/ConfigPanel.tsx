import React, { useState, useEffect } from 'react';
import { NodeEditorController, Node, Connection, StickyNote, ConfigurableItem, ConfigurableItemType, ConfigParameter } from '../editor/app/NodeEditorController';
import '../editor/components/ConfigPanel/ConfigPanel.css';

interface ConfigPanelProps {
  controller: NodeEditorController | null;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ controller }) => {
  const [selectedItem, setSelectedItem] = useState<ConfigurableItem | null>(null);
  const [itemType, setItemType] = useState<ConfigurableItemType | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
    if (!controller) return;

    const handleSelectionChange = (selectedIds: string[]) => {
      if (selectedIds.length === 1) {
        const id = selectedIds[0];
        const node = controller.nodeManager.getNode(id);
        if (node) {
          setSelectedItem(node);
          setItemType('node');
          // Include node color in formData
          setFormData({ ...node.data, color: node.color });
          // Set active tab to first available tab or 'general'
          setActiveTab(node.config?.tabs?.[0]?.id || 'general');
          return;
        }
        
        const conn = controller.connectionManager.getConnection(id);
        if (conn) {
          setSelectedItem(conn);
          setItemType('connection');
          setFormData(conn.data || {});
          setActiveTab('general');
          return;
        }

        const note = controller.stickyNoteManager.getNote(id);
        if (note) {
          setSelectedItem(note);
          setItemType('stickyNote');
          setFormData(note.style || {});
          setActiveTab('style');
          return;
        }
      } else {
        setSelectedItem(null);
        setItemType(null);
        setFormData({});
        setActiveTab(null);
      }
    };

    controller.selectionManager.on('selectionChanged', handleSelectionChange);
    return () => {
      controller.selectionManager.off('selectionChanged', handleSelectionChange);
    };
  }, [controller]);

  const renderInput = (param: ConfigParameter) => {
    const value = formData[param.id] ?? param.defaultValue ?? '';
    
    switch (param.type) {
      case 'text':
      case 'number':
      case 'secret':
        return (
          <input
            type={param.type === 'secret' ? 'password' : param.type}
            id={param.id}
            name={param.id}
            value={value}
            onChange={handleInputChange}
            className="config-input"
            required={param.required}
            min={param.validation?.min}
            max={param.validation?.max}
            pattern={param.validation?.pattern}
          />
        );
      
      case 'boolean':
        return (
          <div className="checkbox-group">
            <input
              type="checkbox"
              id={param.id}
              name={param.id}
              checked={!!value}
              onChange={handleInputChange}
              className="config-input"
            />
          </div>
        );
      
      case 'select':
        return (
          <select
            id={param.id}
            name={param.id}
            value={value}
            onChange={handleInputChange}
            className="config-input"
            required={param.required}
          >
            {param.options?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );
      
      case 'code':
        return (
          <textarea
            id={param.id}
            name={param.id}
            value={value}
            onChange={handleInputChange}
            className="code-editor config-input"
            required={param.required}
          />
        );
      
      case 'color':
        return (
          <div className="color-picker">
            <input
              type="color"
              id={param.id}
              name={param.id}
              value={value}
              onChange={handleInputChange}
              className="config-input-color"
            />
            <input
              type="text"
              value={value}
              onChange={handleInputChange}
              className="config-input-hex"
              pattern="^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$"
              title="Hex color code"
            />
          </div>
        );
      
      default:
        return <p>Unsupported parameter type: {param.type}</p>;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const finalValue = isCheckbox ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };
  
  const handleApplyChanges = () => {
    if (!controller || !selectedItem || !itemType) return;
    
    // For nodes, handle color separately from data
    if (itemType === 'node') {
      const { color, ...nodeData } = formData;
      controller.nodeManager.updateNode(selectedItem.id, { color });
      controller.applyItemConfig(selectedItem.id, itemType, nodeData);
    } else {
      controller.applyItemConfig(selectedItem.id, itemType, formData);
    }
  };

  if (!selectedItem || !itemType) {
    return <div className="config-panel-wrapper">Select an item to configure</div>;
  }

  const config = selectedItem.config;
  const title = (selectedItem as Node).title || (selectedItem as StickyNote).content || 'Item';
  const icon = (selectedItem as Node).icon || 'ph-gear';

  // Get all available tabs, including the style tab for nodes
  const allTabs = config?.tabs || [];
  if (itemType === 'node' && !allTabs.find(t => t.id === 'style')) {
    allTabs.push({ id: 'style', label: 'Style', icon: 'ph-palette' });
  }

  // Get all parameters, including style parameters for nodes
  const allParameters = [...(config?.parameters || [])];
  if (itemType === 'node' && activeTab === 'style') {
    allParameters.push({
      id: 'color',
      tabId: 'style',
      type: 'color',
      label: 'Node Color',
      description: 'Custom color for node border, ports, and icon.',
      defaultValue: (selectedItem as Node).color || '#666666'
    });
  }

  return (
    <div className="config-panel-wrapper visible">
      <div className="config-panel">
        <div className="config-panel-header">
          <div className="config-panel-icon">
            <i className={`ph ${icon}`}></i>
          </div>
          <div className="config-panel-title">
            <h2>{title}</h2>
            <p>{itemType}</p>
          </div>
        </div>

        {allTabs.length > 0 && (
          <div className="config-panel-tabs">
            {allTabs.map(tab => (
              <div
                key={tab.id}
                className={`config-tab ${tab.id === activeTab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon && <i className={`ph ${tab.icon}`}></i>}
                <span>{tab.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="config-panel-content">
          {allParameters
            .filter(param => !activeTab || param.tabId === activeTab)
            .map(param => (
              <div key={param.id} className="form-group">
                <label htmlFor={param.id}>{param.label}</label>
                {renderInput(param)}
                {param.description && (
                  <div className="help">{param.description}</div>
                )}
              </div>
            ))}
        </div>

        <div className="config-panel-actions">
          <button onClick={handleApplyChanges} className="btn btn-primary">
            <i className="ph ph-check"></i>
            Apply
          </button>
          {itemType === 'node' && (
            <button className="btn btn-secondary">
              <i className="ph ph-play"></i>
              Test
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigPanel;