import { ITelemetryController } from '../types/gameSdk';
import { telemetryService } from '../services/telemetryService';
import { inputManager } from '../services/inputService';

export class TelemetryController implements ITelemetryController {
  private gameId: string;
  private lastInputTelemetry: number = 0;

  constructor(gameId: string) {
    this.gameId = gameId;
  }

  public recordGameStart(inputSource?: string): void {
    const src = inputSource || inputManager.getActiveSource();
    telemetryService.recordGameStart(this.gameId, src);
  }

  public recordGameOver(score: number, failurePoint?: string, inputSource?: string): void {
    const src = inputSource || inputManager.getActiveSource();
    telemetryService.recordGameOver(this.gameId, score, failurePoint, src);
  }

  public recordQuit(score: number = 0): void {
    telemetryService.recordQuit(this.gameId, score);
  }

  public recordEvent(eventName: string, data?: Record<string, any>): void {
    // Non-blocking telemetry tracking
    if (eventName === 'crash') {
      telemetryService.recordCrash(this.gameId, data?.message || 'Unknown Crash');
    }
  }

  public recordInput(action: string): void {
    // Throttle input telemetry: sample at most once every 1000ms
    const now = performance.now();
    if (now - this.lastInputTelemetry < 1000) return;
    this.lastInputTelemetry = now;
  }
}
