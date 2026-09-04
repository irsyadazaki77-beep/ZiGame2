import { GameStats } from '../types';
import { GAME_REGISTRY } from '../config/gameRegistry';

export const INITIAL_GAMES: GameStats[] = Object.keys(GAME_REGISTRY).map((key) => {
  const game = GAME_REGISTRY[key];
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
