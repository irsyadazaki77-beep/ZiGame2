import { CanonicalGameId, GAME_ID_ALIAS_MAP, toCanonicalGameId } from './canonicalGames';

export type GameLayoutType = 'landscape' | 'portrait' | 'square';

export interface GameLayoutConfig {
  type: GameLayoutType;
  aspectRatio: string;
  maxWidth: number;
  maxHeight?: number;
}

export const DEFAULT_GAME_LAYOUT: GameLayoutConfig = {
  type: 'landscape',
  aspectRatio: '16 / 9',
  maxWidth: 1100,
};

export const CANONICAL_GAME_LAYOUTS: Record<CanonicalGameId, GameLayoutConfig> = {
  'snake': { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  'brick-breaker': { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  'flappy-pixel': { type: 'portrait', aspectRatio: '3 / 4', maxWidth: 600 },
  'space-defender': { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  'memory-grid': { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  'cyber-runner': { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  'neon-pong': { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  'neon-stacker': { type: 'portrait', aspectRatio: '3 / 4', maxWidth: 600 },
  'vaporwave-racer': { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  'lock-breaker': { type: 'square', aspectRatio: '1 / 1', maxWidth: 600 },
  'sine-rider': { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  'cosmic-dodge': { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  'laser-grid': { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  'cyber-simon': { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  'plinko-neo': { type: 'portrait', aspectRatio: '9 / 16', maxWidth: 600 },
  'cosmic-asteroid': { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  'cyber-slasher': { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  'cyber-clicker': { type: 'portrait', aspectRatio: '3 / 4', maxWidth: 600 },
  'block-match': { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  'cyber-typer': { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  'maze-runner': { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  'memory-path': { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  'rhythm-tap': { type: 'portrait', aspectRatio: '9 / 16', maxWidth: 600 },
  'pixel-golf': { type: 'portrait', aspectRatio: '3 / 4', maxWidth: 600 },
  'pixel-dino': { type: 'landscape', aspectRatio: '21 / 9', maxWidth: 1200 },
  'cyber-tetris': { type: 'portrait', aspectRatio: '3 / 4', maxWidth: 600 },
  'archery-neo': { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  'cyber-mines': { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  'neon-2048': { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  'whack-a-drone': { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  'jump-rope': { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1000 },
  'neon-drift': { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  'neon-heist': { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  'void-survivor': { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  'orbital-defense': { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  'gravity-shift': { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  'hex-dominion': { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 }
};

export const GAME_LAYOUTS: Record<string, GameLayoutConfig> = {
  ...CANONICAL_GAME_LAYOUTS
};

// Aliases
Object.entries(GAME_ID_ALIAS_MAP).forEach(([alias, canonical]) => {
  if (CANONICAL_GAME_LAYOUTS[canonical]) {
    GAME_LAYOUTS[alias] = CANONICAL_GAME_LAYOUTS[canonical];
  }
});

export function getGameLayout(rawId: string): GameLayoutConfig {
  if (!rawId) return DEFAULT_GAME_LAYOUT;
  if (GAME_LAYOUTS[rawId]) return GAME_LAYOUTS[rawId];
  const canonical = toCanonicalGameId(rawId);
  return CANONICAL_GAME_LAYOUTS[canonical] || DEFAULT_GAME_LAYOUT;
}
