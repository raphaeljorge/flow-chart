import { nanoid } from 'nanoid';
import { EventEmitter } from 'eventemitter3';
import { Point, StickyNote, Rect } from './Types';

export class StickyNoteManager {
  private notes: Map<string, StickyNote>;
  private events: EventEmitter;

  constructor() {
    this.notes = new Map<string, StickyNote>();
    this.events = new EventEmitter();
  }

  public createNote(position: Point, content: string = '', width: number = 200, height: number = 150): StickyNote {
    const note: StickyNote = {
      id: nanoid(),
      content,
      position,
      width,
      height,
      style: {
        backgroundColor: '#2a2a2a', //
        textColor: '#ffffff', //
        fontSize: 14, //
      },
    };

    this.notes.set(note.id, note);
    this.emitNotesUpdated();
    this.events.emit('noteCreated', note);
    return note;
  }

  public getNote(noteId: string): StickyNote | undefined {
    return this.notes.get(noteId);
  }

  public getNotes(): StickyNote[] {
    return Array.from(this.notes.values());
  }

  public updateNote(noteId: string, updates: Partial<Omit<StickyNote, 'id'>>): void {
    const note = this.notes.get(noteId);
    if (note) {
      // Tratar a atualização de 'style' separadamente para mesclar
      if (updates.style) {
        note.style = { ...note.style, ...updates.style };
        delete updates.style; // Remove para não sobrescrever o objeto 'style' inteiro abaixo
      }
      Object.assign(note, updates);
      this.emitNotesUpdated();
      this.events.emit('noteUpdated', note);
    }
  }
  
  public updateNoteContent(noteId: string, content: string): void {
    const note = this.notes.get(noteId);
    if (note) {
        note.content = content;
        this.emitNotesUpdated();
        this.events.emit('noteUpdated', note); // Ou um evento 'noteContentChanged'
    }
  }

  public updateNoteStyle(noteId: string, styleUpdates: Partial<StickyNote['style']>): void {
    const note = this.notes.get(noteId);
    if (note) {
      note.style = { ...note.style, ...styleUpdates };
      this.emitNotesUpdated();
      this.events.emit('noteUpdated', note); // Ou um evento 'noteStyleChanged'
    }
  }
  
  // Método para InteractionManager atualizar posição e dimensões
  public updateNoteRect(noteId: string, newRect: Rect): void {
    const note = this.notes.get(noteId);
    if (note) {
      note.position.x = newRect.x;
      note.position.y = newRect.y;
      note.width = newRect.width;
      note.height = newRect.height;
      this.emitNotesUpdated();
      this.events.emit('noteUpdated', note); // Ou 'noteMovedResized'
    }
  }


  public deleteNote(noteId: string): void {
    const note = this.notes.get(noteId);
    if (note) {
      this.notes.delete(noteId);
      this.emitNotesUpdated();
      this.events.emit('noteDeleted', note);
    }
  }
  
  public deleteNotes(noteIds: string[]): void {
    noteIds.forEach(id => this.deleteNote(id));
    // O evento 'notesUpdated' já é emitido por deleteNote.
    // Se uma notificação em lote for necessária, pode ser adicionada aqui.
  }


  private emitNotesUpdated(): void {
    this.events.emit('notesUpdated', this.getNotes());
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
      this.notes.clear();
      this.events.removeAllListeners();
  }
}