// src/editor/components/Minimap/Minimap.ts
import { CanvasEngine } from '../../canvas/CanvasEngine';
import { NodeManager } from '../../state/NodeManager';
import { StickyNoteManager } from '../../state/StickyNoteManager';
import { ViewStore } from '../../state/ViewStore';
import { Point } from '../../core/types';
import { EVENT_NODES_UPDATED, EVENT_NOTES_UPDATED, EVENT_VIEW_CHANGED } from '../../core/constants';
import { EditorIconService } from '../../services/EditorIconService';
import './Minimap.css';

export class Minimap {
  private wrapper: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isDragging: boolean = false;
  private isCollapsed: boolean = false;
  private lastClientPoint: Point | null = null; // Para arrastar (pan)

  constructor(
    private parentContainer: HTMLElement,
    private mainCanvasEngine: CanvasEngine,
    private nodeManager: NodeManager,
    private stickyNoteManager: StickyNoteManager,
    private viewStore: ViewStore,
    private iconService: EditorIconService
  ) {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'minimap-wrapper';
    this.parentContainer.appendChild(this.wrapper);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap-canvas';
    this.wrapper.appendChild(this.canvas);

    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Failed to get 2D context for minimap');
    this.ctx = context;

    this.setupToggleButton();
    this.subscribeToEvents();
    this.setupInteractionListeners();

    // Renderização inicial
    this.handleUpdate();
  }

  private setupToggleButton() {
    const toggleButton = document.createElement('button');
    toggleButton.className = 'minimap-toggle-button';
    toggleButton.title = 'Toggle Minimap';
    this.wrapper.appendChild(toggleButton);

    const updateIcon = () => {
        toggleButton.innerHTML = this.iconService.getIconHTMLString(
            this.isCollapsed ? 'ph-caret-up-left' : 'ph-caret-down-right'
        );
    };

    toggleButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.isCollapsed = !this.isCollapsed;
        this.wrapper.classList.toggle('collapsed', this.isCollapsed);
        updateIcon();
        if(!this.isCollapsed) {
            this.handleUpdate();
        }
    });

    updateIcon();
  }

  private subscribeToEvents(): void {
    // A renderização agora depende de qualquer atualização nos nós, notas ou na própria visualização
    this.nodeManager.on(EVENT_NODES_UPDATED, this.handleUpdate);
    this.stickyNoteManager.on(EVENT_NOTES_UPDATED, this.handleUpdate);
    this.viewStore.on(EVENT_VIEW_CHANGED, this.handleUpdate);
  }

  private setupInteractionListeners(): void {
    this.wrapper.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
  }

  private handleUpdate = (): void => {
    if (this.isCollapsed || !this.wrapper.isConnected) {
        return;
    }
    this.draw();
  };

  private draw(): void {
    const rect = this.wrapper.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    const allNodes = this.nodeManager.getNodes();
    const allNotes = this.stickyNoteManager.getNotes();

    const mainViewState = this.viewStore.getState();
    const mainCanvasRect = this.mainCanvasEngine.getCanvasElement().getBoundingClientRect();

    // Se a tela principal for 0, não há nada para renderizar.
    if (mainCanvasRect.width === 0 || mainCanvasRect.height === 0) return;

    // 1. Calcula a escala para encaixar a visualização do canvas principal no minimapa
    const fitScale = this.canvas.width / mainCanvasRect.width;

    // 2. Limpa e prepara o canvas do minimapa
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    
    // 3. Aplica a transformação para replicar a câmera do canvas principal
    // Primeiro, escalonamos tudo para caber no minimapa.
    this.ctx.scale(fitScale, fitScale);
    // Em seguida, aplicamos a mesma transformação de pan e zoom do canvas principal.
    this.ctx.translate(mainViewState.offset.x, mainViewState.offset.y);
    this.ctx.scale(mainViewState.scale, mainViewState.scale);

    // 4. Desenha os elementos (de forma simplificada)
    // Desenha os nós
    this.ctx.fillStyle = 'rgba(128, 128, 128, 0.7)';
    allNodes.forEach(node => {
      this.ctx.fillRect(node.position.x, node.position.y, node.width, node.height);
    });

    // Desenha as anotações
    this.ctx.fillStyle = 'rgba(255, 235, 59, 0.7)'; // Amarelo para anotações
    allNotes.forEach(note => {
        this.ctx.fillRect(note.position.x, note.position.y, note.width, note.height);
    });

    // 5. Restaura o contexto. O retângulo do viewport não é mais necessário.
    this.ctx.restore();
  }
  
  private handleMouseDown = (e: MouseEvent): void => {
      // Impede o comportamento padrão do navegador, como arrastar imagens
      e.preventDefault();
      this.isDragging = true;
      this.lastClientPoint = { x: e.clientX, y: e.clientY };
  }
  
  private handleMouseMove = (e: MouseEvent): void => {
      if (this.isDragging && this.lastClientPoint) {
          // Calcula o delta do movimento do mouse
          const dx = e.clientX - this.lastClientPoint.x;
          const dy = e.clientY - this.lastClientPoint.y;

          // Aplica o pan no canvas principal
          this.mainCanvasEngine.pan(dx, dy);

          // Atualiza a última posição do mouse
          this.lastClientPoint = { x: e.clientX, y: e.clientY };
      }
  }

  private handleMouseUp = (): void => {
      this.isDragging = false;
      this.lastClientPoint = null;
  }

  public destroy(): void {
    this.nodeManager.off(EVENT_NODES_UPDATED, this.handleUpdate);
    this.stickyNoteManager.off(EVENT_NOTES_UPDATED, this.handleUpdate);
    this.viewStore.off(EVENT_VIEW_CHANGED, this.handleUpdate);
    
    this.wrapper.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);

    this.wrapper.remove();
  }
}