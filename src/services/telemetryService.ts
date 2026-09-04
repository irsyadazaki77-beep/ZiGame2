import { performanceService } from './performanceService';

export interface TelemetrySessionEvent {
  gameId: string;
  eventType: 'start' | 'gameover' | 'quit' | 'restart' | 'tutorial_view' | 'tutorial_complete' | 'crash';
  durationMs?: number;
  score?: number;
  failurePoint?: string; // e.g. "wall_collision", "speed_wall", "alien_projectile"
  fpsTier: string;
  inputSource: string;
  timestamp: number;
}

const STORAGE_KEY = 'zigame_telemetry_events_v1';

class TelemetryService {
  private events: TelemetrySessionEvent[] = [];
  private activeSessionStart: number | null = null;
  private activeGameId: string | null = null;

  constructor() {
    this.loadEvents();
  }

  private loadEvents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.events = JSON.parse(raw);
      }
    } catch {
      this.events = [];
    }
  }

  private saveEvents() {
    try {
      // Keep last 300 telemetry events to stay compact
      const pruned = this.events.slice(-300);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    } catch {}
  }

  public recordGameStart(gameId: string, inputSource: string = 'keyboard'): void {
    this.activeGameId = gameId;
    this.activeSessionStart = performance.now();

    const event: TelemetrySessionEvent = {
      gameId,
      eventType: 'start',
      fpsTier: performanceService.getSettings().tier,
      inputSource,
      timestamp: Date.now()
    };

    this.events.push(event);
    this.saveEvents();
  }

  public recordGameOver(
    gameId: string,
    score: number,
    failurePoint?: string,
    inputSource: string = 'keyboard'
  ): void {
    const durationMs = this.activeSessionStart ? Math.round(performance.now() - this.activeSessionStart) : 0;
    this.activeSessionStart = null;
    this.activeGameId = null;

    const event: TelemetrySessionEvent = {
      gameId,
      eventType: 'gameover',
      durationMs,
      score,
      failurePoint,
      fpsTier: performanceService.getSettings().tier,
      inputSource,
      timestamp: Date.now()
    };

    this.events.push(event);
    this.saveEvents();
  }

  public recordQuit(gameId: string, score: number = 0): void {
    const durationMs = this.activeSessionStart ? Math.round(performance.now() - this.activeSessionStart) : 0;
    this.activeSessionStart = null;
    this.activeGameId = null;

    const event: TelemetrySessionEvent = {
      gameId,
      eventType: 'quit',
      durationMs,
      score,
      fpsTier: performanceService.getSettings().tier,
      inputSource: 'unknown',
      timestamp: Date.now()
    };

    this.events.push(event);
    this.saveEvents();
  }

  public recordCrash(gameId: string, errorMsg: string): void {
    const event: TelemetrySessionEvent = {
      gameId,
      eventType: 'crash',
      failurePoint: errorMsg.slice(0, 100),
      fpsTier: performanceService.getSettings().tier,
      inputSource: 'unknown',
      timestamp: Date.now()
    };

    this.events.push(event);
    this.saveEvents();
  }

  public recordTutorialEvent(gameId: string, completed: boolean): void {
    const event: TelemetrySessionEvent = {
      gameId,
      eventType: completed ? 'tutorial_complete' : 'tutorial_view',
      fpsTier: performanceService.getSettings().tier,
      inputSource: 'unknown',
      timestamp: Date.now()
    };

    this.events.push(event);
    this.saveEvents();
  }

  public getEvents(): TelemetrySessionEvent[] {
    return [...this.events];
  }

  public clearTelemetry(): void {
    this.events = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
}

export const telemetryService = new TelemetryService();
