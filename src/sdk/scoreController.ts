import { IScoreController } from '../types/gameSdk';

export class ScoreController implements IScoreController {
  private currentScore: number = 0;
  private committed: boolean = false;
  private listeners: Set<(score: number) => void> = new Set();
  private onScoreUpdateCallback?: (score: number) => void;
  private onGameOverCallback?: (finalScore: number) => void;

  constructor(
    initialScore: number = 0,
    callbacks?: {
      onScoreUpdate?: (score: number) => void;
      onGameOver?: (finalScore: number) => void;
    }
  ) {
    this.currentScore = Math.max(0, initialScore);
    this.onScoreUpdateCallback = callbacks?.onScoreUpdate;
    this.onGameOverCallback = callbacks?.onGameOver;
  }

  public get(): number {
    return this.currentScore;
  }

  public set(score: number): void {
    if (this.committed) return;
    const clamped = Math.max(0, Math.floor(score));
    if (this.currentScore !== clamped) {
      this.currentScore = clamped;
      this.notifyListeners();
    }
  }

  public add(points: number): number {
    if (this.committed || points === 0) return this.currentScore;
    this.currentScore = Math.max(0, this.currentScore + Math.floor(points));
    this.notifyListeners();
    return this.currentScore;
  }

  public reset(): void {
    this.currentScore = 0;
    this.committed = false;
    this.notifyListeners();
  }

  public commit(finalScore?: number): number {
    if (this.committed) {
      return this.currentScore;
    }
    this.committed = true;
    if (finalScore !== undefined) {
      this.currentScore = Math.max(0, Math.floor(finalScore));
    }
    const scoreToSubmit = this.currentScore;
    if (this.onGameOverCallback) {
      this.onGameOverCallback(scoreToSubmit);
    }
    this.notifyListeners();
    return scoreToSubmit;
  }

  public isCommitted(): boolean {
    return this.committed;
  }

  public subscribe(listener: (score: number) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentScore);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const s = this.currentScore;
    if (this.onScoreUpdateCallback) {
      this.onScoreUpdateCallback(s);
    }
    this.listeners.forEach((listener) => {
      try {
        listener(s);
      } catch {}
    });
  }
}
