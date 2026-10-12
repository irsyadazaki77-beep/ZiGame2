import { performanceService, PerformanceSnapshot } from './performanceService';

export interface TelemetrySessionEvent {
  gameId: string;
  eventType: 'start' | 'gameover' | 'quit' | 'restart' | 'tutorial_view' | 'tutorial_complete' | 'crash' | 'performance_snapshot';
  durationMs?: number;
  score?: number;
  failurePoint?: string;
  fpsTier: string;
  inputSource: string;
  performanceSnapshot?: PerformanceSnapshot;
  timestamp: number;
}

const STORAGE_KEY = 'zigame_telemetry_events_v1';

class TelemetryService {
  private events: TelemetrySessionEvent[] = [];
  private activeSessionStart: number | null = null;
  private activeGameId: string | null = null;
  private saveTimer: any = null;

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

  /**
   * Debounced save to prevent synchronous localStorage disk I/O from janking the render loop
   */
  private scheduleSave() {
    if (this.saveTimer) return;

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        // Keep last 300 telemetry events to stay compact
        const pruned = this.events.slice(-300);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
      } catch {}
    }, 1000);
  }

  public flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    try {
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
    this.scheduleSave();
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

    const perfSnapshot = performanceService.getPerformanceSnapshot(gameId);

    const event: TelemetrySessionEvent = {
      gameId,
      eventType: 'gameover',
      durationMs,
      score,
      failurePoint,
      fpsTier: performanceService.getSettings().tier,
      inputSource,
      performanceSnapshot: perfSnapshot,
      timestamp: Date.now()
    };

    this.events.push(event);
    this.scheduleSave();
  }

  public recordPerformanceSnapshot(gameId: string): void {
    const snapshot = performanceService.getPerformanceSnapshot(gameId);
    const event: TelemetrySessionEvent = {
      gameId,
      eventType: 'performance_snapshot',
      fpsTier: performanceService.getSettings().tier,
      inputSource: 'engine',
      performanceSnapshot: snapshot,
      timestamp: Date.now()
    };

    this.events.push(event);
    this.scheduleSave();
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
    this.scheduleSave();
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
    this.flush();
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
    this.scheduleSave();
  }

  public getEvents(): TelemetrySessionEvent[] {
    return [...this.events];
  }

  public clearTelemetry(): void {
    this.events = [];
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
}

export const telemetryService = new TelemetryService();
