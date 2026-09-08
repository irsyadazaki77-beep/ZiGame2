import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameStats, LeaderboardCategory, RivalryInsight } from '../types';
import { audio } from '../utils/audio';
import { Trophy, Calendar, Sparkles, CheckCircle, ChevronLeft, ChevronRight, ShieldCheck, Gamepad2 } from "lucide-react";
import { Button } from '../components/UI';

interface LeaderboardPageProps {
  games: GameStats[];
  currentUsername: string;
}

export default function LeaderboardPage({ games, currentUsername }: LeaderboardPageProps) {
  const [selectedGameId, setSelectedGameId] = useState(games[0]?.id || 'snake');
  const [category, setCategory] = useState<LeaderboardCategory>('global');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [userEntry, setUserEntry] = useState<any | null>(null);
  const [rivalryInsight, setRivalryInsight] = useState<RivalryInsight | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedGameId) return;
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        let url = `/api/leaderboard/${selectedGameId}?category=${category}&page=${page}&limit=10&username=${encodeURIComponent(currentUsername)}`;
        
        if (category === 'ranked') {
          url = `/api/competitive/leaderboard/${selectedGameId}?limit=50`;
        }

        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
          if (category === 'ranked') {
            setLeaderboard(data.entries || []);
            setUserRank(data.userRank || null);
            setUserEntry(data.userEntry || null);
            setTotalPages(1);
          } else {
            setLeaderboard(data.leaderboard || []);
            setTotalPages(data.totalPages || 1);
            setUserRank(null);
            setUserEntry(null);
          }
          setRivalryInsight(data.rivalryInsight || null);
        }
      } catch (e) {
        console.error('Failed to fetch leaderboard:', e);
      }
      setLoading(false);
    };
    fetchLeaderboard();
  }, [selectedGameId, category, page, currentUsername]);

  const selectedGame = games.find((g) => g.id === selectedGameId);

  // Top 3 for the podium
  const topThree = leaderboard.slice(0, 3);
  // Remaining players
  const restOfPlayers = leaderboard.slice(3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/[0.05] pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-wider text-white uppercase font-display flex items-center gap-2.5">
            <Trophy className="text-amber-500 w-5 h-5 sm:w-6 sm:h-6" />
            Papan Peringkat
          </h1>
          <p className="text-xs text-zinc-400 mt-1 uppercase tracking-widest font-mono flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-emerald-500" />
            Skor terenkripsi yang diverifikasi sistem anti-cheat
          </p>
        </div>
      </div>

      {/* Primary Configuration Row */}
      <div className="flex flex-col gap-3">
        {/* Category selector row */}
        <div className="flex bg-[#121622] p-1 rounded-full border border-white/[0.04] gap-1 w-fit">
          <button
            onClick={() => { audio.playCoin(); setCategory('global'); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold uppercase transition duration-200 cursor-pointer flex items-center gap-1.5 ${
              category === 'global' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Trophy size={13} /> Global
          </button>
          <button
            onClick={() => { audio.playCoin(); setCategory('weekly'); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold uppercase transition duration-200 cursor-pointer flex items-center gap-1.5 ${
              category === 'weekly' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Calendar size={13} /> Mingguan
          </button>
          <button
            onClick={() => { audio.playCoin(); setCategory('seasonal'); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold uppercase transition duration-200 cursor-pointer flex items-center gap-1.5 ${
              category === 'seasonal' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles size={13} /> Season 1
          </button>
          <button
            onClick={() => { audio.playCoin(); setCategory('ranked'); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold uppercase transition duration-200 cursor-pointer flex items-center gap-1.5 ${
              category === 'ranked' ? 'bg-rose-500 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ShieldCheck size={13} /> Ranked
          </button>
        </div>

        {/* Game Selector horizontal list */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          {games.map((g) => (
            <button
              key={g.id}
              onClick={() => { audio.playHit(); setSelectedGameId(g.id); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer border select-none ${
                selectedGameId === g.id
                  ? 'bg-zinc-800 text-white border-zinc-700'
                  : 'bg-[#121622] border-white/[0.04] text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span>{g.icon}</span>
              <span className="truncate max-w-[110px]">{g.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Rivalry Insight Notification Banner */}
      {rivalryInsight && (
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl px-4 py-3 flex items-center gap-3 text-xs font-mono text-indigo-300">
          <span className="text-sm">⚔️</span>
          <div>
            <span className="font-bold mr-1.5">Informasi Rival:</span>
            <span>{rivalryInsight.message}</span>
          </div>
        </div>
      )}

      {/* Loading state or display leaderboard */}
      {loading ? (
        <div className="p-12 text-center text-zinc-500 text-xs font-mono animate-pulse border border-zinc-800/50 border-dashed rounded-3xl bg-zinc-950/20">
          Mengambil data skor siber yang dienkripsi dari cloud...
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="p-12 text-center text-zinc-500 text-xs italic border border-zinc-800/50 border-dashed rounded-3xl bg-zinc-950/20">
          Belum ada data skor terekam untuk game "{selectedGame?.title || 'ini'}" di kategori ini.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Podium for Top 3 (Rendered only on page 1) */}
          {page === 1 && topThree.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-2 pb-2 px-1 max-w-lg sm:max-w-2xl mx-auto items-end">
              {/* 2nd Place */}
              {topThree[1] ? (
                <div className="flex flex-col items-center order-1">
                  <div className="relative mb-1.5 sm:mb-2">
                    <span className="text-2xl sm:text-3xl p-1.5 sm:p-2 bg-[#141824] border border-white/[0.08] rounded-xl sm:rounded-2xl block relative">
                      {topThree[1].playerAvatar || '👾'}
                    </span>
                    <span className="absolute -top-2 -right-2 w-5 h-5 sm:w-6 sm:h-6 bg-zinc-400 text-zinc-950 font-black text-[10px] sm:text-xs font-mono rounded-full flex items-center justify-center border border-zinc-500 shadow">
                      2
                    </span>
                  </div>
                  <div className="text-center w-full min-w-0">
                    <h3 className="font-bold text-[11px] sm:text-xs text-zinc-300 truncate">{topThree[1].playerName}</h3>
                    <p className="font-mono text-[10px] sm:text-[11px] text-amber-400 font-bold mt-0.5">{topThree[1].score.toLocaleString()}</p>
                  </div>
                  <div className="w-full h-8 sm:h-12 bg-zinc-800/40 border-t border-zinc-700/50 rounded-t-lg mt-2"></div>
                </div>
              ) : <div className="order-1" />}

              {/* 1st Place */}
              {topThree[0] && (
                <div className="flex flex-col items-center order-2">
                  <div className="relative mb-1.5 sm:mb-2">
                    <span className="text-3xl sm:text-4xl p-2 sm:p-2.5 bg-[#141824] border-2 border-amber-500 rounded-2xl sm:rounded-3xl block relative shadow-lg shadow-amber-500/15">
                      {topThree[0].playerAvatar || '👑'}
                    </span>
                    <span className="absolute -top-2.5 -right-2.5 w-6 h-6 sm:w-7 sm:h-7 bg-amber-500 text-zinc-950 font-black text-xs sm:text-sm font-mono rounded-full flex items-center justify-center border border-amber-400 shadow">
                      1
                    </span>
                  </div>
                  <div className="text-center w-full min-w-0">
                    <h3 className="font-bold text-xs sm:text-sm text-white truncate flex items-center justify-center gap-1">
                      <span className="truncate">{topThree[0].playerName}</span>
                      <CheckCircle size={12} className="text-amber-400 shrink-0" />
                    </h3>
                    <p className="font-mono text-xs text-amber-400 font-black mt-0.5">{topThree[0].score.toLocaleString()} pts</p>
                  </div>
                  <div className="w-full h-12 sm:h-16 bg-amber-500/15 border-t-2 border-amber-500/40 rounded-t-lg mt-2"></div>
                </div>
              )}

              {/* 3rd Place */}
              {topThree[2] ? (
                <div className="flex flex-col items-center order-3">
                  <div className="relative mb-1.5 sm:mb-2">
                    <span className="text-2xl sm:text-3xl p-1.5 sm:p-2 bg-[#141824] border border-white/[0.08] rounded-xl sm:rounded-2xl block relative">
                      {topThree[2].playerAvatar || '👾'}
                    </span>
                    <span className="absolute -top-2 -right-2 w-5 h-5 sm:w-6 sm:h-6 bg-amber-700 text-white font-black text-[10px] sm:text-xs font-mono rounded-full flex items-center justify-center border border-amber-600 shadow">
                      3
                    </span>
                  </div>
                  <div className="text-center w-full min-w-0">
                    <h3 className="font-bold text-[11px] sm:text-xs text-zinc-400 truncate">{topThree[2].playerName}</h3>
                    <p className="font-mono text-[10px] sm:text-[11px] text-amber-500 font-bold mt-0.5">{topThree[2].score.toLocaleString()}</p>
                  </div>
                  <div className="w-full h-6 sm:h-8 bg-amber-950/30 border-t border-amber-800/40 rounded-t-lg mt-2"></div>
                </div>
              ) : <div className="order-3" />}
            </div>
          )}

          {/* List for remainder ranks */}
          <div className="space-y-1.5 max-w-3xl mx-auto">
            {/* Show top 3 in list form if not page 1, else only show 4+ */}
            {leaderboard.map((entry, index) => {
              const globalRank = (page - 1) * 10 + index + 1;
              if (page === 1 && globalRank <= 3) return null; // Already displayed on podium
              const isUser = entry.playerName.toUpperCase() === currentUsername.toUpperCase();

              return (
                <div
                  key={index}
                  className={`p-3 rounded-xl border flex items-center justify-between transition ${
                    isUser
                      ? 'bg-amber-500/5 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.05)]'
                      : 'bg-[#121622]/60 border-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-black w-6 text-center text-zinc-500">
                      #{globalRank}
                    </span>
                    <span className="text-xl p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
                      {entry.playerAvatar || '👾'}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white uppercase">{entry.playerName}</span>
                        <CheckCircle size={11} className="text-emerald-500" />
                        {entry.tier && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded font-bold">
                            {entry.tier}
                          </span>
                        )}
                        {isUser && (
                          <span className="text-[8px] font-mono px-1 bg-amber-500 text-black rounded font-black uppercase">
                            Anda
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {entry.submittedAt ? new Date(entry.submittedAt).toLocaleDateString() : 'Terverifikasi'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-xs sm:text-sm font-mono font-black ${category === 'ranked' ? 'text-rose-400' : 'text-amber-400'}`}>
                      {category === 'ranked' ? (entry.rating || 1000) : entry.score.toLocaleString()}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500 block uppercase">
                      {category === 'ranked' ? 'RP' : 'pts'}
                    </span>
                  </div>
                </div>
              );
            })}
            
            {/* My Position context if not in top list */}
            {userRank && userRank > leaderboard.length && userEntry && (
              <div className="mt-4 pt-4 border-t border-white/[0.04]">
                <div className="p-3 rounded-xl border bg-rose-500/10 border-rose-500/40 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-black w-6 text-center text-rose-400">
                      #{userRank}
                    </span>
                    <span className="text-xl p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
                      {userEntry.playerAvatar || '👤'}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white uppercase">{userEntry.playerName}</span>
                        <CheckCircle size={11} className="text-emerald-500" />
                        <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded font-bold uppercase">
                          {userEntry.tier || 'BRONZE'}
                        </span>
                        <span className="text-[8px] font-mono px-1 bg-rose-500 text-white rounded font-black uppercase">
                          POSISI ANDA
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 italic">
                        Terus bermain untuk masuk ke TOP 50!
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs sm:text-sm font-mono font-black text-rose-400">
                      {userEntry.rating || 1000}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500 block uppercase">RP</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="max-w-3xl mx-auto flex items-center justify-between bg-[#121622] p-3.5 rounded-2xl border border-white/[0.04]">
            <button
              onClick={() => { audio.playHit(); setPage((p) => Math.max(1, p - 1)); }}
              disabled={page <= 1}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white text-xs font-mono font-bold transition flex items-center gap-1 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft size={14} /> Sblm
            </button>

            <span className="text-xs font-mono text-zinc-400 uppercase">
              Halaman {page} dari {totalPages}
            </span>

            <button
              onClick={() => { audio.playHit(); setPage((p) => Math.min(totalPages, p + 1)); }}
              disabled={page >= totalPages}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white text-xs font-mono font-bold transition flex items-center gap-1 disabled:opacity-40 cursor-pointer"
            >
              Lanjut <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
