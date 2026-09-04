import { withRetry } from '../utils/resilience';
import { logger } from '../utils/logger';

export interface ScoreSubmissionParams {
  gameId: string;
  score: number;
  playerName: string;
  playerAvatar: string;
  sessionId?: string;
}

export const scoreService = {
  startSession: async (gameId: string, userId?: string): Promise<{ sessionId?: string; nonce?: string }> => {
    try {
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, userId })
      });
      if (res.ok) {
        const data = await res.json();
        return { sessionId: data.sessionId, nonce: data.nonce };
      }
    } catch (e) {
      logger.warn('Failed to register game session with server (offline fallback enabled)', {
        code: 'SESSION_START_OFFLINE',
        gameId
      });
    }
    return {};
  },

  submitScore: async ({ gameId, score, playerName, playerAvatar, sessionId }: ScoreSubmissionParams): Promise<{ success: boolean; message?: string }> => {
    const idempotencyKey = `score_${gameId}_${playerName}_${score}_${Date.now()}`;

    try {
      return await withRetry(async () => {
        const res = await fetch('/api/submit-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId,
            score,
            playerName,
            playerAvatar,
            sessionId,
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
          message: data.message
        };
      }, { maxRetries: 2, initialDelayMs: 500 });
    } catch (e: any) {
      logger.warn('Score submission could not be verified by server (saved locally)', {
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

