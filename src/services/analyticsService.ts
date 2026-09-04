import { AnalyticsEvent, AnalyticsEventType } from '../types';
import { logger } from '../utils/logger';

class AnalyticsService {
  private buffer: AnalyticsEvent[] = [];
  private readonly STORAGE_KEY = 'zigame_analytics_buffer_v2';
  private readonly METRICS_STORAGE_KEY = 'zigame_product_metrics_v2';
  private sessionStartTime: number = Date.now();
  private sessionGamesPlayed: number = 0;

  constructor() {
    this.loadBuffer();
    // Flush buffered events every 45 seconds or on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
    }
  }

  private loadBuffer() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        this.buffer = JSON.parse(saved);
      }
    } catch {
      this.buffer = [];
    }
  }

  private saveBuffer() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.buffer.slice(-100)));
    } catch {
      // Storage quota safety
    }
  }

  public track(
    eventType: AnalyticsEventType, 
    params: {
      userId?: string;
      gameId?: string;
      durationMs?: number;
      score?: number;
      difficulty?: string;
      masteryLevel?: number;
      sessionId?: string;
      metadata?: Record<string, any>;
    } = {}
  ) {
    const event: AnalyticsEvent = {
      eventType,
      userId: params.userId || 'guest',
      timestamp: Date.now(),
      gameId: params.gameId,
      durationMs: params.durationMs,
      score: params.score,
      difficulty: params.difficulty,
      masteryLevel: params.masteryLevel,
      sessionId: params.sessionId,
      metadata: params.metadata
    };

    if (eventType === 'game_start') {
      this.sessionGamesPlayed++;
    }

    this.buffer.push(event);
    this.saveBuffer();
    this.updateAggregatedMetrics(event);

    logger.debug(`[Analytics] Tracked ${eventType}`, { code: 'ANALYTICS_EVENT', context: { eventType, gameId: params.gameId } });

    if (this.buffer.length >= 10) {
      this.flush();
    }
  }

  public async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const eventsToSend = [...this.buffer];
    this.buffer = [];
    this.saveBuffer();

    try {
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: eventsToSend })
      });
    } catch (e) {
      // Re-queue events if network failed
      this.buffer = [...eventsToSend.slice(-50), ...this.buffer];
      this.saveBuffer();
    }
  }

  private updateAggregatedMetrics(event: AnalyticsEvent) {
    try {
      const raw = localStorage.getItem(this.METRICS_STORAGE_KEY);
      const metrics = raw ? JSON.parse(raw) : {
        totalAppOpens: 0,
        totalGameStarts: 0,
        totalGameCompletes: 0,
        totalGameAbandons: 0,
        totalGameRestarts: 0,
        gamesStats: {} as Record<string, { starts: number; completes: number; abandons: number; restarts: number; totalDurationMs: number }>,
        firstSeenDate: new Date().toISOString().split('T')[0],
        activeDays: [] as string[]
      };

      const today = new Date().toISOString().split('T')[0];
      if (!metrics.activeDays.includes(today)) {
        metrics.activeDays.push(today);
      }

      if (event.eventType === 'app_open') metrics.totalAppOpens++;
      if (event.eventType === 'game_start') metrics.totalGameStarts++;
      if (event.eventType === 'game_complete') metrics.totalGameCompletes++;
      if (event.eventType === 'game_abandon') metrics.totalGameAbandons++;
      if (event.eventType === 'game_restart') metrics.totalGameRestarts++;

      if (event.gameId) {
        if (!metrics.gamesStats[event.gameId]) {
          metrics.gamesStats[event.gameId] = { starts: 0, completes: 0, abandons: 0, restarts: 0, totalDurationMs: 0 };
        }
        const g = metrics.gamesStats[event.gameId];
        if (event.eventType === 'game_start') g.starts++;
        if (event.eventType === 'game_complete') {
          g.completes++;
          if (event.durationMs) g.totalDurationMs += event.durationMs;
        }
        if (event.eventType === 'game_abandon') g.abandons++;
        if (event.eventType === 'game_restart') g.restarts++;
      }

      localStorage.setItem(this.METRICS_STORAGE_KEY, JSON.stringify(metrics));
    } catch (err) {
      console.warn('Metrics aggregation error', err);
    }
  }

  public getProductMetrics() {
    try {
      const raw = localStorage.getItem(this.METRICS_STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      
      const sessionDurationSec = Math.round((Date.now() - this.sessionStartTime) / 1000);
      const totalStarts = data.totalGameStarts || 0;
      const totalCompletes = data.totalGameCompletes || 0;
      const totalAbandons = data.totalGameAbandons || 0;
      const totalRestarts = data.totalGameRestarts || 0;

      const completionRate = totalStarts > 0 ? Math.round((totalCompletes / totalStarts) * 100) : 100;
      const abandonRate = totalStarts > 0 ? Math.round((totalAbandons / totalStarts) * 100) : 0;
      const retryRate = totalCompletes > 0 ? Math.round((totalRestarts / totalCompletes) * 100) : 0;

      return {
        retention: {
          d1Active: data.activeDays.length >= 2,
          d7Active: data.activeDays.length >= 5,
          d30Active: data.activeDays.length >= 15,
          totalActiveDays: data.activeDays.length
        },
        engagement: {
          currentSessionDurationSec: sessionDurationSec,
          gamesThisSession: this.sessionGamesPlayed,
          totalAppOpens: data.totalAppOpens || 1
        },
        gameHealth: {
          completionRate,
          abandonRate,
          retryRate,
          totalStarts,
          totalCompletes,
          gamesStats: data.gamesStats
        }
      };
    } catch {
      return null;
    }
  }
}

export const analyticsService = new AnalyticsService();
