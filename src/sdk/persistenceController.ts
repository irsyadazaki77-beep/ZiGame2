import { IPersistenceController } from '../types/gameSdk';
import { GameSaveState } from '../types';
import { saveStateService } from '../services/saveStateService';

export class PersistenceController implements IPersistenceController {
  private gameId: string;

  constructor(gameId: string) {
    this.gameId = gameId;
  }

  public save<T = any>(score: number, data: T, gameVersion: string = '1.0.0'): boolean {
    return saveStateService.saveState(this.gameId, score, data, gameVersion);
  }

  public load<T = any>(): GameSaveState<T> | null {
    return saveStateService.loadState<T>(this.gameId);
  }

  public hasSave(): boolean {
    return saveStateService.hasSaveState(this.gameId);
  }

  public clear(): void {
    saveStateService.clearState(this.gameId);
  }
}
