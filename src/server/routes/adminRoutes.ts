import { Router, Request, Response } from 'express';
import { requireAdmin } from '../authMiddleware';
import { serverLogger } from '../logger';
import { sendApiError, handleServerException } from '../requestContext';
import { requireCanonicalGameId } from '../../config/canonicalGames';
import {
  getRealAdminStats,
  getSuspiciousScores,
  purgeSuspectScores,
  setKillSwitch,
  getKillSwitches,
  KillSwitchFeature,
  reconcileUserEconomy,
  validateCompetitiveIntegrity,
  banUserAccount,
  unbanUserAccount,
  getFlaggedAndBannedUsers,
  getSecurityEvents
} from '../persistence';
import {
  validateBody,
  killSwitchSchema,
  adminUserTargetSchema,
  adminBanUserSchema,
  adminPurgeSchema,
  getRegisteredSchemasSummary
} from '../schemaValidator';

export const adminRoutes = Router();

adminRoutes.get('/admin/verify', requireAdmin, (req: Request, res: Response) => {
  return res.json({
    success: true,
    isAdmin: true,
    uid: req.user!.uid
  });
});

adminRoutes.get('/admin/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await getRealAdminStats();
    return res.json(stats);
  } catch (err: unknown) {
    serverLogger.error('ADMIN_STATS_ERROR', 'Failed to get admin stats', err, undefined, req.user?.uid, req.ip, req.id);
    return handleServerException(err, req, res);
  }
});

adminRoutes.get('/admin/suspicious-scores', requireAdmin, async (req: Request, res: Response) => {
  try {
    const gameId = typeof req.query.gameId === 'string' ? req.query.gameId : undefined;
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const severity = typeof req.query.severity === 'string'
      ? (req.query.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')
      : undefined;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

    const entries = await getSuspiciousScores({ gameId, userId, severity, limit });
    return res.json({
      success: true,
      entries,
      count: entries.length
    });
  } catch (err: unknown) {
    serverLogger.error('ADMIN_SUSPICIOUS_FETCH_ERROR', 'Failed to fetch suspicious scores', err, undefined, req.user?.uid, req.ip, req.id);
    return handleServerException(err, req, res);
  }
});

adminRoutes.post(
  '/admin/purge-suspect-scores',
  requireAdmin,
  validateBody(adminPurgeSchema),
  async (req: Request, res: Response) => {
    try {
      const { gameId } = req.body as { gameId?: string };
      const canonicalId = gameId ? requireCanonicalGameId(gameId) : undefined;

      const result = await purgeSuspectScores(canonicalId);
      serverLogger.security('ADMIN_ACTION', `Admin purged ${result.purgedCount} suspect scores`, { gameId: canonicalId }, req.user!.uid, req.ip, req.id);

      return res.json({
        success: true,
        purgedCount: result.purgedCount
      });
    } catch (err: unknown) {
      serverLogger.error('PURGE_SCORES_ERROR', 'Failed to purge suspect scores', err, undefined, req.user?.uid, req.ip, req.id);
      return handleServerException(err, req, res);
    }
  }
);

adminRoutes.post('/admin/force-sync', requireAdmin, (req: Request, res: Response) => {
  serverLogger.security('ADMIN_ACTION', 'Admin triggered authoritative sync', {}, req.user!.uid, req.ip, req.id);
  return res.json({
    success: true,
    message: 'State authoritative berhasil disinkronkan.'
  });
});

adminRoutes.get('/admin/kill-switches', requireAdmin, (_req: Request, res: Response) => {
  const switches = getKillSwitches();
  return res.json({
    success: true,
    killSwitches: switches
  });
});

adminRoutes.post(
  '/admin/kill-switches',
  requireAdmin,
  validateBody(killSwitchSchema),
  (req: Request, res: Response) => {
    const { feature, active } = req.body as { feature: KillSwitchFeature; active: boolean };
    const result = setKillSwitch(feature, active, req.user!.uid);
    return res.json(result);
  }
);

adminRoutes.post(
  '/admin/reconcile-economy',
  requireAdmin,
  validateBody(adminUserTargetSchema),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.body as { userId: string };
      const report = await reconcileUserEconomy(userId);
      serverLogger.security('ADMIN_ACTION', `Admin ran economy reconciliation for ${userId}`, {
        targetUserId: userId,
        isReconciled: report.isReconciled,
        discrepancy: report.discrepancy
      }, req.user!.uid, req.ip, req.id);

      return res.json({ success: true, report });
    } catch (err: unknown) {
      serverLogger.error('ADMIN_RECONCILE_ERROR', 'Failed to reconcile user economy', err, undefined, req.user?.uid, req.ip, req.id);
      return handleServerException(err, req, res);
    }
  }
);

adminRoutes.post(
  '/admin/reconcile-competitive',
  requireAdmin,
  validateBody(adminUserTargetSchema),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.body as { userId: string };
      const report = await validateCompetitiveIntegrity(userId);
      serverLogger.security('ADMIN_ACTION', `Admin ran competitive integrity check for ${userId}`, {
        targetUserId: userId,
        isConsistent: report.isConsistent
      }, req.user!.uid, req.ip, req.id);

      return res.json({ success: true, report });
    } catch (err: unknown) {
      serverLogger.error('ADMIN_COMP_RECONCILE_ERROR', 'Failed to check competitive integrity', err, undefined, req.user?.uid, req.ip, req.id);
      return handleServerException(err, req, res);
    }
  }
);

adminRoutes.get('/admin/security/bans', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const [users, events] = await Promise.all([
      getFlaggedAndBannedUsers(limit),
      getSecurityEvents(limit)
    ]);
    return res.json({
      success: true,
      users,
      events,
      recentEvents: events
    });
  } catch (err: unknown) {
    serverLogger.error('ADMIN_SECURITY_BANS_ERROR', 'Failed to load flagged/banned users', err, undefined, req.user?.uid, req.ip, req.id);
    return handleServerException(err, req, res);
  }
});

adminRoutes.post(
  '/admin/security/ban-user',
  requireAdmin,
  validateBody(adminBanUserSchema),
  async (req: Request, res: Response) => {
    try {
      const { userId, reason, durationMinutes, durationHours } = req.body as {
        userId: string;
        reason?: string;
        durationMinutes?: number;
        durationHours?: number;
      };
      const targetUid = userId.trim();
      if (targetUid === req.user!.uid) {
        return sendApiError(res, 400, 'INVALID_USER_ID', 'Tidak dapat membekukan akun administrator Anda sendiri.');
      }

      const banReason = typeof reason === 'string' && reason.trim()
        ? reason.trim().slice(0, 256)
        : 'Dibekukan oleh Administrator karena pelanggaran keamanan.';
      let dur: number | null = null;
      if (typeof durationMinutes === 'number' && durationMinutes > 0) {
        dur = durationMinutes;
      } else if (typeof durationHours === 'number' && durationHours > 0) {
        dur = durationHours * 60;
      }

      const record = await banUserAccount(targetUid, banReason, req.user!.uid, dur);
      serverLogger.security('ADMIN_BAN_USER', `Admin ${req.user!.uid} banned user ${targetUid}`, {
        targetUserId: targetUid,
        reason: banReason,
        durationMinutes: dur
      }, req.user!.uid, req.ip, req.id);

      return res.json({
        success: true,
        profile: record,
        securityProfile: record
      });
    } catch (err: unknown) {
      serverLogger.error('ADMIN_BAN_ERROR', 'Failed to ban user account', err, undefined, req.user?.uid, req.ip, req.id);
      return handleServerException(err, req, res);
    }
  }
);

adminRoutes.post(
  '/admin/security/unban-user',
  requireAdmin,
  validateBody(adminUserTargetSchema),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.body as { userId: string };
      const targetUid = userId.trim();
      const record = await unbanUserAccount(targetUid, req.user!.uid);
      serverLogger.security('ADMIN_UNBAN_USER', `Admin ${req.user!.uid} unbanned user ${targetUid}`, {
        targetUserId: targetUid
      }, req.user!.uid, req.ip, req.id);

      return res.json({
        success: true,
        profile: record,
        securityProfile: record
      });
    } catch (err: unknown) {
      serverLogger.error('ADMIN_UNBAN_ERROR', 'Failed to unban user account', err, undefined, req.user?.uid, req.ip, req.id);
      return handleServerException(err, req, res);
    }
  }
);

adminRoutes.get('/admin/security/architecture', requireAdmin, (_req: Request, res: Response) => {
  const schemas = getRegisteredSchemasSummary();
  return res.json({
    success: true,
    architecture: {
      domainRouters: ['systemRoutes', 'sessionRoutes', 'economyRoutes', 'competitiveRoutes', 'adminRoutes'],
      schemaGatewayActive: true,
      registeredSchemasCount: schemas.length,
      schemas
    }
  });
});
