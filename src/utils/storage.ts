/**
 * Durable storage for characters and presets.
 *
 * localStorage only holds about 5 MB per site (shared with everything else on
 * thatbio.vercel.app), which portraits fill quickly. IndexedDB has room for far
 * more, so the real copy lives there. Older data in localStorage is picked up
 * once (migration) when IndexedDB has nothing yet.
 */

const DB_NAME = 'dramatis';
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available in this browser.'));
        return;
      }
      // Opens the database and makes sure the store exists, bumping the version once if a
      // database of that name exists without it (self-repair instead of failing forever).
      const open = (version?: number) => {
        const req = version ? indexedDB.open(DB_NAME, version) : indexedDB.open(DB_NAME);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
        };
        req.onsuccess = () => {
          const db = req.result;
          if (db.objectStoreNames.contains(STORE)) {
            db.onversionchange = () => db.close();
            resolve(db);
            return;
          }
          const next = db.version + 1;
          db.close();
          open(next);
        };
        req.onerror = () => reject(req.error ?? new Error('Could not open storage.'));
        req.onblocked = () => reject(new Error('Storage is busy in another tab. Close other Dramatis tabs and reload.'));
      };
      open();
    });
    dbPromise.catch(() => {
      dbPromise = null; // allow a retry later
    });
  }
  return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error ?? new Error('Could not read storage.'));
  });
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not save.'));
    tx.onabort = () => reject(tx.error ?? new Error('Saving was aborted (storage may be full).'));
  });
}

/** Resolves like the promise, or rejects after `ms` so a stuck database can never freeze saving. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Storage did not answer in time.')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/** Asks the browser not to clear this site's storage under pressure (best effort). */
export function requestPersistentStorage() {
  try {
    void navigator.storage?.persist?.();
  } catch {
    // not supported: fine
  }
}
