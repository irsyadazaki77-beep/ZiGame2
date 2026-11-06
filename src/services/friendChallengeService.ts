import { logger } from '../utils/logger';

export interface FriendChallenge {
  id: string;
  gameId: string;
  gameTitle: string;
  challengerName: string;
  targetScore: number;
  message?: string;
  bountyCoins: number;
  bountyXp: number;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  achievedScore?: number;
  completedAt?: number;
}

const STORAGE_KEY_OUTGOING = 'zigame_friend_challenges_out';
const STORAGE_KEY_INCOMING = 'zigame_friend_challenges_in';

export const friendChallengeService = {
  createChallenge(params: {
    gameId: string;
    gameTitle: string;
    challengerName: string;
    targetScore: number;
    message?: string;
    bountyCoins?: number;
    bountyXp?: number;
  }): FriendChallenge {
    const id = `fc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const challenge: FriendChallenge = {
      id,
      gameId: params.gameId,
      gameTitle: params.gameTitle,
      challengerName: params.challengerName || 'Anon Gamer',
      targetScore: Math.max(1, Math.round(params.targetScore)),
      message: params.message?.trim() || 'Coba kalahkan skorku kalau kamu memang jagoan arkade!',
      bountyCoins: params.bountyCoins || 150,
      bountyXp: params.bountyXp || 300,
      createdAt: now,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000, // 7 days validity
      status: 'pending'
    };

    this.saveOutgoingChallenge(challenge);
    return challenge;
  },

  encodeChallenge(challenge: FriendChallenge): string {
    try {
      const payload = {
        i: challenge.id,
        g: challenge.gameId,
        t: challenge.gameTitle,
        n: challenge.challengerName,
        s: challenge.targetScore,
        m: challenge.message,
        c: challenge.bountyCoins,
        x: challenge.bountyXp,
        ca: challenge.createdAt,
        ea: challenge.expiresAt
      };
      const jsonStr = JSON.stringify(payload);
      // UTF-8 safe base64
      return btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (_, p1) => 
        String.fromCharCode(parseInt(p1, 16))
      ));
    } catch (e) {
      logger.error('Failed to encode challenge', { error: e });
      return '';
    }
  },

  decodeChallenge(encoded: string): FriendChallenge | null {
    try {
      // Restore standard base64 from URL-safe format if needed
      const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const jsonStr = decodeURIComponent(Array.prototype.map.call(atob(base64), (c: string) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      const data = JSON.parse(jsonStr);
      if (!data.g || !data.s || !data.n) return null;

      return {
        id: data.i || `fc_${data.ca || Date.now()}`,
        gameId: data.g,
        gameTitle: data.t || 'Arcade Game',
        challengerName: data.n,
        targetScore: Number(data.s) || 100,
        message: data.m || '',
        bountyCoins: Number(data.c) || 150,
        bountyXp: Number(data.x) || 300,
        createdAt: Number(data.ca) || Date.now(),
        expiresAt: Number(data.ea) || Date.now() + 7 * 24 * 60 * 60 * 1000,
        status: 'pending'
      };
    } catch (e) {
      logger.warn('Failed to decode challenge from URL payload', { error: e });
      return null;
    }
  },

  generateShareUrl(challenge: FriendChallenge): string {
    const code = this.encodeChallenge(challenge);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/game/${challenge.gameId}?challenge=${code}`;
  },

  parseChallengeFromUrl(searchParams: URLSearchParams): FriendChallenge | null {
    const challengeParam = searchParams.get('challenge') || searchParams.get('c');
    if (!challengeParam) return null;
    return this.decodeChallenge(challengeParam);
  },

  saveOutgoingChallenge(challenge: FriendChallenge): void {
    try {
      const list = this.getOutgoingChallenges();
      const filtered = list.filter(c => c.id !== challenge.id);
      filtered.unshift(challenge);
      localStorage.setItem(STORAGE_KEY_OUTGOING, JSON.stringify(filtered.slice(0, 50)));
    } catch {}
  },

  saveIncomingChallenge(challenge: FriendChallenge): void {
    try {
      const list = this.getIncomingChallenges();
      const existing = list.find(c => c.id === challenge.id);
      if (!existing) {
        list.unshift(challenge);
        localStorage.setItem(STORAGE_KEY_INCOMING, JSON.stringify(list.slice(0, 50)));
      }
    } catch {}
  },

  getOutgoingChallenges(): FriendChallenge[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_OUTGOING);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  getIncomingChallenges(): FriendChallenge[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_INCOMING);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  recordChallengeAttempt(id: string, score: number): { completed: boolean; challenge: FriendChallenge | null } {
    try {
      const incoming = this.getIncomingChallenges();
      const challenge = incoming.find(c => c.id === id);
      if (!challenge) return { completed: false, challenge: null };

      const isWin = score >= challenge.targetScore;
      challenge.achievedScore = Math.max(score, challenge.achievedScore || 0);

      if (isWin) {
        challenge.status = 'completed';
        challenge.completedAt = Date.now();
      } else {
        if (challenge.status !== 'completed') {
          challenge.status = 'failed';
        }
      }

      localStorage.setItem(STORAGE_KEY_INCOMING, JSON.stringify(incoming));
      return { completed: isWin, challenge };
    } catch {
      return { completed: false, challenge: null };
    }
  }
};
