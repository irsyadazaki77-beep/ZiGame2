import { GameQualityTier } from '../types';
import { CanonicalGameId, toCanonicalGameId } from './canonicalGames';

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

export const GAME_QUALITY_MAP: Record<CanonicalGameId, GameQualityInfo> = {
  // Flagship Games - Polished to the highest standard
  'snake': {
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
  'brick-breaker': {
    gameId: 'brick-breaker',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: true,
    estimatedDuration: 'standard'
  },
  'space-defender': {
    gameId: 'space-defender',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: true,
    estimatedDuration: 'standard'
  },
  'cyber-runner': {
    gameId: 'cyber-runner',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: true,
    estimatedDuration: 'quick'
  },
  'vaporwave-racer': {
    gameId: 'vaporwave-racer',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: true,
    estimatedDuration: 'quick'
  },
  'neon-pong': {
    gameId: 'neon-pong',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: true,
    estimatedDuration: 'standard'
  },
  'pixel-dino': {
    gameId: 'pixel-dino',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: true,
    estimatedDuration: 'quick'
  },
  'cyber-tetris': {
    gameId: 'cyber-tetris',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: true,
    ghostModeSupported: false,
    competitiveSupported: true,
    estimatedDuration: 'deep'
  },
  'flappy-pixel': {
    gameId: 'flappy-pixel',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: false,
    estimatedDuration: 'quick'
  },
  'memory-grid': {
    gameId: 'memory-grid',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'standard'
  },
  'neon-stacker': {
    gameId: 'neon-stacker',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: true,
    estimatedDuration: 'quick'
  },
  'sine-rider': {
    gameId: 'sine-rider',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: false,
    estimatedDuration: 'standard'
  },
  'cosmic-dodge': {
    gameId: 'cosmic-dodge',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: true,
    estimatedDuration: 'quick'
  },
  'laser-grid': {
    gameId: 'laser-grid',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'quick'
  },
  'cyber-simon': {
    gameId: 'cyber-simon',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'standard'
  },
  'plinko-neo': {
    gameId: 'plinko-neo',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'quick'
  },
  'cosmic-asteroid': {
    gameId: 'cosmic-asteroid',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: true,
    estimatedDuration: 'standard'
  },
  'cyber-slasher': {
    gameId: 'cyber-slasher',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'quick'
  },
  'cyber-clicker': {
    gameId: 'cyber-clicker',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: true,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'deep'
  },
  'block-match': {
    gameId: 'block-match',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: true,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'standard'
  },
  'cyber-typer': {
    gameId: 'cyber-typer',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'standard'
  },
  'maze-runner': {
    gameId: 'maze-runner',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: true,
    estimatedDuration: 'standard'
  },
  'memory-path': {
    gameId: 'memory-path',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: true,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'standard'
  },
  'rhythm-tap': {
    gameId: 'rhythm-tap',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: true,
    estimatedDuration: 'standard'
  },
  'pixel-golf': {
    gameId: 'pixel-golf',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: true,
    estimatedDuration: 'standard'
  },
  'archery-neo': {
    gameId: 'archery-neo',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: true,
    estimatedDuration: 'quick'
  },
  'cyber-mines': {
    gameId: 'cyber-mines',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: true,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'deep'
  },
  'neon-2048': {
    gameId: 'neon-2048',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: true,
    ghostModeSupported: false,
    competitiveSupported: true,
    estimatedDuration: 'deep'
  },
  'whack-a-drone': {
    gameId: 'whack-a-drone',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'quick'
  },
  'jump-rope': {
    gameId: 'jump-rope',
    tier: 'core',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: false,
    competitiveSupported: false,
    estimatedDuration: 'quick'
  },
  'neon-drift': {
    gameId: 'neon-drift',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: true,
    estimatedDuration: 'quick'
  },
  'lock-breaker': {
    gameId: 'lock-breaker',
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
  },
  'wizard-chess': {
    gameId: 'wizard-chess',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: false,
    saveStateSupported: true,
    ghostModeSupported: false,
    competitiveSupported: true,
    estimatedDuration: 'deep'
  },
  'desk-racer': {
    gameId: 'desk-racer',
    tier: 'flagship',
    targetFps: 60,
    mobileOptimized: true,
    gamepadOptimized: true,
    saveStateSupported: false,
    ghostModeSupported: true,
    competitiveSupported: true,
    estimatedDuration: 'standard'
  },
  'world-box': {
    gameId: 'world-box',
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
  const canonical = toCanonicalGameId(gameId);
  return (
    GAME_QUALITY_MAP[canonical] || {
      gameId: canonical,
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
