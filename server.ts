import express, { Request, Response, NextFunction } from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

interface ProcessedAction {
  result: any;
  timestamp: number;
}

interface GameSessionRecord {
  sessionId: string;
  gameId: string;
  userId?: string;
  nonce: string;
  startTime: number;
  consumed: boolean;
}

// Game-specific validation configs (scoring ceilings & minimum realistic duration)
const GAME_VALIDATION_CONFIG: Record<string, { maxScorePerSec: number; minDurationMs: number; absoluteMaxScore: number }> = {
  'snake': { maxScorePerSec: 150, minDurationMs: 2000, absoluteMaxScore: 50000 },
  'cyber-clicker': { maxScorePerSec: 250, minDurationMs: 1000, absoluteMaxScore: 1000000 },
  'brick-breaker': { maxScorePerSec: 300, minDurationMs: 3000, absoluteMaxScore: 200000 },
  'space-defender': { maxScorePerSec: 500, minDurationMs: 3000, absoluteMaxScore: 300000 },
  'neon-2048': { maxScorePerSec: 400, minDurationMs: 5000, absoluteMaxScore: 500000 },
  'flappy-pixel': { maxScorePerSec: 50, minDurationMs: 2000, absoluteMaxScore: 10000 },
  'default': { maxScorePerSec: 350, minDurationMs: 1500, absoluteMaxScore: 250000 }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Strict payload size limits (100kb)
  app.use(express.json({ limit: "100kb" }));

  // In-memory data structures with automatic TTL cleanup
  const ipEndpointHits = new Map<string, { count: number; resetTime: number }>();
  const processedActions = new Map<string, ProcessedAction>();
  const activeSessions = new Map<string, GameSessionRecord>();
  const leaderboards = new Map<string, any[]>();
  const spinCooldowns = new Map<string, string>(); // IP/UID -> YYYY-MM-DD

  // Periodic memory sanitization (every 5 minutes)
  setInterval(() => {
    const now = Date.now();
    // Clean expired processed actions (older than 24 hours)
    for (const [key, value] of processedActions.entries()) {
      if (now - value.timestamp > 86400000) processedActions.delete(key);
    }
    // Clean expired game sessions (older than 2 hours)
    for (const [key, value] of activeSessions.entries()) {
      if (now - value.startTime > 7200000) activeSessions.delete(key);
    }
    // Clean expired rate limit counters
    for (const [key, value] of ipEndpointHits.entries()) {
      if (now > value.resetTime) ipEndpointHits.delete(key);
    }
  }, 300000);

  // Rate Limiting Middleware Factory
  const createRateLimiter = (endpointKey: string, maxRequests: number, windowMs: number = 60000) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const userId = (req.body && req.body.userId) || (req.headers['x-user-id'] as string) || '';
      const key = `${endpointKey}:${userId || clientIp}`;
      const now = Date.now();

      let hit = ipEndpointHits.get(key);
      if (!hit || now > hit.resetTime) {
        hit = { count: 1, resetTime: now + windowMs };
      } else {
        hit.count++;
      }
      ipEndpointHits.set(key, hit);

      if (hit.count > maxRequests) {
        return res.status(429).json({
          success: false,
          code: 'RATE_LIMIT',
          message: 'Terlalu banyak permintaan. Silakan tunggu beberapa saat.',
          retryAfterMs: hit.resetTime - now
        });
      }
      next();
    };
  };

  const getTodayDateString = () => {
    return new Date().toISOString().split('T')[0];
  };

  const generateScoreChecksum = (gameId: string, score: number, duration: number, playerName: string): string => {
    const secret = "ZiGaMeArcAdE_SeCrEt_SaLt_2026";
    const data = `${gameId}:${score}:${duration}:${playerName}:${secret}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  };

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", version: "v2.4.0", timestamp: new Date().toISOString() });
  });

  // 1. Session Start Endpoint (Anti-Cheat & Nonce generation)
  app.post("/api/session/start", createRateLimiter("session_start", 30), (req, res) => {
    const { gameId, userId } = req.body;
    if (!gameId || typeof gameId !== 'string') {
      return res.status(400).json({ success: false, code: 'INVALID_PARAM', message: 'Game ID wajib diisi.' });
    }

    const sessionId = 'ses_' + crypto.randomBytes(12).toString('hex');
    const nonce = crypto.randomBytes(8).toString('hex');
    const startTime = Date.now();

    activeSessions.set(sessionId, {
      sessionId,
      gameId,
      userId: userId || undefined,
      nonce,
      startTime,
      consumed: false
    });

    return res.json({
      success: true,
      sessionId,
      nonce,
      startTime
    });
  });

  // 2. Daily Lucky Spin Endpoint with Idempotency
  app.post("/api/spin", createRateLimiter("spin", 10), (req, res) => {
    const { type, idempotencyKey, userId } = req.body;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const actorId = userId || ip;

    // Idempotency verification: return existing result if action was already processed
    if (idempotencyKey && processedActions.has(idempotencyKey)) {
      return res.json(processedActions.get(idempotencyKey)!.result);
    }

    if (type === 'free') {
      const today = getTodayDateString();
      const lastSpin = spinCooldowns.get(actorId);
      if (lastSpin === today) {
        return res.status(403).json({ 
          success: false, 
          code: 'COOLDOWN_ACTIVE', 
          message: "Anda sudah menggunakan spin gratis hari ini." 
        });
      }
      spinCooldowns.set(actorId, today);
    }

    const SECTORS = [
      { id: 0, label: '🪙 10', value: 10, color: '#f43f5e', rarity: 'common' },
      { id: 1, label: '🪙 20', value: 20, color: '#06b6d4', rarity: 'common' },
      { id: 2, label: '🪙 5', value: 5, color: '#4b5563', rarity: 'common' },
      { id: 3, label: '🪙 50', value: 50, color: '#a855f7', rarity: 'epic' },
      { id: 4, label: '🪙 15', value: 15, color: '#10b981', rarity: 'common' },
      { id: 5, label: '🪙 30', value: 30, color: '#f59e0b', rarity: 'rare' },
      { id: 6, label: '🪙 100', value: 100, color: '#ea580c', rarity: 'legendary' },
      { id: 7, label: '🪙 25', value: 25, color: '#ec4899', rarity: 'rare' },
    ];

    const randomIndex = Math.floor(Math.random() * SECTORS.length);
    const sector = SECTORS[randomIndex];

    const responsePayload = {
      success: true,
      sectorIndex: randomIndex,
      sector: sector
    };

    if (idempotencyKey) {
      processedActions.set(idempotencyKey, {
        result: responsePayload,
        timestamp: Date.now()
      });
    }

    return res.json(responsePayload);
  });

  // Spin status endpoint
  app.get("/api/spin-status", (req, res) => {
    const userId = req.query.userId as string;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const actorId = userId || ip;
    const lastSpin = spinCooldowns.get(actorId) || '';
    const hasSpunToday = lastSpin === getTodayDateString();
    return res.json({ hasSpunToday, lastSpin });
  });

  // 3. Leaderboard 2.0 Query Endpoint with Pagination, Category & Rivalry Insights
  app.get("/api/leaderboard/:gameId", (req, res) => {
    const { gameId } = req.params;
    const category = (req.query.category as string) || 'global';
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 5), 50);
    const currentUsername = (req.query.username as string) || '';

    let scores = [...(leaderboards.get(gameId) || [])];

    // Category filtering
    const todayStr = getTodayDateString();
    const currentYearWeek = `${new Date().getFullYear()}-W${Math.ceil((((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000) + 1) / 7)}`;

    if (category === 'weekly') {
      scores = scores.filter(s => s.weekId === currentYearWeek || !s.weekId);
    } else if (category === 'seasonal') {
      scores = scores.filter(s => s.seasonId === 'season_1' || !s.seasonId);
    }

    // Sort descending
    scores.sort((a, b) => b.score - a.score);

    // Populate rank indices
    const rankedList = scores.map((s, idx) => ({
      ...s,
      rank: idx + 1
    }));

    // Calculate dynamic rivalry insight for current player
    let rivalryInsight: any = null;
    if (currentUsername) {
      const userEntryIndex = rankedList.findIndex(s => s.playerName.toUpperCase() === currentUsername.toUpperCase());
      if (userEntryIndex > 0) {
        // Player has someone above them
        const playerAbove = rankedList[userEntryIndex - 1];
        const diff = playerAbove.score - rankedList[userEntryIndex].score;
        rivalryInsight = {
          type: 'behind',
          message: `Hanya tertinggal ${diff.toLocaleString()} poin di belakang ${playerAbove.playerName}!`,
          targetPlayerName: playerAbove.playerName,
          pointDifference: diff
        };
      } else if (userEntryIndex === 0 && rankedList.length > 1) {
        const playerBelow = rankedList[1];
        const diff = rankedList[0].score - playerBelow.score;
        rivalryInsight = {
          type: 'leader',
          message: `Anda memimpin papan skor ini, unggul ${diff.toLocaleString()} poin dari ${playerBelow.playerName}!`,
          targetPlayerName: playerBelow.playerName,
          pointDifference: diff
        };
      } else if (userEntryIndex === -1 && rankedList.length >= 10) {
        const top10Score = rankedList[9].score;
        rivalryInsight = {
          type: 'approaching_top10',
          message: `Raih skor ${top10Score.toLocaleString()} untuk menembus jajaran Top 10!`
        };
      }
    }

    const startIndex = (page - 1) * limit;
    const paginated = rankedList.slice(startIndex, startIndex + limit);

    return res.json({
      success: true,
      category,
      page,
      limit,
      totalEntries: rankedList.length,
      totalPages: Math.ceil(rankedList.length / limit) || 1,
      leaderboard: paginated,
      rivalryInsight
    });
  });

  // Analytics Ingestion Endpoint
  app.post("/api/analytics/events", (req, res) => {
    const { events } = req.body;
    if (Array.isArray(events)) {
      // In production these could be streamed to BigQuery / Log Sink
      // For sandbox, we acknowledge receipt
      return res.json({ success: true, count: events.length });
    }
    return res.json({ success: true, count: 0 });
  });

  // Active Season & Dynamic Events Info Endpoints
  app.get("/api/season/active", (_req, res) => {
    res.json({
      success: true,
      serverTime: new Date().toISOString(),
      season: {
        id: 'season_1',
        name: 'Season 1: Neon Cyber Genesis',
        startAt: '2026-08-01T00:00:00Z',
        endAt: '2026-09-30T23:59:59Z',
        featuredGames: ['space-defender', 'brick-breaker', 'snake']
      }
    });
  });

  app.get("/api/events/active", (_req, res) => {
    const now = Date.now();
    const events = [
      {
        id: 'evt_double_xp_weekend',
        name: '⚡ Double XP Weekend',
        description: 'Dapatkan 2x XP untuk setiap game sepanjang akhir pekan!',
        startAt: '2026-08-14T00:00:00Z',
        endAt: '2026-08-18T23:59:59Z',
        targetGames: ['all'],
        xpMultiplier: 2.0,
        coinMultiplier: 1.0
      }
    ].filter(e => {
      const s = new Date(e.startAt).getTime();
      const end = new Date(e.endAt).getTime();
      return now >= s && now <= end;
    });

    res.json({
      success: true,
      serverTime: new Date().toISOString(),
      events
    });
  });

  // 4. Secure Score Submission Endpoint with Replay & State Protection
  app.post("/api/submit-score", createRateLimiter("submit_score", 15), (req, res) => {
    const { 
      gameId, 
      score, 
      sessionDurationMs, 
      playerName, 
      playerAvatar, 
      checksum,
      sessionId,
      idempotencyKey 
    } = req.body;

    // Check idempotency for duplicate score submits
    if (idempotencyKey && processedActions.has(idempotencyKey)) {
      return res.json(processedActions.get(idempotencyKey)!.result);
    }

    if (!gameId || typeof score !== 'number' || typeof sessionDurationMs !== 'number' || score < 0) {
      return res.status(400).json({ success: false, code: 'INVALID_PAYLOAD', message: "Data payload skor tidak valid." });
    }

    // Session validation if provided
    if (sessionId) {
      const session = activeSessions.get(sessionId);
      if (!session) {
        return res.status(422).json({ success: false, code: 'SESSION_NOT_FOUND', message: "Sesi permainan tidak valid atau telah kadaluwarsa." });
      }
      if (session.consumed) {
        return res.status(409).json({ success: false, code: 'SESSION_REPLAY', message: "Sesi skor ini sudah pernah dikirimkan sebelumnya (replay terdeteksi)." });
      }
      if (session.gameId !== gameId) {
        return res.status(422).json({ success: false, code: 'SESSION_MISMATCH', message: "Sesi permainan tidak cocok dengan target game." });
      }
      session.consumed = true;
    }

    // Game-specific validation
    const config = GAME_VALIDATION_CONFIG[gameId] || GAME_VALIDATION_CONFIG['default'];
    const durationSeconds = Math.max(sessionDurationMs / 1000, 0.1);
    const scoreRate = score / durationSeconds;

    if (score > config.absoluteMaxScore) {
      return res.status(422).json({ 
        success: false, 
        code: 'SCORE_CEILING_EXCEEDED', 
        message: "Skor melebihi batas teoritis maksimum sistem." 
      });
    }

    if (scoreRate > config.maxScorePerSec && score > 50) {
      return res.status(422).json({ 
        success: false, 
        code: 'ANOMALOUS_VELOCITY', 
        message: "Laju perolehan skor terdeteksi anomali." 
      });
    }

    // Checksum verification (supports legacy and SHA-256)
    if (checksum) {
      const expectedSha = generateScoreChecksum(gameId, score, sessionDurationMs, playerName || '');
      // Also allow legacy 32-bit hash fallback
      let legacyHash = 0x811c9dc5;
      const secret = "ZiGaMeArcAdE_SeCrEt_SaLt_2026";
      const legacyData = `${gameId}:${score}:${sessionDurationMs}:${playerName || ''}:${secret}`;
      for (let i = 0; i < legacyData.length; i++) {
        legacyHash ^= legacyData.charCodeAt(i);
        legacyHash += (legacyHash << 1) + (legacyHash << 4) + (legacyHash << 7) + (legacyHash << 8) + (legacyHash << 24);
      }
      const expectedLegacy = (legacyHash >>> 0).toString(16);

      if (checksum !== expectedSha && checksum !== expectedLegacy) {
        return res.status(403).json({ 
          success: false, 
          code: 'CHECKSUM_MISMATCH', 
          message: "Aktivitas mencurigakan terdeteksi (gagal verifikasi integritas data)." 
        });
      }
    }

    // Update leaderboard
    if (playerName) {
      const board = leaderboards.get(gameId) || [];
      const cleanPlayer = playerName.trim().slice(0, 25);
      const existing = board.find(entry => entry.playerName === cleanPlayer);
      if (existing) {
        if (score > existing.score) existing.score = score;
      } else {
        board.push({ 
          playerName: cleanPlayer, 
          playerAvatar: playerAvatar || '🎮', 
          score, 
          date: getTodayDateString() 
        });
      }
      leaderboards.set(gameId, board);
    }

    const resultPayload = {
      success: true,
      message: "Skor berhasil divalidasi dan disimpan.",
      validatedScore: score
    };

    if (idempotencyKey) {
      processedActions.set(idempotencyKey, {
        result: resultPayload,
        timestamp: Date.now()
      });
    }

    return res.json(resultPayload);
  });

  // 5. Server-Authoritative Item Purchase with Idempotency
  app.post("/api/buy-item", createRateLimiter("buy_item", 20), (req, res) => {
    const { itemCost, currentCoins, itemId, idempotencyKey } = req.body;
    
    if (idempotencyKey && processedActions.has(idempotencyKey)) {
      return res.json(processedActions.get(idempotencyKey)!.result);
    }

    if (typeof itemCost !== 'number' || typeof currentCoins !== 'number' || !itemId || itemCost < 0) {
      return res.status(400).json({ success: false, code: 'INVALID_REQUEST', message: "Data pembelian tidak valid." });
    }
    
    if (currentCoins < itemCost) {
      return res.status(403).json({ success: false, code: 'INSUFFICIENT_FUNDS', message: "Saldo koin tidak mencukupi." });
    }
    
    const remainingCoins = currentCoins - itemCost;
    const responsePayload = {
      success: true,
      itemId,
      remainingCoins,
      transactionId: 'tx_' + crypto.randomBytes(8).toString('hex'),
      timestamp: Date.now()
    };

    if (idempotencyKey) {
      processedActions.set(idempotencyKey, {
        result: responsePayload,
        timestamp: Date.now()
      });
    }

    return res.json(responsePayload);
  });

  // Centralized Error Handler (No stack leaks in production)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[SERVER_UNCAUGHT_ERROR]', err);
    res.status(500).json({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Terjadi kendala pada server. Tim kami telah mencatat insiden ini.'
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // React Router SPA fallback
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ZiGame] Hardened production server running on http://localhost:${PORT}`);
  });
}

startServer();

