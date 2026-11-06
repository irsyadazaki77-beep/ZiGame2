import React from 'react';
import { Swords, Trophy, Sparkles, CheckCircle2 } from 'lucide-react';
import { FriendChallenge } from '../../services/friendChallengeService';

interface FriendChallengeBannerProps {
  challenge: FriendChallenge;
  currentScore: number;
}

export const FriendChallengeBanner: React.FC<FriendChallengeBannerProps> = ({
  challenge,
  currentScore
}) => {
  const isTargetBeaten = currentScore >= challenge.targetScore;
  const progressPercent = Math.min(100, Math.round((currentScore / challenge.targetScore) * 100));
  const diff = challenge.targetScore - currentScore;

  return (
    <div className="w-full max-w-5xl mb-2 px-3 py-2 bg-zinc-950/90 border border-indigo-500/30 rounded-xl backdrop-blur-md shadow-lg flex flex-col gap-1.5 font-sans animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
            <Swords size={14} />
          </div>
          <div>
            <span className="text-zinc-400 font-medium">Tantangan dari </span>
            <span className="font-bold text-white font-mono">{challenge.challengerName}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-mono">
            <Trophy size={12} className="text-amber-400" />
            <span>Target: {challenge.targetScore.toLocaleString()}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-zinc-400 font-mono">
            <span>Bounty: </span>
            <span className="text-emerald-400 font-bold">+{challenge.bountyCoins} Koin</span>
          </div>
        </div>
      </div>

      {/* Real-time Progress Bar */}
      <div className="w-full flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isTargetBeaten
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_#10b981]'
                : 'bg-gradient-to-r from-indigo-500 to-cyan-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <span className="text-[10px] font-mono shrink-0">
          {isTargetBeaten ? (
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={11} /> TARGET TERLEWATI!
            </span>
          ) : (
            <span className="text-zinc-400">
              {diff.toLocaleString()} poin lagi
            </span>
          )}
        </span>
      </div>
    </div>
  );
};
