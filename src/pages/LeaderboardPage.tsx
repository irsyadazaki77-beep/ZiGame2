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
  const [rivalryInsight, setRivalryInsight] = useState<RivalryInsight | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedGameId) return;
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/leaderboard/${selectedGameId}?category=${category}&page=${page}&limit=10&username=${encodeURIComponent(currentUsername)}`);
        const data = await res.json();
        if (data.success) {
          setLeaderboard(data.leaderboard || []);
          setTotalPages(data.totalPages || 1);
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
            <div className="flex flex-col sm:flex-row justify-center items-end gap-3 md:gap-6 pt-4 pb-2 px-2 max-w-2xl mx-auto">
              {/* 2nd Place */}
              {topThree[1] && (
                <div className="w-full sm:w-32 flex flex-col items-center order-2 sm:order-1 mt-4 sm:mt-0">
                  <div className="relative mb-2">
                    <span className="text-3xl p-1.5 bg-zinc-900 border border-zinc-800 rounded-2xl block relative">
                      {topThree[1].playerAvatar || '👾'}
                    </span>
                    <span className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-zinc-400 text-black font-black text-xs font-mono rounded-full flex items-center justify-center border border-zinc-700">
                      2
                    </span>
                  </div>
                  <div className="text-center w-full min-w-0">
                    <h3 className="font-bold text-xs text-zinc-300 uppercase truncate">{topThree[1].playerName}</h3>
                    <p className="font-mono text-[11px] text-amber-500 font-bold mt-0.5">{topThree[1].score.toLocaleString()} pts</p>
                  </div>
                  <div className="w-full h-10 bg-zinc-800/50 border-t border-zinc-700 rounded-t-lg mt-2 hidden sm:block"></div>
                </div>
              )}

              {/* 1st Place */}
              {topThree[0] && (
                <div className="w-full sm:w-36 flex flex-col items-center order-1 sm:order-2">
                  <div className="relative mb-2">
                    <span className="text-4xl p-2 bg-zinc-900 border-2 border-amber-500 rounded-3xl block relative shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                      {topThree[0].playerAvatar || '👑'}
                    </span>
                    <span className="absolute -top-3 -right-3 w-7 h-7 bg-amber-500 text-black font-black text-sm font-mono rounded-full flex items-center justify-center border border-amber-600">
                      1
                    </span>
                  </div>
                  <div className="text-center w-full min-w-0">
                    <h3 className="font-black text-sm text-white uppercase truncate flex items-center justify-center gap-1">
                      {topThree[0].playerName}
                      <CheckCircle size={13} className="text-amber-500 shrink-0" />
                    </h3>
                    <p className="font-mono text-xs text-amber-400 font-black mt-0.5">{topThree[0].score.toLocaleString()} pts</p>
                  </div>
                  <div className="w-full h-14 bg-amber-500/10 border-t-2 border-amber-500/40 rounded-t-lg mt-2 hidden sm:block"></div>
                </div>
              )}

              {/* 3rd Place */}
              {topThree[2] && (
                <div className="w-full sm:w-32 flex flex-col items-center order-3 mt-4 sm:mt-0">
                  <div className="relative mb-2">
                    <span className="text-3xl p-1.5 bg-zinc-900 border border-zinc-800 rounded-2xl block relative">
                      {topThree[2].playerAvatar || '👾'}
                    </span>
                    <span className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-amber-700 text-white font-black text-xs font-mono rounded-full flex items-center justify-center border border-amber-900">
                      3
                    </span>
                  </div>
                  <div className="text-center w-full min-w-0">
                    <h3 className="font-bold text-xs text-zinc-400 uppercase truncate">{topThree[2].playerName}</h3>
                    <p className="font-mono text-[11px] text-amber-500 font-bold mt-0.5">{topThree[2].score.toLocaleString()} pts</p>
                  </div>
                  <div className="w-full h-8 bg-zinc-800/30 border-t border-zinc-800 rounded-t-lg mt-2 hidden sm:block"></div>
                </div>
              )}
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
                    <span className="text-xs sm:text-sm font-mono font-black text-amber-400">
                      {entry.score.toLocaleString()}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500 block uppercase">pts</span>
                  </div>
                </div>
              );
            })}
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
