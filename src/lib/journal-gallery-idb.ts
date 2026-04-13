/** IndexedDB store for Journal screenshot slots (8 JPEG data URLs). */

const DB_NAME = "bex-journal-gallery";
const STORE = "kv";
const VERSION = 1;
const KEY_SLOTS = "slots";
const LEGACY_LS_KEY = "bex-journal-gallery-v1";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const st = tx.objectStore(STORE);
    const r = st.get(key);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve(r.result as T | undefined);
  });
}

function idbSet(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const st = tx.objectStore(STORE);
    const r = st.put(value, key);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve();
  });
}

const EMPTY_SLOTS = (): (string | null)[] =>
  Array.from({ length: 8 }, () => null);

export async function loadGallerySlotsFromIdb(): Promise<(string | null)[]> {
  try {
    const db = await openDb();
    const raw = await idbGet<string | null[]>(db, KEY_SLOTS);
    db.close();
    if (!Array.isArray(raw) || raw.length !== 8) return EMPTY_SLOTS();
    return raw.map((x) => (typeof x === "string" ? x : null));
  } catch {
    return EMPTY_SLOTS();
  }
}

export async function saveGallerySlotsToIdb(
  slots: (string | null)[]
): Promise<void> {
  const norm = EMPTY_SLOTS().map((_, i) => slots[i] ?? null);
  const db = await openDb();
  await idbSet(db, KEY_SLOTS, norm);
  db.close();
}

/** One-time copy from legacy localStorage into IDB. */
export async function migrateGalleryFromLocalStorage(): Promise<void> {
  if (typeof window === "undefined") return;
  const flag = "bex-journal-gallery-migrated-idb";
  if (localStorage.getItem(flag)) return;
  try {
    const existing = await loadGallerySlotsFromIdb();
    if (existing.some((x) => x)) {
      localStorage.setItem(flag, "1");
      return;
    }
    const raw = localStorage.getItem(LEGACY_LS_KEY);
    if (!raw) {
      localStorage.setItem(flag, "1");
      return;
    }
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) {
      localStorage.setItem(flag, "1");
      return;
    }
    const slots = EMPTY_SLOTS();
    for (let i = 0; i < Math.min(8, p.length); i++) {
      if (typeof p[i] === "string") slots[i] = p[i] as string;
    }
    await saveGallerySlotsToIdb(slots);
    localStorage.removeItem(LEGACY_LS_KEY);
    localStorage.setItem(flag, "1");
  } catch {
    localStorage.setItem(flag, "1");
  }
}
