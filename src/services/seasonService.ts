import { SEASON_CONFIG } from '../config/balanceConfig';
import { SeasonInfo } from '../types';

export const seasonService = {
  getActiveSeason(): SeasonInfo {
    return SEASON_CONFIG.activeSeason;
  },

  getTimeRemaining(): { days: number; hours: number; minutes: number; formatted: string; isEnded: boolean } {
    const end = new Date(SEASON_CONFIG.activeSeason.endAt).getTime();
    const now = Date.now();
    const diff = end - now;

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, formatted: 'Berakhir', isEnded: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);

    return {
      days,
      hours,
      minutes,
      formatted: `${days}h ${hours}j ${minutes}m`,
      isEnded: false
    };
  },

  isFeaturedGame(gameId: string): boolean {
    return SEASON_CONFIG.activeSeason.featuredGames.includes(gameId);
  }
};
