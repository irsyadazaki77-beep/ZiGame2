import { ILoopController } from '../types/gameSdk';
import { performanceService } from '../services/performanceService';

const safeReqAnimationFrame = (cb: FrameRequestCallback): number => {
  if (typeof requestAnimationFrame !== 'undefined') {
    return requestAnimationFrame(cb);
  }
  return setTimeout(() => cb(performance.now()), 16) as unknown as number;
};

const safeCancelAnimationFrame = (id: number): void => {
  if (typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(id);
  } else {
    clearTimeout(id);
  }
};

export class LoopController implements ILoopController {
  private animFrameId: number | null = null;
  private isLoopRunning: boolean = false;
  private isLoopPaused: boolean = false;
  private lastTimestamp: number = 0;
  private frameCounter: number = 0;
  private fpsTimer: number = 0;
  private stepCallback: ((timestamp: number, deltaTime: number) => void) | null = null;
  private boundVisibilityHandler: (() => void) | null = null;

  public start(stepFn: (timestamp: number, deltaTime: number) => void): void {
    this.stop();
    this.stepCallback = stepFn;
    this.isLoopRunning = true;
    this.isLoopPaused = false;
    this.lastTimestamp = performance.now();
    this.fpsTimer = performance.now();
    this.frameCounter = 0;

    performanceService.registerRafStart();
    this.setupVisibilityListener();

    const loop = (timestamp: number) => {
      if (!this.isLoopRunning) {
        this.stop();
        return;
      }

      if (this.isLoopPaused) {
        // Paused loop does not continuously request RAF
        return;
      }

      const rawDelta = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;

      // Safe delta time: clamp between 1ms and 50ms to prevent physics explosions
      const safeDelta = Math.min(Math.max(rawDelta, 1), 50);

      // Record frame-time distribution for real-time profiling
      performanceService.recordFrameTime(rawDelta);

      // FPS tracking
      this.frameCounter++;
      if (timestamp - this.fpsTimer >= 1000) {
        performanceService.recordFramePerformance(this.frameCounter);
        this.frameCounter = 0;
        this.fpsTimer = timestamp;
      }

      if (this.stepCallback) {
        try {
          this.stepCallback(timestamp, safeDelta);
        } catch (err) {
          console.error('[ZiGame SDK] Error in game loop step:', err);
        }
      }

      if (this.isLoopRunning && !this.isLoopPaused) {
        this.animFrameId = safeReqAnimationFrame(loop);
      }
    };

    this.animFrameId = safeReqAnimationFrame(loop);
  }

  public stop(): void {
    if (this.animFrameId !== null) {
      safeCancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
      performanceService.registerRafEnd();
    }
    this.removeVisibilityListener();
    this.isLoopRunning = false;
    this.isLoopPaused = false;
    this.stepCallback = null;
  }

  public pause(): void {
    if (!this.isLoopPaused) {
      this.isLoopPaused = true;
      if (this.animFrameId !== null) {
        safeCancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
    }
  }

  public resume(): void {
    if (this.isLoopRunning && this.isLoopPaused) {
      this.lastTimestamp = performance.now();
      this.isLoopPaused = false;
      if (this.animFrameId === null && this.stepCallback) {
        const loop = (timestamp: number) => {
          if (!this.isLoopRunning || this.isLoopPaused) return;

          const rawDelta = timestamp - this.lastTimestamp;
          this.lastTimestamp = timestamp;
          const safeDelta = Math.min(Math.max(rawDelta, 1), 50);

          performanceService.recordFrameTime(rawDelta);

          this.frameCounter++;
          if (timestamp - this.fpsTimer >= 1000) {
            performanceService.recordFramePerformance(this.frameCounter);
            this.frameCounter = 0;
            this.fpsTimer = timestamp;
          }

          if (this.stepCallback) {
            try {
              this.stepCallback(timestamp, safeDelta);
            } catch (err) {
              console.error('[ZiGame SDK] Error in game loop step:', err);
            }
          }

          if (this.isLoopRunning && !this.isLoopPaused) {
            this.animFrameId = safeReqAnimationFrame(loop);
          }
        };
        this.animFrameId = safeReqAnimationFrame(loop);
      }
    }
  }

  public isRunning(): boolean {
    return this.isLoopRunning && !this.isLoopPaused;
  }

  private setupVisibilityListener(): void {
    if (typeof document === 'undefined') return;
    this.removeVisibilityListener();
    this.boundVisibilityHandler = () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
      }
    };
    document.addEventListener('visibilitychange', this.boundVisibilityHandler);
  }

  private removeVisibilityListener(): void {
    if (typeof document !== 'undefined' && this.boundVisibilityHandler) {
      document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
      this.boundVisibilityHandler = null;
    }
  }
}
