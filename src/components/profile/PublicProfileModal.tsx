import React from 'react';
import { Trophy, Shield, Flame, Star, Sparkles, X, Lock, CheckCircle2 } from 'lucide-react';
import { PlayerProfile, GameStats, GameMastery } from '../../types';
import { competitiveService } from '../../services/competitiveService';

interface PublicProfileModalProps {
  profile: PlayerProfile;
  games: GameStats[];
  masteries: Record<string, GameMastery>;
  onClose: () => void;
}

export const PublicProfileModal: React.FC<PublicProfileModalProps> = ({
  profile,
  games,
  masteries,
  onClose
}) => {
  const isPrivate = profile.isPublicProfile === false;
  const competitiveRatings = competitiveService.getAllRatings();

  const favoriteGames = (profile.favoriteGames || []).map((id) => games.find((g) => g.id === id)).filter(Boolean) as GameStats[];
  const topMasteries = Object.values(masteries)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 4);

  return (
    <div
      className="fixed inset-0 z-[140] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none font-sans animate-fade-in"
      id="public-profile-modal"
    >
      <div className="bg-[#0e121c] border border-indigo-500/40 rounded-3xl max-w-lg w-full overflow-hidden shadow-[0_0_50px_rgba(99,102,241,0.3)] relative flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#0d1017] via-indigo-950/40 to-[#0d1017] border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs font-bold uppercase tracking-widest">
            <Trophy size={14} /> PROFIL PUBLIK PEMAIN
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
          {/* Avatar & Identity Hero */}
          <div className="flex items-center gap-4 bg-black/40 border border-white/[0.06] p-4 rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/[0.1] flex items-center justify-center text-3xl shadow-inner shrink-0">
              {profile.avatar || '👾'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black font-display text-white truncate">
                  {profile.name}
                </h3>
                {profile.selectedTitle && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold shrink-0">
                    {profile.selectedTitle}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs font-mono text-zinc-400 mt-1">
                <span>Level {profile.level || 1}</span>
                <span className="text-zinc-600">•</span>
                <span className="text-amber-400 font-bold">{profile.coins?.toLocaleString() || 0} Koin</span>
              </div>
            </div>
          </div>

          {isPrivate ? (
            <div className="p-6 text-center bg-black/40 border border-white/[0.06] rounded-2xl space-y-2">
              <Lock size={24} className="text-zinc-500 mx-auto" />
              <h4 className="text-xs font-bold text-white font-display uppercase tracking-wider">
                Profil ini Bersifat Privat
              </h4>
              <p className="text-[11px] text-zinc-400 font-sans max-w-xs mx-auto">
                Pemain memilih untuk menyembunyikan riwayat statistik publik. Ubah di menu Pengaturan Akun.
              </p>
            </div>
          ) : (
            <>
              {/* Top Mastery Showcase */}
              {topMasteries.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-mono text-zinc-400 uppercase font-semibold">
                    Mastery Tertinggi:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {topMasteries.map((m) => {
                      const game = games.find((g) => g.id === m.gameId);
                      return (
                        <div
                          key={m.gameId}
                          className="p-3 bg-black/40 border border-white/[0.06] rounded-xl flex items-center gap-2.5"
                        >
                          <span className="text-xl">{game?.icon || '🎮'}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white font-display truncate">
                              {game?.title || m.gameId}
                            </div>
                            <div className="text-[10px] text-indigo-400 font-mono font-semibold">
                              Lv.{m.level} • {m.xp} XP
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Competitive Ratings */}
              <div className="space-y-2">
                <div className="text-[11px] font-mono text-zinc-400 uppercase font-semibold">
                  Competitive Skill Ratings:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {['snake', 'space', 'racer', 'tetris'].map((gid) => {
                    const game = games.find((g) => g.id === gid);
                    const rating = competitiveRatings[gid] || { rating: 1000, tier: 'Silver' };
                    return (
                      <div
                        key={gid}
                        className="p-3 bg-black/40 border border-white/[0.06] rounded-xl flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base">{game?.icon || '🎮'}</span>
                          <span className="text-xs font-bold text-white truncate font-display">{game?.title}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[11px] font-bold text-emerald-400 font-mono">{rating.rating}</div>
                          <div className="text-[9px] text-zinc-400 font-mono uppercase">{rating.tier}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
