import { CompetitiveRating, CompetitiveTier, CompetitiveProfile, RankedSubmissionResult } from '../types';
import { isFirebaseReady, auth } from './firebase';
import { logger } from '../utils/logger';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (isFirebaseReady() && auth?.currentUser) {
    const token = await auth.currentUser.getIdToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

class CompetitiveService {
  private profile: CompetitiveProfile | null = null;

  public async fetchProfile(): Promise<CompetitiveProfile | null> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/competitive/profile', { headers });
      if (res.ok) {
        const data = await res.json();
        this.profile = data.profile;
        return this.profile;
      }
    } catch (e) {
      logger.error('Failed to fetch competitive profile', e);
    }
    return null;
  }

  public getRating(gameId: string): CompetitiveRating | null {
    return this.profile?.gameRatings[gameId] || null;
  }

  public getAllRatings(): Record<string, CompetitiveRating> {
    return this.profile?.gameRatings || {};
  }

  public getGlobalStats() {
    return {
      rating: this.profile?.globalRating || 1000,
      tier: this.profile?.globalTier || 'Silver',
      matches: this.profile?.rankedGames || 0
    };
  }

  public async startRankedSession(gameId: string): Promise<{ sessionId?: string; nonce?: string; startTime?: number }> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/competitive/session/start', {
        method: 'POST',
        headers,
        body: JSON.stringify({ gameId })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      logger.error('Failed to start ranked session', e);
    }
    return {};
  }

  public async submitRankedScore(params: {
    gameId: string;
    score: number;
    sessionId: string;
    playerName?: string;
    playerAvatar?: string;
    masteryLevel?: number;
  }): Promise<RankedSubmissionResult | null> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/competitive/submit', {
        method: 'POST',
        headers,
        body: JSON.stringify(params)
      });
      if (res.ok) {
        const data = await res.json();
        // Refresh profile after submission
        await this.fetchProfile();
        return data;
      }
    } catch (e) {
      logger.error('Failed to submit ranked score', e);
    }
    return null;
  }

  public async getRankedLeaderboard(gameId: string, limit: number = 50) {
    try {
      const res = await fetch(`/api/competitive/leaderboard/${gameId}?limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        return data.entries;
      }
    } catch (e) {
      logger.error('Failed to fetch ranked leaderboard', e);
    }
    return [];
  }
}

export const competitiveService = new CompetitiveService();
