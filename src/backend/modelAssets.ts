/** Raw model files are local to this browser profile or desktop installation.
 * Manifests can be shared without copying a large binary into every project. */
const DATABASE = "stratum-model-files";
const STORE = "files";

export async function modelHash(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function access<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DATABASE, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      try {
        const req = operation(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onabort = () => reject(tx.error ?? req.error ?? new Error("Armazenamento local indisponível."));
      } catch (error) {
        tx.abort();
        reject(error);
      }
    });
  } finally {
    db.close();
  }
}

export async function saveModelAsset(hash: string, file: Blob): Promise<void> {
  await access("readwrite", (store) => store.put(file, hash));
}

export async function saveModelAssets(files: ReadonlyMap<string, Blob>): Promise<void> {
  if (!files.size) return;
  await access("readwrite", (store) => {
    let last: IDBRequest<IDBValidKey> | undefined;
    for (const [hash, file] of files) last = store.put(file, hash);
    return last!;
  });
}

export function getModelAsset(hash: string): Promise<Blob | undefined> {
  return access("readonly", (store) => store.get(hash) as IDBRequest<Blob | undefined>);
}
