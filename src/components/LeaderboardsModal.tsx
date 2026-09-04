import React, { useState, useEffect } from 'react';
import { Trophy, X, Crown, Calendar, CheckCircle, ShieldCheck, Users, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { GameStats, LeaderboardCategory, RivalryInsight } from '../types';
import { motion } from 'motion/react';
import { audio } from '../utils/audio';

interface LeaderboardsModalProps {
  games: GameStats[];
  currentUsername: string;
  onClose: () => void;
}

export default function LeaderboardsModal({ games, currentUsername, onClose }: LeaderboardsModalProps) {
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans select-none">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden z-10">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Trophy size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-display font-black text-white tracking-wider uppercase">
                LEADERBOARD 2.0 TERVERIFIKASI
              </h2>
              <div className="text-xs text-zinc-400 font-mono flex items-center gap-1.5 mt-0.5">
                <ShieldCheck size={13} className="text-emerald-400" />
                <span>Semua skor telah diverifikasi oleh sistem anti-cheat ZiGaMe</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => { audio.playCoin(); onClose(); }}
            className="w-9 h-9 hover:bg-zinc-800 rounded-full transition flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="px-5 py-2.5 bg-zinc-950/90 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800 gap-1 overflow-x-auto">
            <button
              onClick={() => { audio.playCoin(); setCategory('global'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1 shrink-0 ${category === 'global' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'}`}
            >
              <Trophy size={13} /> GLOBAL
            </button>
            <button
              onClick={() => { audio.playCoin(); setCategory('weekly'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1 shrink-0 ${category === 'weekly' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'}`}
            >
              <Calendar size={13} /> MINGGUAN
            </button>
            <button
              onClick={() => { audio.playCoin(); setCategory('seasonal'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1 shrink-0 ${category === 'seasonal' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'}`}
            >
              <Sparkles size={13} /> SEASON 1
            </button>
          </div>

          {/* Game Selector Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
            {games.slice(0, 5).map((g) => (
              <button
                key={g.id}
                onClick={() => { audio.playHit(); setSelectedGameId(g.id); setPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1 shrink-0 cursor-pointer ${
                  selectedGameId === g.id ? 'bg-zinc-800 text-white border border-zinc-700' : 'bg-zinc-950 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span>{g.icon}</span>
                <span className="truncate max-w-[80px]">{g.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Rivalry Insight Banner (if available) */}
        {rivalryInsight && (
          <div className="bg-gradient-to-r from-indigo-500/15 via-purple-500/10 to-transparent border-b border-indigo-500/20 px-5 py-2.5 flex items-center gap-2.5 text-xs font-mono text-indigo-300">
            <span className="text-base">⚔️</span>
            <span className="font-bold">Insight Rival:</span>
            <span>{rivalryInsight.message}</span>
          </div>
        )}

        {/* Modal Body: Leaderboard Table */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-zinc-500 text-xs font-mono animate-pulse">
              Memverifikasi skor terenkripsi dari server...
            </div>
          ) : leaderboard.length > 0 ? (
            <div className="space-y-2">
              {leaderboard.map((entry, index) => {
                const globalRank = (page - 1) * 10 + index + 1;
                const isUser = entry.playerName.toUpperCase() === currentUsername.toUpperCase();

                return (
                  <div
                    key={index}
                    className={`p-3 rounded-2xl border flex items-center justify-between transition ${
                      isUser
                        ? 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                        : index === 0
                        ? 'bg-zinc-950 border-amber-500/30'
                        : 'bg-zinc-950/70 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-mono text-sm font-black w-6 text-center ${
                        globalRank === 1 ? 'text-amber-400' : globalRank === 2 ? 'text-zinc-300' : globalRank === 3 ? 'text-amber-600' : 'text-zinc-500'
                      }`}>
                        #{globalRank}
                      </span>
                      <span className="text-2xl p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                        {entry.playerAvatar || '👾'}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white uppercase">{entry.playerName}</span>
                          <CheckCircle size={12} className="text-emerald-400" />
                          {isUser && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 bg-amber-500 text-black rounded font-black">
                              ANDA
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {entry.submittedAt ? new Date(entry.submittedAt).toLocaleDateString() : 'Terverifikasi'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-mono font-black text-amber-400 tracking-tight">
                        {entry.score.toLocaleString()}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 block">PTS</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-500 text-xs italic">
              Belum ada data skor untuk kategori ini.
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
          <button
            onClick={() => { audio.playHit(); setPage(p => Math.max(1, p - 1)); }}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white text-xs font-mono font-bold transition flex items-center gap-1 disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft size={14} /> Sebelumnya
          </button>

          <span className="text-xs font-mono text-zinc-400">
            Halaman {page} dari {totalPages}
          </span>

          <button
            onClick={() => { audio.playHit(); setPage(p => Math.min(totalPages, p + 1)); }}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white text-xs font-mono font-bold transition flex items-center gap-1 disabled:opacity-40 cursor-pointer"
          >
            Berikutnya <ChevronRight size={14} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
