import { isFirebaseReady, auth } from './firebase';
import { withRetry } from '../utils/resilience';
import { logger } from '../utils/logger';

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
  startSession: async (gameId: string, nonce?: string): Promise<{ sessionId?: string; nonce?: string; startTime?: number }> => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers,
        body: JSON.stringify({ gameId, nonce })
      });
      if (res.ok) {
        const data = await res.json();
        return {
          sessionId: data.sessionId,
          nonce: data.nonce,
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
    sessionId,
    durationMs,
    masteryLevel
  }: ScoreSubmissionParams): Promise<ScoreSubmissionResult> => {
    const idempotencyKey = `score_${gameId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    try {
      return await withRetry(async () => {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/submit-score', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            gameId,
            score,
            playerName,
            playerAvatar,
            sessionId,
            durationMs,
            masteryLevel,
            idempotencyKey
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Server responded with ${res.status}`);
        }

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
      }, { maxRetries: 2, initialDelayMs: 400 });
    } catch (e: any) {
      logger.warn('Score submission failed server verification or was offline', {
        code: 'SCORE_SUBMISSION_OFFLINE',
        gameId,
        context: { score, error: e.message }
      });
      return {
        success: false,
        message: e.message || 'Offline submission'
      };
    }
  }
};
