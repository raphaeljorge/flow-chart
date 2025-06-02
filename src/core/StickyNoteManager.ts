import { nanoid } from 'nanoid';
import { EventEmitter } from 'eventemitter3';
import { Point, StickyNote } from './types';

export class StickyNoteManager {
  private notes: Map<string, StickyNote> = new Map();
  private events: EventEmitter = new EventEmitter();
  private selectedNote: string | null = null;
  private isDragging: boolean = false;
  private isResizing: boolean = false;
  private dragStartPos: Point | null = null;
  private noteStartPos: Point | null = null;
  private noteStartDimensions: { width: number; height: number } | null = null;
  private resizeHandle: string = '';

  constructor() {}

  public createNote(position: Point): StickyNote {
    const note: StickyNote = {
      id: nanoid(),
      content: '',
      position,
      width: 200,
      height: 150,
      style: {
        backgroundColor: '#2a2a2a',
        textColor: '#ffffff',
        fontSize: 14
      }
    };

    this.notes.set(note.id, note);
    this.emitNotesUpdated();
    return note;
  }

  public startDrag(noteId: string, point: Point) {
    const note = this.notes.get(noteId);
    if (!note) return;

    this.isDragging = true;
    this.dragStartPos = point;
    this.noteStartPos = { ...note.position };
    this.selectNote(noteId);
  }

  public startResize(noteId: string, point: Point, handle: string) {
    const note = this.notes.get(noteId);
    if (!note) return;

    this.isResizing = true;
    this.resizeHandle = handle;
    this.dragStartPos = point;
    this.noteStartDimensions = {
      width: note.width,
      height: note.height
    };
    this.noteStartPos = { ...note.position };
    this.selectNote(noteId);
  }

  public handleDrag(point: Point) {
    if (!this.isDragging || !this.dragStartPos || !this.noteStartPos || !this.selectedNote) return;

    const note = this.notes.get(this.selectedNote);
    if (!note) return;

    const dx = point.x - this.dragStartPos.x;
    const dy = point.y - this.dragStartPos.y;

    note.position = {
      x: this.noteStartPos.x + dx,
      y: this.noteStartPos.y + dy
    };

    this.emitNotesUpdated();
  }

  public handleResize(point: Point) {
    if (!this.isResizing || !this.dragStartPos || !this.noteStartDimensions || !this.noteStartPos || !this.selectedNote) return;

    const note = this.notes.get(this.selectedNote);
    if (!note) return;

    const dx = point.x - this.dragStartPos.x;
    const dy = point.y - this.dragStartPos.y;

    switch (this.resizeHandle) {
      case 'e':
        note.width = Math.max(100, this.noteStartDimensions.width + dx);
        break;
      case 'w':
        const deltaW = Math.min(dx, this.noteStartDimensions.width - 100);
        note.width = Math.max(100, this.noteStartDimensions.width - deltaW);
        note.position.x = this.noteStartPos.x + deltaW;
        break;
      case 's':
        note.height = Math.max(100, this.noteStartDimensions.height + dy);
        break;
      case 'n':
        const deltaH = Math.min(dy, this.noteStartDimensions.height - 100);
        note.height = Math.max(100, this.noteStartDimensions.height - deltaH);
        note.position.y = this.noteStartPos.y + deltaH;
        break;
      case 'se':
        note.width = Math.max(100, this.noteStartDimensions.width + dx);
        note.height = Math.max(100, this.noteStartDimensions.height + dy);
        break;
      case 'sw':
        note.height = Math.max(100, this.noteStartDimensions.height + dy);
        const deltaSW = Math.min(dx, this.noteStartDimensions.width - 100);
        note.width = Math.max(100, this.noteStartDimensions.width - deltaSW);
        note.position.x = this.noteStartPos.x + deltaSW;
        break;
      case 'ne':
        note.width = Math.max(100, this.noteStartDimensions.width + dx);
        const deltaNE = Math.min(dy, this.noteStartDimensions.height - 100);
        note.height = Math.max(100, this.noteStartDimensions.height - deltaNE);
        note.position.y = this.noteStartPos.y + deltaNE;
        break;
      case 'nw':
        const deltaNW_W = Math.min(dx, this.noteStartDimensions.width - 100);
        const deltaNW_H = Math.min(dy, this.noteStartDimensions.height - 100);
        note.width = Math.max(100, this.noteStartDimensions.width - deltaNW_W);
        note.height = Math.max(100, this.noteStartDimensions.height - deltaNW_H);
        note.position.x = this.noteStartPos.x + deltaNW_W;
        note.position.y = this.noteStartPos.y + deltaNW_H;
        break;
    }

    this.emitNotesUpdated();
  }

  public stopDragAndResize() {
    this.isDragging = false;
    this.isResizing = false;
    this.dragStartPos = null;
    this.noteStartPos = null;
    this.noteStartDimensions = null;
    this.resizeHandle = '';
  }

  public updateNote(noteId: string, updates: Partial<StickyNote>) {
    const note = this.notes.get(noteId);
    if (note) {
      Object.assign(note, updates);
      this.emitNotesUpdated();
    }
  }

  public updateNoteStyle(noteId: string, style: Partial<StickyNote['style']>) {
    const note = this.notes.get(noteId);
    if (note) {
      note.style = { ...note.style, ...style };
      this.emitNotesUpdated();
    }
  }

  public updateNoteContent(noteId: string, content: string) {
    const note = this.notes.get(noteId);
    if (note) {
      note.content = content;
      this.emitNotesUpdated();
    }
  }

  public deleteNote(noteId: string) {
    this.notes.delete(noteId);
    if (this.selectedNote === noteId) {
      this.selectedNote = null;
    }
    this.emitNotesUpdated();
  }

  public selectNote(noteId: string | null) {
    this.selectedNote = noteId;
    this.events.emit('selectionChanged', noteId);
  }

  public getSelectedNote(): StickyNote | null {
    if (!this.selectedNote) return null;
    return this.notes.get(this.selectedNote) || null;
  }

  public getNotes(): StickyNote[] {
    return Array.from(this.notes.values());
  }

  public findNoteAtPoint(point: Point): { note: StickyNote; region: string } | null {
    const resizeHandleSize = 8;
    
    for (const note of this.notes.values()) {
      if (
        point.x >= note.position.x &&
        point.x <= note.position.x + note.width &&
        point.y >= note.position.y &&
        point.y <= note.position.y + note.height
      ) {
        // Check resize handles
        const isNearTop = Math.abs(point.y - note.position.y) <= resizeHandleSize;
        const isNearBottom = Math.abs(point.y - (note.position.y + note.height)) <= resizeHandleSize;
        const isNearLeft = Math.abs(point.x - note.position.x) <= resizeHandleSize;
        const isNearRight = Math.abs(point.x - (note.position.x + note.width)) <= resizeHandleSize;

        if (isNearTop && isNearLeft) return { note, region: 'nw' };
        if (isNearTop && isNearRight) return { note, region: 'ne' };
        if (isNearBottom && isNearLeft) return { note, region: 'sw' };
        if (isNearBottom && isNearRight) return { note, region: 'se' };
        if (isNearTop) return { note, region: 'n' };
        if (isNearBottom) return { note, region: 's' };
        if (isNearLeft) return { note, region: 'w' };
        if (isNearRight) return { note, region: 'e' };

        return { note, region: 'body' };
      }
    }
    return null;
  }

  private emitNotesUpdated() {
    this.events.emit('notesUpdated', this.getNotes());
  }

  public on(event: string, callback: (...args: any[]) => void) {
    this.events.on(event, callback);
  }
}