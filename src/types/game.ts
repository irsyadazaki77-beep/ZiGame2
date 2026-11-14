export type GameQualityTier = 'flagship' | 'core' | 'experimental' | 'legacy';
export type GameCategory = 'All' | 'Classic' | 'Arcade' | 'Shooter' | 'Puzzle' | 'Endless' | 'Action';
export type TouchControlsType = 'dpad' | 'leftright' | 'updown' | 'actiononly' | 'none';

export type GameLifecycleState =
  | 'initialize'
  | 'ready'
  | 'countdown'
  | 'playing'
  | 'paused'
  | 'gameover'
  | 'restart'
  | 'dispose';

export interface GameSaveState<T = any> {
  gameId: string;
  gameVersion: string;
  balanceVersion: string;
  score: number;
  timestamp: number;
  data: T;
  checksum: string;
}

export interface GhostPoint {
  t: number; // time in ms from start
  x?: number;
  y?: number;
  a?: string; // action
  s?: number; // score snapshot
}

export interface GhostDeltaPoint {
  dt: number; // delta time in ms from previous point
  dx?: number; // delta x from previous point
  dy?: number; // delta y from previous point
  a?: string; // discrete action
  s?: number; // delta score or score snapshot
}

export interface GhostRunData {
  gameId: string;
  score: number;
  durationMs: number;
  recordedAt: number;
  points: GhostPoint[];
  deltaPoints?: GhostDeltaPoint[];
  encoding?: 'raw' | 'delta';
  sampleIntervalMs?: number;
  gameVersion: string;
  checksum?: string;
}

export interface GameStats {
  id: string;
  title: string;
  description: string;
  plays: number;
  highScore: number;
  themeColor: string;
  accentShadow: string;
  icon: string;
  coverImage?: string;
  thumbnailUrl?: string;
  genre?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  controls?: string;
  controlsHint?: string;
  featured?: boolean;
  tier?: 'flagship' | 'arcade' | 'classic';
  avgDuration?: string;
  completionRate?: number;
  restartCount?: number;
  totalPlaytimeSec?: number;
}

export interface GameComponentProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

export interface GameResult {
  gameId: string;
  score: number;
  durationMs: number;
  timestamp: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  alpha: number;
  decay: number;
}
