import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Trophy, Sparkles, Check, Gift, Clock, Calendar, Zap, X } from 'lucide-react';
import { Challenge, PlayerProfile } from '../types';
import { challengeService } from '../services/challengeService';
import { audio } from '../utils/audio';

interface ChallengesModalProps {
  challenges: Challenge[];
  profile: PlayerProfile;
  onUpdateProfile: (profile: PlayerProfile) => void;
  onChallengesUpdated: (challenges: Challenge[]) => void;
  onClose: () => void;
}

export default function ChallengesModal({
  challenges,
  profile,
  onUpdateProfile,
  onChallengesUpdated,
  onClose
}: ChallengesModalProps) {
  const [tab, setTab] = useState<'daily' | 'weekly' | 'special'>('daily');

  const filteredChallenges = challenges.filter(c => c.frequency === tab);

  const handleClaim = (challenge: Challenge) => {
    if (!challenge.completed || challenge.claimed) return;

    audio.playLevelUp();
    const result = challengeService.claimChallenge(challenge.id);
    if (result.success) {
      onUpdateProfile({
        ...profile,
        coins: profile.coins + result.coins
      });
      onChallengesUpdated(challengeService.getStoredChallenges());
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans select-none">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden z-10"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Target size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-display font-black text-white tracking-wider uppercase">
                TANTANGAN & MISI SIBER 2.0
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                Selesaikan objektif khusus untuk meraih Koin & XP Progres
              </p>
            </div>
          </div>
          <button
            onClick={() => { audio.playCoin(); onClose(); }}
            className="w-9 h-9 hover:bg-zinc-800 rounded-full transition flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="px-5 py-2.5 bg-zinc-950/80 border-b border-zinc-800 flex gap-2">
          <button
            onClick={() => { audio.playHit(); setTab('daily'); }}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
              tab === 'daily' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Clock size={14} /> Tantangan Harian
          </button>
          <button
            onClick={() => { audio.playHit(); setTab('weekly'); }}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
              tab === 'weekly' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Calendar size={14} /> Tantangan Mingguan
          </button>
          <button
            onClick={() => { audio.playHit(); setTab('special'); }}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
              tab === 'special' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles size={14} /> Spesial Season
          </button>
        </div>

        {/* List */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-3 flex-1">
          {filteredChallenges.length > 0 ? (
            filteredChallenges.map((ch) => {
              const percent = Math.min(100, Math.round((ch.progress / ch.target) * 100));

              return (
                <div
                  key={ch.id}
                  className={`p-4 rounded-2xl border transition flex flex-col justify-between gap-3 ${
                    ch.claimed
                      ? 'bg-zinc-950/40 border-zinc-800 opacity-60'
                      : ch.completed
                      ? 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                      : 'bg-zinc-950 border-zinc-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl p-2 bg-zinc-900 rounded-xl border border-zinc-800 shrink-0">
                        {ch.icon}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-xs sm:text-sm text-white uppercase">{ch.title}</h3>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 uppercase">
                            {ch.category}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{ch.description}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-black text-amber-400">+{ch.rewardCoins} 🪙</div>
                      <div className="text-[10px] font-mono text-purple-400">+{ch.rewardXp} XP</div>
                    </div>
                  </div>

                  {/* Progress Bar & Claim Button */}
                  <div className="flex items-center justify-between gap-4 pt-2 border-t border-zinc-900">
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                        <span>Progres: {ch.progress.toLocaleString()} / {ch.target.toLocaleString()}</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            ch.completed ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {ch.claimed ? (
                      <span className="text-xs font-mono font-bold text-zinc-500 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-1">
                        <Check size={13} /> Diklaim
                      </span>
                    ) : ch.completed ? (
                      <button
                        onClick={() => handleClaim(ch)}
                        className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider transition flex items-center gap-1 cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.4)] animate-pulse"
                      >
                        <Gift size={14} /> Klaim Hadiah
                      </button>
                    ) : (
                      <span className="text-xs font-mono text-zinc-500 px-3 py-1.5">
                        Belum Selesai
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 text-zinc-500 text-xs italic">
              Tidak ada tantangan dalam kategori ini.
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
