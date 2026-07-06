import Dexie, { Table } from 'dexie';
export interface LocalDocument {
  id: string;
  title: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  content?: string;
  isShared?: boolean;
  role?: string;
}
export interface LocalOperation {
  id: string;
  documentId: string;
  operation: any;
  version: number;
  timestamp: string;
}
export interface QueueOperation {
  id: string; 
  documentId: string;
  operationType: 'CREATE_DOC' | 'UPDATE_DOC' | 'DELETE_DOC' | 'SYNC_OP';
  payload: any;
  versionNumber: number;
  timestamp: string;
  status: 'pending' | 'uploading' | 'synced' | 'failed';
  retryCount: number;
}
export interface LocalVersion {
  id: string;
  documentId: string;
  snapshot: any;
  createdBy: string;
  createdAt: string;
}
export interface LocalSetting {
  key: string;
  value: any;
}
export interface LocalUserCache {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}
export class SyncDocsDatabase extends Dexie {
  documents!: Table<LocalDocument, string>;
  operations!: Table<LocalOperation, string>;
  pendingQueue!: Table<QueueOperation, string>;
  versions!: Table<LocalVersion, string>;
  settings!: Table<LocalSetting, string>;
  usersCache!: Table<LocalUserCache, string>;
  constructor() {
    super('SyncDocs');
    this.version(1).stores({
      documents: 'id, title, ownerId, updatedAt',
      operations: 'id, documentId, version, timestamp',
      pendingQueue: 'id, documentId, operationType, status, timestamp',
      versions: 'id, documentId, createdBy, createdAt',
      settings: 'key',
      usersCache: 'id, email',
    });
  }
}
export const db = new SyncDocsDatabase();
