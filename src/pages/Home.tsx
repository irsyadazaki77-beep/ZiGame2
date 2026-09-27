import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Play, Sparkles, Target, ArrowRight, Zap, Trophy, Star } from 'lucide-react';
import { GameStats, DailyMission, Achievement, PlayerProfile, RecentlyPlayedEntry } from '../types';
import { challengeService } from '../services/challengeService';
import { getRecommendedGames, getTrendingGames } from '../utils/recommendationEngine';
import { audio } from '../utils/audio';
import { useNavigate } from 'react-router-dom';
import { NewPlayerOnboardingModal } from '../components/onboarding/NewPlayerOnboardingModal';
import { GAME_QUALITY_MAP } from '../config/qualityTiers';
import GameCard from '../components/GameCard';
import { GameArtwork } from '../components/GameArtwork';

interface HomeProps {
  games: GameStats[];
  dailyMissions: DailyMission[];
  achievements: Achievement[];
  profile: PlayerProfile;
  totalPlays: number;
  recentlyPlayed: RecentlyPlayedEntry[];
  onClearRecentlyPlayed: () => void;
  onSelectGame: (id: string) => void;
  onUpdateProfile: (updates: any) => void;
}

export default function Home({
  games,
  dailyMissions,
  achievements,
  profile,
  totalPlays,
  recentlyPlayed,
  onClearRecentlyPlayed,
  onSelectGame,
  onUpdateProfile
}: HomeProps) {
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    try {
      const isCompleted = localStorage.getItem('zigame_onboarding_completed') === 'true';
      if (!isCompleted && totalPlays === 0 && (!recentlyPlayed || recentlyPlayed.length === 0)) {
        setShowOnboarding(true);
      }
    } catch {}
  }, [totalPlays, recentlyPlayed]);

  // Favorites state for GameCards
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('arcade_favorite_games');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorite = (e: React.MouseEvent, gameId: string) => {
    e.stopPropagation();
    audio.playCoin();
    const updated = favorites.includes(gameId)
      ? favorites.filter(id => id !== gameId)
      : [...favorites, gameId];
    setFavorites(updated);
    localStorage.setItem('arcade_favorite_games', JSON.stringify(updated));
  };

  // Active challenges
  const activeChallenges = useMemo(() => {
    return challengeService.generateChallengesIfOutdated(games);
  }, [games]);

  const dailyChallengeToHighlight = useMemo(() => {
    return activeChallenges.find(c => c.frequency === 'daily' && !c.claimed) || activeChallenges[0];
  }, [activeChallenges]);

  // Shelves computation
  const flagshipGames = useMemo(() => {
    const list = games.filter(g => GAME_QUALITY_MAP[g.id]?.tier === 'flagship');
    return list.length > 0 ? list.slice(0, 4) : games.slice(0, 4);
  }, [games]);

  const recommendedGames = useMemo(() => {
    return getRecommendedGames(games, profile, recentlyPlayed).slice(0, 4);
  }, [games, profile, recentlyPlayed]);

  const quickPlayGames = useMemo(() => {
    return games.filter(g => GAME_QUALITY_MAP[g.id]?.estimatedDuration === 'quick').slice(0, 4);
  }, [games]);

  const topRatedGames = useMemo(() => {
    return [...games].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 4);
  }, [games]);

  // Spotlight game (either Tetris, Snake, Space, or the highest play game)
  const spotlightGame = useMemo(() => {
    return games.find(g => g.id === 'tetris') || games.find(g => g.id === 'snake') || games[0];
  }, [games]);

  // Continue playing (the last played game)
  const lastPlayedGameEntry = recentlyPlayed[0];
  const lastPlayedGame = lastPlayedGameEntry ? games.find(g => g.id === lastPlayedGameEntry.gameId) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className="space-y-8 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-7"
    >
      {/* First-Run Onboarding Modal */}
      {showOnboarding && (
        <NewPlayerOnboardingModal
          games={games}
          profile={profile}
          onComplete={(favoriteGenres, selectedGameId) => {
            setShowOnboarding(false);
            if (favoriteGenres.length > 0) {
              onUpdateProfile({ favoriteGenre: favoriteGenres[0], hasCompletedOnboarding: true });
            }
            if (selectedGameId) {
              onSelectGame(selectedGameId);
            }
          }}
          onSkip={() => setShowOnboarding(false)}
        />
      )}

      {/* 1. Editorial Spotlight Hero Banner */}
      {spotlightGame && (
        <section className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-border-subtle bg-surface-card shadow-xl">
          <div className="absolute inset-0">
            <GameArtwork game={spotlightGame} className="opacity-30 blur-sm scale-105" />
            <div className="absolute inset-0 bg-gradient-to-r from-surface-card via-surface-card/85 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-transparent to-transparent" />
          </div>

          <div className="relative z-10 p-5 sm:p-8 lg:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 sm:gap-6">
            <div className="max-w-xl space-y-2.5 sm:space-y-3">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-[11px] sm:text-xs font-semibold">
                <Sparkles size={12} className="text-indigo-500 shrink-0" />
                <span>Pilihan Utama Hari Ini</span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-text-primary tracking-tight">
                {spotlightGame.title}
              </h1>

              <p className="text-text-secondary text-xs sm:text-sm lg:text-base leading-relaxed font-normal line-clamp-2 sm:line-clamp-none">
                {spotlightGame.description}
              </p>

              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-2">
                <button
                  onClick={() => { audio.playCoin(); onSelectGame(spotlightGame.id); }}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer active:scale-98"
                >
                  <Play size={15} fill="currentColor" />
                  Main Sekarang
                </button>
                <button
                  onClick={() => { audio.playCoin(); navigate('/games'); }}
                  className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-surface-subtle hover:bg-surface-hover border border-border-subtle text-text-primary font-semibold text-xs sm:text-sm transition cursor-pointer"
                >
                  Jelajahi Semua
                </button>
              </div>
            </div>

            {/* Quick Stats Pill */}
            <div className="hidden lg:flex flex-col items-end gap-2 shrink-0">
              <div className="bg-surface-elevated/90 backdrop-blur-md border border-border-medium p-4 rounded-2xl space-y-2 min-w-[200px]">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Tingkat Kesulitan</span>
                  <span className="font-semibold text-text-primary">{spotlightGame.difficulty || 'Medium'}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Dimainkan</span>
                  <span className="font-semibold text-text-primary">{(spotlightGame.plays || 0).toLocaleString()} kali</span>
                </div>
                <div className="flex items-center justify-between text-xs text-text-muted pt-1 border-t border-border-subtle">
                  <span>Skor Tertinggi</span>
                  <span className="font-semibold text-amber-500">{(spotlightGame.highScore || 0).toLocaleString()} pts</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 2. Lanjutkan Bermain & Tantangan Harian (Dual Row) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Lanjutkan Bermain */}
        <div className="lg:col-span-7 flex flex-col">
          {lastPlayedGame ? (
            <div className="bg-surface-card border border-border-subtle hover:border-border-medium p-4 sm:p-6 rounded-2xl flex-1 flex flex-col justify-between transition-colors relative shadow-xs">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-500 flex items-center gap-1.5">
                    Lanjutkan Bermain
                  </span>
                  <span className="text-xs text-text-muted">
                    {lastPlayedGame.genre}
                  </span>
                </div>

                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 bg-surface-sunken border border-border-subtle rounded-xl flex items-center justify-center text-xl sm:text-2xl shrink-0">
                    {lastPlayedGame.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base text-text-primary truncate">
                      {lastPlayedGame.title}
                    </h3>
                    <p className="text-xs text-text-muted line-clamp-1 mt-0.5">
                      {lastPlayedGame.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-text-muted pt-1">
                  <div>Skor Terakhir: <span className="text-amber-500 font-semibold">{lastPlayedGameEntry.lastScore !== undefined ? lastPlayedGameEntry.lastScore : lastPlayedGame.highScore}</span></div>
                  <div className="text-text-muted opacity-40">•</div>
                  <div>Rekor: <span className="text-text-primary font-semibold">{lastPlayedGame.highScore}</span></div>
                </div>
              </div>

              <div className="pt-4 flex items-center gap-2.5">
                <button
                  onClick={() => { audio.playCoin(); onSelectGame(lastPlayedGame.id); }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer"
                >
                  <Play size={13} fill="currentColor" /> Lanjutkan Sesi
                </button>
                <button
                  onClick={() => { audio.playCoin(); navigate('/games'); }}
                  className="px-3.5 py-2 bg-surface-subtle hover:bg-surface-hover border border-border-subtle text-text-primary font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  Pilih Lainnya
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-surface-card border border-border-subtle p-5 sm:p-6 rounded-2xl text-center space-y-3 flex-1 flex flex-col justify-center items-center shadow-xs">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-surface-subtle border border-border-subtle flex items-center justify-center text-lg sm:text-xl">
                🎮
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-text-primary">Mulai Permainan Pertama Anda</h4>
                <p className="text-xs text-text-muted mt-0.5">Pilih game dari perpustakaan dan ciptakan rekor skor perdana Anda!</p>
              </div>
              <button
                onClick={() => { audio.playCoin(); navigate('/games'); }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Buka Perpustakaan Game
              </button>
            </div>
          )}
        </div>

        {/* Daily Challenge */}
        <div className="lg:col-span-5 flex flex-col">
          {dailyChallengeToHighlight ? (
            <div className="bg-surface-card border border-border-subtle p-4 sm:p-6 rounded-2xl flex-1 flex flex-col justify-between shadow-xs">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-500 flex items-center gap-1.5">
                    <Target size={14} />
                    Tantangan Harian
                  </span>
                  <span className="text-xs text-text-muted">
                    +{dailyChallengeToHighlight.rewardCoins} koin
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-xl sm:text-2xl w-9 h-9 sm:w-10 sm:h-10 bg-surface-sunken border border-border-subtle rounded-xl flex items-center justify-center shrink-0">
                    {dailyChallengeToHighlight.icon}
                  </span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-text-primary">
                      {dailyChallengeToHighlight.title}
                    </h4>
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
                      {dailyChallengeToHighlight.description}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[11px] text-text-muted">
                    <span>Progres: {dailyChallengeToHighlight.progress} / {dailyChallengeToHighlight.target}</span>
                    <span>{Math.round((dailyChallengeToHighlight.progress / dailyChallengeToHighlight.target) * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-sunken rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-400 transition-all duration-300 rounded-full"
                      style={{ width: `${Math.min(100, (dailyChallengeToHighlight.progress / dailyChallengeToHighlight.target) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end">
                {dailyChallengeToHighlight.gameId ? (
                  <button
                    onClick={() => { audio.playCoin(); onSelectGame(dailyChallengeToHighlight.gameId!); }}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Mulai Misi
                  </button>
                ) : (
                  <button
                    onClick={() => { audio.playCoin(); navigate('/challenges'); }}
                    className="px-4 py-2 bg-surface-subtle hover:bg-surface-hover border border-border-subtle text-text-primary font-semibold text-xs rounded-xl transition cursor-pointer"
                  >
                    Lihat Semua Tantangan
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-surface-card border border-border-subtle p-5 sm:p-6 rounded-2xl text-center space-y-2 flex-1 flex flex-col justify-center items-center shadow-xs">
              <span className="text-2xl">🏆</span>
              <h4 className="text-xs sm:text-sm font-semibold text-text-primary">Semua Tantangan Selesai</h4>
              <p className="text-xs text-text-muted">Kembali lagi besok untuk misi dan hadiah koin baru!</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Flagship Games Shelf (Featured High Quality Games) */}
      <section className="space-y-3.5 sm:space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-text-primary tracking-tight flex items-center gap-2">
              <Trophy className="text-amber-500 w-4 h-4 shrink-0" />
              Game Unggulan (Flagship)
            </h2>
            <p className="text-[11px] sm:text-xs text-text-muted mt-0.5">
              Koleksi permainan terbaik dengan kontrol presisi, audio haptik, dan performa 60 FPS
            </p>
          </div>
          <button
            onClick={() => { audio.playCoin(); navigate('/games'); }}
            className="text-xs text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition flex items-center gap-1 cursor-pointer shrink-0"
          >
            Lihat Katalog <ArrowRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
          {flagshipGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              isFavorite={favorites.includes(game.id)}
              onToggleFavorite={toggleFavorite}
              onClick={() => onSelectGame(game.id)}
            />
          ))}
        </div>
      </section>

      {/* 4. Rekomendasi Pilihan Komunitas Shelf */}
      <section className="space-y-3.5 sm:space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-text-primary tracking-tight flex items-center gap-2">
              <Star className="text-indigo-500 w-4 h-4 shrink-0" />
              Rekomendasi untuk Anda
            </h2>
            <p className="text-[11px] sm:text-xs text-text-muted mt-0.5">
              Disesuaikan dengan preferensi dan gaya bermain Anda
            </p>
          </div>
          <button
            onClick={() => { audio.playCoin(); navigate('/games'); }}
            className="text-xs text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition flex items-center gap-1 cursor-pointer shrink-0"
          >
            Semua Game <ArrowRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
          {recommendedGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              isFavorite={favorites.includes(game.id)}
              onToggleFavorite={toggleFavorite}
              onClick={() => onSelectGame(game.id)}
            />
          ))}
        </div>
      </section>

      {/* 5. Main 5 Menit (Quick Play) */}
      {quickPlayGames.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
              <Zap className="text-amber-500 w-4 h-4 shrink-0" />
              Main 5 Menit (Quick Play)
            </h3>
            <span className="text-[11px] sm:text-xs text-text-muted">Sesi kilat &amp; ringan (&lt; 3 menit)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
            {quickPlayGames.map(game => (
              <div
                key={game.id}
                onClick={() => onSelectGame(game.id)}
                className="overflow-hidden bg-surface-card hover:bg-surface-card-hover border border-border-subtle hover:border-border-medium rounded-xl cursor-pointer group transition-all flex flex-col h-full shadow-xs"
              >
                <div className="h-20 sm:h-24 w-full relative">
                  <GameArtwork game={game} />
                </div>
                <div className="p-2 sm:p-3">
                  <div className="font-semibold text-xs text-text-primary group-hover:text-indigo-500 transition-colors truncate">{game.title}</div>
                  <div className="text-[10px] sm:text-[11px] text-text-muted mt-0.5">{game.genre || 'Arcade'}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
}
