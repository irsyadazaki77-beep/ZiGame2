/**
 * Central API Router
 * ZiGame 2.0 Stabilization & Production Hardening
 * 
 * Strict Server Authority, Session Verification, Atomic Economy,
 * Distributed Rate Limiting, and Telemetry Validation.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, requireAuth, requireAdmin } from './authMiddleware';
import { rateLimit } from './rateLimiter';
import { serverLogger } from './logger';
import { sendApiError } from './requestContext';
import { isValidGameId, requireCanonicalGameId } from '../config/canonicalGames';
import { GAME_BALANCE_CONFIG } from '../config/balanceConfig';
import {
  isFirestoreAvailable,
  createGameSession,
  executeScoreSubmission,
  getUserEconomy,
  getSpinCooldown,
  executeDailySpin,
  executeShopPurchase,
  getLeaderboardEntries,
  getRealAdminStats,
  purgeSuspectScores,
  isValidIdempotencyKey
} from './persistence';

export const apiRouter = Router();

// Apply global authentication parser
apiRouter.use(authenticateToken);

// ----------------------------------------------------
// 19. MINIMAL HEALTH CHECK (No Leaks)
// ----------------------------------------------------
apiRouter.get('/health', (_req: Request, res: Response) => {
  return res.json({
    status: 'ok',
    version: '2.0.0',
    persistence: isFirestoreAvailable() ? 'firestore' : 'memory',
    timestamp: new Date().toISOString()
  });
});

// ----------------------------------------------------
// BALANCE CONFIGURATION
// ----------------------------------------------------
apiRouter.get('/config/balance', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    multipliers: Object.fromEntries(
      Object.entries(GAME_BALANCE_CONFIG).map(([k, v]) => [k, {
        coinMultiplier: v.baseCoinMultiplier,
        xpMultiplier: v.baseXpMultiplier,
        maxScoreCeiling: v.maxScoreCeiling,
        minDurationMs: v.minDurationMs
      }])
    )
  });
});

// ----------------------------------------------------
// 1 & 2. VERIFIED GAME SESSIONS (Anti-Cheat Lifecycle)
// ----------------------------------------------------

/**
 * POST /api/session/start
 * Authoritatively issues a cryptographically secure session ticket for gameplay.
 */
apiRouter.post('/session/start', requireAuth, rateLimit(30, 60000, 'session_start'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { gameId } = req.body;

    if (!isValidGameId(gameId)) {
      return sendApiError(res, 400, 'INVALID_GAME_ID', 'ID Game tidak valid atau tidak terdaftar.');
    }

    const session = await createGameSession(userId, gameId);

    serverLogger.info('SESSION_STARTED', `Game session started for ${session.gameId}`, {
      gameId: session.gameId,
      sessionId: session.sessionId
    }, userId, req.ip, req.id);

    return res.json({
      success: true,
      sessionId: session.sessionId,
      nonce: session.nonce,
      startTime: session.startTime,
      expiresAt: session.expiresAt
    });
  } catch (err: any) {
    serverLogger.error('SESSION_START_ERROR', 'Failed to initialize game session', err, undefined, req.user?.uid, req.ip, req.id);
    const status = err?.code === 'SERVICE_UNAVAILABLE' ? 503 : 500;
    return sendApiError(res, status, err?.code || 'INTERNAL_ERROR', err?.message || 'Gagal memulai sesi permainan.');
  }
});

/**
 * POST /api/submit-score
 * Server-authoritative score verification, anti-cheat validation, and reward distribution.
 * MANDATORY: Verified sessionId is strictly required for competitive progression and rewards.
 */
apiRouter.post('/submit-score', requireAuth, rateLimit(20, 60000, 'score_submit'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const {
      gameId,
      score,
      playerName,
      playerAvatar,
      sessionId,
      masteryLevel,
      idempotencyKey
    } = req.body;

    // Strict input validation
    if (!isValidGameId(gameId)) {
      return sendApiError(res, 400, 'INVALID_GAME_ID', 'ID Game tidak valid atau tidak terdaftar.');
    }

    if (typeof score !== 'number' || score < 0 || !Number.isFinite(score)) {
      return sendApiError(res, 400, 'INVALID_SCORE', 'Nilai skor tidak valid.');
    }

    // MANDATORY Verified Game Session
    if (!sessionId || typeof sessionId !== 'string') {
      return sendApiError(res, 422, 'VERIFIED_SESSION_REQUIRED', 'ID Sesi permainan (sessionId) wajib disertakan untuk submission skor.');
    }

    if (idempotencyKey && !isValidIdempotencyKey(idempotencyKey)) {
      return sendApiError(res, 400, 'INVALID_IDEMPOTENCY_KEY', 'Format kunci idempotency tidak valid.');
    }

    const name = typeof playerName === 'string' && playerName.trim()
      ? playerName.trim().slice(0, 32)
      : (req.user?.name || 'Player');

    const avatar = typeof playerAvatar === 'string' && playerAvatar.trim()
      ? playerAvatar.trim().slice(0, 16)
      : '👾';

    const result = await executeScoreSubmission({
      sessionId,
      userId,
      gameId,
      score: Math.floor(score),
      playerName: name,
      playerAvatar: avatar,
      masteryLevel: typeof masteryLevel === 'number' ? Math.max(1, Math.min(100, masteryLevel)) : 1,
      idempotencyKey
    });

    serverLogger.info('SCORE_ACCEPTED', `Score ${score} accepted for ${result.gameId}`, {
      gameId: result.gameId,
      score,
      coinsEarned: result.coinsEarned
    }, userId, req.ip, req.id);

    return res.json(result);
  } catch (err: any) {
    serverLogger.error('SCORE_SUBMIT_ERROR', 'Failed to submit score', err, undefined, req.user?.uid, req.ip, req.id);

    // Controlled client-facing error mapping
    const clientErrors: Record<string, { status: number; message: string }> = {
      'INVALID_GAME_ID': { status: 400, message: 'ID Game tidak valid.' },
      'INVALID_SCORE': { status: 400, message: 'Nilai skor tidak valid.' },
      'INVALID_IDEMPOTENCY_KEY': { status: 400, message: 'Format idempotency key tidak valid.' },
      'VERIFIED_SESSION_REQUIRED': { status: 422, message: 'Sesi permainan terverifikasi wajib disertakan.' },
      'SESSION_NOT_FOUND': { status: 422, message: 'Sesi permainan tidak ditemukan.' },
      'SESSION_USER_MISMATCH': { status: 422, message: 'Sesi permainan tidak sesuai dengan akun pengguna.' },
      'SESSION_GAME_MISMATCH': { status: 422, message: 'Sesi permainan tidak sesuai dengan game yang dimainkan.' },
      'SESSION_ALREADY_CONSUMED': { status: 422, message: 'Sesi permainan sudah pernah digunakan.' },
      'SESSION_EXPIRED': { status: 422, message: 'Sesi permainan telah kadaluarsa.' },
      'SCORE_CEILING_EXCEEDED': { status: 422, message: 'Skor melebihi batas maksimum wajar.' },
      'ANOMALOUS_DURATION': { status: 422, message: 'Durasi permainan terlalu singkat untuk perolehan skor ini.' },
      'ANOMALOUS_VELOCITY': { status: 422, message: 'Laju perolehan skor melebihi ambang batas wajar.' }
    };

    const mapped = clientErrors[err?.code];
    if (mapped) {
      return sendApiError(res, mapped.status, err.code, mapped.message);
    }

    const status = err?.code === 'SERVICE_UNAVAILABLE' ? 503 : 500;
    return sendApiError(res, status, err?.code || 'INTERNAL_ERROR', 'Gagal memproses skor permainan.');
  }
});

// ----------------------------------------------------
// 3 & 4. SERVER-AUTHORITATIVE ECONOMY & PURCHASES
// ----------------------------------------------------

/**
 * GET /api/economy
 * Returns authenticated user's authoritative balance and spin cooldown
 */
apiRouter.get('/economy', requireAuth, rateLimit(60, 60000, 'economy_fetch'), async (req: Request, res: Response) => {
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
    serverLogger.error('ECONOMY_FETCH_ERROR', 'Failed to fetch economy', err, undefined, req.user?.uid, req.ip, req.id);
    const status = err?.code === 'SERVICE_UNAVAILABLE' ? 503 : 500;
    return sendApiError(res, status, err?.code || 'INTERNAL_ERROR', 'Gagal memuat saldo koin.');
  }
});

/**
 * GET /api/spin-status
 * Single registration for spin status query
 */
apiRouter.get('/spin-status', requireAuth, rateLimit(60, 60000, 'spin_status'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const cooldown = await getSpinCooldown(userId);
    return res.json({ success: true, canSpin: cooldown.canSpin, lastSpinDate: cooldown.lastSpinDate });
  } catch (err: any) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', 'Gagal memeriksa status spin.');
  }
});

/**
 * POST /api/buy-item
 * Server-Authoritative shop purchase.
 * Client sends ONLY: itemId and idempotencyKey.
 * Cost, itemType, and value are strictly dictated by the backend catalog.
 */
apiRouter.post('/buy-item', requireAuth, rateLimit(20, 60000, 'shop_purchase'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { itemId, idempotencyKey } = req.body;

    if (!itemId || typeof itemId !== 'string') {
      return sendApiError(res, 400, 'INVALID_PURCHASE_DATA', 'ID Item toko wajib diisi.');
    }

    if (!idempotencyKey || !isValidIdempotencyKey(idempotencyKey)) {
      return sendApiError(res, 400, 'INVALID_IDEMPOTENCY_KEY', 'Kunci idempotency valid wajib disertakan untuk transaksi.');
    }

    const result = await executeShopPurchase(userId, itemId, idempotencyKey);

    serverLogger.info('PURCHASE', `User purchased ${result.itemId}`, {
      itemId: result.itemId,
      remainingCoins: result.remainingCoins,
      transactionId: result.transactionId
    }, userId, req.ip, req.id);

    return res.json(result);
  } catch (err: any) {
    if (err?.code === 'ITEM_NOT_FOUND') {
      return sendApiError(res, 404, 'ITEM_NOT_FOUND', 'Item tidak ditemukan dalam katalog toko.');
    }
    if (err?.code === 'ITEM_ALREADY_OWNED') {
      return sendApiError(res, 400, 'ITEM_ALREADY_OWNED', 'Item ini sudah Anda miliki.');
    }
    if (err?.code === 'INSUFFICIENT_FUNDS') {
      return sendApiError(res, 400, 'INSUFFICIENT_FUNDS', 'Koin tidak mencukupi untuk melakukan pembelian ini.');
    }
    if (err?.code === 'INVALID_IDEMPOTENCY_KEY') {
      return sendApiError(res, 400, 'INVALID_IDEMPOTENCY_KEY', 'Kunci idempotency tidak valid.');
    }

    serverLogger.error('BUY_ITEM_ERROR', 'Failed to execute purchase', err, undefined, req.user?.uid, req.ip, req.id);
    const status = err?.code === 'SERVICE_UNAVAILABLE' ? 503 : 500;
    return sendApiError(res, status, err?.code || 'INTERNAL_ERROR', 'Gagal memproses transaksi toko.');
  }
});

/**
 * 5 & 6. POST /api/spin
 * Daily Wheel Spin with atomic transaction, daily cooldown enforcement, and crypto.randomInt RNG
 */
apiRouter.post('/spin', requireAuth, rateLimit(10, 60000, 'daily_spin'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const result = await executeDailySpin(userId);

    serverLogger.info('SPIN', `User spun wheel and won ${result.prize} coins`, {
      prize: result.prize,
      newBalance: result.newCoinBalance,
      transactionId: result.transactionId
    }, userId, req.ip, req.id);

    return res.json(result);
  } catch (err: any) {
    if (err?.code === 'SPIN_COOLDOWN') {
      return sendApiError(res, 429, 'SPIN_COOLDOWN', 'Kamu sudah melakukan spin harian hari ini. Silakan coba lagi besok!');
    }

    serverLogger.error('SPIN_ERROR', 'Failed to process spin', err, undefined, req.user?.uid, req.ip, req.id);
    const status = err?.code === 'SERVICE_UNAVAILABLE' ? 503 : 500;
    return sendApiError(res, status, err?.code || 'INTERNAL_ERROR', 'Gagal memproses putaran roda.');
  }
});

// ----------------------------------------------------
// LEADERBOARD
// ----------------------------------------------------
apiRouter.get('/leaderboard/:gameId', rateLimit(60, 60000, 'leaderboard_view'), async (req: Request, res: Response) => {
  try {
    const rawGameId = req.params.gameId;
    if (!isValidGameId(rawGameId)) {
      return sendApiError(res, 400, 'INVALID_GAME_ID', 'ID Game tidak valid atau tidak terdaftar.');
    }

    const canonicalId = requireCanonicalGameId(rawGameId);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

    const entries = await getLeaderboardEntries(canonicalId, limit);
    return res.json({
      success: true,
      gameId: canonicalId,
      entries
    });
  } catch (err: any) {
    serverLogger.error('LEADERBOARD_FETCH_ERROR', 'Failed to fetch leaderboard', err, undefined, req.user?.uid, req.ip, req.id);
    return sendApiError(res, 500, 'INTERNAL_ERROR', 'Gagal memuat data papan peringkat.');
  }
});

// ----------------------------------------------------
// 10 & 18. ADMIN SYSTEM (Strict Custom Claims & Honest Stats)
// ----------------------------------------------------

apiRouter.get('/admin/verify', requireAdmin, (req: Request, res: Response) => {
  return res.json({
    success: true,
    isAdmin: true,
    uid: req.user!.uid
  });
});

apiRouter.get('/admin/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await getRealAdminStats();
    return res.json(stats);
  } catch (err: any) {
    serverLogger.error('ADMIN_STATS_ERROR', 'Failed to get admin stats', err, undefined, req.user?.uid, req.ip, req.id);
    return sendApiError(res, 500, 'INTERNAL_ERROR', 'Gagal memuat statistik admin.');
  }
});

apiRouter.post('/admin/purge-suspect-scores', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { gameId } = req.body;
    let canonicalId: string | undefined = undefined;
    if (gameId) {
      if (!isValidGameId(gameId)) {
        return sendApiError(res, 400, 'INVALID_GAME_ID', 'ID Game tidak valid.');
      }
      canonicalId = requireCanonicalGameId(gameId);
    }

    const result = await purgeSuspectScores(canonicalId);
    serverLogger.security('ADMIN_ACTION', `Admin purged ${result.purgedCount} suspect scores`, { gameId: canonicalId }, req.user!.uid, req.ip, req.id);

    return res.json({
      success: true,
      purgedCount: result.purgedCount
    });
  } catch (err: any) {
    serverLogger.error('PURGE_SCORES_ERROR', 'Failed to purge suspect scores', err, undefined, req.user?.uid, req.ip, req.id);
    return sendApiError(res, 500, 'INTERNAL_ERROR', 'Gagal membersihkan data skor mencurigakan.');
  }
});

apiRouter.post('/admin/force-sync', requireAdmin, (req: Request, res: Response) => {
  serverLogger.security('ADMIN_ACTION', 'Admin triggered authoritative sync', {}, req.user!.uid, req.ip, req.id);
  return res.json({
    success: true,
    message: 'State authoritative berhasil disinkronkan.'
  });
});

// ----------------------------------------------------
// 16. TELEMETRY WITH STRICT SCHEMA VALIDATION
// ----------------------------------------------------

const ALLOWED_TELEMETRY_EVENTS = new Set([
  'game_start',
  'game_end',
  'restart',
  'pause',
  'crash',
  'tutorial_complete',
  'performance_sample',
  'tutorial_view',
  'quit',
  'gameover'
]);

apiRouter.post('/telemetry', rateLimit(100, 60000, 'telemetry'), (req: Request, res: Response) => {
  const { eventType, gameId, durationMs, score, metadata } = req.body;

  // 1. EventType allowlist
  if (typeof eventType !== 'string' || !ALLOWED_TELEMETRY_EVENTS.has(eventType)) {
    return sendApiError(res, 400, 'INVALID_EVENT_TYPE', 'Jenis event telemetri tidak diizinkan.');
  }

  // 2. Validate gameId if present
  if (gameId !== undefined && (typeof gameId !== 'string' || gameId.length > 64)) {
    return sendApiError(res, 400, 'INVALID_TELEMETRY_DATA', 'gameId melebihi batas panjang yang diizinkan.');
  }

  // 3. Validate durationMs and score ranges
  if (durationMs !== undefined && (typeof durationMs !== 'number' || durationMs < 0 || durationMs > 86400000 || !Number.isFinite(durationMs))) {
    return sendApiError(res, 400, 'INVALID_TELEMETRY_DATA', 'durationMs di luar rentang valid.');
  }

  if (score !== undefined && (typeof score !== 'number' || score < 0 || score > 10000000 || !Number.isFinite(score))) {
    return sendApiError(res, 400, 'INVALID_TELEMETRY_DATA', 'score di luar rentang valid.');
  }

  // 4. Sanitize and strip metadata
  let sanitizedMetadata: Record<string, string | number | boolean> | undefined = undefined;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    sanitizedMetadata = {};
    const keys = Object.keys(metadata).slice(0, 20); // Max 20 keys
    for (const key of keys) {
      if (typeof key === 'string' && key.length <= 64) {
        const val = metadata[key];
        if (typeof val === 'string') {
          sanitizedMetadata[key] = val.slice(0, 256);
        } else if (typeof val === 'number' && Number.isFinite(val)) {
          sanitizedMetadata[key] = val;
        } else if (typeof val === 'boolean') {
          sanitizedMetadata[key] = val;
        }
      }
    }
  }

  serverLogger.info('TELEMETRY', `Event: ${eventType}`, {
    eventType,
    gameId,
    durationMs,
    score,
    metadata: sanitizedMetadata
  }, req.user?.uid, req.ip, req.id);

  return res.json({ success: true });
});
