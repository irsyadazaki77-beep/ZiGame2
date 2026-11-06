import React, { useState } from 'react';
import { Trophy, Swords, Sparkles, RefreshCw, CheckCircle, ArrowRight, X } from 'lucide-react';
import { FriendChallenge } from '../../services/friendChallengeService';
import { audio } from '../../utils/audio';
import { haptics } from '../../utils/haptics';

interface ChallengeResultModalProps {
  challenge: FriendChallenge;
  finalScore: number;
  onRetry: () => void;
  onCounterChallenge: () => void;
  onClaimBounty: () => void;
  onClose: () => void;
}

export const ChallengeResultModal: React.FC<ChallengeResultModalProps> = ({
  challenge,
  finalScore,
  onRetry,
  onCounterChallenge,
  onClaimBounty,
  onClose
}) => {
  const isWon = finalScore >= challenge.targetScore;
  const [claimed, setClaimed] = useState(false);
  const diff = challenge.targetScore - finalScore;

  const handleClaim = () => {
    if (claimed) return;
    setClaimed(true);
    audio.playCoin();
    haptics.trigger('success');
    onClaimBounty();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-zinc-900 border border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col font-sans text-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner */}
        <div className={`p-6 border-b border-white/[0.06] flex flex-col items-center relative ${
          isWon ? 'bg-gradient-to-b from-emerald-950/60 to-zinc-900' : 'bg-gradient-to-b from-rose-950/50 to-zinc-900'
        }`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-400 hover:text-white transition"
          >
            <X size={18} />
          </button>

          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-lg ${
            isWon 
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
              : 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
          }`}>
            {isWon ? <Trophy size={32} /> : <Swords size={32} />}
          </div>

          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider mb-1 uppercase ${
            isWon ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
          }`}>
            {isWon ? 'TANTANGAN DITAKLUKKAN!' : 'BELUM BERHASIL'}
          </span>

          <h3 className="font-bold text-xl text-white">
            {isWon ? 'Hebat, Kamu Menang!' : 'Jangan Menyerah!'}
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Tantangan dari <span className="text-white font-medium">{challenge.challengerName}</span>
          </p>
        </div>

        {/* Score Comparison */}
        <div className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-zinc-950 border border-white/[0.06] flex flex-col items-center">
              <span className="text-[10px] text-zinc-400 mb-0.5">Skor Kamu</span>
              <span className={`text-xl font-mono font-bold ${isWon ? 'text-emerald-400' : 'text-white'}`}>
                {finalScore.toLocaleString()}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-950 border border-white/[0.06] flex flex-col items-center">
              <span className="text-[10px] text-zinc-400 mb-0.5">Target Penantang</span>
              <span className="text-xl font-mono font-bold text-amber-300">
                {challenge.targetScore.toLocaleString()}
              </span>
            </div>
          </div>

          {!isWon && (
            <p className="text-xs text-zinc-400">
              Kamu hanya butuh <span className="text-rose-400 font-bold font-mono">+{diff.toLocaleString()}</span> poin lagi untuk mengalahkan skor penantang.
            </p>
          )}

          {/* Bounty section */}
          {isWon && (
            <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-300">
                <Sparkles size={16} className="text-amber-400" />
                <span>Bounty Tersedia:</span>
              </div>
              <span className="font-mono font-bold text-emerald-400">
                +{challenge.bountyCoins} Koin · +{challenge.bountyXp} XP
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-1">
            {isWon && !claimed && (
              <button
                onClick={handleClaim}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
              >
                <CheckCircle size={16} />
                <span>Klaim Hadiah Bounty Sekarang</span>
              </button>
            )}

            {isWon && claimed && (
              <div className="py-2 text-xs text-emerald-400 font-medium flex items-center justify-center gap-1">
                <CheckCircle size={14} /> Hadiah berhasil ditambahkan ke akunmu!
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onRetry}
                className="py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition rounded-xl text-xs font-bold text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Coba Lagi</span>
              </button>

              <button
                onClick={onCounterChallenge}
                className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20"
              >
                <Swords size={13} />
                <span>Tantang Balik</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
