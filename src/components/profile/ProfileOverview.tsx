import React from 'react';
import { PlayerProfile, GameStats, RecentlyPlayedEntry } from '../../types';
import { Gamepad2, Trophy, Clock, Zap, ArrowUpRight, Flame } from 'lucide-react';
import { formatNumber } from '../../utils/format';

interface ProfileOverviewProps {
  profile: PlayerProfile;
  games: GameStats[];
  totalPlays: number;
  totalCoinsEarned: number;
  achievementUnlocks: { unlocked: number; total: number; percent: number };
  playerRank: { title: string; desc: string; color: string; bg: string };
  barChartData: { sorted: GameStats[]; maxPlays: number };
  recentlyPlayed: RecentlyPlayedEntry[];
  onSelectGame: (id: string) => void;
  onClearRecentlyPlayed: () => void;
}

export const ProfileOverview: React.FC<ProfileOverviewProps> = ({
  profile,
  totalPlays,
  totalCoinsEarned,
  achievementUnlocks,
  playerRank,
  barChartData,
  recentlyPlayed,
  onSelectGame,
  onClearRecentlyPlayed
}) => {
  const currentXp = profile.xp || 0;
  const currentLevel = profile.level || 1;
  const xpNeeded = currentLevel * 200;
  const progressPercent = Math.min(100, Math.round((currentXp / xpNeeded) * 100));

  return (
    <div className="space-y-6">
      {/* Level & XP Banner */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-display font-black text-lg">
              {currentLevel}
            </div>
            <div>
              <h3 className="font-display font-black text-sm uppercase text-text-primary tracking-wide">
                LEVEL PROGRESSION
              </h3>
              <p className="text-xs text-text-secondary font-mono">
                {currentXp} / {xpNeeded} XP untuk Level {currentLevel + 1}
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-indigo-400">
            {progressPercent}%
          </span>
        </div>

        <div className="w-full h-2.5 bg-surface-subtle rounded-full overflow-hidden border border-border-subtle">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Statistics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-4 sm:p-5 shadow-sm space-y-1">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-mono">
            <Gamepad2 className="w-4 h-4" />
            <span className="uppercase">Total Bermain</span>
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-text-primary">
            {formatNumber(totalPlays)}
          </div>
        </div>

        <div className="bg-surface-card border border-border-subtle rounded-2xl p-4 sm:p-5 shadow-sm space-y-1">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-mono">
            <Trophy className="w-4 h-4" />
            <span className="uppercase">Prestasi</span>
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-text-primary">
            {achievementUnlocks.unlocked} / {achievementUnlocks.total}
          </div>
        </div>

        <div className="bg-surface-card border border-border-subtle rounded-2xl p-4 sm:p-5 shadow-sm space-y-1">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono">
            <Zap className="w-4 h-4" />
            <span className="uppercase">Koin Didapat</span>
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-text-primary">
            {formatNumber(totalCoinsEarned)}
          </div>
        </div>

        <div className="bg-surface-card border border-border-subtle rounded-2xl p-4 sm:p-5 shadow-sm space-y-1">
          <div className="flex items-center gap-2 text-pink-400 text-xs font-mono">
            <Flame className="w-4 h-4" />
            <span className="uppercase">Streak Aktif</span>
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-text-primary">
            {profile.streak || 0} Hari
          </div>
        </div>
      </div>

      {/* Top Played Games Bar Chart */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <h3 className="font-display font-black text-sm uppercase text-text-primary tracking-wide flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-indigo-500" />
          GAME PALING SERING DIMAINKAN
        </h3>

        {barChartData.sorted.length === 0 ? (
          <p className="text-xs font-mono text-text-secondary py-4 text-center">
            Belum ada data bermain game.
          </p>
        ) : (
          <div className="space-y-3">
            {barChartData.sorted.map((game) => {
              const pct = Math.round((game.plays / barChartData.maxPlays) * 100);
              return (
                <div key={game.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-text-primary font-bold">{game.title}</span>
                    <span className="text-text-secondary">{game.plays} sesi</span>
                  </div>
                  <div className="w-full h-2 bg-surface-subtle rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recently Played */}
      {recentlyPlayed.length > 0 && (
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-black text-sm uppercase text-text-primary tracking-wide flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              TERAKHIR DIMAINKAN
            </h3>
            <button
              onClick={onClearRecentlyPlayed}
              className="text-xs font-mono text-text-secondary hover:text-rose-400 transition cursor-pointer"
            >
              Hapus Riwayat
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {recentlyPlayed.map((item) => (
              <button
                key={item.gameId}
                onClick={() => onSelectGame(item.gameId)}
                className="p-3 bg-surface-subtle hover:bg-surface-hover border border-border-subtle rounded-xl flex items-center justify-between text-left transition cursor-pointer group"
              >
                <div>
                  <span className="text-xs font-bold text-text-primary block group-hover:text-indigo-400 transition">
                    {item.gameId}
                  </span>
                  <span className="text-[10px] font-mono text-text-secondary">
                    Skor: {item.lastScore || 0}
                  </span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-text-secondary group-hover:text-indigo-400 transition" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
