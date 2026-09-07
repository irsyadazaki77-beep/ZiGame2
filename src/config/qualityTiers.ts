import { GameQualityTier } from '../types';

export interface GameQualityInfo {
  gameId: string;
  tier: GameQualityTier;
  targetFps: number;
  mobileOptimized: boolean;
  gamepadOptimized: boolean;
  saveStateSupported: boolean;
  ghostModeSupported: boolean;
  competitiveSupported: boolean;
  estimatedDuration: 'quick' | 'standard' | 'deep'; // quick (<3m), standard (3-5m), deep (5m+)
}

export const GAME_QUALITY_MAP: Record<string, GameQualityInfo> = {
  // Flagship Games - Polished to the highest standard
  snake: {
    gameId: 'snake',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: true,
    estimatedDuration: 'standard'
  },
  brick: {
    gameId: 'brick',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: true,
    estimatedDuration: 'standard'
  },
  space: {
    gameId: 'space',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: true,
    estimatedDuration: 'standard'
  },
  runner: {
    gameId: 'runner',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: true,
    estimatedDuration: 'quick'
  },
  racer: {
    gameId: 'racer',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: true,
    estimatedDuration: 'quick'
  },
  pong: {
    gameId: 'pong',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: true,
    estimatedDuration: 'standard'
  },
  dinorun: {
    gameId: 'dinorun',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: true,
    estimatedDuration: 'quick'
  },
  tetris: {
    gameId: 'tetris',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: true,
    ghostModeSupported: false,
    competitiveSupported: true,
    estimatedDuration: 'deep'
  },

  // Core Arcade Games
  flappy: {
    gameId: 'flappy',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: false,
    estimatedDuration: 'quick'
  },
  memory: {
    gameId: 'memory',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'standard'
  },
  stacker: {
    gameId: 'stacker',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'quick'
  },
  sinerider: {
    gameId: 'sinerider',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: false,
    estimatedDuration: 'standard'
  },
  cosmicdodge: {
    gameId: 'cosmicdodge',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: false,
    estimatedDuration: 'quick'
  },
  lasergrid: {
    gameId: 'lasergrid',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'quick'
  },
  simon: {
    gameId: 'simon',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'standard'
  },
  plinko: {
    gameId: 'plinko',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'quick'
  },
  asteroid: {
    gameId: 'asteroid',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: true,
    estimatedDuration: 'standard'
  },
  slasher: {
    gameId: 'slasher',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'quick'
  },
  clicker: {
    gameId: 'clicker',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: true,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'deep'
  },
  blockmatch: {
    gameId: 'blockmatch',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: true,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'standard'
  },
  typer: {
    gameId: 'typer',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: false,
    gamepadOptimized: false,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'standard'
  },
  maze: {
    gameId: 'maze',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'standard'
  },
  matrixmemory: {
    gameId: 'matrixmemory',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: true,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'standard'
  },
  rhythm: {
    gameId: 'rhythm',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: true,
    estimatedDuration: 'standard'
  },
  puttgolf: {
    gameId: 'puttgolf',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'standard'
  },
  archery: {
    gameId: 'archery',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'quick'
  },
  mines: {
    gameId: 'mines',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: true,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'deep'
  },
  '2048': {
    gameId: '2048',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: true,
    ghostModeSupported: false,
    competitiveSupported: true,
    estimatedDuration: 'deep'
  },
  whack: {
    gameId: 'whack',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'quick'
  },
  jumprope: {
    gameId: 'jumprope',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'quick'
  },
  neondrift: {
    gameId: 'neondrift',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: false,
    estimatedDuration: 'quick'
  },
  lockbreaker: {
    gameId: 'lockbreaker',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'quick'
  },
  'neon-heist': {
    gameId: 'neon-heist',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: true,
    ghostModeSupported: true,
    competitiveSupported: true,
    estimatedDuration: 'standard'
  },
  'void-survivor': {
    gameId: 'void-survivor',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: true,
    estimatedDuration: 'deep'
  },
  'orbital-defense': {
    gameId: 'orbital-defense',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: true,
    ghostModeSupported: false,
    competitiveSupported: true,
    estimatedDuration: 'deep'
  },
  'gravity-shift': {
    gameId: 'gravity-shift',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: true,
    estimatedDuration: 'standard'
  },
  'hex-dominion': {
    gameId: 'hex-dominion',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: true,
    ghostModeSupported: false,
    competitiveSupported: true,
    estimatedDuration: 'deep'
  }
};

export const getGameQualityInfo = (gameId: string): GameQualityInfo => {
  return (
    GAME_QUALITY_MAP[gameId] || {
      gameId,
      tier: 'core',
      targetFps: 60,
      mobileOptimized: true,
      gamepadOptimized: false,
      saveStateSupported: false,
      ghostModeSupported: false,
      competitiveSupported: false,
      estimatedDuration: 'standard'
    }
  );
};

export const getFlagshipGameIds = (): string[] => {
  return Object.values(GAME_QUALITY_MAP)
    .filter((g) => g.tier === 'flagship')
    .map((g) => g.gameId);
};
