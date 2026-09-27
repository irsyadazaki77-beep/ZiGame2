import { DailyMission, GameStats } from '../types';
import { 
  getUtcTodayDateString, 
  getAuthoritativeDailyMissions 
} from '../config/authoritativeMissions';

// Use UTC for daily reset to prevent local clock manipulation
export const getTodayDateString = (): string => {
  return getUtcTodayDateString();
};

export const generateDailyMissions = (games: GameStats[]): DailyMission[] => {
  return getAuthoritativeDailyMissions(undefined, games);
};

