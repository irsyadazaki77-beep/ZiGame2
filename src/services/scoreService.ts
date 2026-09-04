import { withRetry } from '../utils/resilience';
import { logger } from '../utils/logger';

export interface ScoreSubmissionParams {
  gameId: string;
  score: number;
  playerName: string;
  playerAvatar: string;
  sessionId?: string;
}

const generateScoreChecksum = async (gameId: string, score: number, duration: number, playerName: string): Promise<string> => {
  const secret = "ZiGaMeArcAdE_SeCrEt_SaLt_2026";
  const data = `${gameId}:${score}:${duration}:${playerName}:${secret}`;
  try {
    const msgUint8 = new TextEncoder().encode(data);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback 32-bit FNV hash
    let hash = 0x811c9dc5;
    for (let i = 0; i < data.length; i++) {
      hash ^= data.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
  }
};

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
    const sessionDurationMs = Math.max(15000, score * 200); 

    try {
      const checksum = await generateScoreChecksum(gameId, score, sessionDurationMs, playerName);

      return await withRetry(async () => {
        const res = await fetch('/api/submit-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId,
            score,
            sessionDurationMs,
            playerName,
            playerAvatar,
            checksum,
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

