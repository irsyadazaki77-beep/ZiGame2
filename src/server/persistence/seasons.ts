import { isFirestoreAvailable, getDb, StoredSeason } from './db';

export async function getActiveSeason(): Promise<StoredSeason> {
  const now = Date.now();
  if (isFirestoreAvailable()) {
    const db = getDb();
    const snap = await db.collection('seasons')
      .where('status', '==', 'active')
      .where('endAt', '>', now)
      .limit(1)
      .get();
    
    if (!snap.empty) {
      return snap.docs[0].data() as StoredSeason;
    }
  }

  // Fallback to explicit static versioned default season (no sliding dates)
  return {
    seasonId: 'season_1',
    name: 'Season 1: Neon Cyber Genesis',
    startAt: 1785542400000, // Fixed: Aug 1, 2026
    endAt: 1790812799000,   // Fixed: Sep 30, 2026
    status: 'active'
  };
}
