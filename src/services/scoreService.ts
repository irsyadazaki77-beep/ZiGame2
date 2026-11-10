import { isFirebaseReady, auth } from './firebase';
import { withRetry } from '../utils/resilience';
import { logger } from '../utils/logger';
import { computePayloadProofClient } from '../utils/sessionCrypto';
import { toCanonicalGameId } from '../config/canonicalGames';

export interface ScoreSubmissionParams {
  gameId: string;
  score: number;
  playerName: string;
  playerAvatar: string;
  sessionId?: string;
  durationMs?: number;
  masteryLevel?: number;
}

export interface ScoreSubmissionResult {
  success: boolean;
  gameId?: string;
  score?: number;
  coinsEarned?: number;
  xpEarned?: number;
  newCoinBalance?: number;
  message?: string;
}

interface SessionCryptoMeta {
  nonce: string;
  signature?: string;
  gameId: string;
}

const sessionCryptoStore = new Map<string, SessionCryptoMeta>();

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (isFirebaseReady() && auth?.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (e) {
      logger.warn('Failed to retrieve Firebase ID token for score session', { error: e });
    }
  }
  return headers;
}

export const scoreService = {
  startSession: async (gameId: string, nonce?: string): Promise<{ sessionId?: string; nonce?: string; signature?: string; startTime?: number }> => {
    try {
      const headers = await getAuthHeaders();
      if (!headers['Authorization']) {
        // Offline / unauthenticated guest plays locally without server session
        return {};
      }
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers,
        body: JSON.stringify({ gameId, nonce })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sessionId && data.nonce) {
          sessionCryptoStore.set(data.sessionId, {
            nonce: data.nonce,
            signature: data.signature,
            gameId: toCanonicalGameId(gameId)
          });
        }
        return {
          sessionId: data.sessionId,
          nonce: data.nonce,
          signature: data.signature,
          startTime: data.startTime
        };
      }
    } catch (e) {
      logger.warn('Failed to register game session with server (offline fallback active)', {
        code: 'SESSION_START_OFFLINE',
        gameId
      });
    }
    return {};
  },

  submitScore: async ({
    gameId,
    score,
    playerName,
    playerAvatar,
    sessionId: inputSessionId,
    durationMs,
    masteryLevel
  }: ScoreSubmissionParams): Promise<ScoreSubmissionResult> => {
    // Generate valid formatted idempotency key
    const randSuffix = Math.random().toString(36).substring(2, 10);
    const idempotencyKey = `score_${Date.now()}_${randSuffix}`;

    try {
      // Ensure we have a valid session before submitting
      let activeSessionId = inputSessionId;
      if (!activeSessionId) {
        const sessionRes = await scoreService.startSession(gameId);
        activeSessionId = sessionRes.sessionId;
      }

      if (!activeSessionId) {
        return {
          success: false,
          message: 'Gagal membuat sesi permainan yang terverifikasi.'
        };
      }

      const cryptoMeta = sessionCryptoStore.get(activeSessionId);
      const canonicalGameId = cryptoMeta?.gameId || toCanonicalGameId(gameId);
      const cleanScore = Math.floor(score);
      let clientProof: string | undefined;
      if (cryptoMeta?.nonce) {
        clientProof = await computePayloadProofClient(activeSessionId, canonicalGameId, cleanScore, cryptoMeta.nonce);
      }

      return await withRetry(async () => {
        const headers = await getAuthHeaders();
        if (cryptoMeta?.signature) {
          headers['X-Session-Signature'] = cryptoMeta.signature;
        }
        if (clientProof) {
          headers['X-Client-Proof'] = clientProof;
        }

        const res = await fetch('/api/submit-score', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            gameId,
            score: cleanScore,
            playerName,
            playerAvatar,
            sessionId: activeSessionId,
            durationMs,
            masteryLevel,
            idempotencyKey,
            nonce: cryptoMeta?.nonce,
            signature: cryptoMeta?.signature,
            clientProof
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const error: any = new Error(errData.message || `Server responded with ${res.status}`);
          error.code = errData.code;
          error.status = res.status;
          throw error;
        }

        sessionCryptoStore.delete(activeSessionId!);
        const data = await res.json();
        return {
          success: !!data.success,
          gameId: data.gameId,
          score: data.score,
          coinsEarned: data.coinsEarned,
          xpEarned: data.xpEarned,
          newCoinBalance: data.newCoinBalance,
          message: data.message
        };
      }, { maxRetries: 1, initialDelayMs: 300 });
    } catch (e: any) {
      logger.warn('Score submission failed server verification', {
        code: e.code || 'SCORE_SUBMISSION_ERROR',
        gameId,
        context: { score, error: e.message }
      });
      return {
        success: false,
        message: e.message || 'Gagal mengirim skor permainan ke server.'
      };
    }
  }
};

