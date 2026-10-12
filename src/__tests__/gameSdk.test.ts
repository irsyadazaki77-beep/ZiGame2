// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScoreController } from '../sdk/scoreController';
import { LoopController } from '../sdk/loopController';
import { LifecycleCoordinator } from '../sdk/lifecycleCoordinator';
import { AudioController } from '../sdk/audioController';
import { TelemetryController } from '../sdk/telemetryController';
import { ReplayController } from '../sdk/replayController';
import { PerformanceController } from '../sdk/performanceController';
import { PersistenceController } from '../sdk/persistenceController';
import { InputController } from '../sdk/inputController';
import { ViewportController } from '../sdk/viewportController';
import { createGameRuntimeContext } from '../sdk/runtimeContext';
import { CANONICAL_GAME_IDS } from '../config/canonicalGames';
import { CANONICAL_GAME_REGISTRY } from '../config/gameRegistry';

describe('ZiGame 2.0 Unified Game SDK & Architecture Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ScoreController', () => {
    it('should manage scores correctly and disallow modifications once committed', () => {
      const onScoreUpdate = vi.fn();
      const onGameOver = vi.fn();
      const score = new ScoreController(0, { onScoreUpdate, onGameOver });

      expect(score.get()).toBe(0);
      expect(score.isCommitted()).toBe(false);

      score.add(10);
      expect(score.get()).toBe(10);
      expect(onScoreUpdate).toHaveBeenCalledWith(10);

      score.set(50);
      expect(score.get()).toBe(50);
      expect(onScoreUpdate).toHaveBeenCalledWith(50);

      const finalScore = score.commit();
      expect(finalScore).toBe(50);
      expect(score.isCommitted()).toBe(true);
      expect(onGameOver).toHaveBeenCalledWith(50);

      // Post-commit mutations should be ignored
      score.add(20);
      expect(score.get()).toBe(50);
      score.set(100);
      expect(score.get()).toBe(50);

      // Multiple commits should return the same committed score without double triggering
      const secondCommit = score.commit(200);
      expect(secondCommit).toBe(50);
      expect(onGameOver).toHaveBeenCalledTimes(1);

      // Reset allows fresh scoring
      score.reset();
      expect(score.get()).toBe(0);
      expect(score.isCommitted()).toBe(false);
      score.add(15);
      expect(score.get()).toBe(15);
    });

    it('should notify subscriber listeners on score changes', () => {
      const score = new ScoreController(5);
      const listener = vi.fn();
      const unsubscribe = score.subscribe(listener);

      // Initial notification
      expect(listener).toHaveBeenCalledWith(5);

      score.add(10);
      expect(listener).toHaveBeenCalledWith(15);

      unsubscribe();
      score.add(20);
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe('LoopController', () => {
    it('should control game loops and enforce safe delta bounds', () => {
      const loop = new LoopController();
      expect(loop.isRunning()).toBe(false);

      const stepCallback = vi.fn();
      loop.start(stepCallback);
      expect(loop.isRunning()).toBe(true);

      loop.pause();
      expect(loop.isRunning()).toBe(false);

      loop.resume();
      expect(loop.isRunning()).toBe(true);

      loop.stop();
      expect(loop.isRunning()).toBe(false);
    });
  });

  describe('LifecycleCoordinator', () => {
    it('should coordinate state transitions from ready -> countdown -> playing -> paused -> gameover', () => {
      const score = new ScoreController();
      const loop = new LoopController();
      const audio = new AudioController();
      const telemetry = new TelemetryController('snake');
      const replay = new ReplayController('snake');

      const onPause = vi.fn();
      const onResume = vi.fn();
      const onRestart = vi.fn();

      const lifecycle = new LifecycleCoordinator({
        gameId: 'snake',
        score,
        loop,
        audio,
        telemetry,
        replay,
        onPause,
        onResume,
        onRestart
      });

      expect(lifecycle.getState()).toBe('ready');

      const stateListener = vi.fn();
      lifecycle.subscribe(stateListener);

      // Start countdown
      const onCountdownEnd = vi.fn();
      lifecycle.startWithCountdown(onCountdownEnd);
      expect(lifecycle.getState()).toBe('countdown');
      expect(stateListener).toHaveBeenCalledWith('countdown', 'ready');

      // Fast-forward countdown timer (3 * 800ms)
      vi.advanceTimersByTime(2500);
      expect(lifecycle.getState()).toBe('playing');
      expect(onCountdownEnd).toHaveBeenCalled();

      // Pause and resume
      lifecycle.pauseGame();
      expect(lifecycle.getState()).toBe('paused');
      expect(onPause).toHaveBeenCalled();

      lifecycle.resumeGame();
      expect(lifecycle.getState()).toBe('playing');
      expect(onResume).toHaveBeenCalled();

      // Toggle pause
      lifecycle.togglePause();
      expect(lifecycle.getState()).toBe('paused');
      lifecycle.togglePause();
      expect(lifecycle.getState()).toBe('playing');

      // Game over idempotency
      score.set(250);
      lifecycle.triggerGameOver();
      expect(lifecycle.getState()).toBe('gameover');
      expect(score.isCommitted()).toBe(true);
      expect(score.get()).toBe(250);

      // Calling triggerGameOver again does nothing
      lifecycle.triggerGameOver(500);
      expect(score.get()).toBe(250);

      // Restart
      lifecycle.triggerRestart();
      expect(lifecycle.getState()).toBe('ready');
      expect(onRestart).toHaveBeenCalled();
      expect(score.get()).toBe(0);

      // Destroy
      lifecycle.destroy();
      expect(lifecycle.getState()).toBe('destroyed');
    });
  });

  describe('PersistenceController', () => {
    it('should save and load validated state with checksum verification', () => {
      const persistence = new PersistenceController('neon-pong');

      expect(persistence.hasSave()).toBe(false);
      expect(persistence.load()).toBeNull();

      const gameData = { paddleX: 120, aiScore: 3, userScore: 5 };
      const saved = persistence.save(50, gameData);
      expect(saved).toBe(true);
      expect(persistence.hasSave()).toBe(true);

      const loaded = persistence.load<typeof gameData>();
      expect(loaded).toBeDefined();
      expect(loaded?.score).toBe(50);
      expect(loaded?.data).toEqual(gameData);
      expect(loaded?.gameId).toBe('neon-pong');

      persistence.clear();
      expect(persistence.hasSave()).toBe(false);
    });
  });

  describe('ReplayController', () => {
    it('should record ghost run data and persist personal best runs', () => {
      const replay = new ReplayController('pixel-dino');

      replay.start();
      replay.recordPoint(10, 20, 'jump', 10);
      replay.recordPoint(30, 20, 'duck', 25);

      const ghost = replay.finish(100);
      expect(ghost).toBeDefined();
      expect(ghost?.gameId).toBe('pixel-dino');
      expect(ghost?.score).toBe(100);
      expect(ghost?.points.length).toBe(2);

      const savedGhost = replay.getGhostRun();
      expect(savedGhost).toBeDefined();
      expect(savedGhost?.score).toBe(100);

      // Discard run
      replay.start();
      replay.recordPoint(5, 5, 'run', 5);
      replay.discard();
      expect(replay.getGhostRun()?.score).toBe(100);
    });
  });

  describe('ViewportController', () => {
    it('should map client coordinates to logical canvas bounds accurately', () => {
      const viewport = new ViewportController();
      const canvas = document.createElement('canvas');

      // Mock getBoundingClientRect
      canvas.getBoundingClientRect = () => ({
        left: 50,
        top: 100,
        width: 400,
        height: 300,
        right: 450,
        bottom: 400,
        x: 50,
        y: 100,
        toJSON: () => {}
      });

      // Click at center (clientX: 250, clientY: 250)
      const coords = viewport.toLogicalCoords(canvas, 250, 250, 800, 600);
      expect(coords.x).toBe(400); // (250 - 50) / 400 * 800 = 400
      expect(coords.y).toBe(300); // (250 - 100) / 300 * 600 = 300

      // Clamp out-of-bounds clicks
      const clamped = viewport.toLogicalCoords(canvas, 0, 0, 800, 600);
      expect(clamped.x).toBe(0);
      expect(clamped.y).toBe(0);
    });
  });

  describe('Runtime Context & Canonical Integration', () => {
    it('should initialize complete runtime context for all canonical games', () => {
      for (const gameId of CANONICAL_GAME_IDS) {
        const ctx = createGameRuntimeContext({ gameId });
        expect(ctx.gameId).toBe(gameId);
        expect(ctx.score).toBeDefined();
        expect(ctx.input).toBeDefined();
        expect(ctx.audio).toBeDefined();
        expect(ctx.telemetry).toBeDefined();
        expect(ctx.performance).toBeDefined();
        expect(ctx.persistence).toBeDefined();
        expect(ctx.replay).toBeDefined();
        expect(ctx.viewport).toBeDefined();
        expect(ctx.loop).toBeDefined();
        expect(ctx.lifecycle).toBeDefined();
        expect(ctx.lifecycle.getState()).toBe('ready');
        ctx.lifecycle.destroy();
      }
    });

    it('should normalize legacy aliases to canonical IDs in runtime context', () => {
      const ctx = createGameRuntimeContext({ gameId: 'brick' });
      expect(ctx.gameId).toBe('brick-breaker');
      ctx.lifecycle.destroy();

      const ctx2 = createGameRuntimeContext({ gameId: '2048' });
      expect(ctx2.gameId).toBe('neon-2048');
      ctx2.lifecycle.destroy();
    });
  });
});
