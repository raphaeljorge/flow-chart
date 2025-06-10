// src/components/Breadcrumb.tsx
import React from 'react';
import { NodeEditorController } from '../../editor/app/NodeEditorController';
import { BreadcrumbEntry } from '../../editor/core/types';
import './Breadcrumb.css';

interface BreadcrumbProps {
  controller: NodeEditorController | null;
  path: BreadcrumbEntry[];
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ controller, path }) => {
  if (!controller || path.length <= 1) {
    return null; // Não mostrar se estiver na raiz
  }

  const handleNavigation = (graphId: string) => {
    controller.navigateToGraphId(graphId);
  };

  return (
    <nav className="breadcrumb-container">
      <ol className="breadcrumb-list">
        {path.map((entry, index) => (
          <li key={entry.graphId} className="breadcrumb-item">
            {index < path.length - 1 ? (
              <a href="#" onClick={(e) => { e.preventDefault(); handleNavigation(entry.graphId); }}>
                {entry.label}
              </a>
            ) : (
              <span className="breadcrumb-current">{entry.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumb;