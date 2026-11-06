import { CanonicalGameId } from '../config/canonicalGames';
import { InputAction, InputSource, PerformanceSettings, GameSaveState, GhostRunData } from './index';

export type GameRuntimeState =
  | 'idle'
  | 'ready'
  | 'starting'
  | 'countdown'
  | 'playing'
  | 'paused'
  | 'gameover'
  | 'restarting'
  | 'destroyed';

export type GameInputEvent =
  | { type: 'move'; direction: 'up' | 'down' | 'left' | 'right'; isDown: boolean; source?: InputSource }
  | { type: 'action'; action: 'primary' | 'secondary' | 'pause' | 'restart' | string; isDown: boolean; source?: InputSource }
  | { type: 'pointer'; x: number; y: number; button?: number; isDown: boolean; phase: 'down' | 'move' | 'up' }
  | { type: 'touch'; x: number; y: number; dx?: number; dy?: number; phase: 'start' | 'move' | 'end' }
  | { type: 'key'; key: string; code: string; isDown: boolean };

export interface IScoreController {
  get(): number;
  set(score: number): void;
  add(points: number): number;
  reset(): void;
  commit(finalScore?: number): number;
  isCommitted(): boolean;
  subscribe(listener: (score: number) => void): () => void;
}

export interface IInputController {
  subscribe(handler: (event: GameInputEvent) => void): () => void;
  dispatch(event: GameInputEvent): void;
  isActionActive(action: InputAction): boolean;
  getActiveSource(): InputSource;
  vibrate(durationMs?: number, intensity?: number): void;
}

export interface IAudioController {
  playCoin(): void;
  playJump(): void;
  playLaser(): void;
  playScore(): void;
  playCombo(combo?: number): void;
  playNearMiss(): void;
  playReflect(): void;
  playShield(): void;
  playHitStop(): void;
  playCountdown(step?: number): void;
  playCountdownGo(): void;
  playGameOver(): void;
  playHit(): void;
  playPowerup(): void;
  playExplosion(): void;
  playLevelUp(): void;
  startBgm(): void;
  stopBgm(): void;
  isBgmPlaying(): boolean;
  toggleMute(): boolean;
  isMuted(): boolean;
  stopAll(): void;
}

export interface ITelemetryController {
  recordGameStart(inputSource?: string): void;
  recordGameOver(score: number, failurePoint?: string, inputSource?: string): void;
  recordQuit(score?: number): void;
  recordEvent(eventName: string, data?: Record<string, any>): void;
  recordInput(action: string): void;
}

export interface IPerformanceController {
  getSettings(): PerformanceSettings;
  getAdaptiveDPR(maxDpr?: number): number;
  getParticleMultiplier(): number;
  recordFramePerformance(fps: number): void;
  subscribe(listener: (settings: PerformanceSettings) => void): () => void;
}

export interface IPersistenceController {
  save<T = any>(score: number, data: T, gameVersion?: string): boolean;
  load<T = any>(): GameSaveState<T> | null;
  hasSave(): boolean;
  clear(): void;
}

export interface IReplayController {
  start(): void;
  recordPoint(x?: number, y?: number, action?: string, score?: number): void;
  finish(finalScore: number, gameVersion?: string): GhostRunData | null;
  discard(): void;
  getGhostRun(): GhostRunData | null;
}

export interface IViewportController {
  setupCanvas(canvas: HTMLCanvasElement | null, logicalWidth: number, logicalHeight: number, maxDpr?: number): CanvasRenderingContext2D | null;
  toLogicalCoords(canvas: HTMLCanvasElement, clientX: number, clientY: number, logicalWidth: number, logicalHeight: number): { x: number; y: number };
  attachResizeObserver(element: HTMLElement, onResize: (width: number, height: number) => void): () => void;
}

export interface ILoopController {
  start(stepFn: (timestamp: number, deltaTime: number) => void): void;
  stop(): void;
  pause(): void;
  resume(): void;
  isRunning(): boolean;
}

export interface ILifecycleController {
  getState(): GameRuntimeState;
  setState(state: GameRuntimeState): void;
  startWithCountdown(onComplete?: () => void, onTick?: (count: number) => void): void;
  pauseGame(): void;
  resumeGame(): void;
  togglePause(): void;
  triggerGameOver(finalScore?: number): void;
  triggerRestart(): void;
  destroy(): void;
  subscribe(listener: (state: GameRuntimeState, prevState: GameRuntimeState) => void): () => void;
}

export interface GameRuntimeContext {
  gameId: string;
  score: IScoreController;
  input: IInputController;
  audio: IAudioController;
  telemetry: ITelemetryController;
  performance: IPerformanceController;
  persistence: IPersistenceController;
  replay: IReplayController;
  viewport: IViewportController;
  loop: ILoopController;
  lifecycle: ILifecycleController;
}

export interface GameModule<TState = any> {
  id: CanonicalGameId | string;
  init?(ctx: GameRuntimeContext): void | Promise<void>;
  onStart?(ctx: GameRuntimeContext): void;
  onUpdate?(deltaTime: number, ctx: GameRuntimeContext): void;
  onRender?(ctx: GameRuntimeContext): void;
  onInput?(event: GameInputEvent, ctx: GameRuntimeContext): void;
  onPause?(ctx: GameRuntimeContext): void;
  onResume?(ctx: GameRuntimeContext): void;
  onRestart?(ctx: GameRuntimeContext): void;
  onGameOver?(finalScore: number, ctx: GameRuntimeContext): void;
  onDestroy?(): void;
  getScore?(): number;
  getState?(): TState;
  loadState?(state: TState): void;
}

export interface GameSessionTicket {
  sessionId: string;
  userId: string;
  gameId: string;
  mode: string;
  nonce: string;
  startTime: number;
  expiresAt: number;
  consumed: boolean;
  gameVersion: string;
  balanceVersion: string;
  rulesetVersion: string;
}

