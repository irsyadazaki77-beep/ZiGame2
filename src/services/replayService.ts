import { GhostPoint, GhostRunData } from '../types';

const PREFIX = 'zigame_ghost_';

class ReplayService {
  private activeRecording: {
    gameId: string;
    startTime: number;
    points: GhostPoint[];
  } | null = null;

  public startRecording(gameId: string): void {
    this.activeRecording = {
      gameId,
      startTime: performance.now(),
      points: []
    };
  }

  public recordPoint(x?: number, y?: number, action?: string, score?: number): void {
    if (!this.activeRecording) return;

    // Cap points to prevent memory or storage bloat
    if (this.activeRecording.points.length >= 1000) return;

    const t = Math.round(performance.now() - this.activeRecording.startTime);
    this.activeRecording.points.push({
      t,
      x: x !== undefined ? Math.round(x * 10) / 10 : undefined,
      y: y !== undefined ? Math.round(y * 10) / 10 : undefined,
      a: action,
      s: score
    });
  }

  public finishRecording(finalScore: number, gameVersion: string = '1.0.0'): GhostRunData | null {
    if (!this.activeRecording || this.activeRecording.points.length === 0) {
      this.activeRecording = null;
      return null;
    }

    const durationMs = Math.round(performance.now() - this.activeRecording.startTime);
    const ghostData: GhostRunData = {
      gameId: this.activeRecording.gameId,
      score: finalScore,
      durationMs,
      recordedAt: Date.now(),
      points: this.activeRecording.points,
      gameVersion
    };

    // Check if this run is higher score than existing ghost
    const existingGhost = this.getGhostRun(this.activeRecording.gameId);
    if (!existingGhost || finalScore > existingGhost.score) {
      this.saveGhostRun(ghostData);
    }

    this.activeRecording = null;
    return ghostData;
  }

  public discardRecording(): void {
    this.activeRecording = null;
  }

  public getGhostRun(gameId: string): GhostRunData | null {
    try {
      const raw = localStorage.getItem(`${PREFIX}${gameId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public saveGhostRun(data: GhostRunData): void {
    try {
      localStorage.setItem(`${PREFIX}${data.gameId}`, JSON.stringify(data));
    } catch {}
  }
}

export const replayService = new ReplayService();
