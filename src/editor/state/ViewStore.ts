import { EventEmitter } from 'eventemitter3';
import { ViewState, Point, CanvasBackgroundPattern } from '../core/types';
import { EVENT_VIEW_CHANGED, DEFAULT_SCALE, DEFAULT_GRID_SIZE } from '../core/constants';

export class ViewStore {
  private state: ViewState;
  private events: EventEmitter;

  constructor(initialState?: Partial<ViewState>) {
    this.state = {
      scale: initialState?.scale ?? DEFAULT_SCALE,
      offset: initialState?.offset ?? { x: 0, y: 0 },
      showGrid: initialState?.showGrid ?? true,
      snapToGrid: initialState?.snapToGrid ?? false,
      gridSize: initialState?.gridSize ?? DEFAULT_GRID_SIZE,
      backgroundPattern: initialState?.backgroundPattern ?? 'dots',
    };
    this.events = new EventEmitter();
  }

  public getState(): Readonly<ViewState> {
    return this.state;
  }

  public setState(newState: Partial<ViewState>): void {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...newState };
    this.events.emit(EVENT_VIEW_CHANGED, this.state, oldState);
  }

  public setScale(scale: number): void {
    if (this.state.scale !== scale) {
      this.setState({ scale });
    }
  }

  public setOffset(offset: Point): void {
    if (this.state.offset.x !== offset.x || this.state.offset.y !== offset.y) {
      this.setState({ offset });
    }
  }
  
  public setScaleAndOffset(scale: number, offset: Point): void {
    if (this.state.scale !== scale || this.state.offset.x !== offset.x || this.state.offset.y !== offset.y) {
        this.setState({ scale, offset });
    }
  }

  public toggleGrid(forceState?: boolean): void {
    const showGrid = forceState !== undefined ? forceState : !this.state.showGrid;
    if (this.state.showGrid !== showGrid) {
        this.setState({ showGrid });
    }
  }

  public setBackgroundPattern(pattern: CanvasBackgroundPattern): void {
    if (this.state.backgroundPattern !== pattern) {
      this.setState({ backgroundPattern: pattern });
    }
  }

  public toggleSnapToGrid(): void {
    this.setState({ snapToGrid: !this.state.snapToGrid });
  }
  
  public resetView(defaultState?: Partial<ViewState>): void {
    this.setState({
        scale: defaultState?.scale ?? DEFAULT_SCALE,
        offset: defaultState?.offset ?? { x: 0, y: 0 },
        showGrid: defaultState?.showGrid ?? true,
        snapToGrid: defaultState?.snapToGrid ?? false,
        gridSize: defaultState?.gridSize ?? DEFAULT_GRID_SIZE,
        backgroundPattern: defaultState?.backgroundPattern ?? 'dots',
    });
  }

  public on(event: string, listener: (newState: ViewState, oldState?: ViewState) => void): this {
    if (event === EVENT_VIEW_CHANGED) {
        this.events.on(event, listener);
    }
    return this;
  }

  public off(event: string, listener: (newState: ViewState, oldState?: ViewState) => void): this {
    if (event === EVENT_VIEW_CHANGED) {
        this.events.off(event, listener);
    }
    return this;
  }

  public destroy(): void {
    this.events.removeAllListeners();
  }
}