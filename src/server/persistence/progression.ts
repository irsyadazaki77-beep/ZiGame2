import { isFirestoreAvailable, getDb, memoryStore, assertPersistenceOperational, StoredUserProgression } from './db';

export function getXpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  let totalXp = 0;
  for (let i = 1; i < level; i++) {
    if (i < 10) totalXp += i * 150;
    else if (i < 30) totalXp += 1350 + (i - 9) * 300;
    else totalXp += 7350 + (i - 29) * 600;
  }
  return totalXp;
}

export function calculateLevelFromXp(totalXp: number): number {
  let level = 1;
  while (true) {
    const nextLevelXp = getXpRequiredForLevel(level + 1);
    if (totalXp >= nextLevelXp) {
      level++;
    } else {
      return level;
    }
  }
}

export async function getUserProgression(userId: string): Promise<StoredUserProgression> {
  assertPersistenceOperational();
  if (isFirestoreAvailable()) {
    const db = getDb();
    const doc = await db.collection('userProgression').doc(userId).get();
    if (doc.exists) {
      return doc.data() as StoredUserProgression;
    }
    const initial: StoredUserProgression = {
      userId,
      totalXp: 0,
      level: 1,
      lastUpdated: Date.now()
    };
    await db.collection('userProgression').doc(userId).set(initial);
    return initial;
  } else {
    let prog = memoryStore.userProgression.get(userId);
    if (!prog) {
      prog = {
        userId,
        totalXp: 0,
        level: 1,
        lastUpdated: Date.now()
      };
      memoryStore.userProgression.set(userId, prog);
    }
    return prog;
  }
}
