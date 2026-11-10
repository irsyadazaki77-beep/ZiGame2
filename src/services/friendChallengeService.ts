import { logger } from '../utils/logger';
import { CANONICAL_GAME_IDS, CanonicalGameId, isValidGameId, toCanonicalGameId } from '../config/canonicalGames';

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
const CHALLENGE_SIG_SALT = 'zigame_fc_v2_integrity_salt_9a8f';
const MAX_BOUNTY_COINS = 500;
const MAX_BOUNTY_XP = 1000;

function computeChallengeSignature(params: {
  gameId: string;
  targetScore: number;
  bountyCoins: number;
  createdAt: number;
}): string {
  const raw = `${params.gameId}|${params.targetScore}|${params.bountyCoins}|${params.createdAt}|${CHALLENGE_SIG_SALT}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export const friendChallengeService = {
  computeSignature(challenge: Pick<FriendChallenge, 'gameId' | 'targetScore' | 'bountyCoins' | 'createdAt'>): string {
    return computeChallengeSignature({
      gameId: challenge.gameId,
      targetScore: Math.max(1, Math.round(Number(challenge.targetScore) || 1)),
      bountyCoins: Math.min(Math.max(0, Math.round(Number(challenge.bountyCoins) || 0)), MAX_BOUNTY_COINS),
      createdAt: Number(challenge.createdAt) || 0
    });
  },

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
    const canonicalGameId = isValidGameId(params.gameId) ? toCanonicalGameId(params.gameId) : params.gameId;
    const safeBountyCoins = Math.min(Math.max(0, Math.round(params.bountyCoins ?? 150)), MAX_BOUNTY_COINS);
    const safeBountyXp = Math.min(Math.max(0, Math.round(params.bountyXp ?? 300)), MAX_BOUNTY_XP);

    const challenge: FriendChallenge = {
      id,
      gameId: canonicalGameId,
      gameTitle: params.gameTitle,
      challengerName: params.challengerName || 'Anon Gamer',
      targetScore: Math.max(1, Math.round(params.targetScore)),
      message: params.message?.trim() || 'Coba kalahkan skorku kalau kamu memang jagoan arkade!',
      bountyCoins: safeBountyCoins,
      bountyXp: safeBountyXp,
      createdAt: now,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000, // 7 days validity
      status: 'pending'
    };

    this.saveOutgoingChallenge(challenge);
    return challenge;
  },

  encodeChallenge(challenge: FriendChallenge): string {
    try {
      const safeTargetScore = Math.max(1, Math.round(Number(challenge.targetScore) || 1));
      const safeBountyCoins = Math.min(Math.max(0, Math.round(Number(challenge.bountyCoins) || 0)), MAX_BOUNTY_COINS);
      const safeCreatedAt = Number(challenge.createdAt) || Date.now();
      const sig = computeChallengeSignature({
        gameId: challenge.gameId,
        targetScore: safeTargetScore,
        bountyCoins: safeBountyCoins,
        createdAt: safeCreatedAt
      });

      const payload = {
        i: challenge.id,
        g: challenge.gameId,
        t: challenge.gameTitle,
        n: challenge.challengerName,
        s: safeTargetScore,
        m: challenge.message,
        c: safeBountyCoins,
        x: Math.min(Math.max(0, Math.round(Number(challenge.bountyXp) || 0)), MAX_BOUNTY_XP),
        ca: safeCreatedAt,
        ea: challenge.expiresAt,
        sig
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

  decodeChallenge(encoded: string, externalSig?: string | null): FriendChallenge | null {
    try {
      // Restore standard base64 from URL-safe format if needed
      const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const jsonStr = decodeURIComponent(Array.prototype.map.call(atob(base64), (c: string) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      const parsed = JSON.parse(jsonStr);
      if (!parsed || typeof parsed !== 'object' || !parsed.g || !parsed.n) return null;

      // 1. Validate canonical game ID
      if (!isValidGameId(parsed.g)) {
        logger.warn('Rejected friend challenge: invalid gameId', { gameId: parsed.g });
        return null;
      }
      const canonicalGameId = toCanonicalGameId(parsed.g);
      if (!CANONICAL_GAME_IDS.includes(canonicalGameId as CanonicalGameId)) {
        return null;
      }

      // 2. Validate positive integer targetScore
      const rawTargetScore = Number(parsed.s);
      if (!Number.isFinite(rawTargetScore) || rawTargetScore <= 0) {
        logger.warn('Rejected friend challenge: non-positive targetScore', { context: { targetScore: parsed.s } });
        return null;
      }
      const targetScore = Math.max(1, Math.round(rawTargetScore));

      // 3. Clamp bountyCoins to safe maximum (max 500 coins)
      const rawBountyCoins = Number(parsed.c ?? 150);
      const bountyCoins = Number.isFinite(rawBountyCoins)
        ? Math.min(Math.max(0, Math.round(rawBountyCoins)), MAX_BOUNTY_COINS)
        : 150;

      const rawBountyXp = Number(parsed.x ?? 300);
      const bountyXp = Number.isFinite(rawBountyXp)
        ? Math.min(Math.max(0, Math.round(rawBountyXp)), MAX_BOUNTY_XP)
        : 300;

      const createdAt = Number(parsed.ca) || Date.now();

      // 4. Verify signature integrity if sig parameter or embedded sig is present
      const providedSig = externalSig || parsed.sig;
      if (providedSig) {
        const expectedSig = computeChallengeSignature({
          gameId: canonicalGameId,
          targetScore,
          bountyCoins,
          createdAt
        });
        const expectedRawSig = computeChallengeSignature({
          gameId: String(parsed.g),
          targetScore: rawTargetScore,
          bountyCoins: rawBountyCoins,
          createdAt
        });
        if (providedSig !== expectedSig && providedSig !== expectedRawSig) {
          logger.warn('Rejected friend challenge: signature mismatch (tampering detected)');
          return null;
        }
      }

      return {
        id: String(parsed.i || `fc_${createdAt}`),
        gameId: canonicalGameId,
        gameTitle: String(parsed.t || 'Arcade Game').slice(0, 80),
        challengerName: String(parsed.n).slice(0, 40),
        targetScore,
        message: String(parsed.m || '').slice(0, 200),
        bountyCoins,
        bountyXp,
        createdAt,
        expiresAt: Number(parsed.ea) || createdAt + 7 * 24 * 60 * 60 * 1000,
        status: 'pending'
      };
    } catch (e) {
      logger.warn('Failed to decode challenge from URL payload', { error: e });
      return null;
    }
  },

  generateShareUrl(challenge: FriendChallenge): string {
    const code = this.encodeChallenge(challenge);
    const sig = this.computeSignature(challenge);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/game/${challenge.gameId}?challenge=${code}&sig=${sig}`;
  },

  parseChallengeFromUrl(searchParams: URLSearchParams): FriendChallenge | null {
    const challengeParam = searchParams.get('challenge') || searchParams.get('c');
    if (!challengeParam) return null;
    const sigParam = searchParams.get('sig');
    return this.decodeChallenge(challengeParam, sigParam);
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

