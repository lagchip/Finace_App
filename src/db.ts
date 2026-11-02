export type Entry = { id: string; date: string; kind: '支出' | '収入'; amount: number; category: string; memo: string; created: number };
const name = 'kakeibo-prototype';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('entries', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readEntries(): Promise<Entry[]> {
  const db = await open();
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readonly');
    const request = tx.objectStore('entries').getAll();
    request.onsuccess = () => resolve(request.result as Entry[]);
    request.onerror = () => reject(request.error);
    tx.onabort = () => reject(tx.error);
  }); } finally { db.close(); }
}
export async function saveEntry(entry: Entry): Promise<void> {
  const db = await open();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('entries', 'readwrite');
    tx.objectStore('entries').add(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }); } finally { db.close(); }
}
export async function importEntries(entries: Entry[]): Promise<number> {
  const db = await open();
  try { return await new Promise<number>((resolve, reject) => {
    const tx = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');
    const request = store.getAll();
    let count = 0;
    let conflict = false;
    request.onsuccess = () => {
      const existing = new Map((request.result as Entry[]).map(entry => [entry.id, entry]));
      for (const entry of entries) {
        const old = existing.get(entry.id);
        if (old) {
          if (old.date !== entry.date || old.kind !== entry.kind || old.amount !== entry.amount || old.category !== entry.category || old.memo !== entry.memo) { conflict = true; tx.abort(); return; }
        } else { store.add(entry); count++; }
      }
    };
    tx.oncomplete = () => resolve(count);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error(conflict ? '同じIDで内容が異なる取引があります。取り込みを中止しました。' : '取り込みに失敗しました。'));
  }); } finally { db.close(); }
}
