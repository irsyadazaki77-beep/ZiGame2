import React from 'react';
import { Smile, Save } from 'lucide-react';

interface ProfileSettingsSectionProps {
  displayName: string;
  setDisplayName: (name: string) => void;
  avatar: string;
  setAvatar: (av: string) => void;
  themeColor: string;
  setThemeColor: (color: string) => void;
  avatars: string[];
  colors: { value: string; label: string }[];
  onSaveProfile: () => void;
}

export const ProfileSettingsSection: React.FC<ProfileSettingsSectionProps> = ({
  displayName,
  setDisplayName,
  avatar,
  setAvatar,
  themeColor,
  setThemeColor,
  avatars,
  colors,
  onSaveProfile
}) => {
  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      <h3 className="text-xs font-mono font-bold text-text-primary tracking-wider uppercase flex items-center gap-2">
        <Smile className="w-4 h-4 text-indigo-500" /> IDENTITAS & PROFIL
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
            Pilih Avatar
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
            Warna Tema
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
          onClick={onSaveProfile}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
        >
          <Save size={14} />
          SIMPAN IDENTITAS
        </button>
      </div>
    </div>
  );
};
