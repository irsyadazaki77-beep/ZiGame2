import { Router, Request, Response } from 'express';
import { requireAuth, enforceUserOwnership } from '../authMiddleware';
import { requireNotBanned } from '../securityMiddleware';
import { rateLimit } from '../rateLimiter';
import { serverLogger } from '../logger';
import { sendApiError, handleServerException } from '../requestContext';
import { isValidGameId } from '../../config/canonicalGames';
import {
  getCompetitiveProfile,
  createRankedSession,
  executeRankedSubmission,
  getRankedLeaderboardWithContext,
  getActiveSeason,
  isKillSwitchActive
} from '../persistence';
import {
  validateBody,
  sessionStartSchema,
  rankedSubmitSchema
} from '../schemaValidator';

export const competitiveRoutes = Router();

competitiveRoutes.get(
  '/competitive/profile',
  requireAuth,
  enforceUserOwnership,
  rateLimit(60, 60000, 'comp_profile'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;
      const profile = await getCompetitiveProfile(userId);
      return res.json({ success: true, profile });
    } catch (err: unknown) {
      serverLogger.error('COMP_PROFILE_ERROR', 'Failed to fetch competitive profile', err, undefined, req.user?.uid, req.ip, req.id);
      return handleServerException(err, req, res);
    }
  }
);

competitiveRoutes.post(
  '/competitive/session/start',
  requireAuth,
  enforceUserOwnership,
  requireNotBanned,
  rateLimit(30, 60000, 'comp_session_start'),
  validateBody(sessionStartSchema),
  async (req: Request, res: Response) => {
    try {
      if (isKillSwitchActive('ranked')) {
        return sendApiError(res, 503, 'RANKED_MAINTENANCE', 'Mode Ranked sedang dalam pemeliharaan sementara.');
      }
      const userId = req.user!.uid;
      const { gameId } = req.body as { gameId: string };

      const session = await createRankedSession(userId, gameId);

      serverLogger.info('RANKED_SESSION_STARTED', `Ranked session started for ${session.gameId}`, {
        gameId: session.gameId,
        sessionId: session.sessionId
      }, userId, req.ip, req.id);

      return res.json({
        success: true,
        sessionId: session.sessionId,
        nonce: session.nonce,
        signature: session.signature,
        startTime: session.startTime,
        expiresAt: session.expiresAt
      });
    } catch (err: unknown) {
      return handleServerException(err, req, res);
    }
  }
);

competitiveRoutes.post(
  '/competitive/submit',
  requireAuth,
  enforceUserOwnership,
  requireNotBanned,
  rateLimit(10, 60000, 'comp_submit'),
  validateBody(rankedSubmitSchema),
  async (req: Request, res: Response) => {
    try {
      if (isKillSwitchActive('ranked')) {
        return sendApiError(res, 503, 'RANKED_MAINTENANCE', 'Mode Ranked sedang dalam pemeliharaan sementara.');
      }
      const userId = req.user!.uid;
      const {
        gameId,
        score,
        playerName,
        playerAvatar,
        sessionId,
        durationMs,
        masteryLevel,
        idempotencyKey,
        nonce,
        signature,
        clientProof
      } = req.body as {
        gameId: string;
        score: number;
        playerName?: string;
        playerAvatar?: string;
        sessionId: string;
        durationMs?: number;
        masteryLevel?: number;
        idempotencyKey: string;
        nonce?: string;
        signature?: string;
        clientProof?: string;
      };

      const headerSignature = typeof req.headers['x-session-signature'] === 'string'
        ? req.headers['x-session-signature']
        : undefined;
      const headerProof = typeof req.headers['x-client-proof'] === 'string'
        ? req.headers['x-client-proof']
        : undefined;

      const result = await executeRankedSubmission({
        sessionId,
        userId,
        gameId,
        score: Math.floor(score),
        playerName: playerName || 'Player',
        playerAvatar: playerAvatar || '👾',
        durationMs: typeof durationMs === 'number' ? durationMs : undefined,
        masteryLevel: masteryLevel || 1,
        idempotencyKey,
        nonce: typeof nonce === 'string' ? nonce : undefined,
        signature: typeof signature === 'string' ? signature : headerSignature,
        clientProof: typeof clientProof === 'string' ? clientProof : headerProof,
        requestId: req.id,
        clientIp: req.ip
      });

      serverLogger.info('RANKED_SCORE_ACCEPTED', `Ranked score ${score} accepted for ${result.gameId}. New Rating: ${result.newRating}`, {
        gameId: result.gameId,
        score,
        ratingChange: result.ratingChange,
        newRating: result.newRating,
        newTier: result.newTier
      }, userId, req.ip, req.id);

      return res.json(result);
    } catch (err: unknown) {
      return handleServerException(err, req, res);
    }
  }
);

competitiveRoutes.get('/competitive/leaderboard/:gameId', rateLimit(60, 60000, 'comp_leaderboard'), async (req: Request, res: Response) => {
  try {
    const gameId = req.params.gameId;
    const userId = req.user?.uid;

    if (!isValidGameId(gameId)) return sendApiError(res, 400, 'INVALID_GAME_ID', 'ID Game tidak valid.');

    const limit = Math.min(100, parseInt(req.query.limit as string, 10) || 50);
    const result = await getRankedLeaderboardWithContext(gameId, userId, limit);

    return res.json({ success: true, gameId, ...result });
  } catch (err: unknown) {
    return handleServerException(err, req, res);
  }
});

competitiveRoutes.get('/competitive/seasons/active', async (_req: Request, res: Response) => {
  try {
    const season = await getActiveSeason();
    return res.json({ success: true, season });
  } catch {
    return res.status(500).json({ success: false });
  }
});
