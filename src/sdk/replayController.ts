import { IReplayController } from '../types/gameSdk';
import { GhostRunData } from '../types';
import { replayService } from '../services/replayService';

export class ReplayController implements IReplayController {
  private gameId: string;

  constructor(gameId: string) {
    this.gameId = gameId;
  }

  public start(): void {
    replayService.startRecording(this.gameId);
  }

  public recordPoint(x?: number, y?: number, action?: string, score?: number): void {
    replayService.recordPoint(x, y, action, score);
  }

  public finish(finalScore: number, gameVersion: string = '1.0.0'): GhostRunData | null {
    return replayService.finishRecording(finalScore, gameVersion);
  }

  public discard(): void {
    replayService.discardRecording();
  }

  public getGhostRun(): GhostRunData | null {
    return replayService.getGhostRun(this.gameId);
  }
}
