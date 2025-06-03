// src/core/HistoryManager.ts
import { EventEmitter } from 'eventemitter3';

interface GraphState {
    nodes: any[];
    stickyNotes: any[];
    connections: any[];
    viewState: any;
}

export class HistoryManager {
    private history: GraphState[] = [];
    private currentIndex: number = -1;
    private maxSize: number; // Número máximo de estados a serem armazenados
    private events: EventEmitter;

    constructor(maxSize: number = 50) {
        this.maxSize = maxSize;
        this.events = new EventEmitter();
    }

    /**
     * Adiciona um novo estado ao histórico.
     * Limpa o 'redo' stack se houver operações após o estado atual.
     * @param state O estado completo do grafo a ser salvo.
     */
    public push(state: GraphState): void {
        // Remove quaisquer estados de "refazer" se uma nova operação foi feita
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        this.history.push(state);
        this.currentIndex++;

        // Limita o tamanho do histórico
        if (this.history.length > this.maxSize) {
            this.history.shift(); // Remove o estado mais antigo
            this.currentIndex--;
        }
        this.emitChange();
    }

    /**
     * Desfaz a última operação, retornando ao estado anterior.
     * @returns O estado anterior do grafo, ou undefined se não houver histórico para desfazer.
     */
    public undo(): GraphState | undefined {
        if (this.canUndo()) {
            this.currentIndex--;
            this.emitChange();
            return this.history[this.currentIndex];
        }
        return undefined;
    }

    /**
     * Refaz uma operação que foi desfeita.
     * @returns O estado posterior do grafo, ou undefined se não houver histórico para refazer.
     */
    public redo(): GraphState | undefined {
        if (this.canRedo()) {
            this.currentIndex++;
            this.emitChange();
            return this.history[this.currentIndex];
        }
        return undefined;
    }

    /**
     * Verifica se há estados para desfazer.
     */
    public canUndo(): boolean {
        return this.currentIndex > 0; // Não pode desfazer o estado inicial (índice 0)
    }

    /**
     * Verifica se há estados para refazer.
     */
    public canRedo(): boolean {
        return this.currentIndex < this.history.length - 1;
    }

    /**
     * Limpa todo o histórico.
     */
    public clear(): void {
        this.history = [];
        this.currentIndex = -1;
        this.emitChange();
    }

    private emitChange(): void {
        this.events.emit('historyChanged', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
    }

    public on(event: 'historyChanged', listener: (status: { canUndo: boolean; canRedo: boolean }) => void): this {
        this.events.on(event, listener);
        return this;
    }

    public off(event: 'historyChanged', listener: (status: { canUndo: boolean; canRedo: boolean }) => void): this {
        this.events.off(event, listener);
        return this;
    }

    public destroy(): void {
        this.clear();
        this.events.removeAllListeners();
    }
}