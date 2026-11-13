import { isFirestoreAvailable, getDb, StoredSeason } from './db';
import { serverLogger } from '../logger';

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
    try {
      const db = getDb();
      const snap = await db.collection('seasons')
        .where('status', '==', 'active')
        .get();

      for (const doc of snap.docs) {
        const season = doc.data() as StoredSeason;
        if (isSeasonActive(season, now)) {
          return season;
        }
      }
    } catch (err) {
      serverLogger.warn(
        'SEASONS_FIRESTORE_FALLBACK',
        'Failed to load active season from Firestore; using default fallback season.',
        { error: err instanceof Error ? err.message : String(err) }
      );
    }
  }

  // Dynamic active fallback season starting at the beginning of the current month and lasting 90 days ahead
  return getDefaultFallbackSeason(now);
}

