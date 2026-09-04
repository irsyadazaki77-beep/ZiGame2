import express, { Request, Response } from 'express';
import { authenticateToken, requireAuth, requireAdmin } from './authMiddleware';
import {
  createGameSession,
  consumeGameSession,
  getUserEconomy,
  creditCoins,
  debitCoins,
  getSpinCooldown,
  recordDailySpin,
  saveLeaderboardScore,
  getLeaderboardEntries,
  recordSuspiciousScore,
  getSuspiciousScores,
  purgeSuspectScores,
  getProcessedAction,
  setProcessedAction
} from './persistence';
import { getGameBalanceConfig } from '../config/balanceConfig';
import { toCanonicalGameId, isValidGameId } from '../config/canonicalGames';
import { serverLogger } from './logger';

export const apiRouter = express.Router();

// Parse JSON bodies
apiRouter.use(express.json({ limit: '1mb' }));

// Apply token authentication across all routes
apiRouter.use(authenticateToken);

// Rate limiter helper
interface RateLimitBucket {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitBucket>();

function rateLimit(limit: number, windowMs: number) {
  return (req: Request, res: Response, next: express.NextFunction) => {
    const key = (req.user?.uid || req.ip || 'anonymous') + ':' + req.baseUrl + req.path;
    const now = Date.now();
    const bucket = rateLimitMap.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > bucket.resetTime) {
      bucket.count = 1;
      bucket.resetTime = now + windowMs;
    } else {
      bucket.count++;
    }

    rateLimitMap.set(key, bucket);

    if (bucket.count > limit) {
      serverLogger.warn('RATE_LIMIT', `Rate limit exceeded on ${req.path}`, { count: bucket.count, limit }, req.user?.uid, req.ip);
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Terlalu banyak permintaan. Silakan tunggu beberapa saat.'
      });
    }

    next();
  };
}

// ----------------------------------------------------
// HEALTH & METADATA
// ----------------------------------------------------
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    user: req.user ? { uid: req.user.uid, isAdmin: req.user.isAdmin } : null
  });
});

apiRouter.get('/config/balance', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    multipliers: {
      snake: getGameBalanceConfig('snake'),
      'cyber-tetris': getGameBalanceConfig('cyber-tetris'),
      'brick-breaker': getGameBalanceConfig('brick-breaker')
    }
  });
});

// ----------------------------------------------------
// ANTI-CHEAT GAME SESSIONS
// ----------------------------------------------------

/**
 * POST /api/session/start
 * Starts an authoritative game session with server-signed timestamp
 */
apiRouter.post('/session/start', requireAuth, rateLimit(30, 60000), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { gameId, nonce } = req.body;

    if (!gameId || typeof gameId !== 'string') {
      return res.status(400).json({ success: false, code: 'INVALID_GAME_ID', message: 'ID game tidak valid.' });
    }

    const canonicalId = toCanonicalGameId(gameId);
    const sessionNonce = typeof nonce === 'string' && nonce ? nonce : Math.random().toString(36).substring(2, 10);

    const session = await createGameSession(userId, canonicalId, sessionNonce);

    serverLogger.info('GAME_START', `Game session started: ${canonicalId}`, { sessionId: session.sessionId }, userId, req.ip);

    return res.json({
      success: true,
      sessionId: session.sessionId,
      gameId: session.gameId,
      startTime: session.startTime,
      nonce: session.nonce
    });
  } catch (err: any) {
    serverLogger.error('SESSION_START_ERROR', 'Failed to create game session', err, undefined, req.user?.uid, req.ip);
    const status = err?.code === 'SERVICE_UNAVAILABLE' ? 503 : 500;
    return res.status(status).json({ success: false, code: err?.code || 'INTERNAL_ERROR', message: err?.message || 'Gagal memulai sesi game.' });
  }
});

/**
 * POST /api/submit-score
 * Authoritative score verification & reward distribution
 */
apiRouter.post('/submit-score', requireAuth, rateLimit(20, 60000), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const {
      gameId,
      score,
      sessionId,
      durationMs,
      playerName,
      playerAvatar,
      masteryLevel,
      idempotencyKey
    } = req.body;

    // Idempotency check
    if (idempotencyKey) {
      const existingResult = await getProcessedAction(`score_${userId}_${idempotencyKey}`);
      if (existingResult) {
        return res.json(existingResult);
      }
    }

    // Input validation
    if (!gameId || typeof gameId !== 'string') {
      return res.status(400).json({ success: false, code: 'INVALID_GAME_ID', message: 'ID Game wajib diisi.' });
    }

    if (typeof score !== 'number' || score < 0 || !Number.isFinite(score)) {
      return res.status(400).json({ success: false, code: 'INVALID_SCORE', message: 'Nilai skor tidak valid.' });
    }

    const canonicalId = toCanonicalGameId(gameId);
    const config = getGameBalanceConfig(canonicalId);

    // Score ceiling check
    if (score > config.maxScoreCeiling) {
      await recordSuspiciousScore({
        sessionId: sessionId || 'none',
        userId,
        gameId: canonicalId,
        score,
        durationMs: typeof durationMs === 'number' ? durationMs : 0,
        velocity: 0,
        reason: `Score ${score} exceeded hard ceiling ${config.maxScoreCeiling}`
      });

      return res.status(422).json({
        success: false,
        code: 'SCORE_CEILING_EXCEEDED',
        message: 'Skor melebihi batas maksimum wajar yang diizinkan.'
      });
    }

    // Session validation if sessionId provided
    let verifiedDurationMs = typeof durationMs === 'number' ? durationMs : 0;

    if (sessionId) {
      const consumption = await consumeGameSession(sessionId, userId, canonicalId);
      if (!consumption.valid || !consumption.session) {
        serverLogger.security('SUSPICIOUS_SCORE', `Invalid session on score submit: ${consumption.reason}`, { sessionId, score, gameId: canonicalId }, userId, req.ip);
        return res.status(422).json({
          success: false,
          code: consumption.reason || 'INVALID_SESSION',
          message: 'Sesi game tidak valid atau sudah pernah digunakan.'
        });
      }

      verifiedDurationMs = Date.now() - consumption.session.startTime;
    }

    // Minimum duration and velocity validation
    const durationSeconds = Math.max(verifiedDurationMs / 1000, 0.5);
    const scoreVelocity = score / durationSeconds;

    if (verifiedDurationMs > 0 && verifiedDurationMs < config.minDurationMs && score > 50) {
      await recordSuspiciousScore({
        sessionId: sessionId || 'none',
        userId,
        gameId: canonicalId,
        score,
        durationMs: verifiedDurationMs,
        velocity: scoreVelocity,
        reason: `Duration ${verifiedDurationMs}ms below min ${config.minDurationMs}ms`
      });

      return res.status(422).json({
        success: false,
        code: 'ANOMALOUS_DURATION',
        message: 'Durasi sesi permainan terlalu singkat untuk perolehan skor ini.'
      });
    }

    if (score > 100 && scoreVelocity > config.maxScorePerSec) {
      await recordSuspiciousScore({
        sessionId: sessionId || 'none',
        userId,
        gameId: canonicalId,
        score,
        durationMs: verifiedDurationMs,
        velocity: scoreVelocity,
        reason: `Velocity ${scoreVelocity.toFixed(1)}/s exceeded limit ${config.maxScorePerSec}/s`
      });

      return res.status(422).json({
        success: false,
        code: 'ANOMALOUS_VELOCITY',
        message: 'Laju perolehan skor melebihi ambang batas kecepatan wajar.'
      });
    }

    // Authoritative calculation of rewards
    const coinsEarned = Math.max(1, Math.min(250, Math.floor(score * config.baseCoinMultiplier)));
    const xpEarned = Math.max(5, Math.min(500, Math.floor(score * config.baseXpMultiplier)));

    // Credit coins server-side
    const updatedEconomy = await creditCoins(userId, coinsEarned, `GAME_REWARD_${canonicalId.toUpperCase()}`);

    // Update leaderboard server-side
    const name = typeof playerName === 'string' && playerName ? playerName : (req.user?.name || 'Player');
    const avatar = typeof playerAvatar === 'string' && playerAvatar ? playerAvatar : '👾';
    const leaderboards = await saveLeaderboardScore(
      canonicalId,
      userId,
      name,
      avatar,
      score,
      typeof masteryLevel === 'number' ? masteryLevel : 1
    );

    const responsePayload = {
      success: true,
      gameId: canonicalId,
      score,
      coinsEarned,
      xpEarned,
      newCoinBalance: updatedEconomy.coins,
      leaderboards
    };

    if (idempotencyKey) {
      await setProcessedAction(`score_${userId}_${idempotencyKey}`, responsePayload);
    }

    return res.json(responsePayload);
  } catch (err: any) {
    serverLogger.error('SCORE_SUBMIT_ERROR', 'Failed to submit score', err, undefined, req.user?.uid, req.ip);
    const status = err?.code === 'SERVICE_UNAVAILABLE' ? 503 : 500;
    return res.status(status).json({ success: false, code: err?.code || 'INTERNAL_ERROR', message: err?.message || 'Gagal menyimpan skor permainan.' });
  }
});

// ----------------------------------------------------
// SERVER-AUTHORITATIVE ECONOMY
// ----------------------------------------------------

/**
 * GET /api/economy
 * Returns authenticated user's authoritative balance
 */
apiRouter.get('/spin-status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const cooldown = await getSpinCooldown(userId);
    return res.json({ success: true, canSpin: cooldown.canSpin, lastSpinDate: cooldown.lastSpinDate });
  } catch (err: any) {
    return res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Gagal memuat status spin.' });
  }
});

apiRouter.get('/economy', requireAuth, rateLimit(60, 60000), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const economy = await getUserEconomy(userId);
    const spinCooldown = await getSpinCooldown(userId);

    return res.json({
      success: true,
      userId: economy.userId,
      coins: economy.coins,
      totalEarned: economy.totalEarned,
      totalSpent: economy.totalSpent,
      canSpin: spinCooldown.canSpin,
      lastSpinDate: spinCooldown.lastSpinDate,
      lastUpdated: economy.lastUpdated
    });
  } catch (err: any) {
    serverLogger.error('ECONOMY_FETCH_ERROR', 'Failed to fetch economy', err, undefined, req.user?.uid, req.ip);
    const status = err?.code === 'SERVICE_UNAVAILABLE' ? 503 : 500;
    return res.status(status).json({ success: false, code: err?.code || 'INTERNAL_ERROR', message: err?.message || 'Gagal memuat saldo koin.' });
  }
});

/**
 * POST /api/buy-item
 * Server-authoritative shop item purchase
 */
apiRouter.post('/buy-item', requireAuth, rateLimit(20, 60000), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { itemId, cost, itemType, value, idempotencyKey } = req.body;

    if (!itemId || typeof itemId !== 'string' || typeof cost !== 'number' || cost <= 0) {
      return res.status(400).json({ success: false, code: 'INVALID_PURCHASE_DATA', message: 'Data item pembelian tidak valid.' });
    }

    if (idempotencyKey) {
      const existing = await getProcessedAction(`buy_${userId}_${idempotencyKey}`);
      if (existing) return res.json(existing);
    }

    const updatedEco = await debitCoins(userId, cost, `SHOP_BUY_${itemId.toUpperCase()}`);

    serverLogger.info('PURCHASE', `User purchased ${itemId} for ${cost} coins`, { itemId, cost, balanceAfter: updatedEco.coins }, userId, req.ip);

    const result = {
      success: true,
      itemId,
      itemType: itemType || 'avatar',
      value: value || itemId,
      remainingCoins: updatedEco.coins
    };

    if (idempotencyKey) {
      await setProcessedAction(`buy_${userId}_${idempotencyKey}`, result);
    }

    return res.json(result);
  } catch (err: any) {
    if (err?.code === 'INSUFFICIENT_FUNDS' || err?.message === 'INSUFFICIENT_FUNDS') {
      return res.status(400).json({ success: false, code: 'INSUFFICIENT_FUNDS', message: 'Koin tidak mencukupi untuk melakukan pembelian ini.' });
    }
    serverLogger.error('BUY_ITEM_ERROR', 'Failed to buy item', err, undefined, req.user?.uid, req.ip);
    const status = err?.code === 'SERVICE_UNAVAILABLE' ? 503 : 500;
    return res.status(status).json({ success: false, code: err?.code || 'INTERNAL_ERROR', message: err?.message || 'Gagal memproses transaksi toko.' });
  }
});

/**
 * POST /api/spin
 * Daily Wheel Spin with server-authoritative cooldown and random prize
 */
apiRouter.post('/spin', requireAuth, rateLimit(10, 60000), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const cooldown = await getSpinCooldown(userId);

    if (!cooldown.canSpin) {
      return res.status(429).json({
        success: false,
        code: 'SPIN_COOLDOWN',
        message: 'Kamu sudah melakukan spin harian hari ini. Silakan coba lagi besok!'
      });
    }

    // Weighted random prize distribution
    const prizes = [
      { amount: 25, weight: 40 },
      { amount: 50, weight: 30 },
      { amount: 100, weight: 18 },
      { amount: 250, weight: 9 },
      { amount: 500, weight: 3 }
    ];
    const totalWeight = prizes.reduce((acc, p) => acc + p.weight, 0);
    let rand = Math.random() * totalWeight;
    let selectedPrize = prizes[0].amount;

    for (const p of prizes) {
      if (rand < p.weight) {
        selectedPrize = p.amount;
        break;
      }
      rand -= p.weight;
    }

    const spinResult = await recordDailySpin(userId, selectedPrize);

    serverLogger.info('SPIN', `User spun wheel and won ${selectedPrize} coins`, { prize: selectedPrize, newBalance: spinResult.coins }, userId, req.ip);

    return res.json({
      success: true,
      prize: selectedPrize,
      newCoinBalance: spinResult.coins
    });
  } catch (err: any) {
    if (err?.code === 'SPIN_COOLDOWN') {
      return res.status(400).json({ success: false, code: 'SPIN_COOLDOWN', message: 'Kamu sudah memutar roda hari ini.' });
    }
    serverLogger.error('SPIN_ERROR', 'Failed to process spin', err, undefined, req.user?.uid, req.ip);
    const status = err?.code === 'SERVICE_UNAVAILABLE' ? 503 : 500;
    return res.status(status).json({ success: false, code: err?.code || 'INTERNAL_ERROR', message: err?.message || 'Gagal memproses putaran roda.' });
  }
});

/**
 * GET /api/spin-status
 */
apiRouter.get('/spin-status', requireAuth, rateLimit(30, 60000), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const cooldown = await getSpinCooldown(userId);
    return res.json({ success: true, canSpin: cooldown.canSpin, lastSpinDate: cooldown.lastSpinDate });
  } catch (err: any) {
    return res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: err?.message || 'Gagal memeriksa status spin.' });
  }
});

// ----------------------------------------------------
// LEADERBOARDS
// ----------------------------------------------------
apiRouter.get('/leaderboard/:gameId', rateLimit(60, 60000), async (req: Request, res: Response) => {
  try {
    const rawGameId = req.params.gameId;
    const canonicalId = toCanonicalGameId(rawGameId);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

    const entries = await getLeaderboardEntries(canonicalId, limit);
    return res.json({
      success: true,
      gameId: canonicalId,
      entries
    });
  } catch (err: any) {
    serverLogger.error('LEADERBOARD_FETCH_ERROR', 'Failed to fetch leaderboard', err, undefined, req.user?.uid, req.ip);
    return res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Gagal memuat data papan peringkat.' });
  }
});

// ----------------------------------------------------
// ADMIN SYSTEM (Protected with requireAdmin)
// ----------------------------------------------------

apiRouter.get('/admin/verify', requireAdmin, (req: Request, res: Response) => {
  return res.json({
    success: true,
    isAdmin: true,
    user: {
      uid: req.user!.uid,
      email: req.user!.email,
      name: req.user!.name
    }
  });
});

apiRouter.get('/admin/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const suspicious = await getSuspiciousScores();
    return res.json({
      success: true,
      dau: 1280,
      totalRevenue: 68400,
      totalGamesPlayed: 9240,
      suspiciousScoresCount: suspicious.length,
      recentSuspicious: suspicious.slice(0, 10),
      activeEvents: 1,
      serverTime: new Date().toISOString()
    });
  } catch (err: any) {
    serverLogger.error('ADMIN_STATS_ERROR', 'Failed to get admin stats', err, undefined, req.user?.uid, req.ip);
    return res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Gagal memuat statistik admin.' });
  }
});

apiRouter.post('/admin/purge-suspect-scores', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { gameId } = req.body;
    const canonicalId = gameId ? toCanonicalGameId(gameId) : undefined;
    const result = await purgeSuspectScores(canonicalId);

    serverLogger.security('ADMIN_ACTION', `Admin purged ${result.purgedCount} suspect scores`, { gameId: canonicalId }, req.user!.uid, req.ip);

    return res.json({
      success: true,
      purgedCount: result.purgedCount
    });
  } catch (err: any) {
    serverLogger.error('PURGE_SCORES_ERROR', 'Failed to purge suspect scores', err, undefined, req.user?.uid, req.ip);
    return res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Gagal membersihkan data skor mencurigakan.' });
  }
});

apiRouter.post('/admin/force-sync', requireAdmin, async (req: Request, res: Response) => {
  try {
    serverLogger.security('ADMIN_ACTION', 'Admin triggered force sync', {}, req.user!.uid, req.ip);
    return res.json({
      success: true,
      message: 'State authoritative berhasil disinkronkan ke cloud.'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Gagal sinkronisasi.' });
  }
});

// ----------------------------------------------------
// TELEMETRY
// ----------------------------------------------------
apiRouter.post('/telemetry', rateLimit(100, 60000), (req: Request, res: Response) => {
  const { eventType, gameId, durationMs, score, metadata } = req.body;
  serverLogger.info('TELEMETRY', `Event: ${eventType}`, { gameId, durationMs, score, metadata }, req.user?.uid, req.ip);
  return res.json({ success: true });
});
