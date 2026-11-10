import { CompetitiveRating, CompetitiveProfile, RankedSubmissionResult } from '../types';
import { isFirebaseReady, auth } from './firebase';
import { logger } from '../utils/logger';
import { computePayloadProofClient } from '../utils/sessionCrypto';
import { toCanonicalGameId } from '../config/canonicalGames';

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
  private rankedSessionMeta = new Map<string, { nonce: string; signature?: string; gameId: string }>();

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

  public async startRankedSession(gameId: string): Promise<{ sessionId?: string; nonce?: string; signature?: string; startTime?: number }> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/competitive/session/start', {
        method: 'POST',
        headers,
        body: JSON.stringify({ gameId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sessionId && data.nonce) {
          this.rankedSessionMeta.set(data.sessionId, {
            nonce: data.nonce,
            signature: data.signature,
            gameId: toCanonicalGameId(gameId)
          });
        }
        return data;
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
    durationMs?: number;
    masteryLevel?: number;
    idempotencyKey?: string;
  }): Promise<RankedSubmissionResult | null> {
    try {
      const headers = await getAuthHeaders();
      const meta = this.rankedSessionMeta.get(params.sessionId);
      const canonicalGameId = meta?.gameId || toCanonicalGameId(params.gameId);
      const cleanScore = Math.floor(params.score);
      let clientProof: string | undefined;

      if (meta?.nonce) {
        clientProof = await computePayloadProofClient(params.sessionId, canonicalGameId, cleanScore, meta.nonce);
      }
      if (meta?.signature) {
        headers['X-Session-Signature'] = meta.signature;
      }
      if (clientProof) {
        headers['X-Client-Proof'] = clientProof;
      }

      const res = await fetch('/api/competitive/submit', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...params,
          score: cleanScore,
          nonce: meta?.nonce,
          signature: meta?.signature,
          clientProof
        })
      });
      if (res.ok) {
        this.rankedSessionMeta.delete(params.sessionId);
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

