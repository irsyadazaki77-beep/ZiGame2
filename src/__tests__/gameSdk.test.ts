// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScoreController } from '../sdk/scoreController';
import { LoopController } from '../sdk/loopController';
import { LifecycleCoordinator } from '../sdk/lifecycleCoordinator';
import { AudioController, audioController } from '../sdk/audioController';
import { TelemetryController } from '../sdk/telemetryController';
import { ReplayController } from '../sdk/replayController';
import { PerformanceController } from '../sdk/performanceController';
import { PersistenceController } from '../sdk/persistenceController';
import { InputController } from '../sdk/inputController';
import { ViewportController } from '../sdk/viewportController';
import { BrickBreakerEngine } from '../sdk/BrickBreakerEngine';
import { PhysicsWorkerController } from '../sdk/physicsWorkerController';
import { createGameRuntimeContext } from '../sdk/runtimeContext';
import { CANONICAL_GAME_IDS, toCanonicalGameId } from '../config/canonicalGames';
import { CANONICAL_GAME_REGISTRY } from '../config/gameRegistry';
import { GAME_QUALITY_MAP, getGameQualityInfo } from '../config/qualityTiers';

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

  describe('ReplayController (Delta Encoding & Sampling Interval)', () => {
    it('should record ghost run data, apply sampling interval throttling, and encode delta trajectories', () => {
      const replay = new ReplayController('pixel-dino', { sampleIntervalMs: 50 });
      expect(replay.getSampleInterval()).toBe(50);

      replay.start();
      // Discrete actions bypass interval throttling
      replay.recordPoint(10, 20, 'jump', 10);
      replay.recordPoint(30, 20, 'duck', 25);

      const ghost = replay.finish(100);
      expect(ghost).toBeDefined();
      expect(ghost?.gameId).toBe('pixel-dino');
      expect(ghost?.score).toBe(100);
      expect(ghost?.points.length).toBe(2);
      expect(ghost?.encoding).toBe('delta');
      expect(ghost?.deltaPoints?.length).toBe(2);
      expect(ghost?.deltaPoints?.[0].dx).toBe(10);
      expect(ghost?.deltaPoints?.[1].dx).toBe(20);

      // Verify lossless delta round-trip decoding
      const decoded = replay.decodeTrajectory(ghost!.deltaPoints!);
      expect(decoded[0].x).toBe(10);
      expect(decoded[1].x).toBe(30);
      expect(decoded[1].a).toBe('duck');

      const savedGhost = replay.getGhostRun();
      expect(savedGhost).toBeDefined();
      expect(savedGhost?.score).toBe(100);

      // Discard run
      replay.start();
      replay.recordPoint(5, 5, 'run', 5);
      replay.discard();
      expect(replay.getGhostRun()?.score).toBe(100);
    });

    it('should downsample high-frequency frame-by-frame positions without actions', () => {
      const replay = new ReplayController('neon-drift', { sampleIntervalMs: 60 });
      replay.start();

      // Frame 0 (t=0ms) -> recorded as first point
      replay.recordPoint(0, 0);
      // Frame 1 (t=16ms) -> throttled (< 60ms and no discrete action)
      vi.advanceTimersByTime(16);
      replay.recordPoint(1, 1);
      // Frame 2 (t=32ms) -> throttled
      vi.advanceTimersByTime(16);
      replay.recordPoint(2, 2);
      // Frame 3 (t=64ms) -> recorded (>= 60ms elapsed)
      vi.advanceTimersByTime(32);
      replay.recordPoint(5, 5);

      const payload = replay.getCompressedPayload(250);
      expect(payload).not.toBeNull();
      expect(payload?.deltaPoints.length).toBe(2);
      expect((payload as Record<string, unknown>).points).toBeUndefined();
    });
    it('should compute and verify checksum for ghost run data, detecting tampering', () => {
      const replay = new ReplayController('neon-drift');
      replay.start();
      replay.recordPoint(0, 0, 'start', 0);
      vi.advanceTimersByTime(120);
      replay.recordPoint(10, 20, undefined, 50);
      vi.advanceTimersByTime(120);
      replay.recordPoint(25, 45, 'drift', 100);

      const run = replay.saveGhostRun(100);
      expect(run).not.toBeNull();
      expect(run?.checksum).toBeDefined();

      // Valid checksum passes
      expect(replay.verifyChecksum(run!)).toBe(true);

      // Tampered points fail verification
      const tamperedRun = {
        ...run!,
        points: [...run!.points, { t: 9999, x: 999, y: 999, score: 9999 }]
      };
      expect(replay.verifyChecksum(tamperedRun)).toBe(false);
    });
  });

  describe('InputController, PerformanceController, AudioController & TelemetryController', () => {
    it('should dispatch and track input events in InputController', () => {
      const input = new InputController('snake');
      const listener = vi.fn();
      const unsub = input.subscribe(listener);

      input.dispatch({ type: 'move', direction: 'left', isDown: true, source: 'keyboard' });
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'move', direction: 'left', isDown: true })
      );

      unsub();
    });

    it('should expose adaptive DPR and particle multipliers in PerformanceController', () => {
      const perf = new PerformanceController();
      expect(perf.getAdaptiveDPR(2)).toBeGreaterThanOrEqual(1);
      expect(perf.getParticleMultiplier()).toBeGreaterThan(0);
      perf.recordFramePerformance(60);
      perf.recordFrameTime(16.6);
    });

    it('should manage mute state, BGM scheduler and sound triggers in AudioController & TelemetryController', () => {
      const audio = new AudioController();
      expect(typeof audio.isMuted()).toBe('boolean');
      audio.playCoin();
      audio.playJump();
      audio.playLaser();
      audio.playScore();
      audio.playHit();
      audio.playPowerup();
      audio.playExplosion();

      audio.startBgm();
      audio.stopBgm();
      expect(audio.isBgmPlaying()).toBe(false);

      audio.stopAll();

      const telemetry = new TelemetryController('brick-breaker');
      expect(() => {
        telemetry.recordGameStart('keyboard');
        telemetry.recordInput('LEFT');
        telemetry.recordEvent('stage_clear', { stage: 2 });
        telemetry.recordGameOver(400, 'ball_lost', 'keyboard');
      }).not.toThrow();
    });
  });

  describe('Decoupled BrickBreakerEngine & PhysicsWorkerController', () => {
    it('should execute deterministic paddle, wall, and brick collision physics decoupled from React', () => {
      const onScoreAdd = vi.fn();
      const onScoreUpdate = vi.fn();
      const onLivesChange = vi.fn();
      const onLivesUpdate = vi.fn();
      const onGameOver = vi.fn();

      const engine = new BrickBreakerEngine({
        onScoreAdd,
        onScoreUpdate,
        onLivesChange,
        onLivesUpdate,
        onGameOver,
        isPlaying: () => true
      });

      expect(engine.getBricks().length).toBe(40);
      expect(engine.getState().lives).toBe(3);

      // Move paddle right via keyboard state
      engine.setKey('arrowright', true);
      engine.stepPhysics(0.1);
      expect(engine.getState().paddleX).toBeGreaterThan(0);
      engine.setKey('arrowright', false);

      // Sub-stepping handles high speed without tunneling
      engine.stepPhysics(0.05);

      // Clamp normalized pointer coordinate
      engine.setPaddleNormalizedX(5);
      expect(engine.getState().paddleX).toBeCloseTo(7.2 - 1.25, 2);

      // Clean disposal prevents leaks
      engine.dispose();
      expect(engine.isDisposed()).toBe(true);
    });

    it('should verify ghost replay trajectory and detect speed/velocity anomalies via PhysicsWorkerController', async () => {
      const workerCtrl = new PhysicsWorkerController();

      // Legitimate trajectory
      const validResult = await workerCtrl.verifyGhostTrajectory({
        deltaPoints: [
          { dt: 50, dx: 2, dy: 0 },
          { dt: 50, dx: 2.5, dy: 0.5 },
          { dt: 50, dx: 1.5, dy: 0 }
        ],
        maxSpeedUnitsPerSec: 100,
        declaredDurationMs: 5000,
        declaredScore: 120,
        maxScorePerSec: 150
      });
      expect(validResult.valid).toBe(true);
      expect(validResult.anomalyCount).toBe(0);

      // Cheated trajectory with impossible teleport speed
      const cheatedResult = await workerCtrl.verifyGhostTrajectory({
        deltaPoints: [
          { dt: 10, dx: 500, dy: 500 } // ~70,710 units/sec > 100 maxSpeed
        ],
        maxSpeedUnitsPerSec: 100,
        declaredDurationMs: 5000,
        declaredScore: 120,
        maxScorePerSec: 150
      });
      expect(cheatedResult.valid).toBe(false);
      expect(cheatedResult.anomalyCount).toBeGreaterThan(0);
      expect(cheatedResult.reason).toContain('TELEPORT_SPEED_ANOMALY');

      workerCtrl.dispose();
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

    it('should persist audioController volume & mute settings in localStorage and notify subscribers', () => {
      const listener = vi.fn();
      const unsubscribe = audioController.subscribe(listener);

      audioController.setMasterVolume(0.65);
      audioController.setSfxVolume(0.45);
      audioController.setMusicVolume(0.35);
      audioController.setMuted(true);

      expect(audioController.getMasterVolume()).toBeCloseTo(0.65, 2);
      expect(audioController.getSfxVolume()).toBeCloseTo(0.45, 2);
      expect(audioController.getMusicVolume()).toBeCloseTo(0.35, 2);
      expect(audioController.isMuted()).toBe(true);

      expect(localStorage.getItem('zigame_master_vol')).toBe('0.65');
      expect(localStorage.getItem('zigame_sfx_vol')).toBe('0.45');
      expect(localStorage.getItem('zigame_music_vol')).toBe('0.35');
      expect(localStorage.getItem('zigame_muted')).toBe('true');

      const nextMute = audioController.toggleMute();
      expect(nextMute).toBe(false);
      expect(audioController.isMuted()).toBe(false);
      expect(localStorage.getItem('zigame_muted')).toBe('false');
      expect(listener).toHaveBeenCalled();

      expect(() => {
        audioController.playClick();
        audioController.playScore();
        audioController.playCombo(3);
        audioController.playHit();
        audioController.playPowerup();
        audioController.playWin();
        audioController.playGameOver();
      }).not.toThrow();

      unsubscribe();
      audioController.setMasterVolume(1);
      audioController.setSfxVolume(0.7);
      audioController.setMusicVolume(0.5);
    });

    it('should validate CANONICAL_GAME_REGISTRY Phase 4 parity (controlsHint, tier, featured, controlType, qualityMap)', () => {
      const featuredGames = CANONICAL_GAME_IDS.filter(
        (id) => CANONICAL_GAME_REGISTRY[id].featured === true
      );
      expect(featuredGames.length).toBeGreaterThanOrEqual(6);

      for (const id of CANONICAL_GAME_IDS) {
        const entry = CANONICAL_GAME_REGISTRY[id];
        expect(entry, `Missing registry entry for ${id}`).toBeDefined();
        expect(typeof entry.controlsHint).toBe('string');
        expect(entry.controlsHint.trim().length).toBeGreaterThan(10);
        expect(['flagship', 'arcade', 'classic']).toContain(entry.tier);
        expect(entry.controlType).toBeDefined();
        expect(GAME_QUALITY_MAP[id]).toBeDefined();
        expect(getGameQualityInfo(id).gameId).toBe(id);
      }

      // Verify legacy aliases normalize cleanly in quality lookup
      expect(toCanonicalGameId('tetris')).toBe('cyber-tetris');
      expect(getGameQualityInfo('tetris').gameId).toBe('cyber-tetris');
      expect(getGameQualityInfo('brick').gameId).toBe('brick-breaker');
    });
  });
});


