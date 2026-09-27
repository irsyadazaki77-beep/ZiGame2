import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Challenge, PlayerProfile, DailyMission, GameStats } from '../types';
import { challengeService } from '../services/challengeService';
import { progressionService } from '../services/progressionService';
import { audio } from '../utils/audio';
import Quests from './Quests';
import { 
  Target, Clock, Calendar, Sparkles, Check, Gift, ShieldAlert, Award, Star, Trophy, 
  HelpCircle, ArrowUpRight, ArrowDownRight, RefreshCw, Sparkle 
} from "lucide-react";

interface ChallengesPageProps {
  profile: PlayerProfile;
  games: GameStats[];
  dailyMissions: DailyMission[];
  onUpdateProfile: (updates: Partial<PlayerProfile> | ((prev: PlayerProfile) => PlayerProfile)) => void;
}

export default function ChallengesPage({
  profile,
  games,
  dailyMissions,
  onUpdateProfile
}: ChallengesPageProps) {
  const [tab, setTab] = useState<'daily' | 'weekly' | 'missions' | 'special' | 'quests'>('daily');
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  // Initialize and synchronize challenges on load
  useEffect(() => {
    const loaded = challengeService.generateChallengesIfOutdated(games);
    setChallenges(loaded);
  }, [games]);

  const filteredChallenges = challenges.filter(c => c.frequency === (tab === 'missions' ? 'daily' : tab));

  const handleClaim = (challenge: Challenge) => {
    if (!challenge.completed || challenge.claimed) return;

    import('../services/economyService').then(({ economyService }) => {
      economyService.claimReward(challenge.id, 'challenge', profile.name).then(res => {
        if (res.success && res.newBalance !== undefined) {
          audio.playLevelUp();
          
          const result = challengeService.claimChallenge(challenge.id);
          if (result.success) {
            const earnedXp = result.xp || 0;
            onUpdateProfile(prev => {
              const currentXp = prev.xp || 0;
              const nextXp = currentXp + earnedXp;
              const nextLevel = progressionService.calculateLevel(nextXp).level;
              return {
                ...prev,
                coins: res.newBalance,
                xp: nextXp,
                level: nextLevel
              };
            });
            
            setChallenges(challengeService.getStoredChallenges());
          }
        }
      });
    });
  };

  // Computes progress summary
  const completedCount = challenges.filter(c => c.completed && !c.claimed).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6"
    >
      {/* Visual Header Banner */}
      <section className="relative rounded-3xl overflow-hidden border border-border-subtle bg-surface-card flex flex-col justify-center px-6 md:px-10 py-8 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-surface-card via-surface-card/90 to-transparent z-10" />
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-amber-500/5 to-indigo-500/5" style={{ backgroundImage: 'radial-gradient(circle at 100% 50%, rgba(99, 102, 241, 0.08), transparent 50%), radial-gradient(circle at 0% 100%, rgba(245, 158, 11, 0.06), transparent 50%)' }} />

        <div className="relative z-20 max-w-xl space-y-2">
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400 text-[10px] font-mono font-bold px-2.5 py-1 rounded-md w-fit uppercase tracking-wider flex items-center gap-1.5">
            <Trophy size={12} className="text-amber-500" />
            DIAL TANTANGAN &amp; PRESTASI
          </div>
          <h1 className="text-xl md:text-3xl font-black tracking-wider text-text-primary font-display uppercase">
            TANTANGAN <span className="text-amber-500 dark:text-amber-400">SIBER</span>
          </h1>
          <p className="text-text-muted text-xs leading-relaxed font-sans max-w-md">
            Selesaikan misi khusus, klaim hadiah koin harian, dan kumpulkan XP untuk menaikkan level akun Anda.
          </p>
        </div>
      </section>

      {/* Filter Tabs Navigation */}
      <div className="flex gap-1 overflow-x-auto pb-2 border-b border-border-subtle">
        <button
          onClick={() => { audio.playHit(); setTab('daily'); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
            tab === 'daily' ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/30' : 'text-text-muted hover:text-text-primary border border-transparent'
          }`}
        >
          <Clock size={13} /> Tantangan Harian
        </button>
        <button
          onClick={() => { audio.playHit(); setTab('weekly'); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
            tab === 'weekly' ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/30' : 'text-text-muted hover:text-text-primary border border-transparent'
          }`}
        >
          <Calendar size={13} /> Mingguan
        </button>
        <button
          onClick={() => { audio.playHit(); setTab('missions'); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
            tab === 'missions' ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/30' : 'text-text-muted hover:text-text-primary border border-transparent'
          }`}
        >
          <Target size={13} /> Misi Harian
        </button>
        <button
          onClick={() => { audio.playHit(); setTab('special'); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
            tab === 'special' ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/30' : 'text-text-muted hover:text-text-primary border border-transparent'
          }`}
        >
          <Sparkles size={13} /> Spesial Season
        </button>
        <button
          onClick={() => { audio.playHit(); setTab('quests'); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
            tab === 'quests' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30' : 'text-text-muted hover:text-text-primary border border-transparent'
          }`}
        >
          <Gift size={13} /> Pas Tantangan
        </button>
      </div>

      {/* Claim Indicator Notification if any claim is pending */}
      {completedCount > 0 && (
        <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-center justify-between">
          <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wide flex items-center gap-2">
            <Sparkle size={13} className="text-amber-400 animate-spin" />
            Ada {completedCount} tantangan selesai yang siap diklaim!
          </span>
        </div>
      )}

      {/* Main Grid View */}
      <div className="pt-2">
        {tab === 'quests' ? (
          <Quests 
            dailyMissions={dailyMissions} 
            profile={profile} 
            onUpdateProfile={onUpdateProfile} 
            totalPlays={games.reduce((acc, g) => acc + g.plays, 0)} 
          />
        ) : tab !== 'missions' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredChallenges.length > 0 ? (
              filteredChallenges.map((ch) => {
                const percent = Math.min(100, Math.round((ch.progress / ch.target) * 100));

                return (
                  <div
                    key={ch.id}
                    className={`p-4 rounded-3xl border transition flex flex-col justify-between gap-4 ${
                      ch.claimed
                        ? 'bg-surface-subtle/50 border-border-subtle opacity-60'
                        : ch.completed
                        ? 'bg-amber-500/5 border-amber-500/30 shadow-xs'
                        : 'bg-surface-card border-border-subtle hover:border-border-medium'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl w-11 h-11 bg-surface-subtle border border-border-subtle rounded-xl flex items-center justify-center shrink-0">
                          {ch.icon}
                        </span>
                        <div>
                          <div className="flex items-center flex-wrap gap-1.5">
                            <h3 className="font-black text-xs sm:text-sm text-text-primary uppercase tracking-wide">{ch.title}</h3>
                            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-surface-subtle text-text-muted uppercase">
                              {ch.category}
                            </span>
                          </div>
                          <p className="text-xs text-text-muted mt-1 leading-normal font-sans">{ch.description}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono font-black text-amber-500">+{ch.rewardCoins} 🪙</div>
                        <div className="text-[9px] font-mono text-indigo-500">+{ch.rewardXp} XP</div>
                      </div>
                    </div>

                    {/* Progress Bar & Actions */}
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-border-subtle">
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-[10px] font-mono text-text-muted">
                          <span>PROGRES: {ch.progress.toLocaleString()} / {ch.target.toLocaleString()}</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-surface-sunken rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              ch.completed ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {ch.claimed ? (
                        <span className="text-[10px] font-mono font-black text-text-muted px-3 py-1.5 rounded-xl bg-surface-subtle border border-border-subtle flex items-center gap-1 uppercase select-none">
                          <Check size={11} /> Diklaim
                        </span>
                      ) : ch.completed ? (
                        <button
                          onClick={() => handleClaim(ch)}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-xs"
                        >
                          Klaim
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono text-text-muted px-3 py-1.5 uppercase select-none font-bold">
                          Aktif
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-center py-12 text-text-muted text-xs italic font-mono bg-surface-card rounded-3xl border border-border-subtle">
                Tidak ada tantangan aktif dalam kategori ini.
              </div>
            )}
          </div>
        ) : (
          /* TAB 3: DAILY MISSIONS (PLAY TARGETS) */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dailyMissions.length > 0 ? (
              dailyMissions.map((mission) => {
                const progressPercent = Math.min(100, Math.max(0, (mission.progress / mission.target) * 100));
                return (
                  <div 
                    key={mission.id}
                    className={`p-4 rounded-3xl border transition-all duration-300 flex flex-col justify-between gap-4 ${
                      mission.completed 
                        ? 'bg-surface-subtle/50 border-border-subtle opacity-60' 
                        : 'bg-surface-card border-border-subtle hover:border-border-medium'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl w-11 h-11 bg-surface-subtle border border-border-subtle rounded-xl flex items-center justify-center shrink-0">
                          🎯
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-black text-xs sm:text-sm text-text-primary uppercase tracking-wide">{mission.description}</h3>
                            {mission.completed && (
                              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase font-black">
                                Selesai
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-muted mt-1 leading-normal font-sans">Selesaikan sesi game harian untuk meraih coin bonus.</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono font-black text-amber-500">+{mission.rewardCoins} 🪙</div>
                        <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Coin</div>
                      </div>
                    </div>
                    
                    {/* Progress Bar & Info */}
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-border-subtle">
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-[10px] font-mono text-text-muted">
                          <span>PROGRES: {mission.progress} / {mission.target}</span>
                          <span>{Math.round(progressPercent)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-surface-sunken rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-800"
                            style={{ 
                              width: `${progressPercent}%`,
                              backgroundColor: mission.completed ? '#10b981' : '#6366f1'
                            }}
                          />
                        </div>
                      </div>

                      {mission.completed ? (
                        <span className="text-[10px] font-mono font-black text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-1 uppercase select-none">
                          <Check size={11} /> Selesai
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-text-muted px-3 py-1.5 uppercase select-none font-bold">
                          Hari ini
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-center py-12 text-text-muted text-xs italic font-mono bg-surface-card rounded-3xl border border-border-subtle">
                Tidak ada misi harian aktif saat ini.
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
