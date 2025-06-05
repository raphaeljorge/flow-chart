// src/editor/state/StickyNoteManager.ts
import { nanoid } from 'nanoid';
import { EventEmitter } from 'eventemitter3';
import { Point, StickyNote, Rect } from '../core/types';
import { 
    EVENT_NOTES_UPDATED, DEFAULT_STICKY_NOTE_WIDTH, DEFAULT_STICKY_NOTE_HEIGHT, 
    STICKY_NOTE_DEFAULT_CONTENT, STICKY_NOTE_DEFAULT_BG_COLOR, STICKY_NOTE_DEFAULT_TEXT_COLOR,
    STICKY_NOTE_DEFAULT_FONT_SIZE
} from '../core/constants';

export class StickyNoteManager {
  private notes: Map<string, StickyNote>;
  private events: EventEmitter;

  constructor() {
    this.notes = new Map<string, StickyNote>();
    this.events = new EventEmitter();
  }

  public createNote(
    position: Point,
    content: string = STICKY_NOTE_DEFAULT_CONTENT,
    width: number = DEFAULT_STICKY_NOTE_WIDTH,
    height: number = DEFAULT_STICKY_NOTE_HEIGHT
  ): StickyNote {
    if (isNaN(position.x) || isNaN(position.y) || isNaN(width) || isNaN(height)) {
        console.error("[StickyNoteManager.createNote] ERROR: Detected NaN in creation parameters. Using defaults.", {position, width, height});
        position = {x: 0, y: 0}; // Fallback position
        width = DEFAULT_STICKY_NOTE_WIDTH;
        height = DEFAULT_STICKY_NOTE_HEIGHT;
    }

    const note: StickyNote = {
      id: nanoid(),
      content,
      position,
      width,
      height,
      style: {
        backgroundColor: STICKY_NOTE_DEFAULT_BG_COLOR,
        textColor: STICKY_NOTE_DEFAULT_TEXT_COLOR,
        fontSize: STICKY_NOTE_DEFAULT_FONT_SIZE,
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
      if (updates.style) {
        note.style = { ...note.style, ...updates.style };
        delete updates.style;
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
        this.events.emit('noteUpdated', note);
    }
  }

  public updateNoteStyle(noteId: string, styleUpdates: Partial<StickyNote['style']>): void {
    const note = this.notes.get(noteId);
    if (note) {
      note.style = { ...note.style, ...styleUpdates };
      this.emitNotesUpdated();
      this.events.emit('noteUpdated', note);
    }
  }

  public updateNoteRect(noteId: string, newRect: Rect): void {
    const note = this.notes.get(noteId);
    if (note) {
      note.position.x = newRect.x;
      note.position.y = newRect.y;
      note.width = newRect.width;
      note.height = newRect.height;
      this.emitNotesUpdated();
      this.events.emit('noteUpdated', note);
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
    let changed = false;
    noteIds.forEach(id => {
      if (this.notes.has(id)) {
        const note = this.notes.get(id);
        this.notes.delete(id);
        this.events.emit('noteDeleted', note); // Emit for each deleted note
        changed = true;
      }
    });
    if(changed) this.emitNotesUpdated();
  }

  private emitNotesUpdated(): void {
    this.events.emit(EVENT_NOTES_UPDATED, this.getNotes());
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

  public loadNotes(notes: StickyNote[]): void {
    this.notes.clear();
    notes.forEach(note => {
        const clonedNote = JSON.parse(JSON.stringify(note));
        this.notes.set(clonedNote.id, clonedNote);
    });
    this.emitNotesUpdated();
  }
}