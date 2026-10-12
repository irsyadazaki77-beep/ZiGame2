import React, { useState } from 'react';
import { PlayerProfile } from '../../types';
import { Settings as SettingsIcon, Volume2, Monitor, Cpu, ShieldCheck, Trash2, Smile, Save, Sparkles } from 'lucide-react';
import { audio } from '../../utils/audio';

interface ProfileSettingsProps {
  profile: PlayerProfile;
  loggedInUser: string | null;
  onUpdateProfile: (newProfile: PlayerProfile) => void;
  onResetStats: () => void;
  onLogout: () => void;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({
  profile,
  loggedInUser,
  onUpdateProfile,
  onResetStats,
  onLogout
}) => {
  const [displayName, setDisplayName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [themeColor, setThemeColor] = useState(profile.colorTheme);
  const [isMuted, setIsMuted] = useState(() => audio.getMuteState());
  const [graphicsQuality, setGraphicsQuality] = useState<'low' | 'medium' | 'high'>(() => {
    return (localStorage.getItem('zigame-graphics') as any) || 'high';
  });
  const [fpsLimit, setFpsLimit] = useState<'30' | '60' | '120' | 'auto'>(() => {
    return (localStorage.getItem('zigame-fps') as any) || 'auto';
  });
  const [defaultScreenSize, setDefaultScreenSize] = useState<'standard' | 'wide' | 'theater'>(() => {
    return (localStorage.getItem('zigame-screensize') as any) || 'wide';
  });
  const [autolockVal, setAutolockVal] = useState(() => localStorage.getItem('zigame_session_autolock') || 'off');
  const [successMsg, setSuccessMsg] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const avatars = ['👾', '🚀', '🤖', '🛸', '🎮', '⚡', '👑', '🧙‍♂️', '🦊', '🐱'];
  const colors = [
    { value: '#ef4444', label: 'NEON MERAH' },
    { value: '#06b6d4', label: 'NEON SIAN' },
    { value: '#eab308', label: 'NEON KUNING' },
    { value: '#a855f7', label: 'NEON UNGU' },
    { value: '#ec4899', label: 'NEON MERAH MUDA' },
    { value: '#10b981', label: 'NEON HIJAU' }
  ];

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
    setSuccessMsg('Profil berhasil disimpan!');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleToggleMute = () => {
    const nextMute = audio.toggleMute();
    setIsMuted(nextMute);
    if (!nextMute) audio.playCoin();
  };

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

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-500 text-xs font-mono">
          <Sparkles className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Profile Customization */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <h3 className="font-display font-black text-sm uppercase text-text-primary tracking-wide flex items-center gap-2">
          <Smile className="w-4 h-4 text-indigo-500" />
          KUSTOMISASI IDENTITAS
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-mono font-bold text-text-secondary uppercase block mb-1">
              Nama Pemain
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-surface-subtle border border-border-medium rounded-xl px-3.5 py-2.5 text-xs font-mono text-text-primary focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-mono font-bold text-text-secondary uppercase block mb-1.5">
              Avatar Favorit
            </label>
            <div className="flex gap-2 flex-wrap">
              {avatars.map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => setAvatar(av)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-xl transition cursor-pointer ${
                    avatar === av ? 'bg-indigo-600 border border-indigo-400 shadow-xs' : 'bg-surface-subtle border border-border-subtle hover:bg-surface-hover'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-mono font-bold text-text-secondary uppercase block mb-1.5">
              Warna Tema Lobi
            </label>
            <div className="flex gap-2 flex-wrap">
              {colors.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setThemeColor(c.value)}
                  className={`w-7 h-7 rounded-full border-2 transition cursor-pointer ${
                    themeColor === c.value ? 'scale-110 border-white shadow-xs' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleSaveProfile}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs transition cursor-pointer"
          >
            <Save size={14} />
            SIMPAN PERUBAHAN
          </button>
        </div>
      </div>

      {/* Audio & Display Preferences */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm space-y-3">
          <h4 className="font-display font-black text-xs uppercase text-text-primary tracking-wide flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-indigo-500" /> AUDIO SINTESIS
          </h4>
          <div className="flex items-center justify-between p-3 bg-surface-subtle rounded-xl border border-border-subtle">
            <span className="text-xs font-bold text-text-primary">Bungkam Suara</span>
            <button
              onClick={handleToggleMute}
              className={`w-10 h-5 rounded-full p-0.5 transition-colors ${isMuted ? 'bg-zinc-700' : 'bg-indigo-600'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isMuted ? 'translate-x-0' : 'translate-x-5'}`} />
            </button>
          </div>
        </div>

        <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-sm space-y-3">
          <h4 className="font-display font-black text-xs uppercase text-text-primary tracking-wide flex items-center gap-2">
            <Monitor className="w-4 h-4 text-indigo-500" /> TAMPILAN KANVAS
          </h4>
          <div className="grid grid-cols-3 gap-1 bg-surface-subtle p-1 rounded-xl border border-border-subtle">
            {(['standard', 'wide', 'theater'] as const).map(s => (
              <button
                key={s}
                onClick={() => handleScreenSize(s)}
                className={`py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition cursor-pointer ${
                  defaultScreenSize === s ? 'bg-indigo-600 text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dangerous Zone */}
      <div className="bg-surface-card border border-rose-500/20 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <h3 className="font-display font-black text-sm uppercase text-rose-400 tracking-wide flex items-center gap-2">
          <Trash2 className="w-4 h-4" /> ZONA BERBAHAYA
        </h3>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-rose-950/10 border border-rose-500/20 rounded-xl">
          <div>
            <span className="text-xs font-bold text-text-primary block">Reset Statistik & Skor</span>
            <span className="text-[10px] font-mono text-text-secondary">Kembalikan high score semua game ke 0.</span>
          </div>
          {showResetConfirm ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-2.5 py-1 text-xs font-mono text-text-secondary"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onResetStats();
                  setShowResetConfirm(false);
                }}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-mono font-bold"
              >
                Yakin Reset
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600 hover:text-white text-rose-400 border border-rose-500/30 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
            >
              RESET STATS
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
