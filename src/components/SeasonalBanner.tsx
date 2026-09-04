import React, { useState, useEffect } from 'react';
import { seasonService } from '../services/seasonService';
import { Shield, Clock, Gift, ChevronRight, Sparkles } from 'lucide-react';
import { audio } from '../utils/audio';

interface SeasonalBannerProps {
  onOpenSeasonalHub?: () => void;
}

export default function SeasonalBanner({ onOpenSeasonalHub }: SeasonalBannerProps) {
  const season = seasonService.getActiveSeason();
  const [timeLeft, setTimeLeft] = useState(seasonService.getTimeRemaining());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(seasonService.getTimeRemaining());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-950/80 via-zinc-900 to-zinc-950 border border-indigo-500/30 p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-[0_0_30px_rgba(99,102,241,0.15)] select-none">
      {/* Glow */}
      <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-indigo-500/10 filter blur-[50px] pointer-events-none"></div>

      <div className="flex items-center gap-3.5 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
          <Shield size={24} />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
              SEASON AKTIF
            </span>
            <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
              <Clock size={11} className="text-indigo-400" /> Sisa Waktu: <b className="text-white">{timeLeft.formatted}</b>
            </span>
          </div>
          <h2 className="font-display font-black text-sm sm:text-base text-white tracking-wider uppercase mt-1">
            {season.name}
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">
            {season.description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 self-stretch md:self-auto justify-between md:justify-end relative z-10 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-800/80">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 bg-zinc-950/60 px-3 py-1.5 rounded-xl border border-zinc-800">
          <span>Hadiah:</span>
          <span className="text-indigo-400 font-bold flex items-center gap-1">
            {season.badgeReward.icon} {season.badgeReward.name}
          </span>
        </div>

        {onOpenSeasonalHub && (
          <button
            onClick={() => {
              audio.playCoin();
              onOpenSeasonalHub();
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-[0_0_15px_rgba(99,102,241,0.3)] cursor-pointer shrink-0"
          >
            Hub Season <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
