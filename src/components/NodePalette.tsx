import React, { useState, useEffect, useCallback, useMemo } from "react";
import { NodeEditorController } from "../editor/app/NodeEditorController";
import { NodeDefinition, TooltipContent } from "../editor/core/types";
import { LOCAL_STORAGE_FAVORITES_KEY } from "../editor/core/constants";
import "../editor/components/NodePalette/NodePalette.css";

interface NodePaletteProps {
  controller: NodeEditorController | null;
}

const NodePalette: React.FC<NodePaletteProps> = ({ controller }) => {
  const [nodeDefs, setNodeDefs] = useState<NodeDefinition[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  );

  // Efeito para carregar as definições iniciais dos nós a partir do controlador
  useEffect(() => {
    if (controller) {
      controller.getNodeDefinitions().then((definitions) => {
        const displayDefinitions = [...definitions];
        if (!displayDefinitions.find((def) => def.id === "sticky-note-def")) {
          displayDefinitions.unshift({
            id: "sticky-note-def",
            title: "Sticky Note",
            description: "Add a resizable sticky note for annotations.",
            category: "Annotations",
            icon: "ph-note",
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
  const handleToggleFavorite = useCallback(
    (e: React.MouseEvent, defId: string) => {
      e.stopPropagation();
      e.preventDefault();

      setFavorites((prevFavorites) => {
        const newFavorites = new Set(prevFavorites);
        if (newFavorites.has(defId)) {
          newFavorites.delete(defId);
        } else {
          newFavorites.add(defId);
        }
        localStorage.setItem(
          LOCAL_STORAGE_FAVORITES_KEY,
          JSON.stringify(Array.from(newFavorites))
        );
        return newFavorites;
      });
    },
    []
  );

  const handleToggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    defId: string
  ) => {
    e.dataTransfer.setData("text/plain", defId);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleMouseEnterNode = (
    e: React.MouseEvent<HTMLDivElement>,
    def: NodeDefinition
  ) => {
    if (!controller?.tooltip) return;

    const content: TooltipContent = {
      title: def.title,
      type: def.category,
      description: def.description,
      id: def.id,
    };

    const clientPoint = { x: e.clientX, y: e.clientY };
    controller.tooltip.scheduleShow(clientPoint, content);
  };

  const handleMouseLeaveNode = () => {
    controller?.tooltip?.hide();
  };

  const filteredNodes = useMemo(() => {
    return nodeDefs.filter((def) => {
      const lowerSearchTerm = searchTerm.toLowerCase();
      return (
        searchTerm === "" ||
        def.title.toLowerCase().includes(lowerSearchTerm) ||
        (def.description &&
          def.description.toLowerCase().includes(lowerSearchTerm)) ||
        (def.category && def.category.toLowerCase().includes(lowerSearchTerm))
      );
    });
  }, [nodeDefs, searchTerm]);

  const groupedNodes = useMemo(() => {
    const groups: { [key: string]: NodeDefinition[] } = {};
    const favoriteNodes: NodeDefinition[] = [];

    filteredNodes.forEach((node) => {
      if (favorites.has(node.id)) {
        favoriteNodes.push(node);
      }
      const category = node.category || "Uncategorized";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(node);
    });

    const sortedCategories = Object.keys(groups).sort((a, b) =>
      a.localeCompare(b)
    );

    return {
      favoriteNodes,
      categories: sortedCategories,
      groupedNodes: groups,
    };
  }, [filteredNodes, favorites]);

  const renderNode = (def: NodeDefinition) => {
    const isFavorite = favorites.has(def.id);
    return (
      <div
        key={def.id}
        className="node-item"
        draggable
        onDragStart={(e) => handleDragStart(e, def.id)}
        onMouseEnter={(e) => handleMouseEnterNode(e, def)}
        onMouseLeave={handleMouseLeaveNode}
      >
        <div className="node-icon-wrapper">
          <i className={`ph ${def.icon || "ph-cube"}`}></i>
        </div>
        <div className="node-info">
          <div className="node-title">{def.title}</div>
          <div className="node-description">{def.description}</div>
        </div>
        <button
          className={`favorite-button ${isFavorite ? "active" : ""}`}
          onClick={(e) => handleToggleFavorite(e, def.id)}
          title="Toggle favorite"
        >
          <i className={`${isFavorite ? "ph-fill ph-star" : "ph ph-star"}`}></i>
        </button>
      </div>
    );
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

        <div className="palette-nodes">
          {/* List nodes */}
          {groupedNodes.favoriteNodes.length > 0 && (
            <div className="category-section">
              <div
                className="category-section-header"
                onClick={() => handleToggleCategory("Favorites")}
              >
                <i
                  className={`ph ${
                    collapsedCategories.has("Favorites")
                      ? "ph-caret-right"
                      : "ph-caret-down"
                  } caret-icon`}
                ></i>
                <i className="ph ph-star category-icon"></i>
                Favorites
              </div>
              {!collapsedCategories.has("Favorites") && (
                <div className="category-section-nodes">
                  {groupedNodes.favoriteNodes.map(renderNode)}
                </div>
              )}
            </div>
          )}

          {/* List categories */}
          {groupedNodes.categories.map((category) => {
            const nodesInCategory = groupedNodes.groupedNodes[category];
            if (nodesInCategory.length === 0) return null;

            const isCollapsed = collapsedCategories.has(category);

            return (
              <div key={category} className="category-section">
                <div
                  className="category-section-header"
                  onClick={() => handleToggleCategory(category)}
                >
                  <i
                    className={`ph ${
                      isCollapsed ? "ph-caret-right" : "ph-caret-down"
                    } caret-icon`}
                  ></i>
                  {category}
                </div>
                {!isCollapsed && (
                  <div className="category-section-nodes">
                    {nodesInCategory.map(renderNode)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default NodePalette;
