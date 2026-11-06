import { economyService } from './economyService';
import { logger } from '../utils/logger';

export interface StreakReward {
  day: number;
  coins: number;
  xp: number;
  isMysteryDay?: boolean;
  label: string;
}

export const STREAK_REWARDS: StreakReward[] = [
  { day: 1, coins: 50, xp: 100, label: '50 Koin' },
  { day: 2, coins: 75, xp: 150, label: '75 Koin' },
  { day: 3, coins: 100, xp: 200, label: '100 Koin' },
  { day: 4, coins: 150, xp: 250, label: '150 Koin' },
  { day: 5, coins: 200, xp: 300, label: '200 Koin' },
  { day: 6, coins: 250, xp: 400, label: '250 Koin' },
  { day: 7, coins: 500, xp: 1000, isMysteryDay: true, label: '500 Koin + Gacha Box 🎁' }
];

export interface DailyStreakState {
  currentStreak: number; // 1 to 7
  lastClaimDate: string; // 'YYYY-MM-DD' UTC
  totalClaims: number;
}

const STORAGE_KEY = 'zigame_daily_streak_v1';

function getTodayUtcString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function getDayDifference(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1 + 'T00:00:00Z').getTime();
  const d2 = new Date(dateStr2 + 'T00:00:00Z').getTime();
  return Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
}

export const dailyStreakService = {
  getState(): DailyStreakState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      currentStreak: 0,
      lastClaimDate: '',
      totalClaims: 0
    };
  },

  saveState(state: DailyStreakState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  },

  getStreakInfo(): {
    currentStreak: number;
    claimableDay: number;
    canClaimToday: boolean;
    rewards: StreakReward[];
  } {
    const state = this.getState();
    const today = getTodayUtcString();

    if (!state.lastClaimDate) {
      // First time ever
      return {
        currentStreak: 0,
        claimableDay: 1,
        canClaimToday: true,
        rewards: STREAK_REWARDS
      };
    }

    const diff = getDayDifference(state.lastClaimDate, today);

    if (diff === 0) {
      // Already claimed today
      return {
        currentStreak: state.currentStreak,
        claimableDay: state.currentStreak,
        canClaimToday: false,
        rewards: STREAK_REWARDS
      };
    } else if (diff === 1) {
      // Consecutive streak continue!
      const nextDay = state.currentStreak >= 7 ? 1 : state.currentStreak + 1;
      return {
        currentStreak: state.currentStreak,
        claimableDay: nextDay,
        canClaimToday: true,
        rewards: STREAK_REWARDS
      };
    } else {
      // Streak broken, reset to Day 1
      return {
        currentStreak: 0,
        claimableDay: 1,
        canClaimToday: true,
        rewards: STREAK_REWARDS
      };
    }
  },

  async claimReward(): Promise<{
    success: boolean;
    day: number;
    coins: number;
    xp: number;
    isMysteryDay: boolean;
  }> {
    const info = this.getStreakInfo();
    if (!info.canClaimToday) {
      return { success: false, day: info.claimableDay, coins: 0, xp: 0, isMysteryDay: false };
    }

    const day = info.claimableDay;
    const reward = STREAK_REWARDS[day - 1];
    const today = getTodayUtcString();

    try {
      // Claim reward through economy service
      await economyService.claimReward(reward.coins, 'daily_mission');

      const newState: DailyStreakState = {
        currentStreak: day,
        lastClaimDate: today,
        totalClaims: (this.getState().totalClaims || 0) + 1
      };
      this.saveState(newState);

      return {
        success: true,
        day,
        coins: reward.coins,
        xp: reward.xp,
        isMysteryDay: !!reward.isMysteryDay
      };
    } catch (e) {
      logger.error('Failed to claim daily streak', { error: e });
      return { success: false, day, coins: 0, xp: 0, isMysteryDay: false };
    }
  }
};
