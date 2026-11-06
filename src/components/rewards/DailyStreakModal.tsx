import React, { useState } from 'react';
import { X, Flame, Check, Gift, Sparkles, Trophy } from 'lucide-react';
import { dailyStreakService, STREAK_REWARDS } from '../../services/dailyStreakService';
import { PlayerProfile } from '../../types';
import { audio } from '../../utils/audio';
import { haptics } from '../../utils/haptics';

interface DailyStreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: PlayerProfile;
  onUpdateProfile: (updater: (prev: PlayerProfile) => PlayerProfile) => void;
}

export const DailyStreakModal: React.FC<DailyStreakModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdateProfile
}) => {
  const [streakInfo, setStreakInfo] = useState(() => dailyStreakService.getStreakInfo());
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimedReward, setClaimedReward] = useState<{ day: number; coins: number; xp: number; isMystery: boolean } | null>(null);

  if (!isOpen) return null;

  const handleClaim = async () => {
    if (!streakInfo.canClaimToday || isClaiming) return;
    setIsClaiming(true);

    try {
      const res = await dailyStreakService.claimReward();
      if (res.success) {
        audio.playLevelUp();
        haptics.trigger('success');

        onUpdateProfile((prev) => ({
          ...prev,
          coins: prev.coins + res.coins,
          xp: (prev.xp || 0) + res.xp,
          streak: res.day
        }));

        setClaimedReward({
          day: res.day,
          coins: res.coins,
          xp: res.xp,
          isMystery: res.isMysteryDay
        });
        setStreakInfo(dailyStreakService.getStreakInfo());
      }
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-zinc-900 border border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col font-sans animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glowing Top Banner */}
        <div className="relative p-6 bg-gradient-to-b from-amber-950/50 via-zinc-900 to-zinc-900 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)] shrink-0">
              <Flame size={26} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  LOGIN BERUNTUN
                </span>
                <span className="text-xs font-mono text-zinc-400">
                  Streak: <strong className="text-white">{streakInfo.currentStreak} Hari</strong>
                </span>
              </div>
              <h3 className="font-bold text-lg text-white mt-0.5">Hadiah Kalender 7 Hari</h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.04] text-zinc-400 hover:text-white flex items-center justify-center transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* 7 Days Grid */}
        <div className="p-6 flex flex-col gap-5">
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {STREAK_REWARDS.map((reward) => {
              const isPast = reward.day <= streakInfo.currentStreak && !streakInfo.canClaimToday;
              const isClaimableNow = reward.day === streakInfo.claimableDay && streakInfo.canClaimToday;
              const isFuture = reward.day > streakInfo.claimableDay || (reward.day === streakInfo.claimableDay && !streakInfo.canClaimToday);

              return (
                <div
                  key={reward.day}
                  className={`relative p-2.5 rounded-2xl border flex flex-col items-center justify-between gap-2 text-center transition-all ${
                    reward.isMysteryDay ? 'col-span-2 sm:col-span-1' : ''
                  } ${
                    isClaimableNow
                      ? 'bg-amber-500/15 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)] scale-105 ring-1 ring-amber-400/50'
                      : isPast
                      ? 'bg-surface-subtle/40 border-border-subtle opacity-50'
                      : reward.isMysteryDay
                      ? 'bg-gradient-to-b from-purple-950/40 to-zinc-950 border-purple-500/30'
                      : 'bg-zinc-950 border-white/[0.06]'
                  }`}
                >
                  <span className="text-[10px] font-mono text-zinc-400 uppercase">
                    H-{reward.day}
                  </span>

                  <div className="my-1">
                    {isPast ? (
                      <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                        <Check size={14} />
                      </div>
                    ) : reward.isMysteryDay ? (
                      <div className="w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto animate-bounce">
                        <Gift size={16} />
                      </div>
                    ) : (
                      <span className="text-base block">🪙</span>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <span className={`text-[10px] font-mono font-bold ${reward.isMysteryDay ? 'text-purple-300' : 'text-amber-400'}`}>
                      +{reward.coins}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500">
                      +{reward.xp} XP
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action or Claim Feedback */}
          {claimedReward ? (
            <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between text-xs animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2.5 text-emerald-300">
                <Sparkles size={18} className="text-amber-400 shrink-0" />
                <div>
                  <span className="font-bold block">Selamat! Hadiah Hari ke-{claimedReward.day} Berhasil Diklaim!</span>
                  <span className="text-[11px] text-zinc-400">+{claimedReward.coins} Koin & +{claimedReward.xp} XP sudah ditambahkan ke profilmu.</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shrink-0 transition"
              >
                Tutup
              </button>
            </div>
          ) : streakInfo.canClaimToday ? (
            <button
              onClick={handleClaim}
              disabled={isClaiming}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] transition rounded-xl text-sm font-bold text-zinc-950 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 cursor-pointer disabled:opacity-50"
            >
              <Flame size={16} />
              <span>{isClaiming ? 'Mengklaim...' : `Klaim Hadiah Hari ke-${streakInfo.claimableDay}`}</span>
            </button>
          ) : (
            <div className="p-3 bg-zinc-950 border border-white/[0.06] rounded-2xl text-center">
              <span className="text-xs text-zinc-400">
                Kamu sudah mengklaim hadiah hari ini! Kembali lagi besok untuk hadiah Hari ke-{(streakInfo.currentStreak % 7) + 1}.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
