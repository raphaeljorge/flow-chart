import React, { useRef, useEffect, useState } from 'react';
import { NodeEditorController, NodeEditorOptions } from '../editor/app/NodeEditorController';

interface FlowEditorProps {
  options?: Partial<NodeEditorOptions>;
  onEditorReady?: (controller: NodeEditorController) => void;
}

const FlowEditor: React.FC<FlowEditorProps> = ({ options, onEditorReady }) => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [editorController, setEditorController] = useState<NodeEditorController | null>(null);

  useEffect(() => {
    if (canvasContainerRef.current && !editorController) {
      // Initialize the controller
      const controller = new NodeEditorController(canvasContainerRef.current, {
        ...options,
        showPalette: true, // Ensure internal UI isn't created
        showToolbar: false, // Ensure internal UI isn't created
      });

      setEditorController(controller);
      onEditorReady?.(controller);
    }

    // Cleanup function to destroy the editor when component unmounts
    return () => {
      if (editorController) {
        editorController.destroy();
        setEditorController(null);
      }
    };
  }, [options, onEditorReady]);

  return <div ref={canvasContainerRef} style={{ width: '100%', height: '100%' }} />;
};

export default FlowEditor;