import { isFirebaseReady, auth } from './firebase';
import { logger } from '../utils/logger';
import { ShopItem } from '../types';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (isFirebaseReady() && auth?.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      logger.warn('Failed to retrieve Firebase ID token', { error: err });
    }
  }
  return headers;
}

export interface EconomyActionResult {
  success: boolean;
  message?: string;
  remainingCoins?: number;
  newBalance?: number;
  rewardId?: string;
  changeCoins?: number;
  won?: boolean;
  outcomeSide?: 'heads' | 'tails';
  item?: ShopItem | Record<string, unknown>;
  claimId?: string;
  amount?: number;
  xp?: number;
}

function generateIdempotencyKey(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}

export const economyService = {
  syncBalance: async (_legacyUserOrName?: string): Promise<number | null> => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/economy', { headers });
      if (res.ok) {
        const data = await res.json();
        return typeof data.coins === 'number' ? data.coins : null;
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      logger.warn('Failed to sync economy balance', { error: err });
    }
    return null;
  },

  buyItem: async (itemId: string): Promise<EconomyActionResult> => {
    const idempotencyKey = generateIdempotencyKey(`buy_${itemId}`);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/buy-item', {
        method: 'POST',
        headers,
        body: JSON.stringify({ itemId, idempotencyKey })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Pembelian gagal diproses oleh server.');
      }
      return {
        success: true,
        remainingCoins: data.remainingCoins,
        rewardId: data.itemId
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Pembelian gagal';
      return { success: false, message: msg };
    }
  },

  spin: async (): Promise<{ success: boolean; prize?: number; newCoinBalance?: number; message?: string }> => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/spin', {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.message || 'Gagal memproses spin harian.' };
      }
      return {
        success: true,
        prize: data.prize,
        newCoinBalance: data.newCoinBalance
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Spin gagal';
      return { success: false, message: msg };
    }
  },

  getSpinStatus: async (): Promise<{ canSpin: boolean; lastSpinDate: string | null }> => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/spin-status', { headers });
      if (res.ok) {
        const data = await res.json();
        return { canSpin: !!data.canSpin, lastSpinDate: data.lastSpinDate };
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      logger.warn('Failed to fetch spin status', { error: err });
    }
    return { canSpin: true, lastSpinDate: null };
  },

  claimReward: async (
    claimIdOrAmount: string | number,
    reasonOrType: string = 'achievement',
    _legacyUserOrName?: string
  ): Promise<EconomyActionResult> => {
    try {
      const headers = await getAuthHeaders();
      const claimId = typeof claimIdOrAmount === 'string' ? claimIdOrAmount : reasonOrType;
      const claimType = (typeof reasonOrType === 'string' && ['achievement', 'daily_mission', 'challenge', 'quest_tier', 'starter_pack', 'level_up'].includes(reasonOrType))
        ? reasonOrType
        : 'achievement';
      
      const idempotencyKey = generateIdempotencyKey(`claim_${claimId}`);
      const res = await fetch('/api/economy/claim', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          claimId,
          claimType,
          idempotencyKey
        })
      });
      const data = await res.json();
      if (res.ok) {
        return {
          success: true,
          newBalance: data.newBalance,
          remainingCoins: data.newBalance,
          amount: data.amount,
          xp: data.xp,
          claimId: data.claimId
        };
      }
      return { success: false, message: data.message };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal mengklaim reward';
      const err = e instanceof Error ? e : new Error(msg);
      logger.warn('Failed to claim reward on server', { error: err });
      return { success: false, message: msg };
    }
  },

  gacha: async (_legacyUserOrName?: string): Promise<EconomyActionResult> => {
    const idempotencyKey = generateIdempotencyKey('gacha');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/economy/gacha', {
        method: 'POST',
        headers,
        body: JSON.stringify({ idempotencyKey })
      });
      const data = await res.json();
      if (res.ok) {
        return {
          success: true,
          rewardId: data.rewardId,
          remainingCoins: data.remainingCoins,
          item: data.item
        };
      }
      return { success: false, message: data.message };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal menarik gacha';
      return { success: false, message: msg };
    }
  },

  gamble: async (
    bet: number,
    choice: 'heads' | 'tails',
    _legacyUserOrName?: string
  ): Promise<EconomyActionResult> => {
    const idempotencyKey = generateIdempotencyKey(`gamble_${choice}_${bet}`);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/economy/gamble', {
        method: 'POST',
        headers,
        body: JSON.stringify({ bet, choice, idempotencyKey })
      });
      const data = await res.json();
      if (res.ok) {
        return {
          success: true,
          won: data.won,
          changeCoins: data.changeCoins,
          remainingCoins: data.remainingCoins,
          outcomeSide: data.outcomeSide
        };
      }
      return { success: false, message: data.message };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal memproses taruhan';
      const err = e instanceof Error ? e : new Error(msg);
      logger.warn('Gamble transaction failed', { error: err });
      return { success: false, message: msg };
    }
  }
};
