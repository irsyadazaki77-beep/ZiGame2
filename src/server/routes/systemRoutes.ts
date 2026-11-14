import { Router, Request, Response } from 'express';
import { rateLimit } from '../rateLimiter';
import { serverLogger } from '../logger';
import { sendApiError, handleServerException } from '../requestContext';
import { APP_VERSION } from '../../config/version';
import { isValidGameId, requireCanonicalGameId } from '../../config/canonicalGames';
import { GAME_BALANCE_CONFIG } from '../../config/balanceConfig';
import {
  getPersistenceHealthStatus,
  isPersistenceReady,
  getLeaderboardEntries
} from '../persistence';
import {
  validateBody,
  telemetrySchema,
  analyticsBatchSchema
} from '../schemaValidator';

export const systemRoutes = Router();

systemRoutes.get('/health', (_req: Request, res: Response) => {
  const health = getPersistenceHealthStatus();
  return res.status(200).json({
    status: health.status === 'unavailable' ? 'degraded' : health.status,
    version: APP_VERSION,
    persistence: health.persistence,
    timestamp: new Date().toISOString()
  });
});

systemRoutes.get('/ready', (_req: Request, res: Response) => {
  const ready = isPersistenceReady();
  if (!ready) {
    return res.status(503).json({
      ready: false,
      status: 'not_ready',
      message: 'Layanan basis data belum siap menerima transaksi.',
      timestamp: new Date().toISOString()
    });
  }
  return res.json({
    ready: true,
    status: 'ready',
    version: APP_VERSION,
    timestamp: new Date().toISOString()
  });
});

systemRoutes.get('/liveness', (_req: Request, res: Response) => {
  return res.json({
    alive: true,
    timestamp: new Date().toISOString()
  });
});

const handleBalanceConfig = (_req: Request, res: Response) => {
  return res.json({
    success: true,
    config: GAME_BALANCE_CONFIG,
    multipliers: Object.fromEntries(
      Object.entries(GAME_BALANCE_CONFIG).map(([k, v]) => [
        k,
        {
          coinMultiplier: v.baseCoinMultiplier,
          xpMultiplier: v.baseXpMultiplier,
          maxScoreCeiling: v.maxScoreCeiling,
          minDurationMs: v.minDurationMs
        }
      ])
    )
  });
};

systemRoutes.get('/config/balance', handleBalanceConfig);
systemRoutes.get('/balance-config', handleBalanceConfig);

systemRoutes.get('/leaderboard/:gameId', rateLimit(60, 60000, 'leaderboard_view'), async (req: Request, res: Response) => {
  try {
    const rawGameId = req.params.gameId;
    if (!isValidGameId(rawGameId)) {
      return sendApiError(res, 400, 'INVALID_GAME_ID', 'ID Game tidak valid atau tidak terdaftar.');
    }

    const canonicalId = requireCanonicalGameId(rawGameId);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

    const entries = await getLeaderboardEntries(canonicalId, limit);
    return res.json({
      success: true,
      gameId: canonicalId,
      entries
    });
  } catch (err: unknown) {
    serverLogger.error('LEADERBOARD_FETCH_ERROR', 'Failed to fetch leaderboard', err, undefined, req.user?.uid, req.ip, req.id);
    return handleServerException(err, req, res);
  }
});

systemRoutes.post('/telemetry', rateLimit(100, 60000, 'telemetry'), validateBody(telemetrySchema), (req: Request, res: Response) => {
  const { eventType, gameId, durationMs, score, metadata } = req.body;

  let sanitizedMetadata: Record<string, string | number | boolean> | undefined = undefined;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    sanitizedMetadata = {};
    const keys = Object.keys(metadata).slice(0, 20);
    for (const key of keys) {
      if (typeof key === 'string' && key.length <= 64) {
        const val = (metadata as Record<string, unknown>)[key];
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

systemRoutes.post('/analytics/events', rateLimit(100, 60000, 'analytics'), validateBody(analyticsBatchSchema), (req: Request, res: Response) => {
  const { events } = req.body as { events: unknown[] };

  serverLogger.info('ANALYTICS_BATCH', `Received ${events.length} analytics events`, {
    count: events.length
  }, req.user?.uid, req.ip, req.id);

  return res.json({
    success: true,
    accepted: events.length
  });
});
