import React from 'react';
import { ShieldCheck, Lock } from 'lucide-react';
import { audio } from '../../utils/audio';

interface SecuritySettingsSectionProps {
  autolockVal: string;
  setAutolockVal: (val: string) => void;
  setSuccessMsg: (msg: string) => void;
}

export const SecuritySettingsSection: React.FC<SecuritySettingsSectionProps> = ({
  autolockVal,
  setAutolockVal,
  setSuccessMsg
}) => {
  const handleAutolockChange = (val: string) => {
    audio.playCoin();
    setAutolockVal(val);
    localStorage.setItem('zigame_session_autolock', val);
    setSuccessMsg(`Auto-lock disetel ke ${val === 'off' ? 'Nonaktif' : val + ' menit'}`);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      <h3 className="text-xs font-mono font-bold text-text-primary tracking-wider uppercase flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-indigo-500" /> KEAMANAN & AUTOLOCK SESI
      </h3>

      <div className="p-3.5 bg-surface-subtle border border-border-subtle rounded-xl space-y-2">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-bold text-text-primary uppercase tracking-wide">Kunci Otomatis Sesi Tamu/Akun</span>
        </div>
        <p className="text-xs text-text-secondary font-mono">
          Kunci layar otomatis saat tidak ada interaksi keyboard/mouse untuk mencegah modifikasi data lokal.
        </p>
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {[
            { id: 'off', label: 'OFF' },
            { id: '5', label: '5 MNT' },
            { id: '15', label: '15 MNT' },
            { id: '30', label: '30 MNT' }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => handleAutolockChange(opt.id)}
              className={`py-2 rounded-lg text-xs font-mono font-bold uppercase transition cursor-pointer ${
                autolockVal === opt.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-surface-card border border-border-subtle text-text-secondary hover:text-text-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
