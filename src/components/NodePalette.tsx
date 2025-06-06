import React, { useState, useEffect } from 'react';
import { NodeEditorController, NodeDefinition } from '../editor/app/NodeEditorController';
import '../editor/components/NodePalette/NodePalette.css';

interface NodePaletteProps {
  controller: NodeEditorController | null;
}

const NodePalette: React.FC<NodePaletteProps> = ({ controller }) => {
  const [nodeDefs, setNodeDefs] = useState<NodeDefinition[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    if (controller) {
      controller.getNodeDefinitions().then(setNodeDefs);
    }
  }, [controller]);

  const categories = ['All', ...new Set(nodeDefs.map(def => def.category))].filter(Boolean);
  
  const filteredNodes = nodeDefs.filter(def => {
    const matchesSearch = searchTerm === '' || 
      def.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      def.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = activeCategory === 'All' || def.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, defId: string) => {
    e.dataTransfer.setData('text/plain', defId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="node-palette">
      <div className="palette-header">
        <input
          type="text"
          className="palette-search"
          placeholder="Search nodes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="palette-categories">
        {categories.map(category => (
          <div
            key={category}
            className={`category-item ${category === activeCategory ? 'active' : ''}`}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </div>
        ))}
      </div>

      <div className="palette-nodes">
        {filteredNodes.map((def) => (
          <div
            key={def.id}
            className="node-item"
            draggable
            onDragStart={(e) => handleDragStart(e, def.id)}
          >
            <div className="node-icon-wrapper">
              <i className={`ph ${def.icon}`}></i>
            </div>
            <div className="node-info">
              <div className="node-title">{def.title}</div>
              <div className="node-description">{def.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NodePalette;