import { GameStats, RecentlyPlayedEntry, PlayerProfile } from '../types';

export interface RecommendationSections {
  continuePlaying: (GameStats & { lastPlayedAt: number; lastScore?: number })[];
  recommendedForYou: (GameStats & { matchReason: string; matchScore: number })[];
  trySomethingNew: (GameStats & { tag: string })[];
  quickGames: GameStats[];
  popularGames: GameStats[];
}

export const recommendationService = {
  getPersonalizedRecommendations(
    games: GameStats[],
    recentlyPlayed: RecentlyPlayedEntry[],
    profile: PlayerProfile,
    favorites: string[] = []
  ): RecommendationSections {
    // 1. Continue Playing: match recently played entries to GameStats
    const continuePlaying: (GameStats & { lastPlayedAt: number; lastScore?: number })[] = [];
    recentlyPlayed.slice(0, 5).forEach(rp => {
      const g = games.find(game => game.id === rp.gameId);
      if (g) {
        continuePlaying.push({
          ...g,
          lastPlayedAt: rp.lastPlayedAt,
          lastScore: rp.lastScore
        });
      }
    });

    // 2. Identify genre affinities
    const genrePlayCount: Record<string, number> = {};
    games.forEach(g => {
      if (g.genre && g.plays > 0) {
        genrePlayCount[g.genre] = (genrePlayCount[g.genre] || 0) + g.plays;
      }
    });

    const topGenre = Object.entries(genrePlayCount).sort((a, b) => b[1] - a[1])[0]?.[0] || profile.favoriteGenre || 'Arcade';

    // 3. Recommended For You: Weighted algorithm
    const recommendedForYou: (GameStats & { matchReason: string; matchScore: number })[] = [];
    games.forEach(g => {
      let score = 0;
      let reason = 'Cocok untuk Anda';

      // Favorite genre boost
      if (g.genre === topGenre || (profile.favoriteGenre && g.genre?.toLowerCase().includes(profile.favoriteGenre.toLowerCase()))) {
        score += 45;
        reason = `Favorit Genre ${g.genre}`;
      }

      // Favorited by user boost
      if (favorites.includes(g.id)) {
        score += 30;
        reason = 'Favorit Pilihanmu';
      }

      // Moderate play count boost (engaged but not burned out)
      if (g.plays > 0 && g.plays < 20) {
        score += 25;
      }

      // Difficulty preference balance
      if (g.difficulty === 'Medium') {
        score += 15;
      }

      recommendedForYou.push({
        ...g,
        matchReason: reason,
        matchScore: score
      });
    });

    recommendedForYou.sort((a, b) => b.matchScore - a.matchScore);

    // 4. Try Something New: Games with 0 or few plays
    const trySomethingNew: (GameStats & { tag: string })[] = games
      .filter(g => g.plays < 2 && !continuePlaying.some(cp => cp.id === g.id))
      .slice(0, 4)
      .map(g => ({
        ...g,
        tag: g.plays === 0 ? 'Belum Pernah Dicoba' : 'Eksplorasi Lanjutan'
      }));

    // If all games have been played, pick the least played ones
    if (trySomethingNew.length === 0) {
      games.slice()
        .sort((a, b) => a.plays - b.plays)
        .slice(0, 4)
        .forEach(g => {
          trySomethingNew.push({
            ...g,
            tag: 'Segarkan Rekor'
          });
        });
    }

    // 5. Quick Games (fast duration <= 60s or easy casual reflex)
    const quickIds = ['flappy-pixel', 'cyber-clicker', 'snake', 'memory-matrix', 'jumprope', 'minesweeper'];
    const quickGames = games.filter(g => 
      quickIds.includes(g.id) || (g.avgDuration && (g.avgDuration.includes('30s') || g.avgDuration.includes('45s') || g.avgDuration.includes('1m')))
    ).slice(0, 4);

    // 6. Popular Games
    const popularGames = games.slice()
      .sort((a, b) => (b.plays * 2 + b.highScore) - (a.plays * 2 + a.highScore))
      .slice(0, 6);

    return {
      continuePlaying,
      recommendedForYou: recommendedForYou.slice(0, 4),
      trySomethingNew,
      quickGames,
      popularGames
    };
  }
};
