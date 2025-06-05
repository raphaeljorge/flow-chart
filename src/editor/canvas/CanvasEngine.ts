// src/editor/canvas/CanvasEngine.ts
import { EventEmitter } from 'eventemitter3';
import { Point, CanvasPointerEvent, CanvasWheelEvent, Rect } from '../core/types';
import { ViewStore } from '../state/ViewStore';
import {
    EVENT_VIEW_CHANGED, MIN_SCALE, MAX_SCALE, ZOOM_SENSITIVITY,
    EVENT_CANVAS_POINTER_DOWN, EVENT_CANVAS_POINTER_MOVE, EVENT_CANVAS_POINTER_UP,
    EVENT_CANVAS_POINTER_LEAVE, EVENT_CANVAS_DOUBLE_CLICK, EVENT_CANVAS_CONTEXT_MENU,
    EVENT_CANVAS_WHEEL, EVENT_CANVAS_BEFORE_RENDER, EVENT_CANVAS_AFTER_RENDER
} from '../core/constants'; // Assuming these constants are defined

// Re-declare event constant names if not imported from a central constants file
const EVT_POINTER_DOWN = EVENT_CANVAS_POINTER_DOWN || 'pointerdown';
const EVT_POINTER_MOVE = EVENT_CANVAS_POINTER_MOVE || 'pointermove';
const EVT_POINTER_UP = EVENT_CANVAS_POINTER_UP || 'pointerup';
const EVT_POINTER_LEAVE = EVENT_CANVAS_POINTER_LEAVE || 'pointerleave';
const EVT_DOUBLE_CLICK = EVENT_CANVAS_DOUBLE_CLICK || 'doubleclick';
const EVT_CONTEXT_MENU = EVENT_CANVAS_CONTEXT_MENU || 'contextmenu';
const EVT_WHEEL = EVENT_CANVAS_WHEEL || 'wheel';
const EVT_BEFORE_RENDER = EVENT_CANVAS_BEFORE_RENDER || 'beforerender';
const EVT_AFTER_RENDER = EVENT_CANVAS_AFTER_RENDER || 'afterrender';


export class CanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private events: EventEmitter;
  private viewStore: ViewStore;

  private isDestroyed: boolean = false;
  private resizeObserver: ResizeObserver;
  private animationFrameId: number | null = null;

  constructor(container: HTMLElement, viewStore: ViewStore) {
    this.container = container;
    this.viewStore = viewStore;
    this.canvas = document.createElement('canvas');
    this.container.appendChild(this.canvas);
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D rendering context for CanvasEngine');
    }
    this.ctx = context;
    this.events = new EventEmitter();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);

    this.setupEventListeners();
    this.resize(); // Initial resize

    // Subscribe to ViewStore changes to re-render when view state is updated externally
    this.viewStore.on(EVENT_VIEW_CHANGED, this.requestRender);
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.addEventListener('dblclick', this.handleDoubleClick);
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
  }

  private removeEventListeners(): void {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    this.canvas.removeEventListener('wheel', this.handleWheel);
  }

  // Bound event handlers
  private handleMouseDown = (e: MouseEvent): void => {
    const clientPoint = { x: e.clientX, y: e.clientY };
    this.events.emit(EVT_POINTER_DOWN, {
      canvasPoint: this.getClientToCanvasCoordinates(clientPoint),
      clientPoint,
      originalEvent: e,
    } as CanvasPointerEvent);
  };

  private handleMouseMove = (e: MouseEvent): void => {
    const clientPoint = { x: e.clientX, y: e.clientY };
    this.events.emit(EVT_POINTER_MOVE, {
      canvasPoint: this.getClientToCanvasCoordinates(clientPoint),
      clientPoint,
      originalEvent: e,
    } as CanvasPointerEvent);
  };

  private handleMouseUp = (e: MouseEvent): void => {
    const clientPoint = { x: e.clientX, y: e.clientY };
    this.events.emit(EVT_POINTER_UP, {
      canvasPoint: this.getClientToCanvasCoordinates(clientPoint),
      clientPoint,
      originalEvent: e,
    } as CanvasPointerEvent);
  };

  private handleMouseLeave = (e: MouseEvent): void => {
    const clientPoint = { x: e.clientX, y: e.clientY };
    this.events.emit(EVT_POINTER_LEAVE, {
      canvasPoint: this.getClientToCanvasCoordinates(clientPoint),
      clientPoint,
      originalEvent: e,
    } as CanvasPointerEvent);
  };

  private handleDoubleClick = (e: MouseEvent): void => {
    const clientPoint = { x: e.clientX, y: e.clientY };
    this.events.emit(EVT_DOUBLE_CLICK, {
      canvasPoint: this.getClientToCanvasCoordinates(clientPoint),
      clientPoint,
      originalEvent: e,
    } as CanvasPointerEvent);
  };

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    const clientPoint = { x: e.clientX, y: e.clientY };
    this.events.emit(EVT_CONTEXT_MENU, {
      canvasPoint: this.getClientToCanvasCoordinates(clientPoint),
      clientPoint,
      originalEvent: e,
    } as CanvasPointerEvent);
  };

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    // Emit raw wheel event; InteractionManager will handle zooming logic and update ViewStore
    this.events.emit(EVT_WHEEL, {
      deltaY: e.deltaY,
      clientPoint: { x: e.clientX, y: e.clientY },
      originalEvent: e,
    } as CanvasWheelEvent);
  };

  public resize(): void {
    if (!this.container || this.isDestroyed) return;
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.requestRender();
  }

  public getClientToCanvasCoordinates(clientPoint: Point): Point {
    const rect = this.canvas.getBoundingClientRect();
    const viewState = this.viewStore.getState();
    return {
      x: (clientPoint.x - rect.left - viewState.offset.x) / viewState.scale,
      y: (clientPoint.y - rect.top - viewState.offset.y) / viewState.scale,
    };
  }

  public getCanvasToClientCoordinates(canvasPoint: Point): Point {
    const rect = this.canvas.getBoundingClientRect();
    const viewState = this.viewStore.getState();
    return {
      x: canvasPoint.x * viewState.scale + viewState.offset.x + rect.left,
      y: canvasPoint.y * viewState.scale + viewState.offset.y + rect.top,
    };
  }

  // Pan and Zoom methods now update the ViewStore
  public pan(dx: number, dy: number): void {
    const currentViewState = this.viewStore.getState();
    this.viewStore.setOffset({
      x: currentViewState.offset.x + dx,
      y: currentViewState.offset.y + dy,
    });
    // ViewStore will emit 'viewchanged', which CanvasEngine listens to for re-rendering
  }

  public zoom(delta: number, focalPointClient?: Point): void {
    const currentViewState = this.viewStore.getState();
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentViewState.scale * (1 - delta * ZOOM_SENSITIVITY)));
    if (newScale === currentViewState.scale) return;

    const focalCanvas = focalPointClient
      ? this.getClientToCanvasCoordinates(focalPointClient) // Uses current viewState for conversion
      : this.getCenterCanvasPoint(); // Uses current viewState for conversion

    // Calculate new offset based on the focal point
    // The formula ensures the focal point on the canvas remains at the same client position after zoom
    const newOffsetX = focalCanvas.x - (focalCanvas.x - currentViewState.offset.x) * (newScale / currentViewState.scale);
    const newOffsetY = focalCanvas.y - (focalCanvas.y - currentViewState.offset.y) * (newScale / currentViewState.scale);

    this.viewStore.setScaleAndOffset(newScale, { x: newOffsetX, y: newOffsetY });
  }
  
  public getCenterCanvasPoint(): Point {
    // This needs to use the current view state for accurate calculation
    return this.getClientToCanvasCoordinates({x: this.canvas.width / 2, y: this.canvas.height / 2});
  }

  public zoomToFit(rectToFit: Rect, padding: number = 50): void {
    if (rectToFit.width === 0 || rectToFit.height === 0 || this.canvas.width === 0 || this.canvas.height === 0) return;

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    const scaleX = (canvasWidth - padding * 2) / rectToFit.width;
    const scaleY = (canvasHeight - padding * 2) / rectToFit.height;
    const newScale = Math.min(scaleX, scaleY, MAX_SCALE, Math.max(MIN_SCALE, scaleX, scaleY)); // Clamp scale

    const newOffsetX = (canvasWidth - rectToFit.width * newScale) / 2 - rectToFit.x * newScale;
    const newOffsetY = (canvasHeight - rectToFit.height * newScale) / 2 - rectToFit.y * newScale;

    this.viewStore.setScaleAndOffset(newScale, { x: newOffsetX, y: newOffsetY });
  }


  private drawGrid(): void {
    const viewState = this.viewStore.getState();
    if (!viewState.showGrid) return;

    const { scale, offset, gridSize } = viewState;
    const scaledGridSize = gridSize * scale;

    // Evita desenhar o grid se ele for muito pequeno, melhorando a performance
    if (scaledGridSize < 4) return;

    this.ctx.beginPath();
    const minorGridColor = getComputedStyle(this.canvas).getPropertyValue('--canvas-grid-minor-color').trim() || 'rgba(255, 255, 255, 0.08)';
    const majorGridColor = getComputedStyle(this.canvas).getPropertyValue('--canvas-grid-major-color').trim() || 'rgba(255, 255, 255, 0.12)';

    const majorGridMultiple = 5;
    const majorScaledGridSize = scaledGridSize * majorGridMultiple;

    // Calcula as posições iniciais com base no offset do canvas
    const startX = offset.x % scaledGridSize;
    const startY = offset.y % scaledGridSize;
    const majorStartX = offset.x % majorScaledGridSize;
    const majorStartY = offset.y % majorScaledGridSize;

    // Desenha as linhas menores
    this.ctx.strokeStyle = minorGridColor;
    this.ctx.lineWidth = 1; // Linhas sempre com 1px de espessura

    for (let x = startX; x < this.canvas.width; x += scaledGridSize) {
      this.ctx.moveTo(Math.floor(x) + 0.5, 0);
      this.ctx.lineTo(Math.floor(x) + 0.5, this.canvas.height);
    }
    for (let y = startY; y < this.canvas.height; y += scaledGridSize) {
      this.ctx.moveTo(0, Math.floor(y) + 0.5);
      this.ctx.lineTo(this.canvas.width, Math.floor(y) + 0.5);
    }
    this.ctx.stroke();

    // Desenha as linhas maiores por cima
    this.ctx.beginPath();
    this.ctx.strokeStyle = majorGridColor;
    this.ctx.lineWidth = 1;

    for (let x = majorStartX; x < this.canvas.width; x += majorScaledGridSize) {
      this.ctx.moveTo(Math.floor(x) + 0.5, 0);
      this.ctx.lineTo(Math.floor(x) + 0.5, this.canvas.height);
    }
    for (let y = majorStartY; y < this.canvas.height; y += majorScaledGridSize) {
      this.ctx.moveTo(0, Math.floor(y) + 0.5);
      this.ctx.lineTo(this.canvas.width, Math.floor(y) + 0.5);
    }
    this.ctx.stroke();
  }


  public requestRender = (): void => {
    if (this.isDestroyed) return;
    if (this.animationFrameId === null) {
      this.animationFrameId = requestAnimationFrame(this.performRender);
    }
  };

  private performRender = (): void => {
    this.animationFrameId = null;
    if (this.isDestroyed) return;

    const viewState = this.viewStore.getState();

    // 1. Limpa o canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 2. Desenha o grid diretamente na tela (em "screen space")
    this.drawGrid();

    // 3. Salva o contexto e aplica a transformação de zoom/pan para os nós e conexões
    this.ctx.save();
    this.ctx.translate(viewState.offset.x, viewState.offset.y);
    this.ctx.scale(viewState.scale, viewState.scale);

    // 4. Emite o evento para que o RenderService desenhe os elementos
    this.events.emit(EVT_BEFORE_RENDER, this.ctx, viewState);

    // 5. Restaura o contexto para o estado original
    this.ctx.restore();

    // 6. Emite o evento para desenhar elementos de sobreposição (se houver)
    this.events.emit(EVT_AFTER_RENDER, this.ctx, viewState);
  };

  public getCanvasElement(): HTMLCanvasElement {
    return this.canvas;
  }

  public getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    this.events.on(event, listener);
    return this;
  }

  public off(event: string, listener: (...args: any[]) => void): this {
    this.events.off(event, listener);
    return this;
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.removeEventListeners();
    this.resizeObserver.disconnect();
    this.canvas.remove();
    this.events.removeAllListeners();
    this.viewStore.off(EVENT_VIEW_CHANGED, this.requestRender);
  }
}