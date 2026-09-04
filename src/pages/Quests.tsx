import { useToast } from '../utils/ToastContext';
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DailyMission, PlayerProfile as ProfileType } from '../types';
import { Target, Shield, Coins, Sparkles, Check, Gift, Lock, Star, ChevronRight, Zap } from 'lucide-react';
import { audio } from '../utils/audio';

interface QuestsProps {
  dailyMissions: DailyMission[];
  profile: ProfileType;
  onUpdateProfile: (profile: ProfileType) => void;
  totalPlays: number;
}

interface PassTier {
  level: number;
  rewardName: string;
  rewardType: 'coins' | 'avatar';
  rewardValue: any;
  costXp: number;
  icon: string;
}

const PASS_TIERS: PassTier[] = [
  { level: 1, rewardName: '50 Koin Bonus', rewardType: 'coins', rewardValue: 50, costXp: 100, icon: '🪙' },
  { level: 2, rewardName: 'Avatar Neon Slime', rewardType: 'avatar', rewardValue: '🧼', costXp: 250, icon: '🧼' },
  { level: 3, rewardName: '100 Koin Bonus', rewardType: 'coins', rewardValue: 100, costXp: 450, icon: '🪙' },
  { level: 4, rewardName: 'Avatar Cyber Shark', rewardType: 'avatar', rewardValue: '🦈', costXp: 700, icon: '🦈' },
  { level: 5, rewardName: '200 Koin Bonus', rewardType: 'coins', rewardValue: 200, costXp: 1000, icon: '🪙' },
  { level: 6, rewardName: 'Avatar Neon Overlord', rewardType: 'avatar', rewardValue: '😈', costXp: 1350, icon: '😈' },
];

export default function Quests({ dailyMissions, profile, onUpdateProfile, totalPlays }: QuestsProps) {
  // Battle pass XP state, persist locally
  const [xp, setXp] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('arcade_battle_pass_xp');
      if (!saved) {
        return totalPlays * 15; // 15 XP per play
      }
      return parseInt(saved, 10);
    } catch {
      return totalPlays * 15;
    }
  });

  // Persist claimed rewards
  const [claimedTiers, setClaimedTiers] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('arcade_claimed_pass_tiers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const { showToast } = useToast();
  const [particles, setParticles] = useState<{ id: number; emoji: string; left: number; top: number }[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem('arcade_battle_pass_xp', xp.toString());
    } catch (e) {
      console.error(e);
    }
  }, [xp]);

  useEffect(() => {
    try {
      localStorage.setItem('arcade_claimed_pass_tiers', JSON.stringify(claimedTiers));
    } catch (e) {
      console.error(e);
    }
  }, [claimedTiers]);

  // Sync plays to XP if plays increase
  useEffect(() => {
    const computedMinXp = totalPlays * 15;
    if (computedMinXp > xp) {
      setXp(computedMinXp);
    }
  }, [totalPlays, xp]);

  // Compute Battle Pass Level
  const playerPassLevel = useMemo(() => {
    let currentLvl = 1;
    for (const tier of PASS_TIERS) {
      if (xp >= tier.costXp) {
        currentLvl = tier.level + 1;
      }
    }
    return currentLvl;
  }, [xp]);

  // Next tier details
  const nextTier = useMemo(() => {
    return PASS_TIERS.find(t => xp < t.costXp) || null;
  }, [xp]);

  const progressPercentage = useMemo(() => {
    if (!nextTier) return 100;
    const currentTierIndex = PASS_TIERS.findIndex(t => t.level === nextTier.level);
    const baseLimit = currentTierIndex > 0 ? PASS_TIERS[currentTierIndex - 1].costXp : 0;
    const requiredForNext = nextTier.costXp - baseLimit;
    const currentProgress = xp - baseLimit;
    return Math.min(Math.max((currentProgress / requiredForNext) * 100, 0), 100);
  }, [xp, nextTier]);


  const spawnCelebrationParticles = () => {
    const emojis = ['🌟', '🪙', '✨', '⚡', '👑', '🎉'];
    const newParticles = Array.from({ length: 15 }).map((_, i) => ({
      id: Date.now() + i,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      left: 30 + Math.random() * 40, // centered percentage
      top: 20 + Math.random() * 40
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 2500);
  };

  const handleClaimTier = (tier: PassTier) => {
    if (xp < tier.costXp) {
      audio.playHit();
      showToast('Gagal', 'Level XP Anda belum mencukupi untuk membuka tier ini!', 'error');
      return;
    }

    if (claimedTiers.includes(tier.level)) {
      showToast('Gagal', 'Anda sudah mengklaim hadiah dari tier ini!', 'error');
      return;
    }

    const updatedProfile = { ...profile };
    if (tier.rewardType === 'coins') {
      updatedProfile.coins += tier.rewardValue;
      audio.playLevelUp();
      spawnCelebrationParticles();
      showToast('Klaim Berhasil', `+${tier.rewardValue} koin ditambahkan ke dompet Anda.`, 'success', '🪙');
    } else if (tier.rewardType === 'avatar') {
      try {
        const savedAvs = localStorage.getItem('arcade_unlocked_avatars');
        const unlockedAvs = savedAvs ? JSON.parse(savedAvs) : [];
        if (!unlockedAvs.includes(tier.rewardValue)) {
          unlockedAvs.push(tier.rewardValue);
          localStorage.setItem('arcade_unlocked_avatars', JSON.stringify(unlockedAvs));
        }
      } catch (e) {
        console.error(e);
      }
      updatedProfile.avatar = tier.rewardValue;
      audio.playLevelUp();
      spawnCelebrationParticles();
      showToast('Klaim Berhasil', `Avatar premium "${tier.rewardValue}" dipasang.`, 'success', '✨');
    }

    setClaimedTiers(prev => [...prev, tier.level]);
    onUpdateProfile(updatedProfile);
  };

  return (
    <div className="space-y-6 md:space-y-12 pb-16 relative">
      
      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ scale: 0, opacity: 1, x: `${p.left}vw`, y: `${p.top}vh` }}
            animate={{ 
              scale: [1, 1.5, 0.5], 
              opacity: [1, 1, 0],
              y: `${p.top - 20}vh`,
              x: `${p.left + (Math.random() * 20 - 10)}vw`
            }}
            transition={{ duration: 2, ease: 'easeOut' }}
            className="absolute text-3xl filter drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
          >
            {p.emoji}
          </motion.div>
        ))}
      </div>

      {/* Banner */}
      <section className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-[#0f131c] flex flex-col justify-center px-6 md:px-10 py-8 md:py-10 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f131c] via-[#0f131c]/90 to-transparent z-10"></div>
        <img 
          src="https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop" 
          alt="Battle pass quests background"
          referrerPolicy="no-referrer" loading="lazy"
          className="absolute inset-0 w-full h-full object-cover opacity-20 z-0"
        />

        <div className="relative z-20 max-w-xl space-y-2">
          <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono font-bold px-3 py-1 rounded-md w-fit uppercase tracking-wider flex items-center gap-2">
            <Shield size={12} className="text-indigo-400" />
            TIKET PAS TANTANGAN
          </div>
          <h1 className="text-2xl md:text-4xl font-black tracking-wide text-white font-display uppercase">
            BATTLE PASS <span className="text-indigo-400">& MISI HARIAN</span>
          </h1>
          <p className="text-zinc-400 text-xs md:text-sm leading-relaxed max-w-md font-sans">
            Selesaikan misi harian untuk mengumpulkan XP, naikkan level pass, dan klaim bonus koin serta avatar eksklusif.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Battle Pass Progress Area */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-[#0f131c] border border-white/[0.06] p-5 sm:p-6 rounded-2xl space-y-5 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-white/[0.06] pb-5">
              <div className="flex items-center gap-4">
                <div 
                  className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-white shadow-sm shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${profile.colorTheme}, #312e81)`
                  }}
                >
                  <span className="text-[10px] font-mono leading-none opacity-80 uppercase tracking-wider font-bold">LVL</span>
                  <span className="text-xl font-bold font-display leading-none mt-1">{playerPassLevel}</span>
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm text-white tracking-wide uppercase">TIKET ARKADE PASS</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">{xp} Total XP • Mainkan game untuk terus meningkatkan level!</p>
                </div>
              </div>

              {nextTier && (
                <div className="text-right sm:block flex justify-between font-mono text-xs">
                  <span className="text-zinc-500 uppercase">Target Berikutnya:</span>
                  <span className="text-indigo-400 font-bold block sm:mt-0.5">{nextTier.costXp - xp} XP Menuju Tier {nextTier.level}</span>
                </div>
              )}
            </div>

            {/* Level Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-zinc-500 uppercase">Progres Level</span>
                <span className="text-zinc-300 font-bold">{Math.round(progressPercentage)}%</span>
              </div>
              <div className="h-3 bg-[#151a26] rounded-full border border-white/[0.06] p-[2px] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full bg-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Tiers Rewards Path */}
          <div className="space-y-4">
            <h3 className="font-display font-bold text-sm text-zinc-100 tracking-wide uppercase flex items-center gap-2">
              <Gift size={16} className="text-indigo-400" />
              HADIAH JALUR TINGKATAN (TIER)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {PASS_TIERS.map((tier) => {
                const isUnlocked = xp >= tier.costXp;
                const isClaimed = claimedTiers.includes(tier.level);

                return (
                  <div
                    key={tier.level}
                    className={`p-4 rounded-2xl border flex items-center justify-between transition-all duration-200 shadow-sm ${
                      isClaimed
                        ? 'bg-[#151a26]/40 border-white/[0.04] text-zinc-500'
                        : isUnlocked
                        ? 'bg-[#0f131c] border-emerald-500/40 text-zinc-200'
                        : 'bg-[#0f131c] border-white/[0.06] text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center text-2xl relative shrink-0 ${
                        isClaimed
                          ? 'bg-zinc-900 border-white/[0.06]'
                          : isUnlocked
                          ? 'bg-emerald-500/15 border-emerald-500/30'
                          : 'bg-zinc-900 border-white/10'
                      }`}>
                        <span>{tier.icon}</span>
                        {!isUnlocked && (
                          <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                            <Lock size={12} className="text-zinc-500" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">TIER 0{tier.level} • {tier.costXp} XP</span>
                        <h4 className="text-xs font-bold font-sans text-white truncate">{tier.rewardName}</h4>
                      </div>
                    </div>

                    <div className="font-mono shrink-0 pl-2">
                      {isClaimed ? (
                        <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1 bg-[#151a26] px-2.5 py-1.5 rounded-lg border border-white/[0.06]">
                          <Check size={12} /> KLAIMED
                        </span>
                      ) : isUnlocked ? (
                        <button
                          onClick={() => handleClaimTier(tier)}
                          className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-1.5 rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
                        >
                          KLAIM
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-zinc-600 flex items-center gap-1 uppercase tracking-wider bg-zinc-900 border border-white/[0.06] px-2.5 py-1.5 rounded-lg">
                          <Lock size={11} /> TERKUNCI
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Daily Quests Panel */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-[#0f131c] border border-white/[0.06] p-5 sm:p-6 rounded-2xl space-y-4 shadow-sm">
            <div className="flex justify-between items-center border-b border-white/[0.06] pb-3.5">
              <div className="space-y-0.5">
                <h3 className="font-display font-bold text-sm text-white tracking-wide uppercase">Misi Harian</h3>
                <p className="text-xs text-zinc-500 font-mono">SELESAIKAN HARI INI</p>
              </div>
              <Target size={18} className="text-indigo-400" />
            </div>

            <div className="space-y-3">
              {dailyMissions.length === 0 ? (
                <div className="text-center p-8 text-zinc-500 font-mono text-xs">BELUM ADA MISI HARI INI</div>
              ) : (
                dailyMissions.map((mission) => {
                  const percent = Math.min((mission.progress / mission.target) * 100, 100);
                  return (
                    <div 
                      key={mission.id}
                      className="p-3.5 rounded-xl bg-[#151a26] border border-white/[0.06] space-y-2.5"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-xs font-bold text-zinc-200 leading-snug">{mission.description}</p>
                        {mission.completed ? (
                          <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
                            Selesai
                          </span>
                        ) : (
                          <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0 flex items-center gap-1">
                            <Coins size={10} /> +{mission.rewardCoins}
                          </span>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                          <span>Progres</span>
                          <span>{mission.progress} / {mission.target}</span>
                        </div>
                        <div className="h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-white/[0.06]">
                          <div 
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
