/**
 * Authoritative Server-Side Reward Catalog & Definitions
 * ZiGame 2.0 Stabilization & Production Quality
 * 
 * Strict single source of truth for all achievable rewards.
 * Clients are strictly forbidden from specifying reward amounts.
 * Unknown or loose arbitrary claim IDs are strictly rejected.
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

export const AUTHORITATIVE_SEASONAL_CHALLENGES: Record<string, { rewardCoins: number; rewardXp: number; title: string }> = {
  'special_season_1': { rewardCoins: 500, rewardXp: 1000, title: 'Cyber Genesis Vanguard' },
  'season_1_challenge_1': { rewardCoins: 250, rewardXp: 400, title: 'Season 1 Challenge 1' },
  'season_1_challenge_2': { rewardCoins: 250, rewardXp: 400, title: 'Season 1 Challenge 2' },
  'season_1_challenge_3': { rewardCoins: 250, rewardXp: 400, title: 'Season 1 Challenge 3' },
  'season_1_challenge_4': { rewardCoins: 250, rewardXp: 400, title: 'Season 1 Challenge 4' }
};

export const CANONICAL_STARTER_PACK_ID = 'starter_pack_v1';

export function getCanonicalClaimId(
  claimId: string,
  claimType: RewardClaimType,
  targetNum?: number
): string {
  const sanitized = (claimId || '').trim();
  if (claimType === 'starter_pack') {
    if (sanitized === 'starter_pack' || sanitized === 'starter_pack_claim' || sanitized === 'sp_welcome' || sanitized === CANONICAL_STARTER_PACK_ID) {
      return CANONICAL_STARTER_PACK_ID;
    }
    return sanitized;
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
      // Exact pattern check for daily mission: m_YYYY-MM-DD_1, m_YYYY-MM-DD_2, m_YYYY-MM-DD_3
      const dailyMissionMatch = canonical.match(/^m_(\d{4}-\d{2}-\d{2})_([123])$/);
      if (dailyMissionMatch) {
        const index = dailyMissionMatch[2];
        if (index === '1') {
          return { rewardCoins: 100, rewardXp: 150, title: 'Daily Mission: Score Target', canonicalId: canonical };
        } else if (index === '2') {
          return { rewardCoins: 120, rewardXp: 180, title: 'Daily Mission: Engagement', canonicalId: canonical };
        } else if (index === '3') {
          return { rewardCoins: 80, rewardXp: 100, title: 'Daily Mission: Consistency', canonicalId: canonical };
        }
      }
      return null;
    }

    case 'challenge': {
      // 1. Daily Challenge exact pattern check: daily_YYYY-MM-DD_1, daily_YYYY-MM-DD_2, daily_YYYY-MM-DD_3
      const dailyMatch = sanitizedId.match(/^daily_(\d{4}-\d{2}-\d{2})_([123])$/);
      if (dailyMatch) {
        const index = dailyMatch[2];
        if (index === '1') {
          return { rewardCoins: 80, rewardXp: 120, title: 'Daily Challenge: Score Target', canonicalId: sanitizedId };
        } else if (index === '2') {
          return { rewardCoins: 75, rewardXp: 100, title: 'Daily Challenge: Multigenre', canonicalId: sanitizedId };
        } else if (index === '3') {
          return { rewardCoins: 60, rewardXp: 90, title: 'Daily Challenge: Reflex', canonicalId: sanitizedId };
        }
      }

      // 2. Weekly Challenge exact pattern check: weekly_YYYY-Www_1, weekly_YYYY-Www_2, weekly_YYYY-Www_3
      const weeklyMatch = sanitizedId.match(/^weekly_(\d{4}-W\d{2})_([123])$/);
      if (weeklyMatch) {
        const index = weeklyMatch[2];
        if (index === '1') {
          return { rewardCoins: 250, rewardXp: 400, title: 'Weekly Challenge: PB Breaker', canonicalId: sanitizedId };
        } else if (index === '2') {
          return { rewardCoins: 200, rewardXp: 350, title: 'Weekly Challenge: Marathon', canonicalId: sanitizedId };
        } else if (index === '3') {
          return { rewardCoins: 300, rewardXp: 500, title: 'Weekly Challenge: Score Accumulator', canonicalId: sanitizedId };
        }
      }

      // 3. Registered Seasonal/Special Challenge check
      if (sanitizedId in AUTHORITATIVE_SEASONAL_CHALLENGES) {
        const seasonal = AUTHORITATIVE_SEASONAL_CHALLENGES[sanitizedId];
        return { ...seasonal, canonicalId: sanitizedId };
      }

      // Rejects any arbitrary/unregistered challenge ID
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
      const canonical = getCanonicalClaimId(sanitizedId, 'starter_pack');
      if (canonical === CANONICAL_STARTER_PACK_ID) {
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

