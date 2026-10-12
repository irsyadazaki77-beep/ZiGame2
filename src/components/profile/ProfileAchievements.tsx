import React, { useState } from 'react';
import { Achievement } from '../../types';
import { Trophy, CheckCircle, Lock } from 'lucide-react';

interface ProfileAchievementsProps {
  achievements: Achievement[];
}

export const ProfileAchievements: React.FC<ProfileAchievementsProps> = ({ achievements }) => {
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  const filteredAchievements = achievements.filter(a => {
    if (filter === 'unlocked') return a.unlocked;
    if (filter === 'locked') return !a.unlocked;
    return true;
  });

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <div className="space-y-6">
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display font-black text-sm uppercase text-text-primary tracking-wide flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-amber-500" />
            GALERI PRESTASI ({unlockedCount}/{achievements.length})
          </h3>
          <p className="text-xs text-text-secondary font-mono">
            Selesaikan target prestasi untuk mendapatkan koin dan hadiah spesial.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-surface-subtle p-1 rounded-xl border border-border-subtle">
          {(['all', 'unlocked', 'locked'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition cursor-pointer ${
                filter === f ? 'bg-indigo-600 text-white shadow-xs' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {f === 'all' ? 'Semua' : f === 'unlocked' ? 'Terbuka' : 'Terkunci'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredAchievements.map(ach => (
          <div
            key={ach.id}
            className={`bg-surface-card border rounded-2xl p-4 sm:p-5 shadow-sm flex items-start gap-4 transition ${
              ach.unlocked ? 'border-border-subtle' : 'border-border-subtle/50 opacity-60'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
              ach.unlocked ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-surface-subtle text-text-muted border border-border-subtle'
            }`}>
              {ach.unlocked ? ach.icon : <Lock size={20} />}
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-text-primary">{ach.title}</h4>
                <div className="flex items-center gap-1 text-xs font-mono text-amber-400 font-bold">
                  <span>+{ach.rewardCoins}</span>
                  <span>🪙</span>
                </div>
              </div>
              <p className="text-xs text-text-secondary">{ach.description}</p>
              {ach.unlocked && ach.unlockedAt && (
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 mt-1">
                  <CheckCircle size={10} /> Terbuka: {new Date(ach.unlockedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
