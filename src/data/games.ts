import { GameStats } from '../types';
import { CANONICAL_GAME_IDS } from '../config/canonicalGames';
import { CANONICAL_GAME_REGISTRY } from '../config/gameRegistry';

export const INITIAL_GAMES: GameStats[] = CANONICAL_GAME_IDS.map((id) => {
  const game = CANONICAL_GAME_REGISTRY[id];
  return {
    id: game.id,
    title: game.title,
    description: game.description,
    plays: 0,
    highScore: 0,
    themeColor: game.themeColor,
    accentShadow: game.accentShadow,
    icon: game.icon,
    coverImage: game.thumbnail,
    genre: game.genre,
    difficulty: game.difficulty,
    controls: game.controls,
    avgDuration: game.avgDuration
  };
});
