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

export const GAME_LAYOUTS: Record<string, GameLayoutConfig> = {
  snake: { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  memory: { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  matrixmemory: { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  simon: { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  mines: { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  '2048': { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  tetris: { type: 'portrait', aspectRatio: '3 / 4', maxWidth: 600 },
  flappy: { type: 'portrait', aspectRatio: '3 / 4', maxWidth: 600 },
  stacker: { type: 'portrait', aspectRatio: '3 / 4', maxWidth: 600 },
  brick: { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  space: { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  runner: { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  pong: { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  racer: { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  lockbreaker: { type: 'square', aspectRatio: '1 / 1', maxWidth: 600 },
  sinerider: { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  cosmicdodge: { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  lasergrid: { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  plinko: { type: 'portrait', aspectRatio: '9 / 16', maxWidth: 600 },
  asteroid: { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  slasher: { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  clicker: { type: 'portrait', aspectRatio: '3 / 4', maxWidth: 600 },
  blockmatch: { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  typer: { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  maze: { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  rhythm: { type: 'portrait', aspectRatio: '9 / 16', maxWidth: 600 },
  puttgolf: { type: 'portrait', aspectRatio: '3 / 4', maxWidth: 600 },
  dinorun: { type: 'landscape', aspectRatio: '21 / 9', maxWidth: 1200 },
  archery: { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 },
  whack: { type: 'square', aspectRatio: '1 / 1', maxWidth: 720 },
  jumprope: { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1000 },
  neondrift: { type: 'landscape', aspectRatio: '16 / 9', maxWidth: 1100 }
};