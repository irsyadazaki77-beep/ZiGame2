/**
 * Canonical Game IDs & Single Source of Truth
 * ZiGame 2.0 Stabilization
 */

export const CANONICAL_GAME_IDS = [
  'snake',
  'brick-breaker',
  'flappy-pixel',
  'space-defender',
  'memory-grid',
  'cyber-runner',
  'neon-pong',
  'neon-stacker',
  'vaporwave-racer',
  'lock-breaker',
  'sine-rider',
  'cosmic-dodge',
  'laser-grid',
  'cyber-simon',
  'plinko-neo',
  'cosmic-asteroid',
  'cyber-slasher',
  'cyber-clicker',
  'block-match',
  'cyber-typer',
  'maze-runner',
  'memory-path',
  'rhythm-tap',
  'pixel-golf',
  'pixel-dino',
  'cyber-tetris',
  'archery-neo',
  'cyber-mines',
  'neon-2048',
  'whack-a-drone',
  'jump-rope',
  'neon-drift',
  'neon-heist',
  'void-survivor',
  'orbital-defense',
  'gravity-shift',
  'hex-dominion'
] as const;

export type CanonicalGameId = typeof CANONICAL_GAME_IDS[number];

/**
 * Mapping of legacy or alternate identifiers to their canonical form.
 */
export const GAME_ID_ALIAS_MAP: Record<string, CanonicalGameId> = {
  // Direct canonical mappings
  'snake': 'snake',
  'brick-breaker': 'brick-breaker',
  'flappy-pixel': 'flappy-pixel',
  'space-defender': 'space-defender',
  'memory-grid': 'memory-grid',
  'cyber-runner': 'cyber-runner',
  'neon-pong': 'neon-pong',
  'neon-stacker': 'neon-stacker',
  'vaporwave-racer': 'vaporwave-racer',
  'lock-breaker': 'lock-breaker',
  'sine-rider': 'sine-rider',
  'cosmic-dodge': 'cosmic-dodge',
  'laser-grid': 'laser-grid',
  'cyber-simon': 'cyber-simon',
  'plinko-neo': 'plinko-neo',
  'cosmic-asteroid': 'cosmic-asteroid',
  'cyber-slasher': 'cyber-slasher',
  'cyber-clicker': 'cyber-clicker',
  'block-match': 'block-match',
  'cyber-typer': 'cyber-typer',
  'maze-runner': 'maze-runner',
  'memory-path': 'memory-path',
  'rhythm-tap': 'rhythm-tap',
  'pixel-golf': 'pixel-golf',
  'pixel-dino': 'pixel-dino',
  'cyber-tetris': 'cyber-tetris',
  'archery-neo': 'archery-neo',
  'cyber-mines': 'cyber-mines',
  'neon-2048': 'neon-2048',
  'whack-a-drone': 'whack-a-drone',
  'jump-rope': 'jump-rope',
  'neon-drift': 'neon-drift',
  'neon-heist': 'neon-heist',
  'void-survivor': 'void-survivor',
  'orbital-defense': 'orbital-defense',
  'gravity-shift': 'gravity-shift',
  'hex-dominion': 'hex-dominion',

  // Legacy shorthand & slug aliases
  'brick': 'brick-breaker',
  'brickbreaker': 'brick-breaker',
  'flappy': 'flappy-pixel',
  'space': 'space-defender',
  'memory': 'memory-grid',
  'runner': 'cyber-runner',
  'pong': 'neon-pong',
  'stacker': 'neon-stacker',
  'racer': 'vaporwave-racer',
  'lockbreaker': 'lock-breaker',
  'sinerider': 'sine-rider',
  'cosmicdodge': 'cosmic-dodge',
  'lasergrid': 'laser-grid',
  'simon': 'cyber-simon',
  'plinko': 'plinko-neo',
  'asteroid': 'cosmic-asteroid',
  'slasher': 'cyber-slasher',
  'clicker': 'cyber-clicker',
  'blockmatch': 'block-match',
  'typer': 'cyber-typer',
  'maze': 'maze-runner',
  'matrixmemory': 'memory-path',
  'memory-matrix': 'memory-path',
  'rhythm': 'rhythm-tap',
  'puttgolf': 'pixel-golf',
  'dinorun': 'pixel-dino',
  'tetris': 'cyber-tetris',
  'archery': 'archery-neo',
  'mines': 'cyber-mines',
  'minesweeper': 'cyber-mines',
  '2048': 'neon-2048',
  'whack': 'whack-a-drone',
  'jumprope': 'jump-rope',
  'neondrift': 'neon-drift',
  'neonheist': 'neon-heist',
  'heist': 'neon-heist',
  'voidsurvivor': 'void-survivor',
  'survivor': 'void-survivor',
  'orbitaldefense': 'orbital-defense',
  'orbital': 'orbital-defense',
  'defense': 'orbital-defense',
  'towerdefense': 'orbital-defense',
  'gravityshift': 'gravity-shift',
  'gravity': 'gravity-shift',
  'hexdominion': 'hex-dominion',
  'hex': 'hex-dominion'
};

/**
 * Resolve any game ID string (canonical or legacy alias) into its canonical representation.
 * STRICT: Throws an error if gameId is not valid.
 */
export function requireCanonicalGameId(rawId: string): CanonicalGameId {
  if (!rawId || typeof rawId !== 'string') {
    const err = new Error(`Invalid game ID: "${rawId}" is not a string`);
    (err as any).code = 'INVALID_GAME_ID';
    throw err;
  }
  const normalized = rawId.trim().toLowerCase();
  const canonical = GAME_ID_ALIAS_MAP[normalized] || (CANONICAL_GAME_IDS.includes(normalized as CanonicalGameId) ? (normalized as CanonicalGameId) : null);
  if (!canonical) {
    const err = new Error(`Unknown game ID: "${rawId}" is not recognized in canonical registry`);
    (err as any).code = 'INVALID_GAME_ID';
    throw err;
  }
  return canonical;
}

/**
 * Safe alias resolution with default fallback (intended for UI / display safety)
 */
export function toCanonicalGameId(rawId: string, fallback: CanonicalGameId = 'snake'): CanonicalGameId {
  return resolveGameIdForUI(rawId, fallback);
}

/**
 * UI-only helper that safely falls back to a default if unknown
 */
export function resolveGameIdForUI(rawId: string, fallback: CanonicalGameId = 'snake'): CanonicalGameId {
  if (!rawId || typeof rawId !== 'string') return fallback;
  const normalized = rawId.trim().toLowerCase();
  return GAME_ID_ALIAS_MAP[normalized] || (CANONICAL_GAME_IDS.includes(normalized as CanonicalGameId) ? (normalized as CanonicalGameId) : fallback);
}

/**
 * Returns true if rawId is a valid known canonical game ID or alias.
 */
export function isValidGameId(rawId: unknown): rawId is string {
  if (!rawId || typeof rawId !== 'string') return false;
  const normalized = rawId.trim().toLowerCase();
  return Boolean(GAME_ID_ALIAS_MAP[normalized] || CANONICAL_GAME_IDS.includes(normalized as CanonicalGameId));
}
