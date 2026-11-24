// Autosave the working project to IndexedDB so a browser crash or closed tab
// doesn't lose links and rules. The manifest refers to local model assets.

import { parseProject, type StratumProject } from "../core/project";
import { useStore } from "./store";

const DB = "stratum";
const STORE = "autosave";
const KEY = "current";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function put(value: string): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadAutosave(): Promise<StratumProject | null> {
  try {
    const db = await open();
    const text = await new Promise<string | undefined>((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result as string | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return text ? parseProject(text) : null;
  } catch {
    return null;
  }
}

export async function clearAutosave(): Promise<void> {
  try {
    const db = await open();
    db.transaction(STORE, "readwrite").objectStore(STORE).delete(KEY);
    db.close();
  } catch {
    // Storage may be blocked (private mode); autosave is best-effort.
  }
}

/** Start saving 2 s after the last change to project data. Returns an unsubscribe function. */
export function startAutosave(snapshot: () => StratumProject, onSaved?: (at: Date) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsub = useStore.subscribe((s, prev) => {
    if (
      s.schedule === prev.schedule &&
      s.links === prev.links &&
      s.rules === prev.rules &&
      s.profiles === prev.profiles &&
      s.segments === prev.segments &&
      s.groups === prev.groups &&
      s.paths === prev.paths &&
      s.presentation === prev.presentation &&
      s.view3d === prev.view3d &&
      s.sim === prev.sim &&
      s.models === prev.models &&
      s.revisions === prev.revisions &&
      s.scheduleSource === prev.scheduleSource &&
      s.projectTitle === prev.projectTitle &&
      s.workspaceRevision === prev.workspaceRevision
    )
      return;
    if (timer) clearTimeout(timer);
    if (!s.schedule && !s.models?.files.length && !s.projectTitle) return;
    timer = setTimeout(async () => {
      try {
        await put(JSON.stringify(snapshot()));
        onSaved?.(new Date());
      } catch {
        // Quota exceeded or storage blocked: ignore, the user can still save manually.
      }
    }, 2000);
  });
  return () => {
    if (timer) clearTimeout(timer);
    unsub();
  };
}
