import React from 'react';
import { Swords, Trophy, Sparkles, Play, X } from 'lucide-react';
import { FriendChallenge } from '../../services/friendChallengeService';
import { audio } from '../../utils/audio';
import { haptics } from '../../utils/haptics';

interface ChallengeReceivedModalProps {
  challenge: FriendChallenge;
  onAccept: () => void;
  onDecline: () => void;
}

export const ChallengeReceivedModal: React.FC<ChallengeReceivedModalProps> = ({
  challenge,
  onAccept,
  onDecline
}) => {
  const handleStart = () => {
    audio.playLaser();
    haptics.trigger('heavy');
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-zinc-900 border border-indigo-500/40 rounded-3xl shadow-[0_0_30px_rgba(99,102,241,0.25)] overflow-hidden flex flex-col font-sans animate-in zoom-in-95 duration-200 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glowing Top Banner */}
        <div className="relative p-6 bg-gradient-to-b from-indigo-950/80 via-zinc-900 to-zinc-900 border-b border-white/[0.06] flex flex-col items-center">
          <button
            onClick={onDecline}
            className="absolute top-4 right-4 text-zinc-400 hover:text-white transition"
          >
            <X size={18} />
          </button>

          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 mb-3 shadow-[0_0_20px_rgba(99,102,241,0.3)]">
            <Swords size={32} />
          </div>

          <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono uppercase tracking-wider mb-2 font-bold">
            TANTANGAN TEMAN MASUK
          </span>

          <h3 className="font-bold text-xl text-white">
            {challenge.challengerName} Menantangmu!
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Game: <span className="text-white font-medium">{challenge.gameTitle}</span>
          </p>
        </div>

        {/* Challenge Specs */}
        <div className="p-6 flex flex-col gap-4">
          {/* Target Score Card */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-white/[0.08] flex items-center justify-between">
            <div className="text-left">
              <span className="text-[11px] text-zinc-400 block">Target Skor</span>
              <span className="text-2xl font-mono font-black text-amber-300">
                {challenge.targetScore.toLocaleString()}
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Trophy size={24} />
            </div>
          </div>

          {/* Challenger Note */}
          {challenge.message && (
            <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl text-xs text-zinc-300 italic">
              "{challenge.message}"
            </div>
          )}

          {/* Bounty Reward */}
          <div className="flex items-center justify-between px-3 py-2 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-xs">
            <div className="flex items-center gap-1.5 text-emerald-300">
              <Sparkles size={14} className="text-amber-400" />
              <span>Hadiah Kemenangan:</span>
            </div>
            <span className="font-mono font-bold text-emerald-400">
              +{challenge.bountyCoins} Koin · +{challenge.bountyXp} XP
            </span>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={handleStart}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              <Play size={16} />
              <span>Terima & Mulai Bertanding</span>
            </button>

            <button
              onClick={onDecline}
              className="w-full py-2 text-xs font-medium text-zinc-400 hover:text-white transition"
            >
              Bermain Mode Biasa Saja
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
