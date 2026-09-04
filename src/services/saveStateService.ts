import { GameSaveState } from '../types';
import { PLATFORM_CONFIG } from '../config/platformConfig';
import { logger } from '../utils/logger';

const PREFIX = 'zigame_savestate_';

class SaveStateService {
  private calculateChecksum(data: any): string {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }

  public saveState<T = any>(gameId: string, score: number, data: T, gameVersion: string = '1.0.0'): boolean {
    try {
      const state: GameSaveState<T> = {
        gameId,
        gameVersion,
        balanceVersion: PLATFORM_CONFIG.currentPlatformBalanceVersion,
        score,
        timestamp: Date.now(),
        data,
        checksum: this.calculateChecksum(data)
      };
      localStorage.setItem(`${PREFIX}${gameId}`, JSON.stringify(state));
      return true;
    } catch (e) {
      logger.warn(`Failed to save state for game ${gameId}`, { error: e as Error });
      return false;
    }
  }

  public loadState<T = any>(gameId: string): GameSaveState<T> | null {
    try {
      const raw = localStorage.getItem(`${PREFIX}${gameId}`);
      if (!raw) return null;

      const state: GameSaveState<T> = JSON.parse(raw);

      // Validate integrity
      const expectedChecksum = this.calculateChecksum(state.data);
      if (state.checksum !== expectedChecksum) {
        logger.warn(`Corrupted save state detected for ${gameId}. Discarding.`, { code: 'SAVE_CORRUPT' });
        this.clearState(gameId);
        return null;
      }

      // Expire saves older than 7 days
      if (Date.now() - state.timestamp > 7 * 24 * 60 * 60 * 1000) {
        this.clearState(gameId);
        return null;
      }

      return state;
    } catch (e) {
      logger.error(`Error reading save state for ${gameId}`, { error: e as Error });
      return null;
    }
  }

  public clearState(gameId: string): void {
    try {
      localStorage.removeItem(`${PREFIX}${gameId}`);
    } catch {}
  }

  public hasSaveState(gameId: string): boolean {
    return !!localStorage.getItem(`${PREFIX}${gameId}`);
  }
}

export const saveStateService = new SaveStateService();
