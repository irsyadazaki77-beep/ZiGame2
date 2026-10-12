import { GameRuntimeContext } from '../types/gameSdk';
import { toCanonicalGameId } from '../config/canonicalGames';
import { ScoreController } from './scoreController';
import { InputController } from './inputController';
import { AudioController } from './audioController';
import { TelemetryController } from './telemetryController';
import { PerformanceController } from './performanceController';
import { PersistenceController } from './persistenceController';
import { ReplayController } from './replayController';
import { ViewportController } from './viewportController';
import { LoopController } from './loopController';
import { LifecycleCoordinator } from './lifecycleCoordinator';

export interface CreateGameRuntimeContextOptions {
  gameId: string;
  initialScore?: number;
  onScoreUpdate?: (score: number) => void;
  onGameOver?: (finalScore: number) => void;
  onPause?: () => void;
  onResume?: () => void;
  onRestart?: () => void;
}

export function createGameRuntimeContext(options: CreateGameRuntimeContextOptions): GameRuntimeContext {
  const rawId = options.gameId || 'snake';
  const canonicalId = toCanonicalGameId(rawId);
  const { initialScore = 0, onScoreUpdate, onGameOver, onPause, onResume, onRestart } = options;

  const score = new ScoreController(initialScore, {
    onScoreUpdate,
    onGameOver
  });

  const input = new InputController();
  const audio = new AudioController();
  const telemetry = new TelemetryController(canonicalId);
  const performance = new PerformanceController();
  const persistence = new PersistenceController(canonicalId);
  const replay = new ReplayController(canonicalId);
  const viewport = new ViewportController();
  const loop = new LoopController();

  const lifecycle = new LifecycleCoordinator({
    gameId: canonicalId,
    score,
    loop,
    audio,
    telemetry,
    replay,
    onPause,
    onResume,
    onRestart
  });

  return {
    gameId: canonicalId,
    score,
    input,
    audio,
    telemetry,
    performance,
    persistence,
    replay,
    viewport,
    loop,
    lifecycle
  };
}
