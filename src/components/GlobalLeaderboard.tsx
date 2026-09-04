import React, { useEffect, useState } from 'react';
import { Trophy, CheckCircle } from 'lucide-react';
import { GameStats, LeaderboardEntry } from '../types';

interface GlobalLeaderboardProps {
  game: GameStats | null;
}

export default function GlobalLeaderboard({ game }: GlobalLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!game) return;
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/leaderboard/${game.id}`);
        const data = await res.json();
        if (data.success) {
          setLeaderboard(data.leaderboard || []);
        }
      } catch (e) {
        console.error('Failed to fetch leaderboard:', e);
      }
      setLoading(false);
    };
    fetchLeaderboard();
  }, [game]);

  if (!game) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 w-full select-none">
      <div className="flex items-center justify-between mb-3 text-indigo-400 pb-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-amber-400" />
          <h3 className="font-bold font-display text-xs tracking-wider uppercase text-white">
            PAPAN SKOR: {game.title}
          </h3>
        </div>
        <span className="text-[10px] font-mono text-zinc-500 uppercase">Top 5 Global</span>
      </div>
      
      {loading ? (
        <div className="text-center py-6 text-zinc-500 text-xs font-mono animate-pulse">
          Memverifikasi skor server...
        </div>
      ) : leaderboard.length > 0 ? (
        <div className="space-y-2">
          {leaderboard.slice(0, 5).map((entry, idx) => (
            <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 transition">
              <div className="flex items-center gap-2.5">
                <span className={`font-mono text-xs w-4 text-center font-black ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-zinc-300' : idx === 2 ? 'text-amber-700' : 'text-zinc-600'}`}>
                  #{idx + 1}
                </span>
                <span className="text-xl p-1 bg-zinc-900 rounded-lg">{entry.playerAvatar}</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-zinc-200">{entry.playerName}</span>
                  <span title="Skor Terverifikasi"><CheckCircle size={11} className="text-emerald-400 shrink-0" /></span>
                </div>
              </div>
              <span className="text-xs font-mono font-black text-amber-400 tracking-tight">
                {entry.score.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-zinc-500 text-xs font-sans italic bg-zinc-950/40 rounded-xl border border-zinc-800 p-3">
          Belum ada skor tercatat. Jadilah pemain pertama yang mengukir rekor!
        </div>
      )}
    </div>
  );
}
