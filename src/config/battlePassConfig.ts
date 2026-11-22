export type BattlePassRewardType = 'coins' | 'avatar' | 'theme' | 'title' | 'xp-boost';

export interface BattlePassReward {
  id: string;
  tier: number;
  track: 'free' | 'cyber';
  type: BattlePassRewardType;
  name: string;
  icon: string;
  value: string | number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface BattlePassTier {
  tier: number;
  requiredXp: number;
  freeReward: BattlePassReward;
  cyberReward: BattlePassReward;
}

const SPECIAL_CYBER_REWARDS: Record<number, Partial<BattlePassReward>> = {
  1: { type: 'avatar', name: '🤖 Mecha Vanguard', icon: '🤖', value: '🤖', rarity: 'rare' },
  5: { type: 'theme', name: '⚡ Volt Cyan Theme', icon: '⚡', value: '#06b6d4', rarity: 'rare' },
  10: { type: 'avatar', name: '🐉 Cyber Dragon', icon: '🐉', value: '🐉', rarity: 'epic' },
  15: { type: 'title', name: 'Gelar: Neon Ronin', icon: '🗡️', value: 'NEON RONIN', rarity: 'rare' },
  20: { type: 'theme', name: '🟣 Plasma Violet', icon: '🟣', value: '#8b5cf6', rarity: 'epic' },
  25: { type: 'avatar', name: '👁️ Singularity AI', icon: '👁️', value: '👁️', rarity: 'epic' },
  30: { type: 'title', name: 'Gelar: Chrono Architect', icon: '⏳', value: 'CHRONO ARCHITECT', rarity: 'epic' },
  40: { type: 'theme', name: '🟢 Matrix Overlord', icon: '🟢', value: '#10b981', rarity: 'legendary' },
  50: { type: 'avatar', name: '👑 Celestial Sovereign', icon: '👑', value: '👑', rarity: 'legendary' },
};

export const BATTLE_PASS_SEASON_META = {
  id: 'season_2_cyber_uprising',
  name: 'Season 2: Cyber Uprising',
  maxTier: 50,
  xpPerTier: 120,
  premiumUnlockCostCoins: 450,
};

export const BATTLE_PASS_TIERS: BattlePassTier[] = Array.from(
  { length: BATTLE_PASS_SEASON_META.maxTier },
  (_, idx) => {
    const tier = idx + 1;
    const requiredXp = tier * BATTLE_PASS_SEASON_META.xpPerTier;
    const isMilestone = tier % 5 === 0;
    const freeCoins = isMilestone ? 45 + tier * 2 : 15 + (tier % 5) * 5;

    const freeReward: BattlePassReward =
      tier === 10
        ? {
            id: `bp_free_${tier}`,
            tier,
            track: 'free',
            type: 'avatar',
            name: '🦊 Holo Kitsune',
            icon: '🦊',
            value: '🦊',
            rarity: 'rare',
          }
        : tier === 25
          ? {
              id: `bp_free_${tier}`,
              tier,
              track: 'free',
              type: 'theme',
              name: '🔵 Deep Horizon',
              icon: '🔵',
              value: '#3b82f6',
              rarity: 'epic',
            }
          : tier === 50
            ? {
                id: `bp_free_${tier}`,
                tier,
                track: 'free',
                type: 'avatar',
                name: '⚡ Apex Striker',
                icon: '⚡',
                value: '⚡',
                rarity: 'legendary',
              }
            : {
                id: `bp_free_${tier}`,
                tier,
                track: 'free',
                type: 'coins',
                name: `${freeCoins} Koin Arkade`,
                icon: '🪙',
                value: freeCoins,
                rarity: isMilestone ? 'rare' : 'common',
              };

    const special = SPECIAL_CYBER_REWARDS[tier];
    const cyberCoins = 35 + tier * 3;
    const cyberReward: BattlePassReward = special
      ? {
          id: `bp_cyber_${tier}`,
          tier,
          track: 'cyber',
          type: special.type || 'coins',
          name: special.name || `${cyberCoins} Koin`,
          icon: special.icon || '✨',
          value: special.value ?? cyberCoins,
          rarity: special.rarity || 'epic',
        }
      : {
          id: `bp_cyber_${tier}`,
          tier,
          track: 'cyber',
          type: 'coins',
          name: `${cyberCoins} Koin Siber`,
          icon: '💎',
          value: cyberCoins,
          rarity: isMilestone ? 'epic' : 'rare',
        };

    return {
      tier,
      requiredXp,
      freeReward,
      cyberReward,
    };
  }
);

const STORAGE_KEY_CLAIMED = 'zigame_bp_s2_claimed';
const STORAGE_KEY_PREMIUM = 'zigame_bp_s2_premium';

export function computeBattlePassProgress(totalXp: number): {
  currentTier: number;
  currentTierXp: number;
  nextTierXp: number;
  progressPercent: number;
} {
  const safeXp = Math.max(0, Math.floor(totalXp || 0));
  const xpPerTier = BATTLE_PASS_SEASON_META.xpPerTier;
  const rawTier = Math.floor(safeXp / xpPerTier);
  const currentTier = Math.min(BATTLE_PASS_SEASON_META.maxTier, rawTier);
  const currentTierXp = safeXp % xpPerTier;
  const progressPercent =
    currentTier >= BATTLE_PASS_SEASON_META.maxTier
      ? 100
      : Math.min(100, Math.round((currentTierXp / xpPerTier) * 100));

  return {
    currentTier,
    currentTierXp,
    nextTierXp: xpPerTier,
    progressPercent,
  };
}

export function getClaimedBattlePassRewardIds(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CLAIMED);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markBattlePassRewardClaimed(rewardId: string): string[] {
  const current = getClaimedBattlePassRewardIds();
  if (current.includes(rewardId)) return current;
  const updated = [...current, rewardId];
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_CLAIMED, JSON.stringify(updated));
    } catch {}
  }
  return updated;
}

export function isCyberPassPremiumUnlocked(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY_PREMIUM) === 'true';
  } catch {
    return false;
  }
}

export function unlockCyberPassPremium(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_PREMIUM, 'true');
  } catch {}
}
