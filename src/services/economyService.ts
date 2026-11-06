import { isFirebaseReady, auth } from './firebase';
import { logger } from '../utils/logger';
import { ShopItem, PlayerProfile } from '../types';
import { storageService } from './storageService';
import { SERVER_SHOP_CATALOG, getAuthoritativeCatalogItem } from '../config/shopCatalog';
import { resolveAuthoritativeReward, RewardClaimType } from '../config/rewardCatalog';

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

const LOCAL_SPIN_KEY = 'zigame_local_spin_date';
const LOCAL_CLAIMS_KEY = 'zigame_local_claimed_rewards';

function getTodayUtc(): string {
  return new Date().toISOString().split('T')[0];
}

function getLocalProfileWithCoins(): PlayerProfile {
  const saved = storageService.getProfile();
  if (saved) {
    return {
      ...saved,
      coins: typeof saved.coins === 'number' ? saved.coins : 100
    };
  }
  return {
    name: 'ARKADE_X',
    avatar: '👾',
    colorTheme: '#6366f1',
    coins: 100
  };
}

function saveLocalCoins(newCoins: number): number {
  const prof = getLocalProfileWithCoins();
  const clamped = Math.max(0, Math.floor(newCoins));
  storageService.saveProfile({ ...prof, coins: clamped });
  return clamped;
}

function getLocalClaimedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_CLAIMS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {}
  return new Set();
}

function saveLocalClaimedSet(set: Set<string>): void {
  try {
    localStorage.setItem(LOCAL_CLAIMS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export const economyService = {
  syncBalance: async (_legacyUserOrName?: string): Promise<number | null> => {
    try {
      const headers = await getAuthHeaders();
      if (!headers['Authorization']) {
        return getLocalProfileWithCoins().coins;
      }
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
      if (!headers['Authorization']) {
        const catalogItem = getAuthoritativeCatalogItem(itemId);
        if (!catalogItem) {
          return { success: false, message: 'Item tidak ditemukan di katalog toko.' };
        }
        const prof = getLocalProfileWithCoins();
        if (prof.coins < catalogItem.cost) {
          return { success: false, message: 'Saldo koin tidak mencukupi untuk membeli item ini.' };
        }
        const remainingCoins = saveLocalCoins(prof.coins - catalogItem.cost);
        return {
          success: true,
          remainingCoins,
          rewardId: catalogItem.id
        };
      }

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
      if (!headers['Authorization']) {
        const today = getTodayUtc();
        const lastSpin = localStorage.getItem(LOCAL_SPIN_KEY);
        if (lastSpin === today) {
          return { success: false, message: 'Anda sudah melakukan spin hari ini. Kembali lagi besok!' };
        }
        const prizes = [25, 50, 75, 100, 150, 200, 250, 500];
        const prize = prizes[Math.floor(Math.random() * prizes.length)];
        const prof = getLocalProfileWithCoins();
        const newCoinBalance = saveLocalCoins(prof.coins + prize);
        try {
          localStorage.setItem(LOCAL_SPIN_KEY, today);
        } catch {}
        return {
          success: true,
          prize,
          newCoinBalance
        };
      }

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
      if (!headers['Authorization']) {
        const today = getTodayUtc();
        const lastSpinDate = localStorage.getItem(LOCAL_SPIN_KEY);
        return {
          canSpin: lastSpinDate !== today,
          lastSpinDate: lastSpinDate || null
        };
      }

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
        ? (reasonOrType as RewardClaimType)
        : 'achievement';

      if (!headers['Authorization']) {
        const def = resolveAuthoritativeReward(claimId, claimType);
        const amount = def ? def.rewardCoins : (typeof claimIdOrAmount === 'number' && claimIdOrAmount > 0 ? Math.min(1000, claimIdOrAmount) : 0);
        const xp = def ? def.rewardXp : 0;
        const canonicalId = def ? def.canonicalId : claimId;

        if (!def && amount <= 0) {
          return { success: false, message: 'Definisi reward tidak valid.' };
        }

        const claimed = getLocalClaimedSet();
        if (claimed.has(canonicalId)) {
          const currentCoins = getLocalProfileWithCoins().coins;
          return {
            success: true,
            newBalance: currentCoins,
            remainingCoins: currentCoins,
            amount: 0,
            xp: 0,
            claimId: canonicalId
          };
        }

        const prof = getLocalProfileWithCoins();
        const newBalance = saveLocalCoins(prof.coins + amount);
        claimed.add(canonicalId);
        saveLocalClaimedSet(claimed);

        return {
          success: true,
          newBalance,
          remainingCoins: newBalance,
          amount,
          xp,
          claimId: canonicalId
        };
      }
      
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
        saveLocalCoins(data.newBalance);
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
      if (!headers['Authorization']) {
        const prof = getLocalProfileWithCoins();
        const GACHA_COST = 50;
        if (prof.coins < GACHA_COST) {
          return { success: false, message: 'Saldo koin tidak mencukupi untuk menarik Gacha (50 koin).' };
        }
        const pool = Object.values(SERVER_SHOP_CATALOG).filter(item => item.active);
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        const remainingCoins = saveLocalCoins(prof.coins - GACHA_COST);
        return {
          success: true,
          rewardId: chosen.id,
          remainingCoins,
          item: chosen as unknown as ShopItem
        };
      }

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
      if (!headers['Authorization']) {
        if (typeof bet !== 'number' || bet <= 0 || !Number.isFinite(bet)) {
          return { success: false, message: 'Nilai taruhan koin tidak valid.' };
        }
        const cleanBet = Math.floor(bet);
        const prof = getLocalProfileWithCoins();
        if (prof.coins < cleanBet) {
          return { success: false, message: 'Saldo koin tidak mencukupi untuk jumlah taruhan ini.' };
        }
        const outcomeSide: 'heads' | 'tails' = Math.random() < 0.5 ? 'heads' : 'tails';
        const won = outcomeSide === choice;
        const changeCoins = won ? cleanBet : -cleanBet;
        const remainingCoins = saveLocalCoins(prof.coins + changeCoins);
        return {
          success: true,
          won,
          changeCoins,
          remainingCoins,
          outcomeSide
        };
      }

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

