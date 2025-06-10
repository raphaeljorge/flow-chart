import { EventEmitter } from 'eventemitter3';
import { ViewState, Point, CanvasBackgroundPattern, EditorPreferences, ConnectionRoutingMode, BreadcrumbEntry } from '../core/types';
import { EVENT_VIEW_CHANGED, DEFAULT_SCALE, DEFAULT_GRID_SIZE } from '../core/constants';

export class ViewStore {
  private state: ViewState;
  private events: EventEmitter;

  constructor(initialState?: Partial<ViewState>) {
    const defaultPreferences: EditorPreferences = {
      connectionRouting: ConnectionRoutingMode.BEZIER,
      grid: {
        pattern: 'dots',
        snapToGrid: false,
        adaptiveGrid: true,
      },
      connectionAppearance: {
        thicknessMode: 'uniform',
        showLabels: true,
        showDirectionArrows: true,
        animateFlow: false,
        colorMode: 'uniform',
      },
      performance: {
        animations: 'essential',
        shadowEffects: true,
        maxVisibleNodes: 200,
      },
      ...(initialState?.preferences || {}),
    };

    this.state = {
      scale: initialState?.scale ?? DEFAULT_SCALE,
      offset: initialState?.offset ?? { x: 0, y: 0 },
      gridSize: initialState?.gridSize ?? DEFAULT_GRID_SIZE,
      preferences: defaultPreferences,
      showGrid: defaultPreferences.grid.pattern !== 'none',
      snapToGrid: defaultPreferences.grid.snapToGrid,
      backgroundPattern: defaultPreferences.grid.pattern,
      navigationPath: initialState?.navigationPath ?? [{ graphId: 'root', label: 'Main Flow' }], // Adicionado
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

  public navigateTo(graphId: string, label: string): void {
    const newPath = [...this.state.navigationPath, { graphId, label }];
    this.setState({ navigationPath: newPath });
  }

  public navigateUpTo(graphId: string): void {
      const index = this.state.navigationPath.findIndex(entry => entry.graphId === graphId);
      if (index !== -1) {
          const newPath = this.state.navigationPath.slice(0, index + 1);
          this.setState({ navigationPath: newPath });
      }
  }

  public getCurrentGraphId(): string {
      return this.state.navigationPath[this.state.navigationPath.length - 1].graphId;
  }

  public getNavigationPath(): BreadcrumbEntry[] {
      return this.state.navigationPath;
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

  public updatePreferences(newPrefs: Partial<EditorPreferences>): void {
    const currentPrefs = this.state.preferences;

    // Deep merge for nested preference objects
    const updatedPreferences: EditorPreferences = {
        connectionRouting: newPrefs.connectionRouting ?? currentPrefs.connectionRouting,
        grid: { ...currentPrefs.grid, ...(newPrefs.grid || {}) },
        connectionAppearance: { ...currentPrefs.connectionAppearance, ...(newPrefs.connectionAppearance || {}) },
        performance: { ...currentPrefs.performance, ...(newPrefs.performance || {}) },
    };

    const derivedState: Partial<ViewState> = {
        preferences: updatedPreferences,
        showGrid: updatedPreferences.grid.pattern !== 'none',
        backgroundPattern: updatedPreferences.grid.pattern,
        snapToGrid: updatedPreferences.grid.snapToGrid,
    };
    this.setState(derivedState);
}

  public destroy(): void {
    this.events.removeAllListeners();
  }
}