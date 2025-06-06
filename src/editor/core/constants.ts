// Canvas & Rendering
export const DEFAULT_GRID_SIZE = 20;
export const DEFAULT_SCALE = 1;
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 5.0;
export const ZOOM_SENSITIVITY = 0.001;
export const PAN_THRESHOLD = 3; // Pixels moved before panning starts

// Nodes
export const DEFAULT_NODE_WIDTH = 200;
export const DEFAULT_NODE_HEIGHT = 100;
export const MIN_NODE_WIDTH = 80;
export const MIN_NODE_HEIGHT = 40;
export const NODE_HEADER_HEIGHT = 40;
export const NODE_PORT_VERTICAL_SPACING = 24;
export const NODE_PORT_SIZE = 10; // Diameter of the port circle
export const NODE_PORT_HIT_RADIUS = 14; // For click/hover detection
export const NODE_ID_PREFIX = "node_";
export const NODE_DEFAULT_ICON = 'ph-cube';

// Connections
export const CONNECTION_HIT_THRESHOLD = 5; // Pixels for click detection on connection line
export const RECONNECT_HANDLE_RADIUS = 10; // Visual and hit radius for connection reconnect handles
export const CONNECTION_DEFAULT_LABEL = "";

// Sticky Notes
export const DEFAULT_STICKY_NOTE_WIDTH = 200;
export const DEFAULT_STICKY_NOTE_HEIGHT = 150;
export const MIN_STICKY_NOTE_WIDTH = 50;
export const MIN_STICKY_NOTE_HEIGHT = 50;
export const STICKY_NOTE_DEFAULT_CONTENT = "New Note";
export const STICKY_NOTE_DEFAULT_BG_COLOR = "#2a2a2a";
export const STICKY_NOTE_DEFAULT_TEXT_COLOR = "#ffffff";
export const STICKY_NOTE_DEFAULT_FONT_SIZE = 14;

// Interaction
export const RESIZE_HANDLE_SIZE = 8; // Visual size of resize handles
export const RESIZE_BORDER_THRESHOLD = 5; // <-- ADICIONE ESTA LINHA (Sensibilidade da borda em pixels)
export const DOUBLE_CLICK_INTERVAL = 300; // ms for detecting double click

// UI Elements
export const TOOLTIP_DELAY = 500; // ms before tooltip appears
export const CONTEXT_MENU_Z_INDEX = 1100;
export const QUICK_ADD_MENU_Z_INDEX = 1100;
export const TOOLTIP_Z_INDEX = 1200;
export const CONFIG_PANEL_Z_INDEX = 1050;

// Local Storage
export const LOCAL_STORAGE_GRAPH_KEY = 'flowchart_saved_data';
export const LOCAL_STORAGE_FAVORITES_KEY = 'nodePaletteFavorites';

// Event Names
export const EVENT_VIEW_CHANGED = 'viewchanged';
export const EVENT_SELECTION_CHANGED = 'selectionChanged';
export const EVENT_NODES_UPDATED = 'nodesUpdated';
export const EVENT_CONNECTIONS_UPDATED = 'connectionsUpdated';
export const EVENT_NOTES_UPDATED = 'notesUpdated';
export const EVENT_HISTORY_CHANGED = 'historyChanged';
export const EVENT_CLIPBOARD_CHANGED = 'clipboardChanged';
export const EVENT_CONFIG_APPLIED = 'configApplied';
export const EVENT_NODE_DATA_CHANGED_WITH_VARIABLES = 'nodeDataChangedWithVariables';
export const EVENT_NODE_TEST_REQUESTED = 'testNodeRequested';

// CanvasEngine Specific Event Names
export const EVENT_CANVAS_POINTER_DOWN = 'pointerdown';
export const EVENT_CANVAS_POINTER_MOVE = 'pointermove';
export const EVENT_CANVAS_POINTER_UP = 'pointerup';
export const EVENT_CANVAS_POINTER_LEAVE = 'pointerleave';
export const EVENT_CANVAS_DOUBLE_CLICK = 'doubleclick';
export const EVENT_CANVAS_CONTEXT_MENU = 'contextmenu';
export const EVENT_CANVAS_WHEEL = 'wheel';
export const EVENT_CANVAS_BEFORE_RENDER = 'beforerender';
export const EVENT_CANVAS_AFTER_RENDER = 'afterrender';


// Default History Manager size
export const DEFAULT_HISTORY_MAX_SIZE = 50;

// Fallback Node Definitions (if platform service fails)
// This should ideally be minimal or empty, relying on PlatformDataService
import { NodeDefinition } from './types'; // Assuming types.ts is in the same directory
export const ALL_NODE_DEFINITIONS: NodeDefinition[] = [
    // Minimal fallback, or empty array if you strictly want to rely on service
  {
    id: 'fallback-trigger', title: 'Fallback Trigger', description: 'A basic trigger if definitions fail to load.',
    category: 'Triggers', icon: 'ph-play', defaultOutputs: [{ name: 'Out', type: 'output'}]
  },
  {
    id: 'fallback-action', title: 'Fallback Action', description: 'A basic action if definitions fail to load.',
    category: 'Actions', icon: 'ph-lightning', defaultInputs: [{name: 'In', type: 'input'}], defaultOutputs: [{ name: 'Out', type: 'output'}]
  }
];