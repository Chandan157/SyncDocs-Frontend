import { db, QueueOperation } from '../indexeddb/db';

export class SyncEngine {
  private isSyncing: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.sync());
    }
  }

  async addOperation(op: Omit<QueueOperation, 'status' | 'retryCount' | 'timestamp'>) {
    await db.pendingQueue.add({
      ...op,
      timestamp: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
    });
    
    if (navigator.onLine) {
      this.sync();
    }
  }

  async sync() {
    if (this.isSyncing || !navigator.onLine) return;
    this.isSyncing = true;

    try {
      const pendingOps = await db.pendingQueue
        .where('status')
        .anyOf(['pending', 'failed'])
        .sortBy('timestamp');

      for (const op of pendingOps) {
        if (!navigator.onLine) break;

        // Exponential backoff simulation
        if (op.retryCount > 0) {
          const delay = Math.min(1000 * Math.pow(2, op.retryCount), 30000);
          await new Promise(res => setTimeout(res, delay));
        }

        try {
          await db.pendingQueue.update(op.id, { status: 'uploading' });

          const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(op),
          });

          if (!response.ok) {
            throw new Error('Sync rejected');
          }

          await db.pendingQueue.update(op.id, { status: 'synced' });
        } catch (error) {
          await db.pendingQueue.update(op.id, {
            status: 'failed',
            retryCount: op.retryCount + 1,
          });
        }
      }
    } finally {
      this.isSyncing = false;
      // Clean up synced ops
      await db.pendingQueue.where('status').equals('synced').delete();
    }
  }
}

export const syncEngine = new SyncEngine();
