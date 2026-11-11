import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireAuth, enforceUserOwnership } from '../authMiddleware';
import { requireNotBanned } from '../securityMiddleware';
import { rateLimit } from '../rateLimiter';
import { serverLogger } from '../logger';
import { handleServerException } from '../requestContext';
import { createGameSession, executeScoreSubmission } from '../persistence';
import {
  validateBody,
  sessionStartSchema,
  scoreSubmitSchema
} from '../schemaValidator';

export const sessionRoutes = Router();

sessionRoutes.post(
  '/session/start',
  requireAuth,
  enforceUserOwnership,
  requireNotBanned,
  rateLimit(30, 60000, 'session_start'),
  validateBody(sessionStartSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;
      const {
        gameId,
        nonce,
        sessionNonce,
        timestamp,
        clientTimestamp
      } = req.body as {
        gameId: string;
        nonce?: string;
        sessionNonce?: string;
        timestamp?: number;
        clientTimestamp?: number;
      };

      const resolvedClientNonce = sessionNonce || nonce;
      const resolvedClientTimestamp = clientTimestamp ?? timestamp;

      const session = await createGameSession(userId, gameId, {
        clientNonce: resolvedClientNonce,
        clientTimestamp: resolvedClientTimestamp
      });

      serverLogger.info('SESSION_STARTED', `Game session started for ${session.gameId}`, {
        gameId: session.gameId,
        sessionId: session.sessionId
      }, userId, req.ip, req.id);

      return res.json({
        success: true,
        sessionId: session.sessionId,
        nonce: session.nonce,
        sessionNonce: session.nonce,
        signature: session.signature,
        startTime: session.startTime,
        expiresAt: session.expiresAt
      });
    } catch (err: unknown) {
      serverLogger.error('SESSION_START_ERROR', 'Failed to initialize game session', err, undefined, req.user?.uid, req.ip, req.id);
      return handleServerException(err, req, res);
    }
  }
);

const handleSubmitScore = async (req: Request, res: Response) => {
  try {
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
      idempotencyKey?: string;
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
    const headerIdempotencyKey = typeof req.headers['x-idempotency-key'] === 'string'
      ? req.headers['x-idempotency-key'].trim()
      : undefined;

    const resolvedIdempotencyKey =
      headerIdempotencyKey ||
      idempotencyKey ||
      `score_${sessionId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

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
      durationMs: typeof durationMs === 'number' ? durationMs : undefined,
      masteryLevel: typeof masteryLevel === 'number' ? Math.max(1, Math.min(100, masteryLevel)) : 1,
      idempotencyKey: resolvedIdempotencyKey,
      nonce: typeof nonce === 'string' ? nonce : undefined,
      signature: typeof signature === 'string' ? signature : headerSignature,
      clientProof: typeof clientProof === 'string' ? clientProof : headerProof,
      requestId: req.id,
      clientIp: req.ip
    });

    serverLogger.info('SCORE_ACCEPTED', `Score ${score} accepted for ${result.gameId}`, {
      gameId: result.gameId,
      score,
      coinsEarned: result.coinsEarned
    }, userId, req.ip, req.id);

    return res.json(result);
  } catch (err: unknown) {
    serverLogger.error('SCORE_SUBMIT_ERROR', 'Failed to submit score', err, undefined, req.user?.uid, req.ip, req.id);
    return handleServerException(err, req, res);
  }
};

sessionRoutes.post(
  '/submit-score',
  requireAuth,
  enforceUserOwnership,
  requireNotBanned,
  rateLimit(20, 60000, 'score_submit'),
  validateBody(scoreSubmitSchema),
  handleSubmitScore
);

sessionRoutes.post(
  '/score/submit',
  requireAuth,
  enforceUserOwnership,
  requireNotBanned,
  rateLimit(20, 60000, 'score_submit'),
  validateBody(scoreSubmitSchema),
  handleSubmitScore
);
