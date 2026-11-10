import { isFirestoreAvailable, getDb, StoredSeason } from './db';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function getDefaultFallbackSeason(now: number = Date.now()): StoredSeason {
  const current = new Date(now);
  const startOfCurrentMonthUtc = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1, 0, 0, 0, 0);
  const endAt = now + NINETY_DAYS_MS;

  return {
    seasonId: 'season_1',
    name: 'Season 1: Neon Cyber Genesis',
    startAt: startOfCurrentMonthUtc,
    endAt,
    status: 'active'
  };
}

export function isSeasonActive(season: StoredSeason, now: number = Date.now()): boolean {
  return season.status === 'active' && now >= season.startAt && now <= season.endAt;
}

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
      const season = snap.docs[0].data() as StoredSeason;
      if (isSeasonActive(season, now)) {
        return season;
      }
    }
  }

  // Dynamic active fallback season starting at the beginning of the current month and lasting 90 days ahead
  return getDefaultFallbackSeason(now);
}

