const DB_NAME = "attendpro-kiosk-queue";
const STORE_NAME = "pending-clocks";
const DB_VERSION = 2;

export interface QueuedClockPayload {
  id: string;
  staffId: string;
  attemptType: "check_in" | "check_out";
  pin: string;
  photoCaptureUrl?: string;
  createdAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueClock(payload: Omit<QueuedClockPayload, "id" | "createdAt">) {
  const db = await openDb();
  const item: QueuedClockPayload = {
    ...payload,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return item.id;
}

export async function listQueuedClocks(): Promise<QueuedClockPayload[]> {
  const db = await openDb();
  const items = await new Promise<QueuedClockPayload[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as QueuedClockPayload[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeQueuedClock(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function flushQueuedClocks(
  submit: (payload: QueuedClockPayload) => Promise<{ success: boolean }>
) {
  const items = await listQueuedClocks();
  for (const item of items) {
    try {
      const result = await submit(item);
      if (result.success) await removeQueuedClock(item.id);
    } catch {
      break;
    }
  }
}
