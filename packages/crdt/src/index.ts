import * as Y from 'yjs';
import { CellValue, CellFormat, cellRefToKey, keyToCellRef, UserPresence } from '@jasheets/shared';

export interface CellData {
  value: CellValue;
  formula?: string;
  format?: CellFormat;
}

export interface CellChange {
  row: number;
  col: number;
  data: CellData;
  userId?: string;
}

export interface SelectionChange {
  userId: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export type SheetDocumentEvent =
  | { type: 'cellChange'; changes: CellChange[] }
  | { type: 'selectionChange'; selection: SelectionChange }
  | { type: 'presenceUpdate'; presence: UserPresence[] };

export class SheetDocument {
  private doc: Y.Doc;
  private cells: Y.Map<Y.Map<any>>;
  private awareness: Y.Map<any>;
  private meta: Y.Map<any>;
  private eventHandlers: Set<(event: SheetDocumentEvent) => void> = new Set();

  constructor(docId?: string) {
    this.doc = new Y.Doc();
    if (docId) {
      this.doc.clientID = parseInt(docId, 36) % (2 ** 30);
    }
    
    this.cells = this.doc.getMap('cells');
    this.awareness = this.doc.getMap('awareness');
    this.meta = this.doc.getMap('meta');
    
    this.setupObservers();
  }

  private setupObservers(): void {
    this.cells.observe((event: Y.YMapEvent<Y.Map<any>>) => {
      const changes: CellChange[] = [];
      
      event.changes.keys.forEach((change: any, key: string) => {
        const { row, col } = keyToCellRef(key);
        const cellMap = this.cells.get(key);
        
        if (cellMap) {
          changes.push({
            row,
            col,
            data: {
              value: cellMap.get('value'),
              formula: cellMap.get('formula'),
              format: cellMap.get('format'),
            },
          });
        }
      });
      
      if (changes.length > 0) {
        this.emit({ type: 'cellChange', changes });
      }
    });

    this.awareness.observe(() => {
      const presence: UserPresence[] = [];
      this.awareness.forEach((value: any, key: string) => {
        if (value && key !== 'local') {
          presence.push(value);
        }
      });
      this.emit({ type: 'presenceUpdate', presence });
    });
  }

  private emit(event: SheetDocumentEvent): void {
    this.eventHandlers.forEach((handler) => handler(event));
  }

  on(handler: (event: SheetDocumentEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  getDoc(): Y.Doc {
    return this.doc;
  }

  // Cell operations
  getCell(row: number, col: number): CellData | null {
    const key = cellRefToKey(row, col);
    const cellMap = this.cells.get(key);
    
    if (!cellMap) return null;
    
    return {
      value: cellMap.get('value'),
      formula: cellMap.get('formula'),
      format: cellMap.get('format'),
    };
  }

  setCell(row: number, col: number, data: Partial<CellData>): void {
    const key = cellRefToKey(row, col);
    
    this.doc.transact(() => {
      let cellMap = this.cells.get(key);
      
      if (!cellMap) {
        cellMap = new Y.Map();
        this.cells.set(key, cellMap);
      }
      
      if (data.value !== undefined) {
        cellMap.set('value', data.value);
      }
      if (data.formula !== undefined) {
        cellMap.set('formula', data.formula);
      }
      if (data.format !== undefined) {
        cellMap.set('format', data.format);
      }
    });
  }

  deleteCell(row: number, col: number): void {
    const key = cellRefToKey(row, col);
    this.cells.delete(key);
  }

  // Batch operations for performance
  setCells(updates: Array<{ row: number; col: number; data: Partial<CellData> }>): void {
    this.doc.transact(() => {
      for (const { row, col, data } of updates) {
        this.setCell(row, col, data);
      }
    });
  }

  // Get all cells
  getAllCells(): Map<string, CellData> {
    const result = new Map<string, CellData>();
    
    this.cells.forEach((cellMap: any, key: string) => {
      result.set(key, {
        value: cellMap.get('value'),
        formula: cellMap.get('formula'),
        format: cellMap.get('format'),
      });
    });
    
    return result;
  }

  // Get cells in a specific range
  getCellsInRange(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ): CellData[][] {
    const result: CellData[][] = [];
    
    for (let row = startRow; row <= endRow; row++) {
      const rowData: CellData[] = [];
      for (let col = startCol; col <= endCol; col++) {
        const cell = this.getCell(row, col);
        rowData.push(cell || { value: null });
      }
      result.push(rowData);
    }
    
    return result;
  }

  // Presence/awareness management
  setLocalPresence(presence: Partial<UserPresence>): void {
    this.awareness.set('local', presence);
  }

  getPresence(): UserPresence[] {
    const result: UserPresence[] = [];
    this.awareness.forEach((value: any, key: string) => {
      if (value) {
        result.push(value);
      }
    });
    return result;
  }

  // Metadata
  setMeta(key: string, value: any): void {
    this.meta.set(key, value);
  }

  getMeta(key: string): any {
    return this.meta.get(key);
  }

  // Serialization
  encodeState(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  applyUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update);
  }

  encodeStateVector(): Uint8Array {
    return Y.encodeStateVector(this.doc);
  }

  // Undo/Redo support
  createUndoManager(): Y.UndoManager {
    return new Y.UndoManager(this.cells, {
      trackedOrigins: new Set([this.doc.clientID]),
    });
  }

  // Cleanup
  destroy(): void {
    this.eventHandlers.clear();
    this.doc.destroy();
  }
}

// Provider for WebSocket synchronization
export interface SyncProvider {
  connect(): void;
  disconnect(): void;
  isConnected(): boolean;
  on(event: 'sync' | 'status', handler: (data: any) => void): void;
}

export class WebSocketSyncProvider implements SyncProvider {
  private ws: WebSocket | null = null;
  private doc: Y.Doc;
  private url: string;
  private connected: boolean = false;
  private handlers: Map<string, Set<(data: any) => void>> = new Map();

  constructor(doc: Y.Doc, url: string) {
    this.doc = doc;
    this.url = url;
  }

  connect(): void {
    if (this.ws) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.connected = true;
      this.emit('status', { connected: true });
      
      // Send initial state vector
      const stateVector = Y.encodeStateVector(this.doc);
      this.ws?.send(JSON.stringify({
        type: 'sync-step-1',
        stateVector: Array.from(stateVector),
      }));
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'sync-step-2':
            // Apply remote updates
            const update = new Uint8Array(message.update);
            Y.applyUpdate(this.doc, update);
            
            // Send our missing updates
            const diff = Y.encodeStateAsUpdate(
              this.doc,
              new Uint8Array(message.stateVector)
            );
            this.ws?.send(JSON.stringify({
              type: 'sync-step-3',
              update: Array.from(diff),
            }));
            
            this.emit('sync', { synced: true });
            break;
            
          case 'update':
            Y.applyUpdate(this.doc, new Uint8Array(message.update));
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.ws = null;
      this.emit('status', { connected: false });
    };

    this.ws.onerror = (error: Event) => {
      console.error('WebSocket error:', error);
    };

    // Set up local update broadcasting
    this.doc.on('update', (update: Uint8Array, origin: any) => {
      if (origin !== 'remote' && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'update',
          update: Array.from(update),
        }));
      }
    });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  on(event: string, handler: (data: any) => void): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  private emit(event: string, data: any): void {
    this.handlers.get(event)?.forEach((handler) => handler(data));
  }
}

export { Y };
export default SheetDocument;
