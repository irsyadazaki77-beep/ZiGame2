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
      if (res.ok) {
        const data = await res.json();
        return { success: true, newBalance: data.coins, remainingCoins: data.coins };
      }
    } catch (e) {
      logger.warn('Failed to claim reward on server', { error: e });
    }
    return { success: true };
  },

  gacha: async (_legacyUserOrName?: string): Promise<EconomyActionResult> => {
    const cost = 50;
    const items = [
      'avatar_alien', 'avatar_ninja', 'avatar_robot', 'avatar_wizard', 'avatar_dragon',
      'theme_cyberpunk', 'theme_retro', 'theme_matrix', 'theme_synthwave'
    ];
    const pickedReward = items[Math.floor(Math.random() * items.length)];

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/buy-item', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          itemId: `gacha_${pickedReward}`,
          cost,
          itemType: pickedReward.startsWith('avatar_') ? 'avatar' : 'theme',
          value: pickedReward
        })
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true, rewardId: pickedReward, remainingCoins: data.remainingCoins };
      }
      return { success: false, message: data.message };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  gamble: async (
    bet: number,
    choice: 'heads' | 'tails',
    _legacyUserOrName?: string
  ): Promise<EconomyActionResult> => {
    const isWin = Math.random() < 0.48; // 48% win probability
    const outcomeSide: 'heads' | 'tails' = isWin ? choice : (choice === 'heads' ? 'tails' : 'heads');
    const change = isWin ? bet : -bet;

    try {
      const headers = await getAuthHeaders();
      if (isWin) {
        await fetch('/api/economy/claim', {
          method: 'POST',
          headers,
          body: JSON.stringify({ amount: bet, reason: 'GAMBLE_WIN' })
        });
      } else {
        await fetch('/api/buy-item', {
          method: 'POST',
          headers,
          body: JSON.stringify({ itemId: 'gamble_loss', cost: bet })
        });
      }
    } catch (e) {
      logger.warn('Gamble transaction handled locally', { error: e });
    }

    return {
      success: true,
      won: isWin,
      changeCoins: change,
      outcomeSide
    };
  }
};
