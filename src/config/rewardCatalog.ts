/**
 * Authoritative Server-Side Reward Catalog & Definitions
 * ZiGame 2.0 Stabilization & Production Quality
 * 
 * Strict single source of truth for all achievable rewards.
 * Clients are strictly forbidden from specifying reward amounts.
 */

export type RewardClaimType =
  | 'achievement'
  | 'daily_mission'
  | 'challenge'
  | 'quest_tier'
  | 'starter_pack'
  | 'level_up';

export interface AuthoritativeRewardDefinition {
  id: string;
  type: RewardClaimType;
  rewardCoins: number;
  rewardXp: number;
  title: string;
  description?: string;
}

export const AUTHORITATIVE_ACHIEVEMENT_REWARDS: Record<string, { rewardCoins: number; rewardXp: number; title: string }> = {
  snake_glutton: { rewardCoins: 50, rewardXp: 80, title: 'ULAR RAKUS' },
  snake_turbo: { rewardCoins: 100, rewardXp: 150, title: 'PENGENDARA BADAI' },
  brick_demolisher: { rewardCoins: 80, rewardXp: 120, title: 'PENGHANCUR BALOK' },
  flappy_pilot: { rewardCoins: 60, rewardXp: 100, title: 'PILOT PRO' },
  flappy_god: { rewardCoins: 120, rewardXp: 200, title: 'PENDEKAR NEON' },
  space_champion: { rewardCoins: 80, rewardXp: 120, title: 'DEFENDER GALAKSI' },
  space_god: { rewardCoins: 200, rewardXp: 350, title: 'DEWA ANGKASA' },
  memory_master: { rewardCoins: 75, rewardXp: 110, title: 'INGATAN CYBER' },
  memory_god: { rewardCoins: 300, rewardXp: 500, title: 'KONEKSI NEURAL SEJATI' },
  runner_speed: { rewardCoins: 80, rewardXp: 120, title: 'CYBER SPRINT' },
  racer_apex: { rewardCoins: 100, rewardXp: 150, title: 'APEX DRIFTER' },
  tetris_grandmaster: { rewardCoins: 150, rewardXp: 250, title: 'TETRIS MATRIX MASTER' },
  mines_sweeper: { rewardCoins: 90, rewardXp: 140, title: 'DEFUSER PROTOCOL' },
  neon_2048_master: { rewardCoins: 200, rewardXp: 300, title: 'QUANTUM 2048' },
  ach_first_win: { rewardCoins: 50, rewardXp: 75, title: 'Achievement: First Win' },
  ach_score_500: { rewardCoins: 100, rewardXp: 150, title: 'Achievement: Score 500' }
};

export const AUTHORITATIVE_QUEST_TIER_REWARDS: Record<number, { rewardCoins: number; rewardXp: number; title: string }> = {
  1: { rewardCoins: 50, rewardXp: 50, title: 'Tier 1 Shards' },
  2: { rewardCoins: 75, rewardXp: 75, title: 'Tier 2 Cache' },
  3: { rewardCoins: 100, rewardXp: 100, title: 'Tier 3 Matrix Box' },
  4: { rewardCoins: 125, rewardXp: 125, title: 'Tier 4 Neon Core' },
  5: { rewardCoins: 150, rewardXp: 150, title: 'Tier 5 Cyber Vault' },
  6: { rewardCoins: 175, rewardXp: 175, title: 'Tier 6 Data Cache' },
  7: { rewardCoins: 200, rewardXp: 200, title: 'Tier 7 Quantum Relic' },
  8: { rewardCoins: 225, rewardXp: 225, title: 'Tier 8 Apex Fragment' },
  9: { rewardCoins: 250, rewardXp: 250, title: 'Tier 9 Vanguard Cache' },
  10: { rewardCoins: 500, rewardXp: 500, title: 'Tier 10 Cyber Crown' }
};

export const CANONICAL_STARTER_PACK_ID = 'starter_pack_v1';

export function getCanonicalClaimId(
  claimId: string,
  claimType: RewardClaimType,
  targetNum?: number
): string {
  const sanitized = (claimId || '').trim();
  if (claimType === 'starter_pack') {
    return CANONICAL_STARTER_PACK_ID;
  }
  if (claimType === 'level_up') {
    const num = targetNum || parseInt(sanitized.replace(/\D/g, ''), 10) || 2;
    return `level_up_${num}`;
  }
  if (claimType === 'quest_tier') {
    const num = targetNum || parseInt(sanitized.replace(/\D/g, ''), 10) || 1;
    return `quest_tier_${num}`;
  }
  if (claimType === 'daily_mission' && sanitized === 'm_play_3') {
    const todayStr = new Date().toISOString().split('T')[0];
    return `m_${todayStr}_3`;
  }
  return sanitized;
}

export function resolveAuthoritativeReward(
  claimId: string,
  claimType: RewardClaimType,
  targetNum?: number
): { rewardCoins: number; rewardXp: number; title: string; canonicalId: string } | null {
  const sanitizedId = (claimId || '').trim();
  if (!sanitizedId) return null;

  switch (claimType) {
    case 'achievement': {
      const ach = AUTHORITATIVE_ACHIEVEMENT_REWARDS[sanitizedId];
      if (ach) return { ...ach, canonicalId: sanitizedId };
      return null;
    }

    case 'daily_mission': {
      const canonical = getCanonicalClaimId(sanitizedId, 'daily_mission');
      if (sanitizedId === 'm_play_3' || canonical.endsWith('_3') || sanitizedId.includes('play_count')) {
        return { rewardCoins: 50, rewardXp: 80, title: 'Daily Mission: Multigenre Exploration', canonicalId: canonical };
      }
      if (canonical.endsWith('_1') || sanitizedId.includes('score_target')) {
        return { rewardCoins: 80, rewardXp: 100, title: 'Daily Mission: Score Target', canonicalId: canonical };
      }
      if (canonical.endsWith('_2') || sanitizedId.includes('unique_games')) {
        return { rewardCoins: 100, rewardXp: 120, title: 'Daily Mission: High Score Breakthrough', canonicalId: canonical };
      }
      return null;
    }

    case 'challenge': {
      if (sanitizedId.startsWith('daily_')) {
        return { rewardCoins: 75, rewardXp: 100, title: 'Daily Challenge Complete', canonicalId: sanitizedId };
      }
      if (sanitizedId.startsWith('weekly_')) {
        return { rewardCoins: 150, rewardXp: 250, title: 'Weekly Challenge Complete', canonicalId: sanitizedId };
      }
      if (sanitizedId.startsWith('special_') || sanitizedId.startsWith('season_')) {
        return { rewardCoins: 250, rewardXp: 400, title: 'Special Challenge Complete', canonicalId: sanitizedId };
      }
      return null;
    }

    case 'quest_tier': {
      const tierNum = targetNum || parseInt(sanitizedId.replace(/\D/g, ''), 10);
      if (!tierNum || isNaN(tierNum) || tierNum < 1 || tierNum > 10) return null;
      const tierReward = AUTHORITATIVE_QUEST_TIER_REWARDS[tierNum];
      if (tierReward) return { ...tierReward, canonicalId: `quest_tier_${tierNum}` };
      return null;
    }

    case 'starter_pack': {
      if (sanitizedId === 'starter_pack' || sanitizedId === 'starter_pack_claim' || sanitizedId === CANONICAL_STARTER_PACK_ID) {
        return { rewardCoins: 100, rewardXp: 150, title: 'Starter Recruit Bonus', canonicalId: CANONICAL_STARTER_PACK_ID };
      }
      return null;
    }

    case 'level_up': {
      const level = targetNum || parseInt(sanitizedId.replace(/\D/g, ''), 10);
      if (!level || isNaN(level) || level < 2 || level > 100) return null;
      return { rewardCoins: 50, rewardXp: 0, title: `Player Level ${level} Reached`, canonicalId: `level_up_${level}` };
    }

    default:
      return null;
  }
}
