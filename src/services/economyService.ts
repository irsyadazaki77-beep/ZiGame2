import { isFirebaseReady, auth } from './firebase';
import { logger } from '../utils/logger';

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
    } catch (e) {
      logger.warn('Failed to retrieve Firebase ID token', { error: e });
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
    } catch (e) {
      logger.warn('Failed to sync economy balance', { error: e });
    }
    return null;
  },

  buyItem: async (itemId: string): Promise<EconomyActionResult> => {
    const randSuffix = Math.random().toString(36).substring(2, 10);
    const idempotencyKey = `buy_${itemId}_${Date.now()}_${randSuffix}`;
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
    } catch (e: any) {
      return { success: false, message: e.message };
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
    } catch (e: any) {
      return { success: false, message: e.message };
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
    } catch (e) {
      logger.warn('Failed to fetch spin status', { error: e });
    }
    return { canSpin: true, lastSpinDate: null };
  },

  claimReward: async (
    amount: number,
    reason: string,
    _legacyUserOrName?: string
  ): Promise<EconomyActionResult> => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/economy/claim', {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount, reason })
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true, newBalance: data.newBalance, remainingCoins: data.newBalance };
      }
      return { success: false, message: data.message };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal mengklaim reward';
      logger.warn('Failed to claim reward on server', { error: e });
      return { success: false, message: msg };
    }
  },

  gacha: async (_legacyUserOrName?: string): Promise<EconomyActionResult> => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/economy/gacha', {
        method: 'POST',
        headers,
        body: JSON.stringify({})
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
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/economy/gamble', {
        method: 'POST',
        headers,
        body: JSON.stringify({ bet, choice })
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
      logger.warn('Gamble transaction failed', { error: e });
      return { success: false, message: msg };
    }
  }
};
