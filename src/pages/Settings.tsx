import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { audio } from '../utils/audio';
import { PlayerProfile } from '../types';
import { useGameContext } from '../contexts/GameContext';
import { Settings as SettingsIcon, Sparkles } from 'lucide-react';

import { AudioSettingsSection } from '../components/settings/AudioSettingsSection';
import { DisplaySettingsSection } from '../components/settings/DisplaySettingsSection';
import { PerformanceSettingsSection } from '../components/settings/PerformanceSettingsSection';
import { ProfileSettingsSection } from '../components/settings/ProfileSettingsSection';
import { SecuritySettingsSection } from '../components/settings/SecuritySettingsSection';
import { DataBackupSection } from '../components/settings/DataBackupSection';
import { DangerZoneSection } from '../components/settings/DangerZoneSection';

interface SettingsProps {
  profile: PlayerProfile;
  onUpdateProfile: (newProfile: PlayerProfile) => void;
  onResetStats: () => void;
  onLogout: () => void;
}

export default function Settings({ profile, onUpdateProfile, onResetStats, onLogout }: SettingsProps) {
  const { theme, toggleTheme } = useGameContext();

  const [defaultScreenSize, setDefaultScreenSize] = useState<'standard' | 'wide' | 'theater'>(() => {
    return (localStorage.getItem('zigame-screensize') as 'standard' | 'wide' | 'theater') || 'wide';
  });

  const [graphicsQuality, setGraphicsQuality] = useState<'low' | 'medium' | 'high'>(() => {
    return (localStorage.getItem('zigame-graphics') as 'low' | 'medium' | 'high') || 'high';
  });

  const [fpsLimit, setFpsLimit] = useState<'30' | '60' | '120' | 'auto'>(() => {
    return (localStorage.getItem('zigame-fps') as '30' | '60' | '120' | 'auto') || 'auto';
  });

  const [displayName, setDisplayName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [themeColor, setThemeColor] = useState(profile.colorTheme);
  const [isMuted, setIsMuted] = useState(() => audio.getMuteState());
  const [successMsg, setSuccessMsg] = useState('');
  const [autolockVal, setAutolockVal] = useState(() => {
    return localStorage.getItem('zigame_session_autolock') || 'off';
  });

  const avatars = ['👾', '🚀', '🤖', '🛸', '🎮', '⚡', '👑', '🧙‍♂️', '🦊', '🐱'];
  const colors = [
    { value: '#ef4444', label: 'NEON MERAH' },
    { value: '#06b6d4', label: 'NEON SIAN' },
    { value: '#eab308', label: 'NEON KUNING' },
    { value: '#a855f7', label: 'NEON UNGU' },
    { value: '#ec4899', label: 'NEON MERAH MUDA' },
    { value: '#10b981', label: 'NEON HIJAU' }
  ];

  const loggedInUser = localStorage.getItem('zigame_active_user');

  const handleGraphicsChange = (quality: 'low' | 'medium' | 'high') => {
    audio.playCoin();
    setGraphicsQuality(quality);
    localStorage.setItem('zigame-graphics', quality);
  };

  const handleFpsChange = (limit: '30' | '60' | '120' | 'auto') => {
    audio.playCoin();
    setFpsLimit(limit);
    localStorage.setItem('zigame-fps', limit);
  };

  const handleScreenSize = (size: 'standard' | 'wide' | 'theater') => {
    audio.playCoin();
    setDefaultScreenSize(size);
    localStorage.setItem('zigame-screensize', size);
  };

  const handleToggleMute = () => {
    const nextMute = audio.toggleMute();
    setIsMuted(nextMute);
    if (!nextMute) {
      audio.playCoin();
    }
  };

  const handleTestSound = () => {
    audio.playCoin();
    setTimeout(() => audio.playScore(), 150);
    setTimeout(() => audio.playLaser(), 300);
  };

  const handleSaveProfile = () => {
    if (!displayName.trim()) return;
    
    audio.playLevelUp();
    const updated = {
      ...profile,
      name: displayName.trim().toUpperCase(),
      avatar,
      colorTheme: themeColor
    };
    onUpdateProfile(updated);

    if (loggedInUser) {
      try {
        const accs = localStorage.getItem('zigame_accounts');
        if (accs) {
          const accounts = JSON.parse(accs);
          const updatedAccs = accounts.map((acc: any) => {
            if (acc.username.toLowerCase() === loggedInUser.toLowerCase()) {
              return {
                ...acc,
                profile: updated
              };
            }
            return acc;
          });
          localStorage.setItem('zigame_accounts', JSON.stringify(updatedAccs));
        }
      } catch (e) {}
    }

    setSuccessMsg('Profil berhasil disimpan!');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-12 text-text-primary">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-surface-card border border-border-subtle text-indigo-500">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-display font-black tracking-wide text-text-primary uppercase">PENGATURAN</h2>
          <p className="text-xs font-mono text-text-secondary uppercase tracking-wider mt-0.5">Konfigurasi sesi, audio, tampilan, dan keamanan</p>
        </div>
      </div>

      {/* Success Banner */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-500 text-xs font-mono"
          >
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <span>{successMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: General Settings */}
        <div className="lg:col-span-7 space-y-6">
          <AudioSettingsSection
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onTestSound={handleTestSound}
          />

          <DisplaySettingsSection
            theme={theme}
            toggleTheme={toggleTheme}
            defaultScreenSize={defaultScreenSize}
            onScreenSizeChange={handleScreenSize}
          />

          <PerformanceSettingsSection
            graphicsQuality={graphicsQuality}
            onGraphicsChange={handleGraphicsChange}
            fpsLimit={fpsLimit}
            onFpsChange={handleFpsChange}
          />
        </div>

        {/* Right Side: Identity, Security, Data */}
        <div className="lg:col-span-5 space-y-6">
          <ProfileSettingsSection
            displayName={displayName}
            setDisplayName={setDisplayName}
            avatar={avatar}
            setAvatar={setAvatar}
            themeColor={themeColor}
            setThemeColor={setThemeColor}
            avatars={avatars}
            colors={colors}
            onSaveProfile={handleSaveProfile}
          />

          <SecuritySettingsSection
            autolockVal={autolockVal}
            setAutolockVal={setAutolockVal}
            setSuccessMsg={setSuccessMsg}
          />

          <DataBackupSection
            profile={profile}
            loggedInUser={loggedInUser}
            onUpdateProfile={onUpdateProfile}
            setSuccessMsg={setSuccessMsg}
          />

          <DangerZoneSection
            loggedInUser={loggedInUser}
            onResetStats={onResetStats}
            onLogout={onLogout}
            setSuccessMsg={setSuccessMsg}
          />
        </div>
      </div>
    </div>
  );
}
