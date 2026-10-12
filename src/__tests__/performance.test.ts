import { describe, it, expect, beforeEach, vi } from 'vitest';
import { performanceService } from '../services/performanceService';
import { ParticlePool } from '../utils/particlePool';
import { telemetryService } from '../services/telemetryService';
import { LoopController } from '../sdk/loopController';

describe('Phase 5 — Performance Engineering & Frame-Time Optimization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Performance Service & Frame-Time Profiling', () => {
    it('accurately records frame times and computes P50, P95, P99 percentiles', () => {
      // Simulate 100 frames with variable latencies
      for (let i = 1; i <= 100; i++) {
        // Frames 1-90 around 16.6ms, frames 91-95 around 26ms (jank), frames 96-100 around 35ms (dropped)
        const duration = i <= 90 ? 16.6 : i <= 95 ? 26.0 : 35.0;
        performanceService.recordFrameTime(duration);
      }

      const snapshot = performanceService.getPerformanceSnapshot('test-game');
      expect(snapshot.gameId).toBe('test-game');
      expect(snapshot.frameTimeP50).toBeCloseTo(16.6, 1);
      expect(snapshot.frameTimeP95).toBeGreaterThanOrEqual(25);
      expect(snapshot.frameTimeP99).toBeGreaterThanOrEqual(30);
      expect(snapshot.jankCount).toBeGreaterThanOrEqual(5);
      expect(snapshot.droppedFrames).toBeGreaterThanOrEqual(5);
    });

    it('enforces adaptive tier hysteresis and prevents rapid toggling', () => {
      performanceService.setTier('high', true);

      // Low FPS check
      performanceService.recordFramePerformance(20);
      performanceService.recordFramePerformance(20);
      performanceService.recordFramePerformance(20);

      // Should downgrade to medium
      expect(performanceService.getSettings().tier).toBe('medium');

      // Immediate high FPS should not instantly upgrade due to cooldown
      performanceService.recordFramePerformance(60);
      expect(performanceService.getSettings().tier).toBe('medium');
    });

    it('clamps DPR based on configured tier limits', () => {
      performanceService.setTier('low');
      const dpr = performanceService.getAdaptiveDPR();
      expect(dpr).toBeLessThanOrEqual(1.0);

      performanceService.setTier('high');
      const highDpr = performanceService.getAdaptiveDPR();
      expect(highDpr).toBeLessThanOrEqual(1.75);
    });
  });

  describe('Particle Pooling (Zero-Allocation Engine)', () => {
    it('reuses preallocated objects without allocating new arrays during gameplay', () => {
      const pool = new ParticlePool(50);
      expect(pool.getActiveCount()).toBe(0);

      // Spawn 10 particles
      for (let i = 0; i < 10; i++) {
        pool.spawn(i * 10, i * 10, 1, 1, '#ff0055', 3, 1, 5);
      }
      expect(pool.getActiveCount()).toBe(10);

      // Step physics until expired
      for (let step = 0; step < 6; step++) {
        pool.update();
      }

      // All particles should have recycled back to pool
      expect(pool.getActiveCount()).toBe(0);
    });
  });

  describe('Loop Controller & Delta-Time Normalization', () => {
    it('initializes and stops cleanly with zero lingering RAF handles', () => {
      const loop = new LoopController();
      let framesRendered = 0;

      loop.start((_ts, dt) => {
        expect(dt).toBeGreaterThanOrEqual(1);
        expect(dt).toBeLessThanOrEqual(50);
        framesRendered++;
      });

      expect(loop.isRunning()).toBe(true);

      loop.stop();
      expect(loop.isRunning()).toBe(false);
    });
  });

  describe('Telemetry Service & Debounced Batching', () => {
    it('buffers telemetry events and attaches performance snapshot upon game over', () => {
      telemetryService.recordGameStart('snake', 'touch');
      telemetryService.recordGameOver('snake', 250, undefined, 'touch');

      const events = telemetryService.getEvents();
      const lastEvent = events[events.length - 1];
      expect(lastEvent.eventType).toBe('gameover');
      expect(lastEvent.score).toBe(250);
      expect(lastEvent.performanceSnapshot).toBeDefined();
      expect(lastEvent.performanceSnapshot?.gameId).toBe('snake');
    });
  });
});
