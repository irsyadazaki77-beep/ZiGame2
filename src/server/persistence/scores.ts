import crypto from 'crypto';
import { ApiError } from '../errors';
import { requireCanonicalGameId, CanonicalGameId } from '../../config/canonicalGames';
import { getGameBalanceConfig, PROGRESSION_CONFIG, ECONOMY_BALANCE_CONFIG } from '../../config/balanceConfig';
import { CANONICAL_GAME_REGISTRY } from '../../config/gameRegistry';
import {
  isFirestoreAvailable,
  getDb,
  memoryStore,
  assertPersistenceOperational,
  StoredGameSession,
  StoredEconomy,
  StoredUserProgression,
  StoredLeaderboardEntry,
  StoredGameHistoryEntry,
  AnomalySeverity
} from './db';
import { calculateLevelFromXp } from './progression';
import { getUserEconomy, buildDoubleEntryLedgerEntry } from './economy';
import { getLeaderboardEntries } from './leaderboard';
import { recordSuspiciousScore } from './suspiciousScores';
import { invalidateSession } from './sessions';
import { getUtcDateString, getIsoWeekString } from './rewards';
import { isValidIdempotencyKey, getProcessedAction, setProcessedAction } from './idempotency';
import { verifyClientSubmissionProof } from './security';

export interface ScoreSubmissionInput {
  sessionId: string;
  userId: string;
  gameId: string;
  score: number;
  playerName: string;
  playerAvatar: string;
  durationMs?: number;
  masteryLevel?: number;
  idempotencyKey?: string;
  nonce?: string;
  signature?: string;
  clientProof?: string;
  requestId?: string;
  clientIp?: string;
}

export interface ScoreSubmissionResult {
  success: boolean;
  gameId: CanonicalGameId;
  score: number;
  coinsEarned: number;
  xpEarned: number;
  newCoinBalance: number;
  leaderboards: StoredLeaderboardEntry[];
  transactionId: string;
}

export async function getUserDailyGameRewardsEarned(userId: string, dateStr: string): Promise<number> {
  assertPersistenceOperational();
  if (isFirestoreAvailable()) {
    const db = getDb();
    const snap = await db.collection('economyTransactions')
      .where('userId', '==', userId)
      .get();
    let total = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.type === 'GAME_REWARD' && data.createdAt && data.createdAt.startsWith(dateStr)) {
        total += data.amount || 0;
      }
    }
    return total;
  } else {
    return memoryStore.ledger
      .filter(tx => tx.userId === userId && tx.type === 'GAME_REWARD' && tx.createdAt.startsWith(dateStr))
      .reduce((sum, tx) => sum + tx.amount, 0);
  }
}

export async function executeScoreSubmission({
  sessionId,
  userId,
  gameId,
  score,
  playerName,
  playerAvatar,
  durationMs,
  masteryLevel,
  idempotencyKey,
  nonce,
  signature,
  clientProof,
  requestId,
  clientIp
}: ScoreSubmissionInput): Promise<ScoreSubmissionResult> {
  assertPersistenceOperational();

  if (!idempotencyKey || !isValidIdempotencyKey(idempotencyKey)) {
    throw ApiError.badRequest('Idempotency key wajib disertakan.', 'INVALID_IDEMPOTENCY_KEY');
  }

  // STRICT NUMERIC SAFETY AUDIT (Priority 17)
  if (typeof score !== 'number' || !Number.isInteger(score) || !Number.isFinite(score) || isNaN(score) || score < 0) {
    throw ApiError.badRequest('Nilai skor tidak valid.', 'INVALID_SCORE');
  }

  const canonicalId = requireCanonicalGameId(gameId);
  const config = getGameBalanceConfig(canonicalId);
  const idempotencyId = `score_${userId}_${idempotencyKey}`;
  const transactionId = `tx_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const genre = CANONICAL_GAME_REGISTRY[canonicalId]?.genre || 'Arcade';

  // Authoritative mastery level bound
  const safeMasteryLevel = Math.min(PROGRESSION_CONFIG.masteryMaxLevel, Math.max(1, masteryLevel || 1));

  if (isFirestoreAvailable()) {
    const db = getDb();
    const idemRef = db.collection('processedActions').doc(idempotencyId);
    const sessionRef = db.collection('gameSessions').doc(sessionId);
    const ecoRef = db.collection('userEconomy').doc(userId);
    const ledgerRef = db.collection('economyTransactions').doc(transactionId);
    const leaderRef = db.collection('leaderboards').doc(canonicalId).collection('entries').doc(userId);
    const historyId = `hist_${nowMs}_${crypto.randomBytes(6).toString('hex')}`;
    const historyRef = db.collection('userGameHistory').doc(historyId);
    const progRef = db.collection('userProgression').doc(userId);

    let antiCheatError: { reason: string; duration: number; velocity: number; severity: AnomalySeverity } | null = null;
    let finalResult: ScoreSubmissionResult | null = null;

    try {
      // Query daily rewards earned today BEFORE transaction begins (no queries allowed in runTransaction)
      const todayStr = getUtcDateString(nowMs);
      const dailyEarnedSoFar = await getUserDailyGameRewardsEarned(userId, todayStr);

      await db.runTransaction(async (tx) => {
        // 1. Idempotency Check
        const idemDoc = await tx.get(idemRef);
        if (idemDoc.exists) {
          finalResult = (idemDoc.data() as any).result as ScoreSubmissionResult;
          return;
        }

        // 2. Verified Session Required
        if (!sessionId) {
          throw ApiError.unprocessable('ID Sesi wajib disertakan.', 'VERIFIED_SESSION_REQUIRED');
        }

        const sessionDoc = await tx.get(sessionRef);
        if (!sessionDoc.exists) throw ApiError.unprocessable('Sesi tidak ditemukan.', 'SESSION_NOT_FOUND');
        const session = sessionDoc.data() as StoredGameSession;

        if (session.userId !== userId) throw ApiError.unprocessable('Sesi bukan milik Anda.', 'SESSION_USER_MISMATCH');
        if (session.gameId !== canonicalId) throw ApiError.unprocessable('Sesi game tidak cocok.', 'SESSION_GAME_MISMATCH');
        if (session.isRanked === true) {
          throw ApiError.unprocessable('Sesi ranked harus dikirimkan melalui endpoint kompetitif.', 'INVALID_SESSION');
        }
        if (session.consumed) throw ApiError.unprocessable('Sesi sudah digunakan.', 'SESSION_ALREADY_CONSUMED');
        if (nowMs > session.expiresAt) throw ApiError.unprocessable('Sesi kedaluwarsa.', 'SESSION_EXPIRED');

        // 2b. Cryptographic HMAC Session Signature & Proof Check
        const proofCheck = verifyClientSubmissionProof(session, score, nonce, clientProof, signature);
        if (!proofCheck.valid) {
          antiCheatError = {
            reason: proofCheck.reason || 'Cryptographic HMAC session verification failed',
            duration: Math.max(0, nowMs - session.startTime),
            velocity: 0,
            severity: 'CRITICAL'
          };
          throw ApiError.unprocessable('Tanda tangan kriptografi atau bukti integritas sesi tidak valid.', 'INVALID_SESSION_SIGNATURE');
        }

        // 3. Anti-Cheat & Duration Validation
        const verifiedDurationMs = nowMs - session.startTime;
        const durationSeconds = Math.max(verifiedDurationMs / 1000, 0.5);
        const serverVelocity = score / durationSeconds;

        let clientVelocity: number | undefined;
        if (typeof durationMs === 'number' && durationMs > 0) {
          const clientDurationSec = Math.max(durationMs / 1000, 0.5);
          clientVelocity = score / clientDurationSec;

          // Clock drift / client time spoofing check
          if (durationMs > verifiedDurationMs + 5000) {
            antiCheatError = {
              reason: `Client duration (${durationMs}ms) exceeds verified session duration (${verifiedDurationMs}ms)`,
              duration: verifiedDurationMs,
              velocity: serverVelocity,
              severity: 'HIGH'
            };
          }
        }

        if (score > config.maxScoreCeiling) {
          antiCheatError = {
            reason: `Score ${score} exceeded hard ceiling ${config.maxScoreCeiling}`,
            duration: verifiedDurationMs,
            velocity: serverVelocity,
            severity: 'CRITICAL'
          };
          throw ApiError.unprocessable('Skor melebihi batas maksimum.', 'SCORE_CEILING_EXCEEDED');
        }
        if (score > 0 && verifiedDurationMs < config.minDurationMs) {
          antiCheatError = {
            reason: `Duration ${verifiedDurationMs}ms below min ${config.minDurationMs}ms`,
            duration: verifiedDurationMs,
            velocity: serverVelocity,
            severity: 'HIGH'
          };
          throw ApiError.unprocessable('Durasi permainan terlalu singkat.', 'INSUFFICIENT_DURATION');
        }
        if (score > 0 && (serverVelocity > config.maxScorePerSec || (clientVelocity !== undefined && clientVelocity > config.maxScorePerSec))) {
          const excessiveVel = Math.max(serverVelocity, clientVelocity || 0);
          antiCheatError = {
            reason: `Velocity ${excessiveVel.toFixed(1)}/s exceeded limit ${config.maxScorePerSec}/s`,
            duration: verifiedDurationMs,
            velocity: excessiveVel,
            severity: 'HIGH'
          };
          throw ApiError.unprocessable('Laju perolehan skor melebihi batas wajar.', 'SCORE_CEILING_EXCEEDED');
        }

        // 4. Rewards Calculation & Caps
        const isEligibleForReward = score > 0 && verifiedDurationMs >= config.minDurationMs;
        const baseCoinsEarned = isEligibleForReward ? Math.min(ECONOMY_BALANCE_CONFIG.caps.maxSingleGameRewardCoins, Math.floor(score * config.baseCoinMultiplier)) : 0;
        
        // Enforce daily cap (Priority 15)
        const maxAllowedToday = Math.max(0, ECONOMY_BALANCE_CONFIG.caps.maxDailyGameRewardCoins - dailyEarnedSoFar);
        const coinsEarned = Math.min(baseCoinsEarned, maxAllowedToday);

        const xpEarned = isEligibleForReward ? Math.min(500, Math.floor(score * config.baseXpMultiplier)) : 0;

        // 5. Leaderboard Update
        const leaderDoc = await tx.get(leaderRef);
        const prevPb = leaderDoc.exists ? (leaderDoc.data()?.score || 0) : 0;
        const isPersonalBest = score > prevPb;

        // Anomaly Detection: Soft statistical spike flag (audit only, not blocking)
        if (isPersonalBest && prevPb > 0 && score > prevPb * 5 && score > 500) {
          recordSuspiciousScore({
            sessionId: sessionId || 'none',
            userId,
            gameId: canonicalId,
            score,
            durationMs: verifiedDurationMs,
            velocity: serverVelocity,
            reason: `Statistical score jump: ${score} vs prevPB ${prevPb}`,
            severity: 'LOW',
            flaggedOnly: true,
            requestId,
            clientIp
          }).catch(() => {});
        }

        if (isPersonalBest || !leaderDoc.exists) {
          tx.set(leaderRef, {
            userId,
            playerName: playerName.slice(0, 32),
            playerAvatar: playerAvatar.slice(0, 16),
            score,
            submittedAt: nowIso,
            gameId: canonicalId,
            masteryLevel: safeMasteryLevel
          });
        }

        // 6. Session Consumption (Atomic)
        tx.update(sessionRef, { consumed: true, consumedAt: nowMs });

        // 7. Insert History
        tx.set(historyRef, {
          historyId,
          userId,
          sessionId,
          gameId: canonicalId,
          genre,
          score,
          isPersonalBest,
          timestamp: nowMs,
          dateStr: getUtcDateString(nowMs),
          weekStr: getIsoWeekString(nowMs),
          seasonId: 'season_1',
          isRanked: false
        });

        // 8. Economy
        const ecoDoc = await tx.get(ecoRef);
        const currentEco = ecoDoc.exists
          ? (ecoDoc.data() as StoredEconomy)
          : { userId, coins: ECONOMY_BALANCE_CONFIG.starterCoins, totalEarned: ECONOMY_BALANCE_CONFIG.starterCoins, totalSpent: 0, lastUpdated: nowMs };

        let newCoinBalance = currentEco.coins;
        if (coinsEarned > 0) {
          const updatedEco = {
            ...currentEco,
            coins: currentEco.coins + coinsEarned,
            totalEarned: currentEco.totalEarned + coinsEarned,
            lastUpdated: nowMs
          };
          newCoinBalance = updatedEco.coins;
          tx.set(ecoRef, updatedEco);
          tx.set(ledgerRef, buildDoubleEntryLedgerEntry({
            transactionId,
            userId,
            type: 'GAME_REWARD',
            amount: coinsEarned,
            balanceBefore: currentEco.coins,
            balanceAfter: updatedEco.coins,
            reason: `GAME_REWARD_${canonicalId.toUpperCase()}`,
            referenceId: sessionId,
            createdAt: nowIso
          }));
        }

        // 9. Progression
        if (xpEarned > 0) {
          const progDoc = await tx.get(progRef);
          const currentProg = progDoc.exists
            ? (progDoc.data() as StoredUserProgression)
            : { userId, totalXp: 0, level: 1, lastUpdated: nowMs };
          const newTotalXp = currentProg.totalXp + xpEarned;
          tx.set(progRef, {
            userId,
            totalXp: newTotalXp,
            level: calculateLevelFromXp(newTotalXp),
            lastUpdated: nowMs
          });
        }

        // 10. Save result & Idempotency
        const result: ScoreSubmissionResult = {
          success: true,
          gameId: canonicalId,
          score,
          coinsEarned,
          xpEarned,
          newCoinBalance,
          leaderboards: [],
          transactionId
        };
        tx.set(idemRef, { actionId: idempotencyId, userId, result, processedAt: nowIso });

        finalResult = result;
      });
    } catch (err) {
      if (antiCheatError) {
        // Burn/invalidate the session so the cheater cannot reuse it
        await invalidateSession(sessionId, false, antiCheatError.reason);
        await recordSuspiciousScore({
          sessionId: sessionId || 'none',
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

    if (finalResult) {
      finalResult.leaderboards = await getLeaderboardEntries(canonicalId);
    }
    return finalResult!;
  } else {
    // Memory Fallback
    const cached = await getProcessedAction(idempotencyId);
    if (cached) return cached.result as ScoreSubmissionResult;

    if (!sessionId) throw ApiError.unprocessable('ID Sesi wajib disertakan.', 'VERIFIED_SESSION_REQUIRED');
    const session = memoryStore.sessions.get(sessionId);
    if (!session) throw ApiError.unprocessable('Sesi tidak ditemukan.', 'SESSION_NOT_FOUND');
    if (session.userId !== userId) throw ApiError.unprocessable('Sesi bukan milik Anda.', 'SESSION_USER_MISMATCH');
    if (session.gameId !== canonicalId) throw ApiError.unprocessable('Sesi game tidak cocok.', 'SESSION_GAME_MISMATCH');
    if (session.isRanked === true) {
      throw ApiError.unprocessable('Sesi ranked harus dikirimkan melalui endpoint kompetitif.', 'INVALID_SESSION');
    }
    if (session.consumed) throw ApiError.unprocessable('Sesi sudah digunakan.', 'SESSION_ALREADY_CONSUMED');
    if (nowMs > session.expiresAt) throw ApiError.unprocessable('Sesi kedaluwarsa.', 'SESSION_EXPIRED');

    const verifiedDurationMs = nowMs - session.startTime;
    const durationSeconds = Math.max(verifiedDurationMs / 1000, 0.5);
    const serverVelocity = score / durationSeconds;

    // Cryptographic HMAC Session Signature & Proof Check
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
        reason: proofCheck.reason || 'Cryptographic HMAC session verification failed',
        severity: 'CRITICAL',
        requestId,
        clientIp
      });
      throw ApiError.unprocessable('Tanda tangan kriptografi atau bukti integritas sesi tidak valid.', 'INVALID_SESSION_SIGNATURE');
    }

    let clientVelocity: number | undefined;
    if (typeof durationMs === 'number' && durationMs > 0) {
      const clientDurationSec = Math.max(durationMs / 1000, 0.5);
      clientVelocity = score / clientDurationSec;
    }

    if (score > config.maxScoreCeiling) {
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
      throw ApiError.unprocessable('Skor melebihi batas maksimum.', 'SCORE_CEILING_EXCEEDED');
    }
    if (score > 0 && verifiedDurationMs < config.minDurationMs) {
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
      throw ApiError.unprocessable('Durasi permainan terlalu singkat.', 'INSUFFICIENT_DURATION');
    }
    if (score > 0 && (serverVelocity > config.maxScorePerSec || (clientVelocity !== undefined && clientVelocity > config.maxScorePerSec))) {
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
      throw ApiError.unprocessable('Laju perolehan skor melebihi batas wajar.', 'SCORE_CEILING_EXCEEDED');
    }

    const todayStr = getUtcDateString(nowMs);
    const dailyEarnedSoFar = await getUserDailyGameRewardsEarned(userId, todayStr);
    const isEligibleForReward = score > 0 && verifiedDurationMs >= config.minDurationMs;
    const baseCoinsEarned = isEligibleForReward ? Math.min(ECONOMY_BALANCE_CONFIG.caps.maxSingleGameRewardCoins, Math.floor(score * config.baseCoinMultiplier)) : 0;
    
    // Enforce daily cap (Priority 15)
    const maxAllowedToday = Math.max(0, ECONOMY_BALANCE_CONFIG.caps.maxDailyGameRewardCoins - dailyEarnedSoFar);
    const coinsEarned = Math.min(baseCoinsEarned, maxAllowedToday);

    const xpEarned = isEligibleForReward ? Math.min(500, Math.floor(score * config.baseXpMultiplier)) : 0;

    session.consumed = true;
    session.consumedAt = nowMs;

    const list = memoryStore.leaderboards.get(canonicalId) || [];
    const idx = list.findIndex(e => e.userId === userId);
    let isPersonalBest = true;
    const prevPb = idx >= 0 ? list[idx].score : 0;

    if (idx >= 0) {
      isPersonalBest = score > list[idx].score;
      if (isPersonalBest) {
        list[idx] = {
          userId,
          playerName: playerName.slice(0, 32),
          playerAvatar: playerAvatar.slice(0, 16),
          score,
          submittedAt: nowIso,
          gameId: canonicalId,
          masteryLevel: safeMasteryLevel
        };
      }
    } else {
      list.push({
        userId,
        playerName: playerName.slice(0, 32),
        playerAvatar: playerAvatar.slice(0, 16),
        score,
        submittedAt: nowIso,
        gameId: canonicalId,
        masteryLevel: safeMasteryLevel
      });
    }
    list.sort((a, b) => b.score - a.score);
    memoryStore.leaderboards.set(canonicalId, list);

    // Soft statistical check (flag only)
    if (isPersonalBest && prevPb > 0 && score > prevPb * 5 && score > 500) {
      await recordSuspiciousScore({
        sessionId,
        userId,
        gameId: canonicalId,
        score,
        durationMs: verifiedDurationMs,
        velocity: serverVelocity,
        reason: `Statistical score jump: ${score} vs prevPB ${prevPb}`,
        severity: 'LOW',
        flaggedOnly: true,
        requestId,
        clientIp
      });
    }

    const historyEntry: StoredGameHistoryEntry = {
      historyId: `hist_${nowMs}_${crypto.randomBytes(6).toString('hex')}`,
      userId,
      sessionId,
      gameId: canonicalId,
      genre,
      score,
      isPersonalBest,
      timestamp: nowMs,
      dateStr: getUtcDateString(nowMs),
      weekStr: getIsoWeekString(nowMs),
      seasonId: 'season_1',
      isRanked: false
    };
    memoryStore.gameHistory.push(historyEntry);

    const eco = await getUserEconomy(userId);
    eco.coins += coinsEarned;
    eco.totalEarned += coinsEarned;
    eco.lastUpdated = nowMs;
    memoryStore.economies.set(userId, eco);

    if (coinsEarned > 0) {
      memoryStore.ledger.push(buildDoubleEntryLedgerEntry({
        transactionId,
        userId,
        type: 'GAME_REWARD',
        amount: coinsEarned,
        balanceBefore: eco.coins - coinsEarned,
        balanceAfter: eco.coins,
        reason: `GAME_REWARD_${canonicalId.toUpperCase()}`,
        referenceId: sessionId,
        createdAt: nowIso
      }));
    }

    if (xpEarned > 0) {
      const prog = memoryStore.userProgression.get(userId) || { userId, totalXp: 0, level: 1, lastUpdated: nowMs };
      prog.totalXp += xpEarned;
      prog.level = calculateLevelFromXp(prog.totalXp);
      prog.lastUpdated = nowMs;
      memoryStore.userProgression.set(userId, prog);
    }

    const leaderboards = await getLeaderboardEntries(canonicalId);
    const result: ScoreSubmissionResult = {
      success: true,
      gameId: canonicalId,
      score,
      coinsEarned,
      xpEarned,
      newCoinBalance: eco.coins,
      leaderboards,
      transactionId
    };

    await setProcessedAction(idempotencyId, result);
    return result;
  }
}
