import { ILifecycleController, GameRuntimeState } from '../types/gameSdk';
import { IScoreController, ILoopController, IAudioController, ITelemetryController, IReplayController } from '../types/gameSdk';

export interface LifecycleCoordinatorOptions {
  gameId: string;
  score: IScoreController;
  loop: ILoopController;
  audio: IAudioController;
  telemetry: ITelemetryController;
  replay: IReplayController;
  onPause?: () => void;
  onResume?: () => void;
  onRestart?: () => void;
}

export class LifecycleCoordinator implements ILifecycleController {
  private currentState: GameRuntimeState = 'ready';
  private listeners: Set<(state: GameRuntimeState, prevState: GameRuntimeState) => void> = new Set();
  private countdownTimer: any = null;
  private isDestroyed: boolean = false;
  private opts: LifecycleCoordinatorOptions;

  constructor(opts: LifecycleCoordinatorOptions) {
    this.opts = opts;
    this.setupWindowEvents();
  }

  private setupWindowEvents(): void {
    if (typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.hidden && this.currentState === 'playing') {
        this.pauseGame();
      }
    };

    const handleBlur = () => {
      if (this.currentState === 'playing') {
        this.pauseGame();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    this.cleanupWindowEvents = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }

  private cleanupWindowEvents?: () => void;

  public getState(): GameRuntimeState {
    return this.currentState;
  }

  public setState(nextState: GameRuntimeState): void {
    if (this.isDestroyed || this.currentState === nextState) return;
    const prevState = this.currentState;
    this.currentState = nextState;

    this.listeners.forEach((listener) => {
      try {
        listener(nextState, prevState);
      } catch {}
    });
  }

  public startWithCountdown(onComplete?: () => void): void {
    if (this.isDestroyed) return;
    this.clearCountdown();

    this.opts.score.reset();
    this.opts.replay.start();
    this.opts.telemetry.recordGameStart();

    this.setState('countdown');
    this.opts.audio.playCountdown(3);

    let count = 3;
    this.countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        this.opts.audio.playCountdown(count);
      } else {
        this.clearCountdown();
        this.opts.audio.playCountdownGo();
        this.setState('playing');
        if (onComplete) {
          onComplete();
        }
      }
    }, 800);
  }

  public pauseGame(): void {
    if (this.isDestroyed || this.currentState !== 'playing') return;
    this.opts.loop.pause();
    this.setState('paused');
    if (this.opts.onPause) {
      this.opts.onPause();
    }
  }

  public resumeGame(): void {
    if (this.isDestroyed || this.currentState !== 'paused') return;
    this.opts.loop.resume();
    this.setState('playing');
    if (this.opts.onResume) {
      this.opts.onResume();
    }
  }

  public togglePause(): void {
    if (this.currentState === 'playing') {
      this.pauseGame();
    } else if (this.currentState === 'paused') {
      this.resumeGame();
    }
  }

  public triggerGameOver(finalScore?: number): void {
    if (this.isDestroyed || this.currentState === 'gameover') return;
    this.clearCountdown();
    this.opts.loop.stop();

    const score = this.opts.score.commit(finalScore);
    this.opts.audio.playGameOver();
    this.opts.replay.finish(score);
    this.opts.telemetry.recordGameOver(score);

    this.setState('gameover');
  }

  public triggerRestart(): void {
    if (this.isDestroyed) return;
    this.clearCountdown();
    this.opts.loop.stop();
    this.opts.score.reset();
    this.opts.replay.discard();
    this.setState('ready');
    if (this.opts.onRestart) {
      this.opts.onRestart();
    }
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    this.clearCountdown();
    this.opts.loop.stop();
    this.opts.audio.stopAll();
    if (this.cleanupWindowEvents) {
      this.cleanupWindowEvents();
    }
    this.setState('destroyed');
    this.isDestroyed = true;
    this.listeners.clear();
  }

  public subscribe(listener: (state: GameRuntimeState, prevState: GameRuntimeState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private clearCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }
}
