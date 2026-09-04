import { logger } from '../utils/logger';

export const economyService = {
  syncBalance: async (userId?: string): Promise<number | null> => {
    try {
      const url = userId ? `/api/economy?userId=${encodeURIComponent(userId)}` : '/api/economy';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return typeof data.coins === 'number' ? data.coins : null;
      }
    } catch (e) {
      logger.warn('Failed to sync economy balance', { error: e });
    }
    return null;
  },

  buyItem: async (itemId: string, userId?: string): Promise<{ success: boolean; message?: string; remainingCoins?: number }> => {
    const idempotencyKey = `buy_${itemId}_${Date.now()}`;
    try {
      const res = await fetch('/api/buy-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, userId, idempotencyKey })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Pembelian gagal');
      }
      return { success: true, remainingCoins: data.remainingCoins };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  spin: async (type: 'free' | 'premium', userId?: string): Promise<any> => {
    const idempotencyKey = `spin_${type}_${Date.now()}`;
    try {
      const res = await fetch('/api/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, userId, idempotencyKey })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Spin gagal');
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  gacha: async (userId?: string): Promise<{ success: boolean; rewardId?: string; remainingCoins?: number; message?: string }> => {
    const idempotencyKey = `gacha_${Date.now()}`;
    try {
      const res = await fetch('/api/gacha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, idempotencyKey })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gacha gagal');
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  gamble: async (bet: number, choice: 'heads' | 'tails', userId?: string): Promise<{ success: boolean; won?: boolean; outcomeSide?: 'heads' | 'tails'; changeCoins?: number; remainingCoins?: number; message?: string }> => {
    const idempotencyKey = `gamble_${Date.now()}`;
    try {
      const res = await fetch('/api/gamble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet, choice, userId, idempotencyKey })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gamble gagal');
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  claimReward: async (amount: number, source: string, userId?: string): Promise<{ success: boolean; newBalance?: number; message?: string }> => {
    const idempotencyKey = `reward_${source}_${Date.now()}`;
    try {
      const res = await fetch('/api/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, source, userId, idempotencyKey })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal klaim reward');
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }
};
