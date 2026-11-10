import crypto from 'crypto';
import { ApiError } from '../errors';
import { requireCanonicalGameId, CanonicalGameId } from '../../config/canonicalGames';
import { getGameBalanceConfig, PROGRESSION_CONFIG, ECONOMY_BALANCE_CONFIG } from '../../config/balanceConfig';
import { CANONICAL_GAME_REGISTRY } from '../../config/gameRegistry';
import {
  getTierForRating,
  INITIAL_RATING,
  PLACEMENT_MATCHES_COUNT,
  GAME_COMPETITIVE_CONFIGS,
  RANKED_GAME_ALLOWLIST
} from '../../config/competitiveConfig';
import {
  isFirestoreAvailable,
  getDb,
  memoryStore,
  assertPersistenceOperational,
  StoredGameSession,
  StoredCompetitiveProfile,
  StoredSeason,
  StoredEconomy,
  StoredUserProgression,
  StoredLeaderboardEntry,
  StoredGameHistoryEntry,
  AnomalySeverity
} from './db';
import { calculateLevelFromXp } from './progression';
import { getUserEconomy } from './economy';
import { getActiveSeason } from './seasons';
import { recordSuspiciousScore } from './suspiciousScores';
import { invalidateSession } from './sessions';
import { getUtcDateString, getIsoWeekString } from './rewards';
import { ScoreSubmissionInput, ScoreSubmissionResult, getUserDailyGameRewardsEarned } from './scores';
import { isValidIdempotencyKey, getProcessedAction, setProcessedAction } from './idempotency';
import { computeSessionSignature, verifyClientSubmissionProof } from './security';

export interface RankedSubmissionResult extends ScoreSubmissionResult {
  oldRating: number;
  newRating: number;
  ratingChange: number;
  newTier: string;
}

export async function getCompetitiveProfile(userId: string): Promise<StoredCompetitiveProfile> {
  assertPersistenceOperational();
  const season = await getActiveSeason();

  let data: StoredCompetitiveProfile | null = null;

  if (isFirestoreAvailable()) {
    const db = getDb();
    const doc = await db.collection('competitiveProfiles').doc(userId).get();
    if (doc.exists) {
      data = doc.data() as StoredCompetitiveProfile;
    }
  } else {
    data = memoryStore.competitiveProfiles.get(userId) || null;
  }

  if (data) {
    // Handle season mismatch (soft reset logic)
    if (data.seasonId !== season.seasonId) {
      const softResetRating = (r: number) => Math.floor((r + INITIAL_RATING) / 2);
      
      const newGameRatings: Record<string, any> = {};
      Object.entries(data.gameRatings).forEach(([gid, stats]: [string, any]) => {
        const newRating = softResetRating(stats.rating);
        newGameRatings[gid] = {
          ...stats,
          rating: newRating,
          tier: getTierForRating(newRating),
          matchesPlayed: 0,
          lastUpdated: Date.now()
        };
      });

      const newGlobalRating = softResetRating(data.globalRating);
      
      const resetProfile: StoredCompetitiveProfile = {
        ...data,
        globalRating: newGlobalRating,
        globalTier: getTierForRating(newGlobalRating),
        gameRatings: newGameRatings,
        seasonId: season.seasonId,
        rankedGames: 0,
        lastUpdated: Date.now()
      };

      if (isFirestoreAvailable()) {
        const db = getDb();
        await db.collection('competitiveProfiles').doc(userId).set(resetProfile);
      } else {
        memoryStore.competitiveProfiles.set(userId, resetProfile);
      }
      return resetProfile;
    }
    return data;
  }

  // Initial Profile
  const initialProfile: StoredCompetitiveProfile = {
    userId,
    globalRating: INITIAL_RATING,
    globalTier: getTierForRating(INITIAL_RATING),
    peakGlobalRating: INITIAL_RATING,
    gameRatings: {},
    rankedGames: 0,
    lastUpdated: Date.now(),
    seasonId: season.seasonId
  };

  if (!isFirestoreAvailable()) {
    memoryStore.competitiveProfiles.set(userId, initialProfile);
  }
  return initialProfile;
}

export async function createRankedSession(userId: string, gameId: string): Promise<StoredGameSession> {
  assertPersistenceOperational();
  const canonicalId = requireCanonicalGameId(gameId);
  
  if (!RANKED_GAME_ALLOWLIST.includes(canonicalId)) {
    throw ApiError.badRequest('Game ini belum mendukung mode ranked.', 'GAME_NOT_RANKED_ELIGIBLE');
  }

  const season = await getActiveSeason();
  const sessionId = `rnk_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = computeSessionSignature(sessionId, userId, canonicalId, nonce);
  const now = Date.now();

  const session: StoredGameSession = {
    sessionId,
    userId,
    gameId: canonicalId,
    nonce,
    signature,
    startTime: now,
    expiresAt: now + (30 * 60 * 1000), // 30 min for ranked
    consumed: false,
    isRanked: true,
    seasonId: season.seasonId,
    gameVersion: '2.0.0',
    balanceVersion: '2.5.0',
    rulesetVersion: '1.0.0',
    createdAt: now
  };

  if (isFirestoreAvailable()) {
    const db = getDb();
    await db.collection('rankedSessions').doc(sessionId).set(session);
  } else {
    memoryStore.sessions.set(sessionId, session);
  }

  return session;
}

export function calculateRatingDelta(
  currentRating: number,
  score: number,
  baseScore: number,
  matchesPlayed: number
): number {
  const performanceRatio = score / baseScore;
  let delta = 0;
  const K = matchesPlayed < PLACEMENT_MATCHES_COUNT ? 60 : 30;

  if (performanceRatio >= 1.0) {
    delta = Math.min(50, Math.floor(K * (performanceRatio - 0.5)));
  } else if (performanceRatio >= 0.2) {
    delta = Math.floor(K * (performanceRatio - 0.8));
  } else {
    delta = -Math.min(25, Math.floor(K * (0.8 - performanceRatio)));
  }

  if (matchesPlayed < PLACEMENT_MATCHES_COUNT && delta < 0) {
    delta = Math.floor(delta * 0.5);
  }

  return delta;
}

export function validateSessionHard(
  session: StoredGameSession,
  userId: string,
  canonicalId: CanonicalGameId,
  activeSeason: StoredSeason
): void {
  if (!session) {
    throw ApiError.unprocessable('Sesi tidak ditemukan.', 'SESSION_NOT_FOUND');
  }
  if (session.userId !== userId) {
    throw ApiError.unprocessable('Sesi ranked bukan milik pengguna ini.', 'SESSION_USER_MISMATCH');
  }
  if (session.gameId !== canonicalId) {
    throw ApiError.unprocessable('Game Sesi tidak cocok dengan game yang dikirim.', 'SESSION_GAME_MISMATCH');
  }
  if (session.isRanked !== true) {
    throw ApiError.unprocessable('Sesi ini bukan sesi ranked.', 'INVALID_SESSION');
  }
  if (session.seasonId !== activeSeason.seasonId) {
    throw ApiError.unprocessable('Sesi ini dibuat pada season yang berbeda.', 'SESSION_EXPIRED');
  }
  if (session.consumed) {
    throw ApiError.unprocessable('Sesi ranked sudah pernah digunakan.', 'SESSION_ALREADY_CONSUMED');
  }
  if (Date.now() > session.expiresAt) {
    throw ApiError.unprocessable('Sesi ranked telah kedaluwarsa.', 'SESSION_EXPIRED');
  }
  if (!RANKED_GAME_ALLOWLIST.includes(canonicalId)) {
    throw ApiError.unprocessable('Game ini tidak valid untuk mode ranked.', 'GAME_NOT_RANKED_ELIGIBLE');
  }
  if (!session.gameVersion || session.gameVersion !== '2.0.0') {
    throw ApiError.unprocessable('Versi game tidak cocok dengan sesi.', 'INVALID_SESSION');
  }
  if (!session.balanceVersion || session.balanceVersion !== '2.5.0') {
    throw ApiError.unprocessable('Versi balancing tidak cocok dengan sesi.', 'INVALID_SESSION');
  }
  if (!session.rulesetVersion || session.rulesetVersion !== '1.0.0') {
    throw ApiError.unprocessable('Versi ruleset tidak cocok dengan sesi.', 'INVALID_SESSION');
  }
}

export async function executeRankedSubmission(input: ScoreSubmissionInput): Promise<RankedSubmissionResult> {
  assertPersistenceOperational();
  const { sessionId, userId, gameId, score, playerName, playerAvatar, durationMs, masteryLevel, idempotencyKey, nonce, signature, clientProof, requestId, clientIp } = input;
  const canonicalId = requireCanonicalGameId(gameId);
  const gameConfig = GAME_COMPETITIVE_CONFIGS[canonicalId];

  if (!gameConfig) {
    throw ApiError.badRequest('Game ini tidak valid untuk mode ranked.', 'INVALID_RANKED_GAME');
  }

  if (!idempotencyKey || !isValidIdempotencyKey(idempotencyKey)) {
    throw ApiError.badRequest('Idempotency key wajib disertakan.', 'INVALID_IDEMPOTENCY_KEY');
  }
  const idempotencyId = `ranked_${userId}_${idempotencyKey}`;

  const season = await getActiveSeason();
  const balanceConfig = getGameBalanceConfig(canonicalId);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const safeMasteryLevel = Math.min(PROGRESSION_CONFIG.masteryMaxLevel, Math.max(1, masteryLevel || 1));

  if (isFirestoreAvailable()) {
    const db = getDb();
    const idemRef = db.collection('processedActions').doc(idempotencyId);
    const sessionRef = db.collection('rankedSessions').doc(sessionId);
    const profileRef = db.collection('competitiveProfiles').doc(userId);
    const leaderRef = db.collection('rankedLeaderboards').doc(canonicalId).collection('entries').doc(userId);
    const seasonalLeaderRef = db.collection('seasonalLeaderboards')
      .doc(season.seasonId)
      .collection('games')
      .doc(canonicalId)
      .collection('entries')
      .doc(userId);

    let antiCheatError: { reason: string; duration: number; velocity: number; severity: AnomalySeverity } | null = null;
    let finalResult: RankedSubmissionResult | null = null;

    try {
      const todayStr = getUtcDateString(nowMs);
      const dailyEarnedSoFar = await getUserDailyGameRewardsEarned(userId, todayStr);

      await db.runTransaction(async (tx) => {
        const idemDoc = await tx.get(idemRef);
        if (idemDoc.exists) {
          finalResult = (idemDoc.data() as any).result as RankedSubmissionResult;
          return;
        }

        const sessDoc = await tx.get(sessionRef);
        if (!sessDoc.exists) throw ApiError.unprocessable('Sesi ranked tidak ditemukan.', 'SESSION_NOT_FOUND');
        const session = sessDoc.data() as StoredGameSession;

        validateSessionHard(session, userId, canonicalId, season);

        const verifiedDurationMs = nowMs - session.startTime;
        const durationSeconds = Math.max(verifiedDurationMs / 1000, 0.5);
        const serverVelocity = score / durationSeconds;

        const proofCheck = verifyClientSubmissionProof(session, score, nonce, clientProof, signature);
        if (!proofCheck.valid) {
          antiCheatError = {
            reason: proofCheck.reason || 'Ranked cryptographic HMAC session verification failed',
            duration: verifiedDurationMs,
            velocity: serverVelocity,
            severity: 'CRITICAL'
          };
          throw ApiError.unprocessable('Tanda tangan kriptografi atau bukti integritas sesi ranked tidak valid.', 'INVALID_SESSION_SIGNATURE');
        }

        let clientVelocity: number | undefined;
        if (typeof durationMs === 'number' && durationMs > 0) {
          const clientDurationSec = Math.max(durationMs / 1000, 0.5);
          clientVelocity = score / clientDurationSec;

          if (durationMs > verifiedDurationMs + 3000) {
            antiCheatError = {
              reason: `Ranked client duration (${durationMs}ms) exceeds verified session duration (${verifiedDurationMs}ms)`,
              duration: verifiedDurationMs,
              velocity: serverVelocity,
              severity: 'HIGH'
            };
            throw ApiError.unprocessable('Durasi tidak valid.', 'INSUFFICIENT_DURATION');
          }
        }

        if (score > balanceConfig.maxScoreCeiling) {
          antiCheatError = {
            reason: `Ranked score ${score} exceeded hard ceiling ${balanceConfig.maxScoreCeiling}`,
            duration: verifiedDurationMs,
            velocity: serverVelocity,
            severity: 'CRITICAL'
          };
          throw ApiError.unprocessable('Skor melebihi batas maksimum.', 'SCORE_CEILING_EXCEEDED');
        }
        if (score > 0 && verifiedDurationMs < balanceConfig.minDurationMs) {
          antiCheatError = {
            reason: `Ranked duration ${verifiedDurationMs}ms below min ${balanceConfig.minDurationMs}ms`,
            duration: verifiedDurationMs,
            velocity: serverVelocity,
            severity: 'HIGH'
          };
          throw ApiError.unprocessable('Durasi tidak valid.', 'INSUFFICIENT_DURATION');
        }
        if (score > 50 && (serverVelocity > balanceConfig.maxScorePerSec || (clientVelocity !== undefined && clientVelocity > balanceConfig.maxScorePerSec))) {
          const excessiveVel = Math.max(serverVelocity, clientVelocity || 0);
          antiCheatError = {
            reason: `Ranked velocity ${excessiveVel.toFixed(1)}/s exceeded limit ${balanceConfig.maxScorePerSec}/s`,
            duration: verifiedDurationMs,
            velocity: excessiveVel,
            severity: 'HIGH'
          };
          throw ApiError.unprocessable('Laju skor tidak valid.', 'SCORE_CEILING_EXCEEDED');
        }

        tx.update(sessionRef, { consumed: true, consumedAt: nowMs });

        const profileDoc = await tx.get(profileRef);
        const currentProfile: StoredCompetitiveProfile = profileDoc.exists ? (profileDoc.data() as StoredCompetitiveProfile) : {
          userId,
          globalRating: 1000,
          globalTier: getTierForRating(1000),
          peakGlobalRating: 1000,
          gameRatings: {},
          rankedGames: 0,
          lastUpdated: nowMs,
          seasonId: season.seasonId
        };

        const currentMatchStats = currentProfile.gameRatings[canonicalId] || {
          rating: 1000,
          tier: getTierForRating(1000),
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          lastUpdated: nowMs
        };

        const delta = calculateRatingDelta(currentMatchStats.rating, score, gameConfig.baseScore, currentMatchStats.matchesPlayed);
        const oldRating = currentMatchStats.rating;
        const newRating = Math.max(100, oldRating + delta);
        const newTier = getTierForRating(newRating);

        const updatedGameStats = {
          rating: newRating,
          tier: newTier,
          matchesPlayed: currentMatchStats.matchesPlayed + 1,
          wins: currentMatchStats.wins + (delta > 0 ? 1 : 0),
          losses: currentMatchStats.losses + (delta < 0 ? 1 : 0),
          lastUpdated: nowMs
        };

        currentProfile.gameRatings[canonicalId] = updatedGameStats;
        currentProfile.rankedGames += 1;
        currentProfile.lastUpdated = nowMs;

        const playedGames = Object.values(currentProfile.gameRatings);
        currentProfile.globalRating = Math.floor(playedGames.reduce((acc, curr) => acc + curr.rating, 0) / playedGames.length);
        currentProfile.globalTier = getTierForRating(currentProfile.globalRating);
        currentProfile.peakGlobalRating = Math.max(currentProfile.peakGlobalRating || 1000, currentProfile.globalRating);

        tx.set(profileRef, currentProfile);

        const entryData = {
          userId,
          playerName: playerName || 'Player',
          playerAvatar: playerAvatar || '👾',
          score,
          submittedAt: nowIso,
          gameId: canonicalId,
          masteryLevel: safeMasteryLevel,
          tier: newTier,
          rating: newRating
        };
        tx.set(leaderRef, entryData);
        tx.set(seasonalLeaderRef, entryData);

        const baseCoinsEarned = Math.min(ECONOMY_BALANCE_CONFIG.caps.maxSingleGameRewardCoins, Math.floor(score * balanceConfig.baseCoinMultiplier * 1.2)); 
        const maxAllowedToday = Math.max(0, ECONOMY_BALANCE_CONFIG.caps.maxDailyGameRewardCoins - dailyEarnedSoFar);
        const coinsEarned = Math.min(baseCoinsEarned, maxAllowedToday);

        const xpEarned = Math.min(600, Math.floor(score * balanceConfig.baseXpMultiplier * 1.5)); 
        const txId = `rnk_tx_${nowMs}_${crypto.randomBytes(8).toString('hex')}`;
        
        const ecoRef = db.collection('userEconomy').doc(userId);
        const ecoDoc = await tx.get(ecoRef);
        const currentEco: StoredEconomy = ecoDoc.exists
          ? (ecoDoc.data() as StoredEconomy)
          : { userId, coins: ECONOMY_BALANCE_CONFIG.starterCoins, totalEarned: ECONOMY_BALANCE_CONFIG.starterCoins, totalSpent: 0, lastUpdated: nowMs };

        const updatedEco: StoredEconomy = {
          userId,
          coins: currentEco.coins + coinsEarned,
          totalEarned: currentEco.totalEarned + coinsEarned,
          totalSpent: currentEco.totalSpent,
          lastUpdated: nowMs
        };
        tx.set(ecoRef, updatedEco);

        if (coinsEarned > 0) {
          const ledgerRef = db.collection('economyTransactions').doc(txId);
          tx.set(ledgerRef, {
            transactionId: txId,
            userId,
            type: 'GAME_REWARD',
            amount: coinsEarned,
            balanceBefore: currentEco.coins,
            balanceAfter: updatedEco.coins,
            reason: `RANKED_REWARD_${canonicalId.toUpperCase()}`,
            referenceId: sessionId,
            createdAt: nowIso
          });
        }

        if (xpEarned > 0) {
          const progRef = db.collection('userProgression').doc(userId);
          const progDoc = await tx.get(progRef);
          const currentProg = progDoc.exists ? (progDoc.data() as StoredUserProgression) : { userId, totalXp: 0, level: 1, lastUpdated: nowMs };
          const newTotalXp = currentProg.totalXp + xpEarned;
          tx.set(progRef, { userId, totalXp: newTotalXp, level: calculateLevelFromXp(newTotalXp), lastUpdated: nowMs });
        }

        const historyId = `hist_${nowMs}_${crypto.randomBytes(6).toString('hex')}`;
        const historyRef = db.collection('userGameHistory').doc(historyId);
        const genre = CANONICAL_GAME_REGISTRY[canonicalId]?.genre || 'Arcade';
        tx.set(historyRef, {
          historyId,
          userId,
          sessionId,
          gameId: canonicalId,
          genre,
          score,
          isPersonalBest: true,
          timestamp: nowMs,
          dateStr: getUtcDateString(nowMs),
          weekStr: getIsoWeekString(nowMs),
          seasonId: season.seasonId,
          isRanked: true
        });

        const result: RankedSubmissionResult = {
          success: true,
          gameId: canonicalId,
          score,
          coinsEarned,
          xpEarned,
          newCoinBalance: updatedEco.coins,
          leaderboards: [],
          transactionId: txId,
          oldRating,
          newRating,
          ratingChange: delta,
          newTier
        };

        tx.set(idemRef, { actionId: idempotencyId, userId, result, processedAt: nowIso });
        finalResult = result;
      });
    } catch (err) {
      if (antiCheatError) {
        await invalidateSession(sessionId, true, antiCheatError.reason);
        await recordSuspiciousScore({
          sessionId,
          userId,
          gameId: canonicalId,
          score,
          durationMs: antiCheatError.duration,
          velocity: antiCheatError.velocity,
          reason: antiCheatError.reason,
          severity: antiCheatError.severity,
          requestId,
          clientIp
        });
      }
      throw err;
    }
    return finalResult!;
  } else {
    const cached = await getProcessedAction(idempotencyId);
    if (cached) return cached as RankedSubmissionResult;

    const todayStr = getUtcDateString(nowMs);
    const dailyEarnedSoFar = await getUserDailyGameRewardsEarned(userId, todayStr);

    const session = memoryStore.sessions.get(sessionId);
    if (!session) throw ApiError.unprocessable('Sesi ranked tidak ditemukan.', 'SESSION_NOT_FOUND');

    validateSessionHard(session, userId, canonicalId, season);

    const verifiedDurationMs = nowMs - session.startTime;
    const durationSeconds = Math.max(verifiedDurationMs / 1000, 0.5);
    const serverVelocity = score / durationSeconds;

    const proofCheck = verifyClientSubmissionProof(session, score, nonce, clientProof, signature);
    if (!proofCheck.valid) {
      session.consumed = true;
      session.consumedAt = nowMs;
      await recordSuspiciousScore({
        sessionId,
        userId,
        gameId: canonicalId,
        score,
        durationMs: verifiedDurationMs,
        velocity: serverVelocity,
        reason: proofCheck.reason || 'Ranked cryptographic HMAC session verification failed',
        severity: 'CRITICAL',
        requestId,
        clientIp
      });
      throw ApiError.unprocessable('Tanda tangan kriptografi atau bukti integritas sesi ranked tidak valid.', 'INVALID_SESSION_SIGNATURE');
    }

    let clientVelocity: number | undefined;
    if (typeof durationMs === 'number' && durationMs > 0) {
      const clientDurationSec = Math.max(durationMs / 1000, 0.5);
      clientVelocity = score / clientDurationSec;

      if (durationMs > verifiedDurationMs + 3000) {
        session.consumed = true;
        session.consumedAt = nowMs;
        await recordSuspiciousScore({
          sessionId,
          userId,
          gameId: canonicalId,
          score,
          durationMs: verifiedDurationMs,
          velocity: serverVelocity,
          reason: `Ranked client duration (${durationMs}ms) exceeds verified session duration (${verifiedDurationMs}ms)`,
          severity: 'HIGH',
          requestId,
          clientIp
        });
        throw ApiError.unprocessable('Durasi tidak valid.', 'INSUFFICIENT_DURATION');
      }
    }

    if (score > balanceConfig.maxScoreCeiling) {
      session.consumed = true;
      session.consumedAt = nowMs;
      await recordSuspiciousScore({
        sessionId,
        userId,
        gameId: canonicalId,
        score,
        durationMs: verifiedDurationMs,
        velocity: serverVelocity,
        reason: `Score exceeded ceiling`,
        severity: 'CRITICAL',
        requestId,
        clientIp
      });
      throw ApiError.unprocessable('Skor melebihi batas', 'SCORE_CEILING_EXCEEDED');
    }
    if (score > 0 && verifiedDurationMs < balanceConfig.minDurationMs) {
      session.consumed = true;
      session.consumedAt = nowMs;
      await recordSuspiciousScore({
        sessionId,
        userId,
        gameId: canonicalId,
        score,
        durationMs: verifiedDurationMs,
        velocity: serverVelocity,
        reason: `Duration too short`,
        severity: 'HIGH',
        requestId,
        clientIp
      });
      throw ApiError.unprocessable('Durasi tidak valid', 'INSUFFICIENT_DURATION');
    }
    if (score > 50 && (serverVelocity > balanceConfig.maxScorePerSec || (clientVelocity !== undefined && clientVelocity > balanceConfig.maxScorePerSec))) {
      session.consumed = true;
      session.consumedAt = nowMs;
      await recordSuspiciousScore({
        sessionId,
        userId,
        gameId: canonicalId,
        score,
        durationMs: verifiedDurationMs,
        velocity: Math.max(serverVelocity, clientVelocity || 0),
        reason: `Velocity too high`,
        severity: 'HIGH',
        requestId,
        clientIp
      });
      throw ApiError.unprocessable('Laju skor tidak valid', 'SCORE_CEILING_EXCEEDED');
    }

    session.consumed = true;
    session.consumedAt = nowMs;

    const profile = memoryStore.competitiveProfiles.get(userId) || {
      userId,
      globalRating: 1000,
      globalTier: getTierForRating(1000),
      peakGlobalRating: 1000,
      gameRatings: {},
      rankedGames: 0,
      lastUpdated: nowMs,
      seasonId: season.seasonId
    };

    const currentMatchStats = profile.gameRatings[canonicalId] || {
      rating: 1000,
      tier: getTierForRating(1000),
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      lastUpdated: nowMs
    };
    const delta = calculateRatingDelta(currentMatchStats.rating, score, gameConfig.baseScore, currentMatchStats.matchesPlayed);
    const oldRating = currentMatchStats.rating;
    const newRating = Math.max(100, oldRating + delta);
    const newTier = getTierForRating(newRating);

    profile.gameRatings[canonicalId] = {
      rating: newRating,
      tier: newTier,
      matchesPlayed: currentMatchStats.matchesPlayed + 1,
      wins: currentMatchStats.wins + (delta > 0 ? 1 : 0),
      losses: currentMatchStats.losses + (delta < 0 ? 1 : 0),
      lastUpdated: nowMs
    };
    
    let totalR = 0;
    let numG = 0;
    let totalGames = 0;
    for (const [, gr] of Object.entries(profile.gameRatings)) {
      if (gr.matchesPlayed > 0) {
        totalR += gr.rating;
        numG++;
      }
      totalGames += gr.matchesPlayed;
    }
    profile.globalRating = numG > 0 ? Math.floor(totalR / numG) : 1000;
    profile.globalTier = getTierForRating(profile.globalRating);
    profile.peakGlobalRating = Math.max(profile.peakGlobalRating || 1000, profile.globalRating);
    profile.rankedGames = totalGames;
    profile.lastUpdated = nowMs;
    memoryStore.competitiveProfiles.set(userId, profile);
    
    const baseCoinsEarned = Math.min(ECONOMY_BALANCE_CONFIG.caps.maxSingleGameRewardCoins, Math.floor(score * balanceConfig.baseCoinMultiplier * 1.2)); 
    const maxAllowedToday = Math.max(0, ECONOMY_BALANCE_CONFIG.caps.maxDailyGameRewardCoins - dailyEarnedSoFar);
    const coinsEarned = Math.min(baseCoinsEarned, maxAllowedToday);

    const xpEarned = Math.min(600, Math.floor(score * balanceConfig.baseXpMultiplier * 1.5)); 
    
    const eco = await getUserEconomy(userId);
    eco.coins += coinsEarned;
    eco.totalEarned += coinsEarned;
    eco.lastUpdated = nowMs;
    memoryStore.economies.set(userId, eco);

    const txId = `rnk_tx_${nowMs}_${crypto.randomBytes(8).toString('hex')}`;
    if (coinsEarned > 0) {
      memoryStore.ledger.push({
        transactionId: txId,
        userId,
        type: 'GAME_REWARD',
        amount: coinsEarned,
        balanceBefore: eco.coins - coinsEarned,
        balanceAfter: eco.coins,
        reason: `RANKED_REWARD_${canonicalId.toUpperCase()}`,
        referenceId: sessionId,
        createdAt: nowIso
      });
    }

    if (xpEarned > 0) {
      const prog = memoryStore.userProgression.get(userId) || { userId, totalXp: 0, level: 1, lastUpdated: nowMs };
      prog.totalXp += xpEarned;
      prog.level = calculateLevelFromXp(prog.totalXp);
      prog.lastUpdated = nowMs;
      memoryStore.userProgression.set(userId, prog);
    }

    const genre = CANONICAL_GAME_REGISTRY[canonicalId]?.genre || 'Arcade';
    const historyEntry: StoredGameHistoryEntry = {
      historyId: `hist_${nowMs}_${crypto.randomBytes(6).toString('hex')}`,
      userId,
      sessionId,
      gameId: canonicalId,
      genre,
      score,
      isPersonalBest: true,
      timestamp: nowMs,
      dateStr: getUtcDateString(nowMs),
      weekStr: getIsoWeekString(nowMs),
      seasonId: season.seasonId,
      isRanked: true
    };
    memoryStore.gameHistory.push(historyEntry);

    const entryData = {
      userId,
      playerName: playerName || 'Player',
      playerAvatar: playerAvatar || '👾',
      score,
      submittedAt: nowIso,
      gameId: canonicalId,
      masteryLevel: safeMasteryLevel,
      tier: newTier,
      rating: newRating
    };

    const rankedList = memoryStore.rankedLeaderboards.get(canonicalId) || [];
    const rIdx = rankedList.findIndex(e => e.userId === userId);
    if (rIdx >= 0) {
      rankedList[rIdx] = entryData;
    } else {
      rankedList.push(entryData);
    }
    rankedList.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    memoryStore.rankedLeaderboards.set(canonicalId, rankedList);

    let seasonalGames = memoryStore.seasonalLeaderboards.get(season.seasonId);
    if (!seasonalGames) {
      seasonalGames = new Map<string, StoredLeaderboardEntry[]>();
      memoryStore.seasonalLeaderboards.set(season.seasonId, seasonalGames);
    }
    const seasonalList = seasonalGames.get(canonicalId) || [];
    const sIdx = seasonalList.findIndex(e => e.userId === userId);
    if (sIdx >= 0) {
      seasonalList[sIdx] = entryData;
    } else {
      seasonalList.push(entryData);
    }
    seasonalList.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    seasonalGames.set(canonicalId, seasonalList);

    const result: RankedSubmissionResult = {
      success: true,
      gameId: canonicalId,
      score,
      coinsEarned,
      xpEarned,
      newCoinBalance: eco.coins,
      leaderboards: [],
      transactionId: txId,
      oldRating,
      newRating,
      ratingChange: delta,
      newTier
    };

    await setProcessedAction(idempotencyId, result);
    return result;
  }
}

export interface CompetitiveIntegrityReport {
  userId: string;
  profileRating: number;
  profileTier: string;
  gamesTracked: number;
  totalRankedMatches: number;
  isConsistent: boolean;
  notes: string[];
}

export async function validateCompetitiveIntegrity(userId: string): Promise<CompetitiveIntegrityReport> {
  const profile = await getCompetitiveProfile(userId);
  const notes: string[] = [];
  let isConsistent = true;

  if (profile.globalRating < 100 || !Number.isFinite(profile.globalRating)) {
    isConsistent = false;
    notes.push(`Invalid global rating: ${profile.globalRating}`);
  }

  let calculatedMatches = 0;
  for (const [gameId, stats] of Object.entries(profile.gameRatings || {})) {
    if (stats.matchesPlayed < 0) {
      isConsistent = false;
      notes.push(`Negative matches for game ${gameId}`);
    }
    calculatedMatches += stats.matchesPlayed || 0;
  }

  const totalMatches = profile.rankedGames ?? 0;
  if (totalMatches < calculatedMatches) {
    isConsistent = false;
    notes.push(`Total matches ${totalMatches} is less than sum of game matches ${calculatedMatches}`);
  }

  return {
    userId,
    profileRating: profile.globalRating,
    profileTier: profile.globalTier,
    gamesTracked: Object.keys(profile.gameRatings || {}).length,
    totalRankedMatches: totalMatches,
    isConsistent,
    notes
  };
}
