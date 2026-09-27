/**
 * Daily Missions Utility
 * Forwarding to single authoritative mission generator
 */
import { DailyMission, GameStats } from '../types';
import { 
  getUtcTodayDateString, 
  getAuthoritativeDailyMissions 
} from '../config/authoritativeMissions';

export const getTodayDateString = (): string => {
  return getUtcTodayDateString();
};

export const generateDailyMissions = (games: GameStats[]): DailyMission[] => {
  return getAuthoritativeDailyMissions(undefined, games);
};
