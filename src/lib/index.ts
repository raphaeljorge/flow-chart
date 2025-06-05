// src/lib/index.ts

// Main entry point for consuming the editor as a library.

// Core Controller
export { NodeEditorController } from '../editor/app/NodeEditorController';

// Core Types (re-export for convenience)
export * from '../editor/core/types';

// Constants that might be useful for consumers
export * from '../editor/core/constants';

// Specific UI components or services could be exported if they are meant to be
// customized or interacted with directly by a consumer of this library.
// For example:
// export { NodePalette } from '../editor/components/NodePalette/NodePalette';
// export { EditorIconService } from '../editor/services/EditorIconService';

// However, it's often better to expose functionality through the NodeEditorController's API
// rather than exporting many internal components directly.