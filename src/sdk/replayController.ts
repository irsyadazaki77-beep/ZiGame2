import { IReplayController } from '../types/gameSdk';
import { GhostDeltaPoint, GhostPoint, GhostRunData } from '../types';
import {
  replayService,
  encodeDeltaTrajectory,
  decodeDeltaTrajectory,
  computeGhostChecksum,
  verifyGhostChecksum
} from '../services/replayService';

export interface ReplayControllerOptions {
  sampleIntervalMs?: number;
}

export class ReplayController implements IReplayController {
  private readonly gameId: string;
  private sampleIntervalMs: number;

  constructor(gameId: string, options?: ReplayControllerOptions) {
    this.gameId = gameId;
    this.sampleIntervalMs = options?.sampleIntervalMs ?? 100;
  }

  public getSampleInterval(): number {
    return this.sampleIntervalMs;
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

  public saveGhostRun(finalScore: number, gameVersion: string = '1.0.0'): GhostRunData | null {
    return this.finish(finalScore, gameVersion);
  }

  /**
   * Produces a compact delta-encoded payload with checksum for network transmission.
   */
  public getCompressedPayload(
    finalScore: number,
    gameVersion: string = '1.0.0'
  ): (Omit<GhostRunData, 'points'> & { deltaPoints: GhostDeltaPoint[] }) | null {
    const finished = this.finish(finalScore, gameVersion);
    if (!finished) return null;
    const deltaPoints = finished.deltaPoints ?? encodeDeltaTrajectory(finished.points);
    return {
      gameId: finished.gameId,
      score: finished.score,
      durationMs: finished.durationMs,
      recordedAt: finished.recordedAt,
      deltaPoints,
      encoding: 'delta',
      sampleIntervalMs: finished.sampleIntervalMs ?? this.sampleIntervalMs,
      gameVersion: finished.gameVersion,
      checksum: finished.checksum
    };
  }

  public encodeTrajectory(points: GhostPoint[]): GhostDeltaPoint[] {
    return encodeDeltaTrajectory(points);
  }

  public decodeTrajectory(deltas: GhostDeltaPoint[]): GhostPoint[] {
    return decodeDeltaTrajectory(deltas);
  }

  public computeChecksum(data: Omit<GhostRunData, 'checksum'>): string {
    return computeGhostChecksum(data);
  }

  public verifyChecksum(data: GhostRunData): boolean {
    return verifyGhostChecksum(data);
  }

  public discard(): void {
    replayService.discardRecording();
  }

  public getGhostRun(): GhostRunData | null {
    return replayService.getGhostRun(this.gameId);
  }
}
