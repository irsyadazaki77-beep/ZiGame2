import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Play, Flame, ArrowUpRight, Trophy, Sparkles, Compass, Target, ArrowRight, Zap, Shield, HelpCircle, Gamepad2 } from 'lucide-react';
import { GameStats, DailyMission, Achievement, PlayerProfile, RecentlyPlayedEntry } from '../types';
import { challengeService } from '../services/challengeService';
import { getRecommendedGames, getTrendingGames, getHiddenGems } from '../utils/recommendationEngine';
import { audio } from '../utils/audio';
import { formatNumber } from "../utils/format";
import { useNavigate } from 'react-router-dom';
import { NewPlayerOnboardingModal } from '../components/onboarding/NewPlayerOnboardingModal';
import { GAME_QUALITY_MAP } from '../config/qualityTiers';

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

  // Get active challenges to highlight the most relevant daily challenge
  const activeChallenges = useMemo(() => {
    return challengeService.generateChallengesIfOutdated(games);
  }, [games]);

  const dailyChallengeToHighlight = useMemo(() => {
    return activeChallenges.find(c => c.frequency === 'daily' && !c.claimed) || activeChallenges[0];
  }, [activeChallenges]);

  // Recommended, trending, hidden gems
  const recommendedGames = useMemo(() => getRecommendedGames(games, profile, recentlyPlayed), [games, profile, recentlyPlayed]);
  const trendingGames = useMemo(() => getTrendingGames(games), [games]);
  const hiddenGems = useMemo(() => getHiddenGems(games), [games]);

  // Curated Discovery Shelves
  const quickPlayGames = useMemo(() => {
    return games.filter(g => GAME_QUALITY_MAP[g.id]?.estimatedDuration === 'quick').slice(0, 4);
  }, [games]);

  const highSkillGames = useMemo(() => {
    return games.filter(g => GAME_QUALITY_MAP[g.id]?.competitiveSupported).slice(0, 4);
  }, [games]);

  const flagshipGames = useMemo(() => {
    return games.filter(g => GAME_QUALITY_MAP[g.id]?.tier === 'flagship').slice(0, 4);
  }, [games]);

  // Continue playing (the last played game)
  const lastPlayedGameEntry = recentlyPlayed[0];
  const lastPlayedGame = lastPlayedGameEntry ? games.find(g => g.id === lastPlayedGameEntry.gameId) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-7"
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

      {/* 1. Hero Feature Banner */}
      <section className="relative rounded-3xl overflow-hidden border border-white/[0.06] bg-[#0d111a] p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-mono font-semibold uppercase tracking-wider">
            <Sparkles size={12} />
            Lobi Utama ZiGame
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide font-display">
            Halo, {profile.name}
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed font-sans">
            {lastPlayedGame ? `Lanjutkan progres bermain ${lastPlayedGame.title} atau jelajahi koleksi game arkade seru hari ini.` : 'Selamat datang di ZiGame. Pilih game arkade favoritmu dan mulai kumpulkan skor tertinggi!'}
          </p>
        </div>

        {/* Quick Stats Pill Header */}
        <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-white/[0.06] shrink-0">
          <div className="bg-[#131824] border border-white/[0.06] px-4 py-2.5 rounded-2xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <div className="text-left">
              <span className="text-[10px] font-mono uppercase text-zinc-400 block font-bold">Koleksi Aktif</span>
              <span className="text-xs font-mono font-bold text-white">{games.length} Permainan Siap Main</span>
            </div>
          </div>
          <button
            onClick={() => setShowOnboarding(true)}
            className="text-[11px] font-mono text-zinc-400 hover:text-indigo-400 flex items-center gap-1 transition cursor-pointer"
          >
            <HelpCircle size={12} />
            <span>Panduan Pemain Baru</span>
          </button>
        </div>
      </section>

      {/* 2. Highlight Row: Continue Playing & Daily Mission */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Continue Playing / Quick Launch */}
        <div className="lg:col-span-7 flex flex-col">
          {lastPlayedGame ? (
            <div className="bg-[#0f131c] border border-white/[0.06] hover:border-indigo-500/30 p-5 sm:p-6 rounded-3xl flex-1 flex flex-col justify-between transition-colors relative group">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-indigo-400 uppercase tracking-wider">
                    Lanjutkan Bermain
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase">
                    {lastPlayedGame.genre}
                  </span>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-zinc-900 border border-white/[0.08] rounded-2xl flex items-center justify-center text-3xl shadow-inner shrink-0">
                    {lastPlayedGame.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display font-bold text-base sm:text-lg text-white tracking-wide truncate">
                      {lastPlayedGame.title}
                    </h3>
                    <p className="text-xs text-zinc-400 font-sans line-clamp-1 mt-0.5">
                      {lastPlayedGame.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[11px] font-mono text-zinc-400 pt-1">
                  <div>Skor Terakhir: <span className="text-amber-400 font-bold">{lastPlayedGameEntry.lastScore !== undefined ? lastPlayedGameEntry.lastScore : lastPlayedGame.highScore}</span></div>
                  <div className="text-zinc-600">•</div>
                  <div>Rekor Terbaik: <span className="text-white font-bold">{lastPlayedGame.highScore}</span></div>
                </div>
              </div>

              <div className="pt-5 flex items-center gap-2.5">
                <button
                  onClick={() => { audio.playCoin(); onSelectGame(lastPlayedGame.id); }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-sm shadow-indigo-600/20"
                >
                  <Play size={13} fill="currentColor" /> Main Sekarang
                </button>
                <button
                  onClick={() => { audio.playCoin(); navigate('/games'); }}
                  className="px-4 py-2.5 bg-[#151a26] hover:bg-[#1a2130] border border-white/[0.06] text-zinc-300 hover:text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Pilih Game Lain
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#0f131c] border border-white/[0.06] p-6 rounded-3xl text-center space-y-3 flex-1 flex flex-col justify-center items-center">
              <div className="w-12 h-12 rounded-2xl bg-[#151a26] border border-white/[0.06] flex items-center justify-center text-2xl">
                🎮
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Mulai Petualangan Pertamamu</h4>
                <p className="text-xs text-zinc-400 mt-1 max-w-xs">Jelajahi perpustakaan game dan catat rekor skor pertamamu!</p>
              </div>
              <button
                onClick={() => { audio.playCoin(); navigate('/games'); }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Buka Perpustakaan Game
              </button>
            </div>
          )}
        </div>

        {/* Daily Challenge Card */}
        <div className="lg:col-span-5 flex flex-col">
          {dailyChallengeToHighlight ? (
            <div className="bg-[#0f131c] border border-white/[0.06] p-5 sm:p-6 rounded-3xl flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Target size={13} />
                    Tantangan Harian
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase">
                    Hadiah: {dailyChallengeToHighlight.rewardCoins}🪙
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-2xl w-11 h-11 bg-zinc-900 border border-white/[0.06] rounded-xl flex items-center justify-center shrink-0">
                    {dailyChallengeToHighlight.icon}
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {dailyChallengeToHighlight.title}
                    </h4>
                    <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
                      {dailyChallengeToHighlight.description}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                    <span>Progres: {dailyChallengeToHighlight.progress} / {dailyChallengeToHighlight.target}</span>
                    <span>{Math.round((dailyChallengeToHighlight.progress / dailyChallengeToHighlight.target) * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
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
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Mulai Misi
                  </button>
                ) : (
                  <button
                    onClick={() => { audio.playCoin(); navigate('/challenges'); }}
                    className="px-4 py-2 bg-[#151a26] hover:bg-[#1a2130] border border-white/[0.06] text-zinc-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Lihat Semua Tantangan
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#0f131c] border border-white/[0.06] p-6 rounded-3xl text-center space-y-2 flex-1 flex flex-col justify-center items-center">
              <span className="text-2xl">🏆</span>
              <h4 className="text-sm font-bold text-white">Semua Tantangan Selesai</h4>
              <p className="text-xs text-zinc-400">Kembali lagi besok untuk misi dan hadiah baru!</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Curated Recommendations Grid */}
      <section className="space-y-4 pt-2">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-display font-bold text-base sm:text-lg text-white tracking-wide flex items-center gap-2">
              <Flame className="text-orange-500 w-4 h-4" />
              Rekomendasi Pilihan
            </h2>
            <p className="text-xs text-zinc-400 font-sans mt-0.5">
              Pilihan game yang paling disukai komunitas
            </p>
          </div>
          <button
            onClick={() => { audio.playCoin(); navigate('/games'); }}
            className="text-xs font-mono text-indigo-400 hover:text-indigo-300 font-semibold transition-colors flex items-center gap-1 cursor-pointer"
          >
            Lihat Semua <ArrowRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {recommendedGames.slice(0, 3).map((game) => (
            <div
              key={game.id}
              onClick={() => onSelectGame(game.id)}
              className="p-5 bg-[#0f131c] hover:bg-[#151a26] border border-white/[0.06] hover:border-indigo-500/30 rounded-2xl flex flex-col justify-between gap-4 cursor-pointer group transition-all duration-150"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 bg-zinc-900 border border-white/[0.06] rounded-xl flex items-center justify-center text-2xl shrink-0 shadow-inner">
                    {game.icon}
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-white/[0.04] text-zinc-400 rounded-md border border-white/[0.04] uppercase">
                    {game.genre}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-display font-bold text-sm text-white group-hover:text-indigo-400 transition-colors">
                    {game.title}
                  </h3>
                  <p className="text-xs text-zinc-400 font-sans line-clamp-2 leading-relaxed">
                    {game.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/[0.04] text-[11px] font-mono text-zinc-400">
                <span>{game.plays} kali dimainkan</span>
                <span className="text-zinc-300 font-bold">Rekor: {game.highScore}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Discovery Section: Play for 5 Minutes */}
      {quickPlayGames.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-sm sm:text-base text-white flex items-center gap-2">
              <Zap className="text-amber-400 w-4 h-4" />
              Main 5 Menit (Quick Play)
            </h3>
            <span className="text-[11px] font-mono text-zinc-400">Sesi Kilat & Ringan</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickPlayGames.map(game => (
              <div
                key={game.id}
                onClick={() => onSelectGame(game.id)}
                className="p-3.5 bg-[#0f131c] hover:bg-[#151a26] border border-white/[0.06] hover:border-amber-500/30 rounded-2xl cursor-pointer group transition-all"
              >
                <div className="text-2xl mb-2">{game.icon}</div>
                <div className="font-bold text-xs text-white group-hover:text-amber-400 truncate">{game.title}</div>
                <div className="text-[10px] font-mono text-zinc-400 mt-0.5">&lt; 3 menit</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Discovery Section: High-Skill Competitive Arcade */}
      {highSkillGames.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-sm sm:text-base text-white flex items-center gap-2">
              <Shield className="text-indigo-400 w-4 h-4" />
              High-Skill Competitive Arcade
            </h3>
            <span className="text-[11px] font-mono text-zinc-400">Skill Rating (MMR) Aktif</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {highSkillGames.map(game => (
              <div
                key={game.id}
                onClick={() => onSelectGame(game.id)}
                className="p-3.5 bg-[#0f131c] hover:bg-[#151a26] border border-white/[0.06] hover:border-indigo-500/30 rounded-2xl cursor-pointer group transition-all"
              >
                <div className="text-2xl mb-2">{game.icon}</div>
                <div className="font-bold text-xs text-white group-hover:text-indigo-400 truncate">{game.title}</div>
                <div className="text-[10px] font-mono text-indigo-300/80 mt-0.5">Rating &amp; Tiers</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Trending and Hidden Gems Split Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* Trending */}
        <section className="bg-[#0f131c] border border-white/[0.06] p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <Sparkles className="text-indigo-400 w-4 h-4" />
              Sedang Tren
            </h3>
            <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold">Popularitas</span>
          </div>

          <div className="space-y-1.5">
            {trendingGames.slice(0, 4).map(game => (
              <div 
                key={game.id} 
                onClick={() => onSelectGame(game.id)} 
                className="flex items-center justify-between p-2.5 hover:bg-white/[0.03] rounded-xl cursor-pointer group transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl w-8 h-8 rounded-lg bg-zinc-900 border border-white/[0.04] flex items-center justify-center">
                    {game.icon}
                  </span>
                  <div>
                    <div className="font-semibold text-xs text-zinc-200 group-hover:text-indigo-400 transition-colors">
                      {game.title}
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">{formatNumber(game.plays)} main</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-indigo-400 transition-colors" />
              </div>
            ))}
          </div>
        </section>

        {/* Hidden Gems */}
        <section className="bg-[#0f131c] border border-white/[0.06] p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <Compass className="text-emerald-400 w-4 h-4" />
              Rekomendasi Spesial
            </h3>
            <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold">Pilihan Editor</span>
          </div>

          <div className="space-y-1.5">
            {hiddenGems.slice(0, 4).map(game => (
              <div 
                key={game.id} 
                onClick={() => onSelectGame(game.id)} 
                className="flex items-center justify-between p-2.5 hover:bg-white/[0.03] rounded-xl cursor-pointer group transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl w-8 h-8 rounded-lg bg-zinc-900 border border-white/[0.04] flex items-center justify-center">
                    {game.icon}
                  </span>
                  <div>
                    <div className="font-semibold text-xs text-zinc-200 group-hover:text-emerald-400 transition-colors">
                      {game.title}
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">{game.genre}</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 7. Recently Played History row */}
      {recentlyPlayed.length > 1 && (
        <section className="bg-[#0f131c] border border-white/[0.06] p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase font-bold tracking-wider">
              Riwayat Bermain
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentlyPlayed.slice(1, 6).map(entry => {
              const gameObj = games.find(g => g.id === entry.gameId);
              if (!gameObj) return null;
              return (
                <div
                  key={entry.gameId}
                  onClick={() => onSelectGame(gameObj.id)}
                  className="px-3 py-1.5 bg-[#151a26] hover:bg-[#1a2130] border border-white/[0.06] hover:border-white/10 rounded-xl text-xs font-mono text-zinc-300 hover:text-white flex items-center gap-2 cursor-pointer transition-colors select-none"
                >
                  <span>{gameObj.icon}</span>
                  <span className="font-semibold">{gameObj.title}</span>
                  <span className="text-[10px] text-zinc-400 font-bold">({entry.lastScore !== undefined ? entry.lastScore : gameObj.highScore} pts)</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </motion.div>
  );
}
