import { isFirestoreAvailable, getDb, memoryStore } from './db';

export function isValidIdempotencyKey(key: unknown): key is string {
  if (typeof key !== 'string') return false;
  return /^[a-zA-Z0-9_\-:]{8,128}$/.test(key);
}

export async function getProcessedAction(key: string): Promise<any | null> {
  if (isFirestoreAvailable()) {
    const db = getDb();
    const doc = await db.collection('processedActions').doc(key).get();
    return doc.exists ? doc.data()?.result : null;
  } else {
    const item = memoryStore.processedActions.get(key);
    return item ? item.result : null;
  }
}

export async function setProcessedAction(key: string, result: any): Promise<void> {
  if (isFirestoreAvailable()) {
    const db = getDb();
    await db.collection('processedActions').doc(key).set({
      result,
      timestamp: Date.now()
    });
  } else {
    memoryStore.processedActions.set(key, { result, timestamp: Date.now() });
  }
}
