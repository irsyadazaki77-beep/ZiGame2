import React from 'react';
import { PlayerProfile } from '../../types';
import { Trophy, Award, Users, Settings as SettingsIcon, LogIn, User, Sparkles } from 'lucide-react';
import { formatNumber } from '../../utils/format';

interface ProfileHeaderProps {
  profile: PlayerProfile;
  loggedInUser: string | null;
  activeTab: 'overview' | 'mastery' | 'achievements' | 'friends' | 'settings' | 'auth';
  setActiveTab: (tab: 'overview' | 'mastery' | 'achievements' | 'friends' | 'settings' | 'auth') => void;
  playerRank: { title: string; desc: string; color: string; bg: string };
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  profile,
  loggedInUser,
  activeTab,
  setActiveTab,
  playerRank
}) => {
  const tabs = [
    { id: 'overview', label: 'Ringkasan', icon: <User className="w-4 h-4" /> },
    { id: 'mastery', label: 'Mastery', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'achievements', label: 'Prestasi', icon: <Trophy className="w-4 h-4" /> },
    { id: 'friends', label: 'Teman', icon: <Users className="w-4 h-4" /> },
    { id: 'settings', label: 'Pengaturan', icon: <SettingsIcon className="w-4 h-4" /> },
    { id: 'auth', label: loggedInUser ? 'Akun' : 'Masuk', icon: <LogIn className="w-4 h-4" /> }
  ];

  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div 
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl shadow-md border border-border-medium"
            style={{ backgroundColor: `${profile.colorTheme}15`, borderColor: `${profile.colorTheme}40` }}
          >
            {profile.avatar}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-display font-black tracking-wide text-text-primary uppercase">
                {profile.name}
              </h1>
              {loggedInUser && (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 rounded-full">
                  VERIFIED
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${playerRank.bg} ${playerRank.color}`}>
                {playerRank.title}
              </span>
              <span className="text-xs text-text-secondary font-mono">
                Level {profile.level || 1}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="px-4 py-2 bg-surface-subtle border border-border-subtle rounded-xl flex items-center gap-2">
            <span className="text-amber-400 text-base">🪙</span>
            <span className="font-mono font-bold text-sm text-text-primary">
              {formatNumber(profile.coins)}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border-subtle scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
