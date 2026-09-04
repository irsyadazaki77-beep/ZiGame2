import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Play, Flame, Award, Clock, ArrowUpRight, Trophy, Zap, Compass, Sparkles, Target, Users } from 'lucide-react';
import { GameStats, DailyMission, Achievement, PlayerProfile, RecentlyPlayedEntry, Challenge } from '../types';
import { challengeService } from '../services/challengeService';
import { getRecommendedGames, getTrendingGames, getHiddenGems } from '../utils/recommendationEngine';
import { audio } from '../utils/audio';
import { formatNumber } from "../utils/format";
import { useNavigate } from 'react-router-dom';

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

  // Get active challenges to highlight the most relevant daily challenge
  const activeChallenges = useMemo(() => {
    return challengeService.generateChallengesIfOutdated(games);
  }, [games]);

  const dailyChallengeToHighlight = useMemo(() => {
    return activeChallenges.find(c => c.frequency === 'daily' && !c.claimed) || activeChallenges[0];
  }, [activeChallenges]);

  // Recommended Games (Top 3 popular or highest play count)
  
  const recommendedGames = useMemo(() => getRecommendedGames(games, profile, recentlyPlayed), [games, profile, recentlyPlayed]);
  const trendingGames = useMemo(() => getTrendingGames(games), [games]);
  const hiddenGems = useMemo(() => getHiddenGems(games), [games]);


  // Continue playing (the absolute last played game)
  const lastPlayedGameEntry = recentlyPlayed[0];
  const lastPlayedGame = lastPlayedGameEntry ? games.find(g => g.id === lastPlayedGameEntry.gameId) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6"
    >
      {/* 1. Welcoming Hero Section with Active Event Info */}
      <section className="relative rounded-3xl overflow-hidden border border-white/[0.05] bg-[#0a0c14] flex flex-col md:flex-row items-center justify-between p-6 sm:p-8 gap-6 shadow-xl shadow-indigo-950/5">
        <div className="absolute -left-20 -top-20 w-48 h-48 rounded-full bg-indigo-500/10 filter blur-3xl pointer-events-none" />
        <div className="absolute -right-20 -bottom-20 w-48 h-48 rounded-full bg-amber-500/5 filter blur-3xl pointer-events-none" />
        
        <div className="space-y-2 relative z-10 text-center md:text-left">
          <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-mono font-black px-2.5 py-1 rounded-md w-fit uppercase tracking-wider mx-auto md:mx-0 flex items-center gap-1.5">
            <Sparkles size={11} className="text-indigo-400 animate-pulse" />
            LOBI UTAMA SIBER
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wider font-display uppercase">
            SELAMAT DATANG, <span className="text-indigo-400">{profile.name}</span>
          </h1>
          <p className="text-zinc-400 text-xs max-w-md leading-relaxed font-sans">
            Anda berada di pusat hiburan arkade paling modern. {lastPlayedGame ? `Siap untuk memecahkan rekor baru di ${lastPlayedGame.title} hari ini?` : 'Temukan game siber seru dan kumpulkan koin reward!'}
          </p>
        </div>

        {/* Mini Active Season Badge */}
        <div className="bg-white/[0.02] border border-white/[0.04] p-4 rounded-2xl flex flex-col justify-center items-center text-center w-full md:w-56 shrink-0 relative z-10">
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest font-bold">EVENT AKTIF</div>
          <div className="text-sm font-black text-white uppercase tracking-wider mt-1">CYBER GENESIS v1</div>
          <div className="text-[10px] font-mono text-indigo-400 mt-1 uppercase bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
            BATALION REWARD
          </div>
        </div>
      </section>

      {/* 2. Primary Layout: split view for Continue & Daily Challenge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Highlighted Continue Playing (High Priority CTA) */}
        <div className="lg:col-span-7 flex flex-col">
          {lastPlayedGame ? (
            <div className="bg-[#0f1322] border border-indigo-500/20 p-5 sm:p-6 rounded-3xl space-y-4 shadow-md flex-1 flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-600/5 rounded-full filter blur-2xl group-hover:bg-indigo-600/10 transition-all pointer-events-none" />
              
              <div className="space-y-3">
                <span className="text-[10px] font-mono font-black text-indigo-400 tracking-wider uppercase block">LANJUTKAN PETUALANGAN</span>
                
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-[#080b13] border border-white/[0.08] rounded-2xl flex items-center justify-center text-3xl shadow-sm shrink-0">
                    {lastPlayedGame.icon}
                  </div>
                  <div>
                    <h3 className="font-black text-base sm:text-lg text-white uppercase tracking-wider font-display">
                      {lastPlayedGame.title}
                    </h3>
                    <p className="text-xs text-zinc-400 leading-normal font-sans mt-0.5 max-w-sm line-clamp-1">{lastPlayedGame.description}</p>
                  </div>
                </div>

                <div className="flex gap-4 pt-1 font-mono text-[10px] text-zinc-500 uppercase">
                  <div>SKOR TERAKHIR: <span className="text-amber-400 font-bold">{lastPlayedGameEntry.lastScore !== undefined ? lastPlayedGameEntry.lastScore : lastPlayedGame.highScore}</span></div>
                  <div>HIGH SCORE: <span className="text-white font-bold">{lastPlayedGame.highScore}</span></div>
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                <button
                  onClick={() => { audio.playCoin(); onSelectGame(lastPlayedGame.id); }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer flex items-center gap-2 shadow-sm transition"
                >
                  <Play size={12} fill="currentColor" /> MAIN LAGI
                </button>
                <button
                  onClick={() => { audio.playCoin(); navigate('/games'); }}
                  className="px-4 py-2.5 bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.04] text-zinc-400 hover:text-white font-mono font-bold text-xs uppercase rounded-xl cursor-pointer transition"
                >
                  GANTI PERMAINAN
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#0f1322] border border-white/[0.04] p-5 sm:p-6 rounded-3xl text-center space-y-4 flex-1 flex flex-col justify-center items-center shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center text-2xl">🎮</div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-white uppercase">Belum Ada Riwayat Bermain</h4>
                <p className="text-xs text-zinc-500 font-sans max-w-xs">Mulai petualangan siber pertamamu sekarang juga di perpustakaan game!</p>
              </div>
              <button
                onClick={() => { audio.playCoin(); navigate('/games'); }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition"
              >
                MULAI BERMAIN
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Featured Daily Challenge Block */}
        <div className="lg:col-span-5 flex flex-col">
          {dailyChallengeToHighlight ? (
            <div className="bg-[#0f1322] border border-amber-500/20 p-5 sm:p-6 rounded-3xl space-y-4 shadow-md flex-1 flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute right-0 top-0 w-32 h-32 bg-amber-500/5 rounded-full filter blur-2xl pointer-events-none" />
              
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-black text-amber-500 tracking-wider uppercase block">TANTANGAN HARI INI</span>
                <div className="flex items-center gap-3">
                  <span className="text-2xl w-10 h-10 bg-white/[0.02] border border-white/[0.05] rounded-xl flex items-center justify-center shrink-0">
                    {dailyChallengeToHighlight.icon}
                  </span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">{dailyChallengeToHighlight.title}</h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-normal font-sans line-clamp-2">{dailyChallengeToHighlight.description}</p>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[9px] font-mono text-zinc-500 uppercase">
                    <span>PROGRES: {dailyChallengeToHighlight.progress}/{dailyChallengeToHighlight.target}</span>
                    <span>{Math.round((dailyChallengeToHighlight.progress / dailyChallengeToHighlight.target) * 100)}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/[0.03] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, (dailyChallengeToHighlight.progress / dailyChallengeToHighlight.target) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center gap-4">
                <div className="flex gap-3 text-[10px] font-mono text-zinc-500 uppercase">
                  <span>HADIAH: <span className="text-amber-400 font-bold">🪙 {dailyChallengeToHighlight.rewardCoins}</span></span>
                </div>
                
                {dailyChallengeToHighlight.gameId ? (
                  <button
                    onClick={() => { audio.playCoin(); onSelectGame(dailyChallengeToHighlight.gameId!); }}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-mono font-black text-[10px] uppercase rounded-xl cursor-pointer transition shadow-sm"
                  >
                    MULAI TANTANGAN
                  </button>
                ) : (
                  <button
                    onClick={() => { audio.playCoin(); navigate('/challenges'); }}
                    className="px-3.5 py-1.5 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] text-zinc-300 font-mono font-bold text-[10px] uppercase rounded-xl cursor-pointer transition"
                  >
                    Buka Menu Misi
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#0f1322] border border-white/[0.04] p-5 sm:p-6 rounded-3xl text-center space-y-3 flex-1 flex flex-col justify-center items-center shadow-sm">
              <span className="text-xl">✨</span>
              <h4 className="text-xs font-black text-white uppercase">Tantangan Selesai</h4>
              <p className="text-[11px] text-zinc-500 font-sans">Semua tantangan harian hari ini sudah diselesaikan dengan baik!</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Recommended / Handpicked Games Section */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="space-y-0.5">
            <h2 className="font-display font-black text-sm sm:text-base text-zinc-200 tracking-wider uppercase flex items-center gap-2">
              <Flame className="text-orange-500 w-4 h-4" /> Rekomendasi Unggulan
            </h2>
            <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">PERMAINAN PALING DIMINATI PEMAIN SIBER</p>
          </div>
          <button
            onClick={() => { audio.playCoin(); navigate('/games'); }}
            className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-widest transition flex items-center gap-1 cursor-pointer"
          >
            LIHAT SEMUA →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {recommendedGames.map((game) => (
            <div
              key={game.id}
              onClick={() => onSelectGame(game.id)}
              className="p-4 bg-[#0f1322] hover:bg-[#12182a] border border-white/[0.04] hover:border-indigo-500/20 rounded-3xl flex flex-col justify-between gap-4 cursor-pointer group transition-all duration-200 shadow-sm"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 bg-[#080b13] border border-white/[0.06] rounded-2xl flex items-center justify-center text-2xl shadow-sm shrink-0">
                    {game.icon}
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 bg-white/[0.02] text-zinc-500 rounded border border-white/[0.04] uppercase">
                    {game.genre}
                  </span>
                </div>
                <div className="space-y-1">
                  <h3 className="font-black text-sm text-white uppercase tracking-wide group-hover:text-indigo-400 transition-colors">
                    {game.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-normal font-sans line-clamp-2">{game.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/[0.03] text-[10px] font-mono">
                <span className="text-zinc-500">PLAYED: <span className="text-white font-bold">{game.plays}x</span></span>
                <span className="text-zinc-500">RECORD: <span className="text-amber-400 font-bold">{game.highScore}</span></span>
              </div>
            </div>
          ))}
        </div>
      
      </section>

      {/* Discovery Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-[#0f1322] border border-white/[0.04] p-4 sm:p-5 rounded-3xl space-y-4 shadow-sm">
          <h3 className="font-display font-black text-xs sm:text-sm text-zinc-200 tracking-wider uppercase flex items-center gap-2">
            <Sparkles className="text-indigo-400 w-4 h-4" /> Trending Now
          </h3>
          <div className="space-y-2">
            {trendingGames.map(game => (
              <div key={game.id} onClick={() => onSelectGame(game.id)} className="flex items-center justify-between p-2 hover:bg-white/[0.02] rounded-xl cursor-pointer group transition">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{game.icon}</span>
                  <div>
                    <div className="font-bold text-xs uppercase group-hover:text-indigo-400 transition">{game.title}</div>
                    <div className="text-[9px] text-zinc-500 font-mono">{formatNumber(game.plays)} plays</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-indigo-400" />
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#0f1322] border border-white/[0.04] p-4 sm:p-5 rounded-3xl space-y-4 shadow-sm">
          <h3 className="font-display font-black text-xs sm:text-sm text-zinc-200 tracking-wider uppercase flex items-center gap-2">
            <Compass className="text-emerald-400 w-4 h-4" /> Hidden Gems
          </h3>
          <div className="space-y-2">
            {hiddenGems.map(game => (
              <div key={game.id} onClick={() => onSelectGame(game.id)} className="flex items-center justify-between p-2 hover:bg-white/[0.02] rounded-xl cursor-pointer group transition">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{game.icon}</span>
                  <div>
                    <div className="font-bold text-xs uppercase group-hover:text-emerald-400 transition">{game.title}</div>
                    <div className="text-[9px] text-zinc-500 font-mono">{game.genre}</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400" />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 4. Compact Recently Played Area (if more than 3 games) */}
      {recentlyPlayed.length > 1 && (
        <section className="bg-[#0f1322] border border-white/[0.04] p-4 sm:p-5 rounded-3xl space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-black">RIWAYAT BERMAIN SEBELUMNYA</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentlyPlayed.slice(1, 6).map(entry => {
              const gameObj = games.find(g => g.id === entry.gameId);
              if (!gameObj) return null;
              return (
                <div
                  key={entry.gameId}
                  onClick={() => onSelectGame(gameObj.id)}
                  className="px-3 py-1.5 bg-[#080b13] hover:bg-white/[0.02] border border-white/[0.04] hover:border-white/10 rounded-xl text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-2 cursor-pointer transition select-none"
                >
                  <span>{gameObj.icon}</span>
                  <span className="uppercase font-bold">{gameObj.title}</span>
                  <span className="text-[9px] text-zinc-600">({entry.lastScore !== undefined ? entry.lastScore : gameObj.highScore} pts)</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </motion.div>
  );
}
