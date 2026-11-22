import React, { useState } from 'react';
import { Sparkles, Lock, Check, Crown, Shield, Gift } from 'lucide-react';
import { PlayerProfile } from '../../types';
import {
  BATTLE_PASS_SEASON_META,
  BATTLE_PASS_TIERS,
  BattlePassReward,
  computeBattlePassProgress,
  getClaimedBattlePassRewardIds,
  isCyberPassPremiumUnlocked,
  markBattlePassRewardClaimed,
  unlockCyberPassPremium,
} from '../../config/battlePassConfig';
import { audioController } from '../../sdk/audioController';
import { useToast } from '../../utils/ToastContext';

interface BattlePassTrackProps {
  profile: PlayerProfile;
  onUpdateProfile: (updates: Partial<PlayerProfile> | ((prev: PlayerProfile) => PlayerProfile)) => void;
}

export const BattlePassTrack: React.FC<BattlePassTrackProps> = ({ profile, onUpdateProfile }) => {
  const { showToast } = useToast();
  const [claimedIds, setClaimedIds] = useState<string[]>(() => getClaimedBattlePassRewardIds());
  const [isPremium, setIsPremium] = useState<boolean>(() => isCyberPassPremiumUnlocked());
  const [pageRange, setPageRange] = useState<number>(0); // 0: 1-10, 1: 11-20, 2: 21-30, 3: 31-40, 4: 41-50

  const progress = computeBattlePassProgress(profile.xp || 0);
  const visibleTiers = BATTLE_PASS_TIERS.slice(pageRange * 10, (pageRange + 1) * 10);

  const handleUnlockPremium = () => {
    const cost = BATTLE_PASS_SEASON_META.premiumUnlockCostCoins;
    if ((profile.coins || 0) < cost) {
      audioController.playHit();
      showToast('Koin Kurang', `Dibutuhkan ${cost}🪙 untuk membuka Cyber Pass Premium.`, 'error');
      return;
    }

    audioController.playLevelUp();
    unlockCyberPassPremium();
    setIsPremium(true);
    onUpdateProfile((prev) => ({
      ...prev,
      coins: Math.max(0, (prev.coins || 0) - cost),
    }));
    showToast('Cyber Pass Aktif!', 'Jalur hadiah Cyber Pass Season 2 (50 Tier) resmi terbuka!', 'success', '👑');
  };

  const handleClaimReward = (reward: BattlePassReward) => {
    if (claimedIds.includes(reward.id)) return;
    if (progress.currentTier < reward.tier) return;
    if (reward.track === 'cyber' && !isPremium) return;

    audioController.playCoin();
    const updated = markBattlePassRewardClaimed(reward.id);
    setClaimedIds(updated);

    onUpdateProfile((prev) => {
      const next = { ...prev };
      if (reward.type === 'coins' && typeof reward.value === 'number') {
        next.coins = (prev.coins || 0) + reward.value;
      } else if (reward.type === 'avatar' && typeof reward.value === 'string') {
        const avs = prev.unlockedAvatars || [];
        next.unlockedAvatars = avs.includes(reward.value) ? avs : [...avs, reward.value];
        next.avatar = reward.value;
      } else if (reward.type === 'theme' && typeof reward.value === 'string') {
        const ths = prev.unlockedThemes || [];
        next.unlockedThemes = ths.includes(reward.value) ? ths : [...ths, reward.value];
        next.colorTheme = reward.value;
      }
      return next;
    });

    showToast('Hadiah Tier Diklaim!', `Tier ${reward.tier}: ${reward.name} telah ditambahkan!`, 'success', reward.icon);
  };

  return (
    <div className="space-y-5" data-testid="battle-pass-track">
      {/* Season 2 Cyber Pass Header */}
      <div className="p-5 sm:p-6 rounded-3xl bg-surface-card border border-border-subtle flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-[10px] font-mono font-bold uppercase">
              50 TIERS • SEASON 2
            </span>
            {isPremium && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold uppercase flex items-center gap-1">
                <Crown size={11} /> CYBER PASS AKTIF
              </span>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-display font-black text-text-primary uppercase tracking-wider">
            {BATTLE_PASS_SEASON_META.name}
          </h2>
          <p className="text-xs text-text-secondary max-w-xl">
            Kumpulkan XP dari setiap permainan dan tantangan harian untuk membuka 50 tier kosmetik holografis, tema neon, dan bonus koin.
          </p>
        </div>

        {/* Current Tier Progress & Premium Upgrade */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="px-4 py-3 rounded-2xl bg-surface-subtle border border-border-subtle min-w-[180px]">
            <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
              <span className="text-indigo-400">TIER {progress.currentTier} / 50</span>
              <span className="text-text-secondary">{progress.currentTierXp}/{progress.nextTierXp} XP</span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-sunken overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-300"
                style={{ width: `${progress.progressPercent}%` }}
              />
            </div>
          </div>

          {!isPremium && (
            <button
              onClick={handleUnlockPremium}
              className="px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-mono font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95 transition"
            >
              <Crown size={15} />
              <span>Buka Cyber Pass ({BATTLE_PASS_SEASON_META.premiumUnlockCostCoins}🪙)</span>
            </button>
          )}
        </div>
      </div>

      {/* Tier Range Pagination Pills (1-10, 11-20, 21-30, 31-40, 41-50) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[0, 1, 2, 3, 4].map((idx) => {
          const start = idx * 10 + 1;
          const end = (idx + 1) * 10;
          const active = pageRange === idx;
          return (
            <button
              key={idx}
              onClick={() => {
                audioController.playClick();
                setPageRange(idx);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer shrink-0 border ${
                active
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                  : 'bg-surface-card text-text-secondary hover:text-text-primary border-border-subtle'
              }`}
            >
              Tier {start}–{end}
            </button>
          );
        })}
      </div>

      {/* Tiers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {visibleTiers.map((item) => {
          const isUnlocked = progress.currentTier >= item.tier;
          const freeClaimed = claimedIds.includes(item.freeReward.id);
          const cyberClaimed = claimedIds.includes(item.cyberReward.id);

          return (
            <div
              key={item.tier}
              className={`rounded-2xl border p-3.5 flex flex-col justify-between gap-3 transition ${
                isUnlocked
                  ? 'bg-surface-card border-indigo-500/40 shadow-sm'
                  : 'bg-surface-card/60 border-border-subtle opacity-80'
              }`}
            >
              {/* Tier Header */}
              <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <span className="font-display font-black text-xs text-text-primary">
                  TIER {item.tier}
                </span>
                <span className="text-[10px] font-mono text-text-muted">
                  {item.requiredXp} XP
                </span>
              </div>

              {/* Free Track Reward */}
              <div className="p-2.5 rounded-xl bg-surface-subtle border border-border-subtle space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold uppercase text-text-muted flex items-center gap-1">
                    <Gift size={10} /> Free Pass
                  </span>
                  {freeClaimed && <Check size={12} className="text-emerald-400" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.freeReward.icon}</span>
                  <span className="text-xs font-bold text-text-primary truncate">{item.freeReward.name}</span>
                </div>
                <button
                  disabled={!isUnlocked || freeClaimed}
                  onClick={() => handleClaimReward(item.freeReward)}
                  className={`w-full py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition ${
                    freeClaimed
                      ? 'bg-emerald-500/10 text-emerald-400 cursor-default'
                      : isUnlocked
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                        : 'bg-surface-sunken text-text-muted cursor-not-allowed'
                  }`}
                >
                  {freeClaimed ? 'Diklaim' : isUnlocked ? 'Klaim Gratis' : 'Terkunci'}
                </button>
              </div>

              {/* Cyber Pass Track Reward */}
              <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/25 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold uppercase text-amber-400 flex items-center gap-1">
                    <Sparkles size={10} /> Cyber Pass
                  </span>
                  {!isPremium ? (
                    <Lock size={11} className="text-amber-500/70" />
                  ) : (
                    cyberClaimed && <Check size={12} className="text-emerald-400" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.cyberReward.icon}</span>
                  <span className="text-xs font-bold text-text-primary truncate">{item.cyberReward.name}</span>
                </div>
                <button
                  disabled={!isUnlocked || !isPremium || cyberClaimed}
                  onClick={() => handleClaimReward(item.cyberReward)}
                  className={`w-full py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition ${
                    cyberClaimed
                      ? 'bg-emerald-500/10 text-emerald-400 cursor-default'
                      : isUnlocked && isPremium
                        ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 cursor-pointer'
                        : 'bg-surface-sunken text-text-muted cursor-not-allowed'
                  }`}
                >
                  {cyberClaimed
                    ? 'Diklaim'
                    : !isPremium
                      ? 'Butuh Cyber Pass'
                      : isUnlocked
                        ? 'Klaim Cyber'
                        : 'Terkunci'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
