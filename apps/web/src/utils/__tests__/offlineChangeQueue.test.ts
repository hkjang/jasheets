import {
  OfflineChange,
  OfflineChangeQueue,
  OfflineChangeStore,
  OfflineConflictError,
} from '../offlineChangeQueue';

class MemoryStore<T> implements OfflineChangeStore<T> {
  changes = new Map<string, OfflineChange<T>>();

  async list(): Promise<OfflineChange<T>[]> {
    return [...this.changes.values()].sort((left, right) => left.createdAt - right.createdAt);
  }

  async put(change: OfflineChange<T>): Promise<void> {
    this.changes.set(change.id, change);
  }

  async delete(id: string): Promise<void> {
    this.changes.delete(id);
  }
}

describe('OfflineChangeQueue', () => {
  it('persists changes and drains them in creation order', async () => {
    const store = new MemoryStore<string>();
    let id = 0;
    const queue = new OfflineChangeQueue(store, () => `change-${++id}`, () => id);
    const sent: string[] = [];
    await queue.enqueue('first');
    await queue.enqueue('second');

    const remaining = await queue.drain(async (payload) => { sent.push(payload); });

    expect(sent).toEqual(['first', 'second']);
    expect(remaining).toEqual([]);
  });

  it('retains transient failures for a later retry', async () => {
    const store = new MemoryStore<string>();
    const queue = new OfflineChangeQueue(store, () => 'change-1');
    await queue.enqueue('edit');

    const remaining = await queue.drain(async () => { throw new Error('offline'); });

    expect(remaining[0]).toMatchObject({ attempts: 1, status: 'pending' });
  });

  it('surfaces conflicts until explicitly retried or discarded', async () => {
    const store = new MemoryStore<string>();
    const queue = new OfflineChangeQueue(store, () => 'change-1');
    await queue.enqueue('edit');
    await queue.drain(async () => { throw new OfflineConflictError('version mismatch'); });

    expect(await queue.list()).toEqual([
      expect.objectContaining({ status: 'conflict', conflictReason: 'version mismatch' }),
    ]);
    await queue.retryConflict('change-1');
    expect((await queue.list())[0].status).toBe('pending');
    await queue.discard('change-1');
    expect(await queue.list()).toEqual([]);
  });
});
