import { requireCanonicalGameId } from '../../config/canonicalGames';
import { isFirestoreAvailable, getDb, memoryStore, assertPersistenceOperational, StoredLeaderboardEntry } from './db';

export async function getLeaderboardEntries(gameId: string, limit = 50): Promise<StoredLeaderboardEntry[]> {
  assertPersistenceOperational();
  const canonicalId = requireCanonicalGameId(gameId);

  if (isFirestoreAvailable()) {
    const db = getDb();
    const snapshot = await db.collection('leaderboards')
      .doc(canonicalId)
      .collection('entries')
      .orderBy('score', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(d => d.data() as StoredLeaderboardEntry);
  } else {
    const list = memoryStore.leaderboards.get(canonicalId) || [];
    return list.slice(0, limit);
  }
}

export async function getRankedLeaderboardEntries(gameId: string, limit = 50): Promise<StoredLeaderboardEntry[]> {
  assertPersistenceOperational();
  const canonicalId = requireCanonicalGameId(gameId);

  if (isFirestoreAvailable()) {
    const db = getDb();
    const snapshot = await db.collection('rankedLeaderboards')
      .doc(canonicalId)
      .collection('entries')
      .orderBy('rating', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(d => d.data() as StoredLeaderboardEntry);
  } else {
    const list = memoryStore.rankedLeaderboards.get(canonicalId) || [];
    return list.slice(0, limit);
  }
}

export async function getRankedLeaderboardWithContext(
  gameId: string,
  userId?: string,
  limit = 50
): Promise<{ entries: StoredLeaderboardEntry[]; userRank?: number; userEntry?: StoredLeaderboardEntry }> {
  assertPersistenceOperational();
  const canonicalId = requireCanonicalGameId(gameId);
  const result: { entries: StoredLeaderboardEntry[]; userRank?: number; userEntry?: StoredLeaderboardEntry } = { entries: [] };

  if (isFirestoreAvailable()) {
    const db = getDb();
    const leaderboardCol = db.collection('rankedLeaderboards').doc(canonicalId).collection('entries');
    
    // 1. Fetch Top Entries
    const topSnapshot = await leaderboardCol
      .orderBy('rating', 'desc')
      .limit(limit)
      .get();
    
    result.entries = topSnapshot.docs.map((d, i) => ({ ...d.data() as StoredLeaderboardEntry, rank: i + 1 }));

    // 2. If userId provided, find their rank and entry
    if (userId) {
      const userDoc = await leaderboardCol.doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data() as StoredLeaderboardEntry;
        result.userEntry = userData;
        
        // Count entries with higher rating to find rank
        const rankSnapshot = await leaderboardCol
          .where('rating', '>', userData.rating)
          .count()
          .get();
        
        result.userRank = rankSnapshot.data().count + 1;
        result.userEntry.rank = result.userRank;
      }
    }
  } else {
    const list = memoryStore.rankedLeaderboards.get(canonicalId) || [];
    result.entries = list.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 }));
    if (userId) {
      const userIdx = list.findIndex(e => e.userId === userId);
      if (userIdx >= 0) {
        result.userEntry = { ...list[userIdx], rank: userIdx + 1 };
        result.userRank = userIdx + 1;
      }
    }
  }
  return result;
}

export async function getSeasonalLeaderboardEntries(seasonId: string, gameId: string, limit = 50): Promise<StoredLeaderboardEntry[]> {
  assertPersistenceOperational();
  const canonicalId = requireCanonicalGameId(gameId);

  if (isFirestoreAvailable()) {
    const db = getDb();
    const snapshot = await db.collection('seasonalLeaderboards')
      .doc(seasonId)
      .collection('games')
      .doc(canonicalId)
      .collection('entries')
      .orderBy('rating', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(d => d.data() as StoredLeaderboardEntry);
  } else {
    const seasonGames = memoryStore.seasonalLeaderboards.get(seasonId);
    if (seasonGames) {
      const list = seasonGames.get(canonicalId) || [];
      return list.slice(0, limit);
    }
    return [];
  }
}
