import { EventEmitter } from 'eventemitter3';
import { Point, ViewState, Size, CanvasPointerEvent, CanvasWheelEvent } from './Types';

export class CanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private events: EventEmitter;

  private viewState: ViewState = {
    scale: 1,
    offset: { x: 0, y: 0 },
    showGrid: true,
    snapToGrid: false, // A lógica de snap em si pode residir no InteractionManager
    gridSize: 20,
  };

  private isDestroyed: boolean = false;

  constructor(container: HTMLElement, initialViewState?: Partial<ViewState>) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.container.appendChild(this.canvas);
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D rendering context');
    }
    this.ctx = context;
    this.events = new EventEmitter();

    if (initialViewState) {
      this.viewState = { ...this.viewState, ...initialViewState };
    }

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    
    this.setupEventListeners();
    this.resize(); // Initial resize
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
    this.events.emit('pointerdown', {
      canvasPoint: this.getClientToCanvasCoordinates(clientPoint),
      clientPoint,
      originalEvent: e,
    } as CanvasPointerEvent);
  };

  private handleMouseMove = (e: MouseEvent): void => {
    const clientPoint = { x: e.clientX, y: e.clientY };
    this.events.emit('pointermove', {
      canvasPoint: this.getClientToCanvasCoordinates(clientPoint),
      clientPoint,
      originalEvent: e,
    } as CanvasPointerEvent);
  };

  private handleMouseUp = (e: MouseEvent): void => {
    const clientPoint = { x: e.clientX, y: e.clientY };
    this.events.emit('pointerup', {
      canvasPoint: this.getClientToCanvasCoordinates(clientPoint),
      clientPoint,
      originalEvent: e,
    } as CanvasPointerEvent);
  };
  
  private handleMouseLeave = (e: MouseEvent): void => {
    const clientPoint = { x: e.clientX, y: e.clientY };
    this.events.emit('pointerleave', {
      canvasPoint: this.getClientToCanvasCoordinates(clientPoint),
      clientPoint,
      originalEvent: e,
    } as CanvasPointerEvent);
  };

  private handleDoubleClick = (e: MouseEvent): void => {
    const clientPoint = { x: e.clientX, y: e.clientY };
    this.events.emit('doubleclick', {
      canvasPoint: this.getClientToCanvasCoordinates(clientPoint),
      clientPoint,
      originalEvent: e,
    } as CanvasPointerEvent);
  };

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    const clientPoint = { x: e.clientX, y: e.clientY };
    this.events.emit('contextmenu', {
      canvasPoint: this.getClientToCanvasCoordinates(clientPoint),
      clientPoint,
      originalEvent: e,
    } as CanvasPointerEvent);
  };

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.events.emit('wheel', {
      deltaY: e.deltaY,
      clientPoint: { x: e.clientX, y: e.clientY },
      originalEvent: e,
    } as CanvasWheelEvent);
  };


  private resizeObserver: ResizeObserver;

  public resize(): void {
    if (!this.container || this.isDestroyed) return;
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.requestRender();
  }

  public getClientToCanvasCoordinates(clientPoint: Point): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientPoint.x - rect.left - this.viewState.offset.x) / this.viewState.scale,
      y: (clientPoint.y - rect.top - this.viewState.offset.y) / this.viewState.scale,
    };
  }

  public getCanvasToClientCoordinates(canvasPoint: Point): Point {
    const rect = this.canvas.getBoundingClientRect();
     return {
      x: canvasPoint.x * this.viewState.scale + this.viewState.offset.x + rect.left,
      y: canvasPoint.y * this.viewState.scale + this.viewState.offset.y + rect.top,
    };
  }
  
  public pan(dx: number, dy: number): void {
    this.viewState.offset.x += dx;
    this.viewState.offset.y += dy;
    this.events.emit('viewchanged', this.viewState);
    this.requestRender();
  }

  public zoom(delta: number, focalPointClient?: Point): void {
    const newScale = Math.max(0.1, Math.min(5, this.viewState.scale * (1 - delta * 0.001))); // Ajuste a sensibilidade do zoom
    if (newScale === this.viewState.scale) return;

    const focal = focalPointClient ? this.getClientToCanvasCoordinates(focalPointClient) : this.getCenterCanvasPoint();
    
    this.viewState.offset.x = focal.x - (focal.x - this.viewState.offset.x) * (newScale / this.viewState.scale);
    this.viewState.offset.y = focal.y - (focal.y - this.viewState.offset.y) * (newScale / this.viewState.scale);
    this.viewState.scale = newScale;
    
    this.events.emit('viewchanged', this.viewState);
    this.requestRender();
  }

  public setViewState(newViewState: Partial<ViewState>): void {
    this.viewState = { ...this.viewState, ...newViewState };
    this.events.emit('viewchanged', this.viewState);
    this.requestRender();
  }
  
  public getCenterCanvasPoint(): Point {
    return this.getClientToCanvasCoordinates({x: this.canvas.width / 2, y: this.canvas.height / 2});
  }

  public resetView(scale: number = 1, offset: Point = { x: 0, y: 0 }): void {
    this.viewState.scale = scale;
    this.viewState.offset = offset;
    this.events.emit('viewchanged', this.viewState);
    this.requestRender();
  }
  
  public zoomToFit(rect: Rect, padding: number = 50): void {
    if (rect.width === 0 || rect.height === 0) return;

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    const scaleX = (canvasWidth - padding * 2) / rect.width;
    const scaleY = (canvasHeight - padding * 2) / rect.height;
    const newScale = Math.min(scaleX, scaleY, 5); // Limita o zoom máximo

    const newOffsetX = (canvasWidth - rect.width * newScale) / 2 - rect.x * newScale;
    const newOffsetY = (canvasHeight - rect.height * newScale) / 2 - rect.y * newScale;
    
    this.viewState.scale = newScale;
    this.viewState.offset = {x: newOffsetX, y: newOffsetY };

    this.events.emit('viewchanged', this.viewState);
    this.requestRender();
  }


  private drawGrid(): void {
    if (!this.viewState.showGrid) return;

    const { scale, offset, gridSize } = this.viewState;
    const scaledGridSize = gridSize * scale;

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.lineWidth = 1;

    const startX = -offset.x % scaledGridSize;
    const startY = -offset.y % scaledGridSize;
    
    this.ctx.beginPath();
    for (let x = startX; x < this.canvas.width; x += scaledGridSize) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
    }
    for (let y = startY; y < this.canvas.height; y += scaledGridSize) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
    }
    this.ctx.stroke();
    
    // Major grid lines (optional, can be more sophisticated)
    const majorGridMultiple = 5;
    const majorScaledGridSize = scaledGridSize * majorGridMultiple;
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    
    const majorStartX = -offset.x % majorScaledGridSize;
    const majorStartY = -offset.y % majorScaledGridSize;

    this.ctx.beginPath();
    for (let x = majorStartX; x < this.canvas.width; x += majorScaledGridSize) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
    }
    for (let y = majorStartY; y < this.canvas.height; y += majorScaledGridSize) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
    }
    this.ctx.stroke();
  }

  private animationFrameId: number | null = null;
  public requestRender(): void {
    if (this.isDestroyed) return;
    if (this.animationFrameId === null) {
      this.animationFrameId = requestAnimationFrame(this.performRender);
    }
  }

  private performRender = (): void => {
    this.animationFrameId = null;
    if (this.isDestroyed) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Salva o estado do contexto para garantir que a transformação seja local para esta renderização
    this.ctx.save();
    this.ctx.translate(this.viewState.offset.x, this.viewState.offset.y);
    this.ctx.scale(this.viewState.scale, this.viewState.scale);

    this.drawGrid(); // Grid é desenhado no espaço transformado
    
    this.events.emit('beforerender', this.ctx, this.viewState);
    // O RenderService ouvirá 'beforerender' e desenhará os elementos (nós, conexões, etc.)
    // usando o contexto já transformado.
    
    this.ctx.restore(); // Restaura o contexto para o estado original

    this.events.emit('afterrender', this.ctx, this.viewState); // Para overlays, etc. no espaço da tela
  }

  public getCanvasElement(): HTMLCanvasElement {
    return this.canvas;
  }

  public getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  public getViewState(): Readonly<ViewState> {
    return this.viewState;
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
  }
}