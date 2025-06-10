## Refactoring Plan: Node-Based Flow Builder Frontend

**Phase 0: Preparation & Setup**

1.  **Version Control:**
    * Ensure your current entire project is committed to a Git repository. Create a new branch specifically for this refactoring effort (e.g., `refactor/frontend-architecture`).
2.  **Review Documentation:**
    * Thoroughly review the "Product Documentation: Node-Based Flow Builder Frontend (Visual Editor for the Future Platform)" and the target "Final File Tree (Enhanced Frontend - Target State for Future)" to have a clear vision of the end state for this refactoring pass.
3.  **Setup New Directory Structure (Minimalist for Current Refactoring):**
    * Create the new top-level directories as per the last agreed-upon file tree: `src/editor/`, `src/platform/`, and their essential subdirectories needed for the current code.
    * Initially, `src/platform/` will be minimal, mainly housing the node definitions and project serialization logic.

**Phase 1: Core Editor Module Migration & Refactoring**

*(Migrate files from your current `src/core/` and parts of `src/editor/` into the new `src/editor/` subdirectories)*

1.  **Core Types & Constants (`src/editor/core/`):**
    * Move `src/core/types.ts` to `src/editor/core/types.ts`. Review and update types to align with the new module responsibilities and future needs (e.g., versioned nodes, connector info).
    * Create `src/editor/core/constants.ts` for editor-specific constants (event names, default values, UI keys). Extract any existing hardcoded constants to this file.
2.  **Canvas & Rendering (`src/editor/canvas/`):**
    * Move `src/core/CanvasEngine.ts` to `src/editor/canvas/CanvasEngine.ts`. Adapt its initialization if needed.
    * Move `src/core/RenderService.ts` to `src/editor/canvas/RenderService.ts`. Ensure it correctly fetches data from the refactored state managers (which will be addressed next).
3.  **State Management (`src/editor/state/`):**
    * **`NodeManager.ts`**: Move `src/core/NodeManager.ts` to `src/editor/state/NodeManager.ts`. Refactor it to focus *solely* on managing the state of *visual nodes* within the editor (position, size, UI-specific data, visual ports). Logic related to connection management will be moved. It should handle dynamic port creation based on node data as per existing functionality.
    * **`ConnectionManager.ts`**: Create `src/editor/state/ConnectionManager.ts`. Extract all connection-related logic (creation, deletion, updates, storage of connections) from the current `NodeManager.ts` into this new dedicated manager.
    * **`StickyNoteManager.ts`**: Move `src/core/StickyNoteManager.ts` to `src/editor/state/StickyNoteManager.ts`.
    * **`SelectionManager.ts`**: Move `src/core/SelectionManager.ts` to `src/editor/state/SelectionManager.ts`.
    * **`ClipboardManager.ts`**: Move `src/core/ClipboardManager.ts` to `src/editor/state/ClipboardManager.ts`.
    * **`HistoryManager.ts`**: Move `src/core/HistoryManager.ts` to `src/editor/state/HistoryManager.ts`. Ensure it can capture and restore state from all relevant state managers.
    * **`ViewStore.ts`**: Create `src/editor/state/ViewStore.ts`. This will manage canvas view state (scale, offset from `CanvasEngine`) and UI panel visibility/states (which might currently be implicit in components or the main editor class).
4.  **Interaction Logic (`src/editor/interaction/`):**
    * Move `src/core/InteractionManager.ts` to `src/editor/interaction/InteractionManager.ts`. Update its dependencies to use the refactored state managers.
    * Move `src/core/ShortcutManager.ts` to `src/editor/interaction/ShortcutManager.ts`.
    * Create or integrate logic for `DndController.ts` (Drag and Drop from palette) into `src/editor/interaction/DndController.ts`. This might involve extracting logic from `NodePalette.ts` or `InteractionManager.ts`.

**Phase 2: UI Component Refactoring (`src/editor/components/`)**

*(For each component from your current `src/ui/`)*

1.  **Move and Adapt:**
    * For `NodePalette.ts`, `ConfigPanel.ts`, `Toolbar.ts`, `ContextMenu.ts`, `QuickAddMenu.ts`, `Tooltip.ts`:
        * Create a corresponding subdirectory in `src/editor/components/` (e.g., `src/editor/components/NodePalette/`).
        * Move the TypeScript file (e.g., `NodePalette.ts`) into its new directory.
        * Refactor the component to:
            * Remove direct DOM manipulation of elements outside its scope.
            * Interact with the new state managers (`NodeManager`, `ViewStore`, etc.) and services (`EditorIconService`, `PlatformDataService` for node definitions) via well-defined interfaces or events, likely intermediated by `NodeEditorController`.
            * Receive data as props or from stores, and emit events for actions.
2.  **Styling (Co-location - Optional but Recommended):**
    * If a component has significant specific styling, consider creating a `ComponentName.css` file within its directory (e.g., `NodePalette.css`) and importing it into the component's TypeScript file. This improves modularity. Alternatively, ensure styles in `main.css` correctly target the refactored components.

**Phase 3: Editor Services & Platform Interface Setup**

1.  **Editor Icon Service (`src/editor/services/`):**
    * Move and refactor `src/editor/IconService.ts` to `src/editor/services/EditorIconService.ts`. Ensure it's a clean utility service.
2.  **Platform Node Catalog Interface (`src/platform/node_catalog/`):**
    * Create `src/platform/node_catalog/_definitions/`.
    * Move the content of your current `src/editor/NodeDefinitions.ts` to `src/platform/node_catalog/_definitions/PlatformNodeDefinitions.ts`. This file now represents the definitions as provided *by the platform*.
    * Create `src/platform/node_catalog/node.types.ts` to define the structure of `PlatformNodeDefinition` (if it needs to differ slightly or be augmented from the editor's internal `NodeDefinition` type).
    * Create `src/platform/node_catalog/NodeDefinitionService.ts`. This frontend service will be responsible for "fetching" (initially, just importing/reading) `PlatformNodeDefinitions.ts` and providing them to editor components like `NodePalette` and `QuickAddMenu`.
3.  **Platform Project Management Interface (`src/platform/project_management/`):**
    * Create `src/platform/project_management/ProjectSerializer.ts`.
    * Migrate the `saveGraph` and `loadGraph` logic (currently in `src/main.ts` using `localStorage`) into this service. It will be responsible for serializing the editor's state (from `NodeManager`, `ConnectionManager`, `StickyNoteManager`, `ViewStore`) into a JSON structure and deserializing it.
4.  **Frontend Platform Data Service (`src/editor/services/`):**
    * Create `src/editor/services/PlatformDataService.ts`. This service will act as an abstraction layer for all future API calls to the backend. Initially, it will interact with the local `NodeDefinitionService` and `ProjectSerializer`. As the backend develops, this service will make actual HTTP requests.

**Phase 4: Application Orchestration & Entry Point**

1.  **`NodeEditorController` (`src/editor/app/`):**
    * Create `src/editor/app/NodeEditorController.ts`.
    * This class will be the primary orchestrator. Consolidate logic from your current main editor class (likely `src/editor/NodeEditor.ts` or `src/lib/NodeEditor.ts`).
    * It will instantiate and wire together the `CanvasEngine`, all state managers, interaction managers, UI components (or provide them with necessary dependencies/callbacks), and platform interface services.
2.  **Main Entry Point (`src/main.ts`):**
    * Refactor `src/main.ts`. Its main responsibility will be to:
        * Identify the root HTML element for the editor.
        * Instantiate the `NodeEditorController`.
        * Handle the initial "load graph" action (potentially from `localStorage` via `ProjectSerializer` called by `NodeEditorController`).
        * Connect the existing "Save/Load/Clear Graph" buttons in `index.html` to methods on `NodeEditorController`.

**Phase 5: Styling Refactoring (`src/editor/styles/`)**

1.  **Global Styles:**
    * Move `src/style.css` to `src/editor/styles/main.css`.
    * Review `main.css` to ensure styles are well-organized and target the refactored component structures.
2.  **Theme Variables:**
    * Create `src/editor/styles/theme-variables.css`.
    * Identify common colors, fonts, spacing, etc., in `main.css` and extract them into CSS custom properties in `theme-variables.css`.
    * Update `main.css` (and any component-specific CSS) to use these variables.

**Phase 6: Library Export (`src/lib/`)**

1.  **Review and Update:**
    * Adapt `src/lib/index.ts` to export the refactored `NodeEditorController` (or a simplified public API facade for it) and any necessary types if the editor is intended to be consumed as a library.

**Phase 7: Testing and Iteration**

1.  **Incremental Testing:** Test modules and components individually as they are refactored.
2.  **Integration Testing:** Test interactions between refactored modules (e.g., UI component -> Controller -> State Manager -> Render Service).
3.  **End-to-End Testing:** Verify all existing functionalities of the editor are working correctly in the new structure.
4.  **Review and Refine:** After the initial pass, review the new structure for any remaining tight coupling or areas for further improvement.

```
node-based-software-builder/
├── public/
│   └── icons/                  # Static icon assets (if any, e.g., SVGs)
│
├── src/
│   ├── main.ts                 # Main application entry point for the EDITOR
│   ├── vite-env.d.ts           # Vite specific type definitions
│   │
│   ├── editor/                 # CORE OF THE VISUAL FLOW BUILDER (Frontend Library)
│   │   ├── app/
│   │   │   └── NodeEditorController.ts # Orchestrates the editor
│   │   ├── core/
│   │   │   ├── types.ts        # Editor-specific types and interfaces
│   │   │   └── constants.ts    # Editor-specific constants
│   │   ├── canvas/
│   │   │   ├── CanvasEngine.ts # Manages <canvas> element, pan, zoom, grid
│   │   │   └── RenderService.ts  # Draws all visual elements
│   │   ├── state/
│   │   │   ├── NodeManager.ts    # Manages visual nodes and their ports
│   │   │   ├── ConnectionManager.ts # Manages visual connections
│   │   │   ├── StickyNoteManager.ts # Manages sticky notes
│   │   │   ├── SelectionManager.ts # Manages selected items
│   │   │   ├── ClipboardManager.ts # Copy/paste logic
│   │   │   ├── HistoryManager.ts   # Undo/redo logic
│   │   │   └── ViewStore.ts      # Manages canvas view state & UI panel states
│   │   ├── interaction/
│   │   │   ├── InteractionManager.ts # Handles direct canvas interactions
│   │   │   ├── ShortcutManager.ts  # Manages keyboard shortcuts
│   │   │   └── DndController.ts    # Manages drag-and-drop from palette
│   │   ├── components/             # UI Components (Pure TypeScript, DOM manipulation)
│   │   │   ├── NodePalette/
│   │   │   │   └── NodePalette.ts    # (Optional: NodePalette.css co-located)
│   │   │   ├── ConfigPanel/
│   │   │   │   └── ConfigPanel.ts  # (Optional: ConfigPanel.css co-located)
│   │   │   ├── Toolbar/
│   │   │   │   └── Toolbar.ts      # (Optional: Toolbar.css co-located)
│   │   │   ├── ContextMenu/
│   │   │   │   └── ContextMenu.ts  # (Optional: ContextMenu.css co-located)
│   │   │   ├── QuickAddMenu/
│   │   │   │   └── QuickAddMenu.ts # (Optional: QuickAddMenu.css co-located)
│   │   │   └── Tooltip/
│   │   │       └── Tooltip.ts      # (Optional: Tooltip.css co-located)
│   │   ├── services/
│   │   │   ├── EditorIconService.ts # Icon management for the editor UI
│   │   │   └── PlatformDataService.ts # NEW: Handles all backend API communication (initially stubs/local)
│   │   └── styles/
│   │       ├── main.css          # Global and component styles for the editor
│   │       └── theme-variables.css # CSS variables for theming
│   │
│   ├── platform/               # MINIMAL interface to the backend platform for NOW
│   │   ├── node_catalog/         # Provides node definitions to the editor
│   │   │   ├── _definitions/
│   │   │   │   └── PlatformNodeDefinitions.ts # Metadata for available node types (content from old editor/NodeDefinitions.ts)
│   │   │   ├── NodeDefinitionService.ts # FRONTEND service to fetch/provide node definitions (initially reads local file)
│   │   │   └── node.types.ts   # Types for platform node definitions (consumed by frontend)
│   │   └── project_management/   # Handles saving/loading of flows (editor state)
│   │       └── ProjectSerializer.ts # Logic for localStorage save/load (from old main.ts)
│   │
│   └── lib/                    # Entry point if editor is used as a standalone library
│       └── index.ts
│
├── index.html                  # Main HTML file
├── package.json
├── tsconfig.json
├── pnpm-lock.yaml              # (If using pnpm)
├── README.md
└── .bolt/config.json           # (If relevant)
```

**Key points about this file tree for your refactoring:**

* **Focus on `src/editor/`**: This is where most of your existing code will be reorganized and refactored.
* **Clear Separation**: Modules within `src/editor/` are separated by concern (canvas, state, interaction, UI components, services).
* **Minimal `src/platform/`**: For now, this only contains what the frontend editor *needs* to consume:
    * Node definitions (moved from your old `src/editor/NodeDefinitions.ts` to `src/platform/node_catalog/_definitions/PlatformNodeDefinitions.ts`).
    * A frontend service (`src/platform/node_catalog/NodeDefinitionService.ts`) that the editor uses to get these definitions.
    * A frontend service (`src/platform/project_management/ProjectSerializer.ts`) to encapsulate the current save/load logic (which uses `localStorage`).
* **`src/editor/services/PlatformDataService.ts`**: This new service is a crucial abstraction layer. Initially, it will talk to the local `NodeDefinitionService` and `ProjectSerializer`. In the future, it will be the single point for making HTTP requests to your actual backend API Gateway.
* **Styling**: Styles are centralized in `src/editor/styles/`, with `theme-variables.css` promoting easier theming. Component-specific CSS can be co-located if desired.

## TODO:

### **Advanced Canvas Features**

- ✅ **Canvas minimap/overview** for navigation in large flows

- ✅ **Canvas background patterns** (dots vs lines vs solid)

- ✅ **Canvas zoom percentage display**



### **Node Palette Enhancements**

- ✅ **Favorites/recently used nodes** (no star/favorite system)

- ✅ **Node preview tooltips** with detailed descriptions

- ✅ **Collapsible category sections** (categories are flat tabs)



### **Visual Flow Features**

- ✅ **Node grouping/containers** (no way to group nodes visually)

- ✅ **Node auto-layout** algorithms (automatic arrangement)

- ❌ **Connection routing improvements** (currently straight lines, no curved/smart routing)

- ✅ **Connection labels/annotations**

- ✅ **Connection styles** (dashed, dotted, colored by type)



### **UI/UX Enhancements**

- ❌ **Breadcrumb navigation** for nested flows

- ❌ **Tab system** for multiple open flows

- ❌ **Split-screen view** 

- ❌ **Customizable panels** (resizable, collapsible, moveable)

- ❌ **Theme/appearance settings**

- ❌ **Accessibility features** (keyboard navigation for screen readers)



### **Enhanced Toolbar Features**

- ❌ **Flow validation** indicator (check for errors/warnings)

- ❌ **Auto-arrange** nodes button

- ❌ **Export options** (PNG, SVG, PDF export of visual flow)

- ❌ **View modes** (compact vs detailed view)

- ❌ **Search in flow** (find specific nodes in large flows)



### **Flow Organization**

- ❌ **Subflows/nested flows** (collapse parts into reusable components)

- ❌ **Flow layers** (background, main, annotations)

- ❌ **Flow bookmarks** (navigate to specific parts)

- ❌ **Flow outline/structure view**



### **Visual Feedback**

- ❌ **Smooth animations** for node creation/deletion

- ❌ **Better loading states** for async operations

- ❌ **Enhanced hover effects** and micro-interactions

- ❌ **Visual feedback** improvements for drag operations