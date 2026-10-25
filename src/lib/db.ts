// The storage layer. Everything the user imports lives in IndexedDB,
// a database inside the browser that survives closing the app.
//
// Stores:
//   tracks    - small info records (title, artist, play count ...)
//   blobs     - the audio files themselves (kept apart so lists stay fast)
//   artwork   - cover pictures (a big and a small version) + colours
//   playlists - playlists and mixes, with their order
//   lyrics    - saved lyrics per track
//   history   - one entry each time a song is played
//   kv        - small settings, queue state, recent searches

export type StoreName = 'tracks' | 'blobs' | 'artwork' | 'playlists' | 'lyrics' | 'history' | 'kv';

const DB_NAME = 'aurora-music';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('This browser does not support offline storage (IndexedDB).'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('tracks', { keyPath: 'id' });
      db.createObjectStore('blobs', { keyPath: 'id' });
      db.createObjectStore('artwork', { keyPath: 'id' });
      db.createObjectStore('playlists', { keyPath: 'id' });
      db.createObjectStore('lyrics', { keyPath: 'trackId' });
      db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('kv', { keyPath: 'key' });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error('Could not open the offline database.'));
    };
    request.onblocked = () => reject(new Error('The offline database is blocked by another open copy of the app.'));
  });
  return dbPromise;
}

/** Runs several reads/writes as ONE transaction: either all happen or none. */
async function transaction(stores: StoreName[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => void): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new DOMException('Storage was cancelled', 'AbortError'));
    try {
      work(tx);
    } catch (e) {
      try {
        tx.abort();
      } catch {
        /* already finished */
      }
      reject(e);
    }
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const store = {
  async all<T>(name: StoreName): Promise<T[]> {
    const db = await openDb();
    return requestToPromise(db.transaction(name).objectStore(name).getAll()) as Promise<T[]>;
  },
  async get<T>(name: StoreName, key: IDBValidKey): Promise<T | undefined> {
    const db = await openDb();
    return requestToPromise(db.transaction(name).objectStore(name).get(key)) as Promise<T | undefined>;
  },
  async count(name: StoreName): Promise<number> {
    const db = await openDb();
    return requestToPromise(db.transaction(name).objectStore(name).count());
  },
  async put(name: StoreName, value: unknown): Promise<void> {
    await transaction([name], 'readwrite', (tx) => {
      tx.objectStore(name).put(value);
    });
  },
  async delete(name: StoreName, key: IDBValidKey): Promise<void> {
    await transaction([name], 'readwrite', (tx) => {
      tx.objectStore(name).delete(key);
    });
  },
  async clear(name: StoreName): Promise<void> {
    await transaction([name], 'readwrite', (tx) => {
      tx.objectStore(name).clear();
    });
  },
  /** Several writes in one transaction. */
  async batch(ops: { store: StoreName; put?: unknown; delete?: IDBValidKey }[]): Promise<void> {
    const names = Array.from(new Set(ops.map((o) => o.store)));
    await transaction(names, 'readwrite', (tx) => {
      for (const op of ops) {
        const s = tx.objectStore(op.store);
        if (op.put !== undefined) s.put(op.put);
        else if (op.delete !== undefined) s.delete(op.delete);
      }
    });
  },
};

// ----- small key/value helpers -----

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await store.get<{ key: string; value: T }>('kv', key);
    return row ? row.value : fallback;
  } catch {
    return fallback;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    await store.put('kv', { key, value });
  } catch {
    /* preferences are best-effort */
  }
}

// ----- audio files -----

export async function getAudioBlob(trackId: string): Promise<Blob | null> {
  const row = await store.get<{ id: string; blob: Blob }>('blobs', trackId);
  return row?.blob ?? null;
}

// ----- storage information -----

export interface StorageInfo {
  usage: number;
  quota: number;
  persisted: boolean | null;
}

export async function storageInfo(): Promise<StorageInfo> {
  let usage = 0;
  let quota = 0;
  let persisted: boolean | null = null;
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      usage = e.usage ?? 0;
      quota = e.quota ?? 0;
    }
    if (navigator.storage?.persisted) persisted = await navigator.storage.persisted();
  } catch {
    /* some browsers refuse; show what we have */
  }
  return { usage, quota, persisted };
}

/** Asks the browser not to delete our data when space is low. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}

export function isQuotaError(error: unknown): boolean {
  const e = error as { name?: string; message?: string } | null;
  return !!e && (e.name === 'QuotaExceededError' || /quota|storage.*full|not enough space/i.test(e.message ?? ''));
}
