export interface OfflineChange<T = unknown> {
  id: string;
  payload: T;
  createdAt: number;
  attempts: number;
  status: 'pending' | 'conflict';
  conflictReason?: string;
}

export interface OfflineChangeStore<T = unknown> {
  list(): Promise<OfflineChange<T>[]>;
  put(change: OfflineChange<T>): Promise<void>;
  delete(id: string): Promise<void>;
}

export class OfflineConflictError extends Error {}

export class IndexedDbChangeStore<T = unknown> implements OfflineChangeStore<T> {
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly databaseName = 'jasheets-offline',
    private readonly storeName = 'changes',
  ) {}

  async list(): Promise<OfflineChange<T>[]> {
    const { store, complete } = await this.transaction('readonly');
    const changes = await this.request<OfflineChange<T>[]>(store.getAll());
    await complete;
    return changes.sort((left, right) => left.createdAt - right.createdAt);
  }

  async put(change: OfflineChange<T>): Promise<void> {
    const { store, complete } = await this.transaction('readwrite');
    await this.request(store.put(change));
    await complete;
  }

  async delete(id: string): Promise<void> {
    const { store, complete } = await this.transaction('readwrite');
    await this.request(store.delete(id));
    await complete;
  }

  private async transaction(mode: IDBTransactionMode): Promise<{
    store: IDBObjectStore;
    complete: Promise<void>;
  }> {
    const database = await this.open();
    const transaction = database.transaction(this.storeName, mode);
    const complete = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    });
    return { store: transaction.objectStore(this.storeName), complete };
  }

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(this.storeName)) {
          request.result.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Unable to open offline database'));
    });
    return this.databasePromise;
  }

  private request<TResult>(request: IDBRequest<TResult>): Promise<TResult> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });
  }
}

export class OfflineChangeQueue<T = unknown> {
  constructor(
    private readonly store: OfflineChangeStore<T>,
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly now: () => number = () => Date.now(),
  ) {}

  async enqueue(payload: T): Promise<OfflineChange<T>> {
    const change: OfflineChange<T> = {
      id: this.createId(),
      payload,
      createdAt: this.now(),
      attempts: 0,
      status: 'pending',
    };
    await this.store.put(change);
    return change;
  }

  list(): Promise<OfflineChange<T>[]> {
    return this.store.list();
  }

  async drain(send: (payload: T) => Promise<void>): Promise<OfflineChange<T>[]> {
    const changes = await this.store.list();
    for (const change of changes) {
      if (change.status === 'conflict') continue;
      try {
        await send(change.payload);
        await this.store.delete(change.id);
      } catch (error) {
        await this.store.put({
          ...change,
          attempts: change.attempts + 1,
          status: error instanceof OfflineConflictError ? 'conflict' : 'pending',
          conflictReason: error instanceof OfflineConflictError ? error.message : undefined,
        });
      }
    }
    return this.store.list();
  }

  async retryConflict(id: string): Promise<void> {
    const change = (await this.store.list()).find((item) => item.id === id);
    if (!change) return;
    await this.store.put({ ...change, status: 'pending', conflictReason: undefined });
  }

  discard(id: string): Promise<void> {
    return this.store.delete(id);
  }
}
