import './style.css';
import { NodeEditor } from './lib';
import '@phosphor-icons/web/regular';

const app = document.querySelector<HTMLDivElement>('#app')!;

const editor = new NodeEditor(app, {
  showPalette: true,
  showToolbar: true,
  defaultScale: 1,
  gridSize: 20,
  showGrid: true,
  snapToGrid: false
});