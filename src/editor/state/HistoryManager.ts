import { EventEmitter } from "eventemitter3";
import { GraphState } from "../core/types";
import {
  EVENT_HISTORY_CHANGED,
  DEFAULT_HISTORY_MAX_SIZE,
} from "../core/constants";

export class HistoryManager {
  private history: GraphState[] = [];
  private currentIndex: number = -1;
  private maxSize: number;
  private events: EventEmitter;
  private _isRestoring: boolean = false;
  private transactionDepth = 0; // Adicionado para lidar com transações

  constructor(maxSize: number = DEFAULT_HISTORY_MAX_SIZE) {
    this.maxSize = maxSize;
    this.events = new EventEmitter();
  }

  /**
   * Verifica se o gerenciador de histórico está restaurando um estado ou dentro de uma transação.
   */
  public isRestoringState(): boolean {
    return this._isRestoring || this.transactionDepth > 0;
  }

  /**
   * Inicia uma transação, impedindo pushes automáticos para o histórico.
   */
  public beginTransaction(): void {
    this.transactionDepth++;
  }

  /**
   * Finaliza uma transação. Se for a transação mais externa, um estado final pode ser salvo.
   * @param finalState O estado final opcional para adicionar ao histórico.
   */
  public endTransaction(finalState?: GraphState): void {
    if (this.transactionDepth > 0) {
      this.transactionDepth--;
    }

    if (this.transactionDepth === 0 && finalState) {
      this.push(finalState);
    }
  }

  public push(state: GraphState): void {
    if (this.isRestoringState()) return;

    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    const clonedState = JSON.parse(JSON.stringify(state));
    this.history.push(clonedState);
    this.currentIndex++;

    if (this.history.length > this.maxSize) {
      this.history.shift();
      this.currentIndex--;
    }
    this.emitChange();
  }

  public undo(): GraphState | undefined {
    if (this.canUndo()) {
      this._isRestoring = true;
      this.currentIndex--;
      const stateToRestore = JSON.parse(
        JSON.stringify(this.history[this.currentIndex])
      );
      this.emitChange();
      this._isRestoring = false;
      return stateToRestore;
    }
    return undefined;
  }

  public redo(): GraphState | undefined {
    if (this.canRedo()) {
      this._isRestoring = true;
      this.currentIndex++;
      const stateToRestore = JSON.parse(
        JSON.stringify(this.history[this.currentIndex])
      );
      this.emitChange();
      this._isRestoring = false;
      return stateToRestore;
    }
    return undefined;
  }

  public canUndo(): boolean {
    return this.currentIndex > 0;
  }

  public canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  public clear(): void {
    this.history = [];
    this.currentIndex = -1;
    this.emitChange();
  }

  public recordInitialState(state: GraphState): void {
    if (this.history.length === 0 && this.currentIndex === -1) {
      this.beginTransaction();
      this.history.push(JSON.parse(JSON.stringify(state)));
      this.currentIndex = 0;
      this.emitChange();
      this.endTransaction();
    }
  }

  private emitChange(): void {
    this.events.emit(EVENT_HISTORY_CHANGED, {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    });
  }

  public on(
    event: string,
    listener: (status: { canUndo: boolean; canRedo: boolean }) => void
  ): this {
    if (event === EVENT_HISTORY_CHANGED) {
      this.events.on(event, listener);
    }
    return this;
  }

  public off(
    event: string,
    listener: (status: { canUndo: boolean; canRedo: boolean }) => void
  ): this {
    if (event === EVENT_HISTORY_CHANGED) {
      this.events.off(event, listener);
    }
    return this;
  }

  public destroy(): void {
    this.clear();
    this.events.removeAllListeners();
  }
}
