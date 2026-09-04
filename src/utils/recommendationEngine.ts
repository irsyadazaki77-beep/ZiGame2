import { GameStats, PlayerProfile, RecentlyPlayedEntry } from '../types';

export function getRecommendedGames(
  games: GameStats[],
  profile: PlayerProfile,
  recentlyPlayed: RecentlyPlayedEntry[]
): GameStats[] {
  if (!games || games.length === 0) return [];

  const scoredGames = games.map(game => {
    let score = 0;

    // 1. Genre match
    if (profile.favoriteGenre && game.genre === profile.favoriteGenre) {
      score += 30;
    }

    // 2. Favorite games match
    if (profile.favoriteGames?.includes(game.id)) {
      score += 20;
    }

    // 3. Low play count but good overall rating (Discovery)
    if (game.plays < 5) {
      score += 15;
    } else {
      score += Math.min(game.plays, 20); // Popularity boost up to 20
    }

    // 4. Recently played penalty (we want to recommend NEW things)
    const recentIndex = recentlyPlayed.findIndex(r => r.gameId === game.id);
    if (recentIndex !== -1) {
      // Very recently played -> heavy penalty
      if (recentIndex < 3) score -= 50; 
      else score -= 10;
    }

    // 5. High score / Mastery potential (if they played a bit but not a lot)
    if (game.plays > 0 && game.highScore < 100) {
      score += 10;
    }

    // Add some randomness to keep it fresh
    score += Math.random() * 15;

    return { game, score };
  });

  scoredGames.sort((a, b) => b.score - a.score);

  return scoredGames.slice(0, 3).map(sg => sg.game);
}

export function getTrendingGames(games: GameStats[]): GameStats[] {
  return [...games].sort((a, b) => b.plays - a.plays).slice(0, 3);
}

export function getHiddenGems(games: GameStats[]): GameStats[] {
  // Games with very low plays
  return [...games].sort((a, b) => a.plays - b.plays).slice(0, 3);
}
