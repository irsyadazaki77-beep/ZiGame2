import React, { useState } from 'react';
import { Trash2, LogOut } from 'lucide-react';
import { audio } from '../../utils/audio';

interface DangerZoneSectionProps {
  loggedInUser: string | null;
  onResetStats: () => void;
  onLogout: () => void;
  setSuccessMsg: (msg: string) => void;
}

export const DangerZoneSection: React.FC<DangerZoneSectionProps> = ({
  loggedInUser,
  onResetStats,
  onLogout,
  setSuccessMsg
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const triggerResetStats = () => {
    audio.playGameOver();
    onResetStats();
    setShowResetConfirm(false);
    setSuccessMsg('Semua statistik & highscore berhasil direset!');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const triggerDeleteAccount = () => {
    if (!loggedInUser) return;
    audio.playGameOver();
    
    try {
      const accs = localStorage.getItem('zigame_accounts');
      if (accs) {
        const accounts = JSON.parse(accs);
        const filtered = accounts.filter((acc: any) => acc.username.toLowerCase() !== loggedInUser.toLowerCase());
        localStorage.setItem('zigame_accounts', JSON.stringify(filtered));
      }
    } catch (e) {}

    localStorage.removeItem('zigame_active_user');
    onLogout();
    setShowDeleteConfirm(false);
    setSuccessMsg('Akun berhasil dihapus. Beralih ke Tamu...');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  return (
    <div className="bg-surface-card border border-rose-500/20 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      <h3 className="text-xs font-mono font-bold text-rose-400 tracking-wider uppercase flex items-center gap-2">
        <Trash2 className="w-4 h-4" /> ZONA BERBAHAYA
      </h3>

      <div className="space-y-3">
        {/* Reset Stats */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-rose-950/10 border border-rose-500/20 rounded-xl">
          <div>
            <span className="text-xs font-bold text-text-primary uppercase tracking-wide block">Reset Seluruh Skor & Statistik</span>
            <span className="text-xs text-text-secondary font-mono mt-0.5 block">Hapus high score lokal semua game ke 0.</span>
          </div>
          {showResetConfirm ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 rounded-lg border border-border-medium text-xs font-mono text-text-secondary hover:text-text-primary cursor-pointer transition"
              >
                Batal
              </button>
              <button
                onClick={triggerResetStats}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold shadow-xs cursor-pointer transition"
              >
                Yakin Hapus
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600/15 hover:bg-rose-600 hover:text-white text-rose-400 border border-rose-500/30 text-xs font-mono font-bold cursor-pointer transition"
            >
              RESET STATS
            </button>
          )}
        </div>

        {/* Delete Account */}
        {loggedInUser && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-rose-950/10 border border-rose-500/20 rounded-xl">
            <div>
              <span className="text-xs font-bold text-text-primary uppercase tracking-wide block">Hapus Akun @{loggedInUser}</span>
              <span className="text-xs text-text-secondary font-mono mt-0.5 block">Hapus kredensial login dan identitas akun lokal.</span>
            </div>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded-lg border border-border-medium text-xs font-mono text-text-secondary hover:text-text-primary cursor-pointer transition"
                >
                  Batal
                </button>
                <button
                  onClick={triggerDeleteAccount}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold shadow-xs cursor-pointer transition"
                >
                  Hapus Permanen
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600/15 hover:bg-rose-600 hover:text-white text-rose-400 border border-rose-500/30 text-xs font-mono font-bold cursor-pointer transition"
              >
                HAPUS AKUN
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
