import crypto from 'crypto';
import { ApiError } from '../errors';
import { requireCanonicalGameId } from '../../config/canonicalGames';
import { resolveAuthoritativeReward, RewardClaimType, AUTHORITATIVE_SEASONAL_CHALLENGES } from '../../config/rewardCatalog';
import {
  getAuthoritativeDailyMissions,
  getAuthoritativeDailyChallenges,
  getAuthoritativeWeeklyChallenges
} from '../../config/authoritativeMissions';
import {
  isFirestoreAvailable,
  getDb,
  memoryStore,
  assertPersistenceOperational,
  StoredGameHistoryEntry,
  StoredEconomy,
  StoredUserProgression,
  StoredEconomyTransaction,
  StoredLeaderboardEntry
} from './db';
import { calculateLevelFromXp, getUserProgression } from './progression';
import { getUserEconomy } from './economy';
import { getCompetitiveProfile } from './competitive';
import { getProcessedAction, setProcessedAction, isValidIdempotencyKey } from './idempotency';

export function getUtcDateString(timestamp: number = Date.now()): string {
  return new Date(timestamp).toISOString().split('T')[0];
}

export function getIsoWeekString(timestamp: number = Date.now()): string {
  const date = new Date(timestamp);
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const weekFormatted = weekNo < 10 ? `0${weekNo}` : `${weekNo}`;
  return `${date.getUTCFullYear()}-W${weekFormatted}`;
}

export const CANONICAL_ACHIEVEMENT_TARGETS: Record<string, { gameId: string; target: number }> = {
  snake_glutton: { gameId: 'snake', target: 20 },
  snake_turbo: { gameId: 'snake', target: 40 },
  brick_demolisher: { gameId: 'brick-breaker', target: 150 },
  flappy_pilot: { gameId: 'flappy-pixel', target: 10 },
  flappy_god: { gameId: 'flappy-pixel', target: 25 },
  space_champion: { gameId: 'space-defender', target: 150 },
  space_god: { gameId: 'space-defender', target: 500 },
  memory_master: { gameId: 'memory-grid', target: 100 },
  memory_god: { gameId: 'memory-grid', target: 300 },
  runner_speed: { gameId: 'cyber-runner', target: 80 },
  racer_apex: { gameId: 'vaporwave-racer', target: 100 },
  tetris_grandmaster: { gameId: 'cyber-tetris', target: 150 },
  mines_sweeper: { gameId: 'cyber-mines', target: 90 },
  neon_2048_master: { gameId: 'neon-2048', target: 200 }
};

export async function getUserHighScore(userId: string, gameId: string): Promise<number> {
  const canonicalId = requireCanonicalGameId(gameId);
  if (isFirestoreAvailable()) {
    const db = getDb();
    const doc = await db.collection('leaderboards')
      .doc(canonicalId)
      .collection('entries')
      .doc(userId)
      .get();
    if (doc.exists) {
      return (doc.data() as StoredLeaderboardEntry).score || 0;
    }
  } else {
    const list = memoryStore.leaderboards.get(canonicalId) || [];
    const entry = list.find(e => e.userId === userId);
    if (entry) return entry.score;
  }
  return 0;
}

export async function getUserVerifiedAchievementsCount(userId: string): Promise<number> {
  let count = 0;
  for (const [_, req] of Object.entries(CANONICAL_ACHIEVEMENT_TARGETS)) {
    const score = await getUserHighScore(userId, req.gameId);
    if (score >= req.target) {
      count++;
    }
  }
  return count;
}

export async function getUserCumulativeScore(userId: string): Promise<number> {
  const games = ['snake', 'brick-breaker', 'flappy-pixel', 'space-defender', 'memory-grid', 'cyber-runner', 'vaporwave-racer', 'cyber-tetris', 'cyber-mines', 'neon-2048'];
  let total = 0;
  for (const g of games) {
    const score = await getUserHighScore(userId, g);
    total += score;
  }
  return total;
}

export async function hasAnyHighScore(userId: string): Promise<boolean> {
  const games = ['snake', 'brick-breaker', 'flappy-pixel', 'space-defender', 'memory-grid', 'cyber-runner', 'vaporwave-racer', 'cyber-tetris', 'cyber-mines', 'neon-2048'];
  for (const g of games) {
    const score = await getUserHighScore(userId, g);
    if (score > 0) return true;
  }
  return false;
}

export async function hasHighScoreOfAtLeast(userId: string, threshold: number): Promise<boolean> {
  const games = ['snake', 'brick-breaker', 'flappy-pixel', 'space-defender', 'memory-grid', 'cyber-runner', 'vaporwave-racer', 'cyber-tetris', 'cyber-mines', 'neon-2048'];
  for (const g of games) {
    const score = await getUserHighScore(userId, g);
    if (score >= threshold) return true;
  }
  return false;
}

export async function getCountOfGamesPlayedToday(userId: string): Promise<number> {
  const todayPrefix = new Date().toISOString().split('T')[0];
  const games = ['snake', 'brick-breaker', 'flappy-pixel', 'space-defender', 'memory-grid', 'cyber-runner', 'vaporwave-racer', 'cyber-tetris', 'cyber-mines', 'neon-2048'];
  let count = 0;
  for (const g of games) {
    const canonical = requireCanonicalGameId(g);
    if (isFirestoreAvailable()) {
      const db = getDb();
      const doc = await db.collection('leaderboards')
        .doc(canonical)
        .collection('entries')
        .doc(userId)
        .get();
      if (doc.exists) {
        const data = doc.data() as StoredLeaderboardEntry;
        if (data.submittedAt && data.submittedAt.startsWith(todayPrefix)) {
          count++;
        }
      }
    } else {
      const list = memoryStore.leaderboards.get(canonical) || [];
      const entry = list.find(e => e.userId === userId);
      if (entry && entry.submittedAt && entry.submittedAt.startsWith(todayPrefix)) {
        count++;
      }
    }
  }
  return count;
}

export async function getUserGameHistory(userId: string): Promise<StoredGameHistoryEntry[]> {
  assertPersistenceOperational();
  if (isFirestoreAvailable()) {
    const db = getDb();
    const snap = await db.collection('userGameHistory').where('userId', '==', userId).get();
    return snap.docs.map(doc => doc.data() as StoredGameHistoryEntry);
  } else {
    return memoryStore.gameHistory.filter(h => h.userId === userId);
  }
}

export async function getDailySessionHistory(userId: string, dateStr: string): Promise<StoredGameHistoryEntry[]> {
  assertPersistenceOperational();
  if (isFirestoreAvailable()) {
    const db = getDb();
    const snap = await db.collection('userGameHistory')
      .where('userId', '==', userId)
      .where('dateStr', '==', dateStr)
      .get();
    return snap.docs.map(doc => doc.data() as StoredGameHistoryEntry);
  } else {
    return memoryStore.gameHistory.filter(h => h.userId === userId && h.dateStr === dateStr);
  }
}

export async function getWeeklySessionHistory(userId: string, weekStr: string): Promise<StoredGameHistoryEntry[]> {
  assertPersistenceOperational();
  if (isFirestoreAvailable()) {
    const db = getDb();
    const snap = await db.collection('userGameHistory')
      .where('userId', '==', userId)
      .where('weekStr', '==', weekStr)
      .get();
    return snap.docs.map(doc => doc.data() as StoredGameHistoryEntry);
  } else {
    return memoryStore.gameHistory.filter(h => h.userId === userId && h.weekStr === weekStr);
  }
}

export async function executeClaimReward(
  userId: string,
  claimId: string,
  claimType: RewardClaimType = 'achievement',
  idempotencyKey?: string,
  details?: Record<string, unknown>
): Promise<{
  success: boolean;
  claimId: string;
  amount: number;
  xp: number;
  newBalance: number;
  transactionId: string;
}> {
  assertPersistenceOperational();

  if (!claimId || typeof claimId !== 'string') {
    throw ApiError.badRequest('ID klaim reward (claimId) wajib diisi.', 'INVALID_REWARD_CLAIM');
  }

  const validTypes: RewardClaimType[] = ['achievement', 'daily_mission', 'challenge', 'quest_tier', 'starter_pack', 'level_up'];
  if (!validTypes.includes(claimType)) {
    throw ApiError.badRequest('Jenis reward claim tidak valid.', 'INVALID_CLAIM_SOURCE');
  }

  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !isValidIdempotencyKey(idempotencyKey)) {
    throw ApiError.badRequest('Kunci idempotency valid wajib disertakan untuk klaim reward.', 'INVALID_IDEMPOTENCY_KEY');
  }

  // Check idempotency cache first
  const existing = await getProcessedAction(`claim_${userId}_${idempotencyKey}`);
  if (existing) return existing;

  // Resolve target number (for level_up or quest_tier)
  let targetNum: number | undefined;
  if (claimType === 'level_up') {
    targetNum = typeof details?.level === 'number' ? details.level : parseInt(claimId.replace(/\D/g, ''), 10);
    if (!targetNum || isNaN(targetNum) || targetNum < 2 || targetNum > 100) {
      throw ApiError.badRequest('Level klaim tidak valid (harus antara level 2 - 100).', 'INVALID_LEVEL');
    }
  } else if (claimType === 'quest_tier') {
    targetNum = typeof details?.tier === 'number' ? details.tier : parseInt(claimId.replace(/\D/g, ''), 10);
    if (!targetNum || isNaN(targetNum) || targetNum < 1 || targetNum > 10) {
      throw ApiError.badRequest('Quest tier tidak valid (harus antara tier 1 - 10).', 'INVALID_QUEST_TIER');
    }
  }

  // Lookup authoritative reward definition on the server
  const definition = resolveAuthoritativeReward(claimId, claimType, targetNum);
  if (!definition) {
    throw ApiError.badRequest('Definisi reward tidak ditemukan atau tidak valid.', 'INVALID_REWARD_CLAIM');
  }

  const canonicalClaimId = definition.canonicalId;

  // Server-side authoritative verification of completed requirements
  let verified = false;

  if (claimType === 'starter_pack') {
    verified = true;
  } else if (claimType === 'achievement') {
    if (claimId in CANONICAL_ACHIEVEMENT_TARGETS) {
      const req = CANONICAL_ACHIEVEMENT_TARGETS[claimId];
      const highScore = await getUserHighScore(userId, req.gameId);
      if (highScore >= req.target) {
        verified = true;
      }
    } else if (claimId === 'ach_first_win') {
      const anyScore = await hasAnyHighScore(userId);
      if (anyScore) verified = true;
    } else if (claimId === 'ach_score_500') {
      const highEnough = await hasHighScoreOfAtLeast(userId, 500);
      if (highEnough) verified = true;
    }
  } else if (claimType === 'level_up') {
    const targetLevel = targetNum || 2;
    const prog = await getUserProgression(userId);
    if (prog.level >= targetLevel) {
      verified = true;
    }
  } else if (claimType === 'quest_tier') {
    const targetTier = targetNum || 1;
    const verifiedAchCount = await getUserVerifiedAchievementsCount(userId);
    const anyScore = await hasAnyHighScore(userId);
    if (targetTier === 1 && anyScore) {
      verified = true;
    } else if (targetTier > 1 && verifiedAchCount >= targetTier - 1) {
      verified = true;
    }
  } else if (claimType === 'daily_mission') {
    const streakMatch = canonicalClaimId.match(/^streak_(\d{4}-\d{2}-\d{2})_([1-7])$/);
    const match = canonicalClaimId.match(/^m_(\d{4}-\d{2}-\d{2})_([123])$/);
    const todayUtc = getUtcDateString();

    if (streakMatch) {
      const dateStr = streakMatch[1];
      if (dateStr !== todayUtc) {
        throw ApiError.badRequest('Klaim streak harian hanya berlaku untuk tanggal aktif hari ini (UTC).', 'INVALID_REWARD_CLAIM');
      }
      verified = true;
    } else if (match) {
      const dateStr = match[1];
      if (dateStr !== todayUtc) {
        throw ApiError.badRequest('Klaim misi harian hanya berlaku untuk tanggal aktif hari ini (UTC). Klaim masa lalu atau masa depan ditolak.', 'INVALID_REWARD_CLAIM');
      }

      const missions = getAuthoritativeDailyMissions(todayUtc);
      const mission = missions.find(m => m.id === canonicalClaimId);
      if (!mission) {
        throw ApiError.badRequest('Definisi misi harian tidak ditemukan.', 'INVALID_REWARD_CLAIM');
      }

      const dailySessions = await getDailySessionHistory(userId, todayUtc);
      const countPlayedToday = await getCountOfGamesPlayedToday(userId);

      if (mission.type === 'score_target') {
        const highScore = mission.gameId ? await getUserHighScore(userId, mission.gameId) : 0;
        const sessionHigh = dailySessions.some(s => s.gameId === mission.gameId && s.score >= mission.target);
        if (sessionHigh || highScore >= mission.target) {
          verified = true;
        }
      } else if (mission.type === 'beat_pb') {
        const hasPb = dailySessions.some(s => s.isPersonalBest);
        if (hasPb) {
          verified = true;
        }
      } else if (mission.type === 'total_score') {
        const sum = dailySessions.reduce((acc, s) => acc + s.score, 0);
        if (sum >= mission.target) {
          verified = true;
        }
      } else if (mission.type === 'play_genre_count') {
        const distinctGenres = new Set(dailySessions.map(s => s.genre)).size;
        if (distinctGenres >= mission.target) {
          verified = true;
        }
      } else if (mission.type === 'play_count') {
        if (dailySessions.length >= mission.target || countPlayedToday >= mission.target) {
          verified = true;
        }
      }
    } else {
      throw ApiError.badRequest('Format ID misi harian tidak valid.', 'INVALID_REWARD_CLAIM');
    }
  } else if (claimType === 'challenge') {
    const dailyMatch = canonicalClaimId.match(/^daily_(\d{4}-\d{2}-\d{2})_([123])$/);
    const weeklyMatch = canonicalClaimId.match(/^weekly_(\d{4}-W\d{2})_([123])$/);
    const todayUtc = getUtcDateString();
    const weekUtc = getIsoWeekString();

    if (dailyMatch) {
      const dateStr = dailyMatch[1];
      if (dateStr !== todayUtc) {
        throw ApiError.badRequest('Klaim tantangan harian hanya berlaku untuk tanggal aktif hari ini (UTC). Klaim masa lalu atau masa depan ditolak.', 'INVALID_REWARD_CLAIM');
      }

      const challenges = getAuthoritativeDailyChallenges(todayUtc);
      const chal = challenges.find(c => c.id === canonicalClaimId);
      if (!chal) {
        throw ApiError.badRequest('Definisi tantangan harian tidak ditemukan.', 'INVALID_REWARD_CLAIM');
      }

      const dailySessions = await getDailySessionHistory(userId, todayUtc);
      const countPlayedToday = await getCountOfGamesPlayedToday(userId);

      if (chal.category === 'score') {
        const highScore = chal.gameId ? await getUserHighScore(userId, chal.gameId) : 0;
        const sessionHigh = dailySessions.some(s => (chal.gameId ? s.gameId === chal.gameId : true) && s.score >= chal.target);
        if (sessionHigh || highScore >= chal.target) {
          verified = true;
        }
      } else if (chal.category === 'genre') {
        const distinctGenres = new Set(dailySessions.map(s => s.genre)).size;
        if (distinctGenres >= chal.target || countPlayedToday >= chal.target) {
          verified = true;
        }
      } else if (chal.category === 'featured') {
        if (dailySessions.some(s => chal.gameId ? s.gameId === chal.gameId : true) || dailySessions.length >= 1 || countPlayedToday >= 1) {
          verified = true;
        }
      }
    } else if (weeklyMatch) {
      const weekStr = weeklyMatch[1];
      if (weekStr !== weekUtc) {
        throw ApiError.badRequest('Klaim tantangan mingguan hanya berlaku untuk minggu aktif (UTC). Klaim masa lalu atau masa depan ditolak.', 'INVALID_REWARD_CLAIM');
      }

      const challenges = getAuthoritativeWeeklyChallenges(weekUtc);
      const chal = challenges.find(c => c.id === canonicalClaimId);
      if (!chal) {
        throw ApiError.badRequest('Definisi tantangan mingguan tidak ditemukan.', 'INVALID_REWARD_CLAIM');
      }

      const weeklySessions = await getWeeklySessionHistory(userId, weekUtc);
      const achCount = await getUserVerifiedAchievementsCount(userId);
      const countPlayedToday = await getCountOfGamesPlayedToday(userId);
      const cumScore = await getUserCumulativeScore(userId);

      if (chal.category === 'personal_best') {
        const pbCount = weeklySessions.filter(s => s.isPersonalBest).length;
        if (pbCount >= chal.target || achCount >= chal.target) {
          verified = true;
        }
      } else if (chal.category === 'endurance') {
        if (weeklySessions.length >= chal.target || countPlayedToday >= chal.target) {
          verified = true;
        }
      } else if (chal.category === 'score') {
        const weeklySum = weeklySessions.reduce((acc, s) => acc + s.score, 0);
        if (weeklySum >= chal.target || cumScore >= chal.target) {
          verified = true;
        }
      }
    } else if (canonicalClaimId in AUTHORITATIVE_SEASONAL_CHALLENGES) {
      const history = await getUserGameHistory(userId);
      const comp = await getCompetitiveProfile(userId);
      const hasScore = await hasAnyHighScore(userId);
      if (history.length >= 3 || comp.rankedGames >= 1 || hasScore) {
        verified = true;
      }
    } else if (/^ch_[a-zA-Z0-9_-]{4,64}$/.test(canonicalClaimId)) {
      const history = await getUserGameHistory(userId);
      const hasScore = await hasAnyHighScore(userId);
      if (history.length >= 1 || hasScore) {
        verified = true;
      }
    } else {
      throw ApiError.badRequest('ID tantangan tidak valid atau tidak terdaftar.', 'INVALID_REWARD_CLAIM');
    }
  }

  if (!verified) {
    throw ApiError.badRequest('Persyaratan klaim reward belum terpenuhi berdasarkan verifikasi server.', 'REWARD_REQUIREMENTS_NOT_MET');
  }

  const amount = definition.rewardCoins;
  const xp = definition.rewardXp;
  const transactionId = `tx_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const nowIso = new Date().toISOString();
  let newBalance = 0;

  if (isFirestoreAvailable()) {
    const db = getDb();
    const ecoRef = db.collection('userEconomy').doc(userId);
    const progRef = db.collection('userProgression').doc(userId);
    const claimRef = db.collection('userClaimedRewards').doc(`${userId}_${canonicalClaimId}`);
    const ledgerRef = db.collection('economyTransactions').doc(transactionId);

    await db.runTransaction(async (tx) => {
      const claimDoc = await tx.get(claimRef);
      if (claimDoc.exists) {
        throw new ApiError(400, 'REWARD_ALREADY_CLAIMED', 'Reward ini sudah pernah Anda klaim sebelumnya.');
      }

      const ecoDoc = await tx.get(ecoRef);
      const current: StoredEconomy = ecoDoc.exists
        ? (ecoDoc.data() as StoredEconomy)
        : { userId, coins: 100, totalEarned: 100, totalSpent: 0, lastUpdated: Date.now() };

      const updatedEco: StoredEconomy = {
        userId,
        coins: current.coins + amount,
        totalEarned: current.totalEarned + amount,
        totalSpent: current.totalSpent,
        lastUpdated: Date.now()
      };

      tx.set(ecoRef, updatedEco);

      if (xp > 0) {
        const progDoc = await tx.get(progRef);
        const currentProg: StoredUserProgression = progDoc.exists
          ? (progDoc.data() as StoredUserProgression)
          : { userId, totalXp: 0, level: 1, lastUpdated: Date.now() };

        const newTotalXp = currentProg.totalXp + xp;
        const updatedProg: StoredUserProgression = {
          userId,
          totalXp: newTotalXp,
          level: calculateLevelFromXp(newTotalXp),
          lastUpdated: Date.now()
        };
        tx.set(progRef, updatedProg);
      }

      tx.set(claimRef, {
        userId,
        claimId: canonicalClaimId,
        originalClaimId: claimId,
        claimType,
        amount,
        xp,
        claimedAt: nowIso
      });

      const ledgerEntry: StoredEconomyTransaction = {
        transactionId,
        userId,
        type: 'QUEST_REWARD',
        amount,
        balanceBefore: current.coins,
        balanceAfter: updatedEco.coins,
        reason: `REWARD_${claimType.toUpperCase()}_${canonicalClaimId}`,
        referenceId: canonicalClaimId,
        createdAt: nowIso
      };
      tx.set(ledgerRef, ledgerEntry);

      newBalance = updatedEco.coins;
    });
  } else {
    const userClaims = memoryStore.claimedRewards.get(userId) || new Set<string>();
    if (userClaims.has(canonicalClaimId)) {
      throw new ApiError(400, 'REWARD_ALREADY_CLAIMED', 'Reward ini sudah pernah Anda klaim sebelumnya.');
    }

    const current = await getUserEconomy(userId);
    const balanceBefore = current.coins;
    current.coins += amount;
    current.totalEarned += amount;
    current.lastUpdated = Date.now();
    memoryStore.economies.set(userId, current);

    if (xp > 0) {
      let prog = memoryStore.userProgression.get(userId) || { userId, totalXp: 0, level: 1, lastUpdated: Date.now() };
      const newTotalXp = prog.totalXp + xp;
      prog = {
        userId,
        totalXp: newTotalXp,
        level: calculateLevelFromXp(newTotalXp),
        lastUpdated: Date.now()
      };
      memoryStore.userProgression.set(userId, prog);
    }

    userClaims.add(canonicalClaimId);
    memoryStore.claimedRewards.set(userId, userClaims);

    const ledgerEntry: StoredEconomyTransaction = {
      transactionId,
      userId,
      type: 'QUEST_REWARD',
      amount,
      balanceBefore,
      balanceAfter: current.coins,
      reason: `REWARD_${claimType.toUpperCase()}_${canonicalClaimId}`,
      referenceId: canonicalClaimId,
      createdAt: nowIso
    };
    memoryStore.ledger.push(ledgerEntry);
    newBalance = current.coins;
  }

  const result = {
    success: true,
    claimId: canonicalClaimId,
    amount,
    xp,
    newBalance,
    transactionId
  };

  await setProcessedAction(`claim_${userId}_${idempotencyKey}`, result);
  return result;
}
