import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NodeEditorController } from '../editor/app/NodeEditorController';
import { NodeDefinition } from '../editor/core/types';
import { LOCAL_STORAGE_FAVORITES_KEY } from '../editor/core/constants';
import '../editor/components/NodePalette/NodePalette.css'; // Reutilizando o mesmo CSS

interface NodePaletteProps {
  controller: NodeEditorController | null;
}

const NodePalette: React.FC<NodePaletteProps> = ({ controller }) => {
  const [nodeDefs, setNodeDefs] = useState<NodeDefinition[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Efeito para carregar as definições iniciais dos nós a partir do controlador
  useEffect(() => {
    if (controller) {
      controller.getNodeDefinitions().then(definitions => {
        const displayDefinitions = [...definitions];
        if (!displayDefinitions.find(def => def.id === 'sticky-note-def')) {
          displayDefinitions.unshift({
            id: 'sticky-note-def',
            title: 'Sticky Note',
            description: 'Add a resizable sticky note for annotations.',
            category: 'Annotations',
            icon: 'ph-note',
          });
        }
        setNodeDefs(displayDefinitions);
      });
    }
  }, [controller]);

  // Efeito para carregar os favoritos do localStorage na montagem do componente
  useEffect(() => {
    const savedFavorites = localStorage.getItem(LOCAL_STORAGE_FAVORITES_KEY);
    if (savedFavorites) {
      setFavorites(new Set(JSON.parse(savedFavorites)));
    }
  }, []);

  // Função para alternar o status de favorito de um nó
  const handleToggleFavorite = useCallback((e: React.MouseEvent, defId: string) => {
    e.stopPropagation(); 
    e.preventDefault();

    setFavorites(prevFavorites => {
      const newFavorites = new Set(prevFavorites);
      if (newFavorites.has(defId)) {
        newFavorites.delete(defId);
      } else {
        newFavorites.add(defId);
      }
      // Persiste no localStorage
      localStorage.setItem(LOCAL_STORAGE_FAVORITES_KEY, JSON.stringify(Array.from(newFavorites)));
      return newFavorites;
    });
  }, []);


  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, defId: string) => {
    e.dataTransfer.setData('text/plain', defId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const categories = useMemo(() => {
    return [
      "All",
      "Favorites",
      ...new Set(nodeDefs.map(def => def.category || "Uncategorized"))
    ].filter((value, index, self) => self.indexOf(value) === index);
  }, [nodeDefs]);

  const filteredNodes = useMemo(() => {
    return nodeDefs.filter(def => {
      const lowerSearchTerm = searchTerm.toLowerCase();
      const matchesSearch = searchTerm === '' ||
        def.title.toLowerCase().includes(lowerSearchTerm) ||
        (def.description && def.description.toLowerCase().includes(lowerSearchTerm)) ||
        (def.category && def.category.toLowerCase().includes(lowerSearchTerm));

      const matchesCategory =
        activeCategory === 'All' ||
        (activeCategory === 'Favorites' && favorites.has(def.id)) ||
        def.category === activeCategory;

      return matchesSearch && matchesCategory;
    });
  }, [nodeDefs, searchTerm, activeCategory, favorites]);

  // Função simplificada para renderizar ícones no React
  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      'All': 'ph-list',
      'Favorites': 'ph-star',
      'Annotations': 'ph-note-pencil',
      'Triggers': 'ph-play-circle',
      'Actions': 'ph-lightning',
      'Logic': 'ph-git-fork',
      'Connectors': 'ph-plugs',
      'Custom Code': 'ph-code-block',
      'Uncategorized': 'ph-folder-simple'
    };
    return icons[category] || 'ph-folder';
  };

  if (!controller) {
    return <div className="node-palette-wrapper">Loading...</div>;
  }

  return (
    <div className="node-palette-wrapper">
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
              onClick={() => setActiveCategory(category!)}
            >
              <i className={`ph ${getCategoryIcon(category!)}`}></i>
              {category}
            </div>
          ))}
        </div>

        <div className="palette-nodes">
          {filteredNodes.map((def) => {
            const isFavorite = favorites.has(def.id);
            return (
              <div
                key={def.id}
                className="node-item"
                draggable
                onDragStart={(e) => handleDragStart(e, def.id)}
              >
                <div className="node-icon-wrapper">
                  <i className={`ph ${def.icon || 'ph-cube'}`}></i>
                </div>
                <div className="node-info">
                  <div className="node-title">{def.title}</div>
                  <div className="node-description">{def.description}</div>
                </div>
                <button
                  className={`favorite-button ${isFavorite ? 'active' : ''}`}
                  onClick={(e) => handleToggleFavorite(e, def.id)}
                  title="Toggle favorite"
                >
                    <i className={`${isFavorite ? 'ph-fill ph-star' : 'ph ph-star'}`}></i>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default NodePalette;