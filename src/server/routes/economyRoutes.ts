import { Router, Request, Response } from 'express';
import { requireAuth, enforceUserOwnership } from '../authMiddleware';
import { requireNotBanned } from '../securityMiddleware';
import { rateLimit } from '../rateLimiter';
import { serverLogger } from '../logger';
import { sendApiError, handleServerException } from '../requestContext';
import {
  getUserEconomy,
  getUserProgression,
  getSpinCooldown,
  executeDailySpin,
  executeShopPurchase,
  executeGamble,
  executeGacha,
  executeClaimReward,
  isKillSwitchActive,
  reconcileUserEconomy,
  checkUserBanStatus
} from '../persistence';
import {
  validateBody,
  buyItemSchema,
  gambleSchema,
  gachaSchema,
  claimRewardSchema
} from '../schemaValidator';

export const economyRoutes = Router();

economyRoutes.get('/economy', requireAuth, rateLimit(60, 60000, 'economy_fetch'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const economy = await getUserEconomy(userId);
    const progression = await getUserProgression(userId);
    const spinCooldown = await getSpinCooldown(userId);

    return res.json({
      success: true,
      userId: economy.userId,
      coins: economy.coins,
      totalEarned: economy.totalEarned,
      totalSpent: economy.totalSpent,
      totalXp: progression.totalXp,
      level: progression.level,
      canSpin: spinCooldown.canSpin,
      lastSpinDate: spinCooldown.lastSpinDate,
      lastUpdated: economy.lastUpdated
    });
  } catch (err: unknown) {
    serverLogger.error('ECONOMY_FETCH_ERROR', 'Failed to fetch economy', err, undefined, req.user?.uid, req.ip, req.id);
    return handleServerException(err, req, res);
  }
});

economyRoutes.get('/spin-status', requireAuth, rateLimit(60, 60000, 'spin_status'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const cooldown = await getSpinCooldown(userId);
    return res.json({ success: true, canSpin: cooldown.canSpin, lastSpinDate: cooldown.lastSpinDate });
  } catch (err: unknown) {
    return handleServerException(err, req, res);
  }
});

economyRoutes.post(
  '/buy-item',
  requireAuth,
  enforceUserOwnership,
  requireNotBanned,
  rateLimit(20, 60000, 'shop_purchase'),
  validateBody(buyItemSchema),
  async (req: Request, res: Response) => {
    try {
      if (isKillSwitchActive('economy')) {
        return sendApiError(res, 503, 'ECONOMY_MAINTENANCE', 'Sistem transaksi ekonomi sedang dalam pemeliharaan sementara.');
      }
      const userId = req.user!.uid;
      const { itemId, idempotencyKey } = req.body as { itemId: string; idempotencyKey: string };

      const result = await executeShopPurchase(userId, itemId, idempotencyKey);

      serverLogger.info('PURCHASE', `User purchased ${result.itemId}`, {
        itemId: result.itemId,
        remainingCoins: result.remainingCoins,
        transactionId: result.transactionId
      }, userId, req.ip, req.id);

      return res.json(result);
    } catch (err: unknown) {
      serverLogger.error('BUY_ITEM_ERROR', 'Failed to execute purchase', err, undefined, req.user?.uid, req.ip, req.id);
      return handleServerException(err, req, res);
    }
  }
);

economyRoutes.post(
  '/spin',
  requireAuth,
  enforceUserOwnership,
  requireNotBanned,
  rateLimit(10, 60000, 'daily_spin'),
  async (req: Request, res: Response) => {
    try {
      if (isKillSwitchActive('economy')) {
        return sendApiError(res, 503, 'ECONOMY_MAINTENANCE', 'Sistem transaksi ekonomi sedang dalam pemeliharaan sementara.');
      }
      const userId = req.user!.uid;
      const result = await executeDailySpin(userId);

      serverLogger.info('SPIN', `User spun wheel and won ${result.prize} coins`, {
        prize: result.prize,
        newBalance: result.newCoinBalance,
        transactionId: result.transactionId
      }, userId, req.ip, req.id);

      return res.json(result);
    } catch (err: unknown) {
      serverLogger.error('SPIN_ERROR', 'Failed to process spin', err, undefined, req.user?.uid, req.ip, req.id);
      return handleServerException(err, req, res);
    }
  }
);

economyRoutes.post(
  '/economy/gamble',
  requireAuth,
  enforceUserOwnership,
  requireNotBanned,
  rateLimit(30, 60000, 'gamble'),
  validateBody(gambleSchema),
  async (req: Request, res: Response) => {
    try {
      if (isKillSwitchActive('economy')) {
        return sendApiError(res, 503, 'ECONOMY_MAINTENANCE', 'Sistem transaksi ekonomi sedang dalam pemeliharaan sementara.');
      }
      const userId = req.user!.uid;
      const { bet, choice, idempotencyKey } = req.body as {
        bet: number;
        choice: 'heads' | 'tails';
        idempotencyKey: string;
      };

      const result = await executeGamble(userId, bet, choice, idempotencyKey);

      serverLogger.info('GAMBLE', `User gambled ${bet} on ${choice} and ${result.won ? 'WON' : 'LOST'}`, {
        bet,
        choice,
        won: result.won,
        remainingCoins: result.remainingCoins,
        transactionId: result.transactionId
      }, userId, req.ip, req.id);

      return res.json(result);
    } catch (err: unknown) {
      serverLogger.error('GAMBLE_ERROR', 'Failed to process gamble', err, undefined, req.user?.uid, req.ip, req.id);
      return handleServerException(err, req, res);
    }
  }
);

economyRoutes.post(
  '/economy/gacha',
  requireAuth,
  enforceUserOwnership,
  requireNotBanned,
  rateLimit(20, 60000, 'gacha'),
  validateBody(gachaSchema),
  async (req: Request, res: Response) => {
    try {
      if (isKillSwitchActive('economy')) {
        return sendApiError(res, 503, 'ECONOMY_MAINTENANCE', 'Sistem transaksi ekonomi sedang dalam pemeliharaan sementara.');
      }
      const userId = req.user!.uid;
      const { idempotencyKey } = req.body as { idempotencyKey: string };

      const result = await executeGacha(userId, idempotencyKey);

      serverLogger.info('GACHA', `User pulled gacha and won ${result.rewardId}`, {
        rewardId: result.rewardId,
        remainingCoins: result.remainingCoins,
        transactionId: result.transactionId
      }, userId, req.ip, req.id);

      return res.json(result);
    } catch (err: unknown) {
      serverLogger.error('GACHA_ERROR', 'Failed to process gacha pull', err, undefined, req.user?.uid, req.ip, req.id);
      return handleServerException(err, req, res);
    }
  }
);

const handleClaimReward = async (req: Request, res: Response) => {
  try {
    if (isKillSwitchActive('economy')) {
      return sendApiError(res, 503, 'ECONOMY_MAINTENANCE', 'Sistem transaksi ekonomi sedang dalam pemeliharaan sementara.');
    }
    const userId = req.user!.uid;
    const { claimId, claimType, reason, idempotencyKey, details } = req.body as {
      claimId?: string;
      claimType?: string;
      reason?: string;
      idempotencyKey: string;
      details?: Record<string, unknown>;
    };

    const resolvedClaimId = (claimId || reason) as string;
    const type = (claimType || 'achievement') as import('../../config/rewardCatalog').RewardClaimType;
    const result = await executeClaimReward(userId, resolvedClaimId, type, idempotencyKey, details);

    serverLogger.info('REWARD_CLAIMED', `User claimed ${result.amount} coins for ${resolvedClaimId}`, {
      claimId: result.claimId,
      amount: result.amount,
      xp: result.xp,
      newBalance: result.newBalance,
      transactionId: result.transactionId
    }, userId, req.ip, req.id);

    return res.json(result);
  } catch (err: unknown) {
    serverLogger.error('CLAIM_ERROR', 'Failed to claim reward', err, undefined, req.user?.uid, req.ip, req.id);
    return handleServerException(err, req, res);
  }
};

economyRoutes.post(
  '/economy/claim',
  requireAuth,
  enforceUserOwnership,
  requireNotBanned,
  rateLimit(30, 60000, 'reward_claim'),
  validateBody(claimRewardSchema),
  handleClaimReward
);

economyRoutes.post(
  '/economy/claim-reward',
  requireAuth,
  enforceUserOwnership,
  requireNotBanned,
  rateLimit(30, 60000, 'reward_claim'),
  validateBody(claimRewardSchema),
  handleClaimReward
);

economyRoutes.get('/user/security-status', requireAuth, enforceUserOwnership, rateLimit(30, 60000, 'user_security_status'), async (req: Request, res: Response) => {
  try {
    const status = await checkUserBanStatus(req.user!.uid);
    return res.json({
      success: true,
      ...status
    });
  } catch (err: unknown) {
    return handleServerException(err, req, res);
  }
});

economyRoutes.get('/user/reconcile-economy', requireAuth, enforceUserOwnership, rateLimit(10, 60000, 'user_reconcile'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const report = await reconcileUserEconomy(userId);
    return res.json({ success: true, report });
  } catch (err: unknown) {
    return handleServerException(err, req, res);
  }
});
