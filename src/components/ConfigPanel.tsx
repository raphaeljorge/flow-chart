import React, { useState, useEffect, useCallback } from 'react';
import { NodeEditorController } from '../editor/app/NodeEditorController';
import { Node, Connection, StickyNote, ConfigurableItem, ConfigurableItemType, ConfigParameter, NodeGroup, LineStyle } from '../editor/core/types';
import '../editor/components/ConfigPanel/ConfigPanel.css';

interface ConfigPanelProps {
  controller: NodeEditorController | null;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ controller }) => {
  const [selectedItem, setSelectedItem] = useState<ConfigurableItem | null>(null);
  const [itemType, setItemType] = useState<ConfigurableItemType | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const updateSelection = useCallback((selectedIds: string[]) => {
    if (!controller) return;

    if (selectedIds.length === 1) {
      const id = selectedIds[0];
      let item: ConfigurableItem | undefined;
      let type: ConfigurableItemType | null = null;
      
      item = controller.nodeManager.getNode(id);
      if (item) { type = 'node'; }
      else {
        item = controller.connectionManager.getConnection(id);
        if (item) { type = 'connection'; }
        else {
          item = controller.stickyNoteManager.getNote(id);
          if (item) { type = 'stickyNote'; }
          else {
            item = controller.nodeGroupManager.getGroup(id);
            if (item) { type = 'group'; }
          }
        }
      }

      if (item && type) {
        setSelectedItem(item);
        setItemType(type);
        let initialTabData: any = {};
        let initialTab: string | null = 'general';

        if (type === 'node') {
            const node = item as Node;
            initialTabData = { ...node.data, color: node.color || '#666666' };
            initialTab = node.config?.tabs?.[0]?.id || 'general';
        } else if (type === 'group') {
            const group = item as NodeGroup;
            initialTabData = { ...group.style, title: group.title };
            initialTab = 'style';
        } else if (type === 'connection') {
            const conn = item as Connection;
            initialTabData = { 
              label: conn.data?.label || '',
              color: conn.style?.color || '#FFFFFF',
              lineStyle: conn.style?.lineStyle || 'solid',
              animated: conn.style?.animated || false
            };
            initialTab = 'general';
        } else if (type === 'stickyNote') {
            const note = item as StickyNote;
            initialTabData = note.style || {};
            initialTab = 'style';
        }
        setFormData(initialTabData);
        setActiveTab(initialTab);
      } else {
        setSelectedItem(null);
        setItemType(null);
      }
    } else {
      setSelectedItem(null);
      setItemType(null);
    }
  }, [controller]);

  useEffect(() => {
    if (!controller) return;
    controller.selectionManager.on('selectionChanged', updateSelection);
    
    // Fallback if the React component misses the first selection event
    if(controller.selectionManager.getSelectionCount() === 1) {
        updateSelection(controller.selectionManager.getSelectedItems());
    }

    return () => {
      controller.selectionManager.off('selectionChanged', updateSelection);
    };
  }, [controller, updateSelection]);

  useEffect(() => {
    if (!selectedItem) {
        setFormData({});
        setActiveTab(null);
    }
  }, [selectedItem]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const finalValue = isCheckbox ? (e.target as HTMLInputElement).checked : value;
    
    const newFormData = { ...formData, [name]: finalValue };
    setFormData(newFormData);

    if (!controller || !selectedItem || !itemType) return;
  
    if (itemType === 'node') {
        const { color, ...nodeData } = newFormData;
        controller.nodeManager.updateNode(selectedItem.id, { data: nodeData, color: color, status: 'unsaved' });
    } else if (itemType === 'group') {
        const { title, ...styleData } = newFormData;
        controller.nodeGroupManager.updateGroup(selectedItem.id, { title, style: styleData });
    } else if (itemType === 'stickyNote') {
      controller.stickyNoteManager.updateNote(selectedItem.id, { style: newFormData });
    } else if (itemType === 'connection') {
      const { label, color, lineStyle, animated } = newFormData;
      controller.connectionManager.updateConnectionData(selectedItem.id, { label });
      controller.connectionManager.updateConnectionStyle(selectedItem.id, { 
        color, 
        lineStyle, 
        animated: !!animated
      });
    }
  };
  
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
              <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
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
              name={param.id}
              className="config-input-hex"
              pattern="^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
              title="Hex color code"
            />
          </div>
        );
      
      default:
        return <p>Unsupported parameter type: {param.type}</p>;
    }
  };

  if (!selectedItem || !itemType) {
    return <div className="config-panel-wrapper" />;
  }

  let config: any;
  let title: string;
  let icon: string;
  let subTitle: string = itemType;

  if (itemType === 'node') {
    const node = selectedItem as Node;
    config = { ...node.config };
    config.parameters = [...(config.parameters || [])];
    config.tabs = [...(config.tabs || [])];
    if(!config.tabs.find((t:any) => t.id === 'appearance')) {
      config.tabs.push({ id: 'appearance', label: 'Appearance', icon: 'ph-palette' });
    }
    if(!config.parameters.find((p:any) => p.id === 'color')) {
        config.parameters.push({
            id: 'color', tabId: 'appearance', type: 'color', label: 'Node Color', 
            description: 'Custom color for the node highlight.', defaultValue: node.color || '#666666'
        });
    }
    title = node.title;
    icon = node.icon || 'ph-cube';
    subTitle = node.type;
  } else if (itemType === 'group') {
    const group = selectedItem as NodeGroup;
    title = group.title;
    icon = 'ph-selection-background';
    subTitle = 'Group';
    config = {
        tabs: [{ id: 'style', label: 'Style', icon: 'ph-palette' }],
        parameters: [
            { id: 'title', tabId: 'style', type: 'text', label: 'Group Title', defaultValue: group.title },
            { id: 'backgroundColor', tabId: 'style', type: 'color', label: 'Background Color', defaultValue: group.style.backgroundColor },
            { id: 'borderColor', tabId: 'style', type: 'color', label: 'Border Color', defaultValue: group.style.borderColor },
            { id: 'titleColor', tabId: 'style', type: 'color', label: 'Title Color', defaultValue: group.style.titleColor },
        ]
    };
  } else if (itemType === 'connection') {
    const conn = selectedItem as Connection;
    title = 'Connection';
    icon = 'ph-link';
    const sourcePort = controller?.nodeManager.getPort(conn.sourcePortId);
    const targetPort = controller?.nodeManager.getPort(conn.targetPortId);
    subTitle = `From ${sourcePort?.name || '?'} to ${targetPort?.name || '?'}`;
    config = {
        tabs: [
            { id: 'general', label: 'General', icon: 'ph-link' },
            { id: 'appearance', label: 'Appearance', icon: 'ph-palette' },
        ],
        parameters: [
            { id: 'label', tabId: 'general', type: 'text', label: 'Label', defaultValue: conn.data?.label || '' },
            { 
              id: 'lineStyle', tabId: 'appearance', type: 'select', label: 'Line Style',
              defaultValue: conn.style?.lineStyle || 'solid',
              options: [
                { value: 'solid', label: 'Solid' },
                { value: 'dashed', label: 'Dashed' },
                { value: 'dotted', label: 'Dotted' },
              ]
            },
            { id: 'color', tabId: 'appearance', type: 'color', label: 'Line Color', defaultValue: conn.style?.color || '#FFFFFF' },
            { id: 'animated', tabId: 'appearance', type: 'boolean', label: 'Animate Flow', defaultValue: !!conn.style?.animated },
        ]
    };
  } else if (itemType === 'stickyNote') {
    const note = selectedItem as StickyNote;
    title = 'Sticky Note';
    icon = 'ph-note';
    subTitle = 'Annotation';
    config = {
        tabs: [{id: 'style', label: 'Style', icon: 'ph-paint-brush'}],
        parameters: [
            { id: 'backgroundColor', tabId: 'style', type: 'color', label: 'Background Color', defaultValue: note.style.backgroundColor },
            { id: 'textColor', tabId: 'style', type: 'color', label: 'Text Color', defaultValue: note.style.textColor },
            { id: 'fontSize', tabId: 'style', type: 'number', label: 'Font Size (px)', defaultValue: note.style.fontSize, validation: {min: 8, max: 72}},
        ]
    };
  } else {
    config = {};
    title = 'Item';
    icon = 'ph-gear';
  }


  const allParameters = config?.parameters || [];
  const allTabs = config?.tabs || [];

  return (
    <div className="config-panel-wrapper visible">
      <div className="config-panel">
        <div className="config-panel-header">
          <div className="config-panel-icon">
            <i className={`ph ${icon}`}></i>
          </div>
          <div className="config-panel-title">
            <h2>{title}</h2>
            <p>{subTitle}</p>
          </div>
        </div>

        {allTabs.length > 0 && (
          <div className="config-panel-tabs">
            {allTabs.map((tab: any) => (
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
            .filter((param: any) => {
                if (!allTabs.length || !param.tabId || param.tabId === activeTab) {
                    return true;
                }
                return false;
            })
            .map((param: any) => (
              <div key={param.id} className="form-group">
                <label htmlFor={param.id}>{param.label}</label>
                {renderInput(param)}
                {param.description && (
                  <div className="help">{param.description}</div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default ConfigPanel;