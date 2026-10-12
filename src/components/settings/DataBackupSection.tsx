import React, { useState } from 'react';
import { Save, Code2 } from 'lucide-react';
import { audio } from '../../utils/audio';
import { generateBackupString, verifyAndImportBackup } from './backupUtils';
import { PlayerProfile } from '../../types';

interface DataBackupSectionProps {
  profile: PlayerProfile;
  loggedInUser: string | null;
  onUpdateProfile: (newProfile: PlayerProfile) => void;
  setSuccessMsg: (msg: string) => void;
}

export const DataBackupSection: React.FC<DataBackupSectionProps> = ({
  profile,
  loggedInUser,
  onUpdateProfile,
  setSuccessMsg
}) => {
  const [showImportArea, setShowImportArea] = useState(false);
  const [importText, setImportText] = useState('');
  const [exportedJson, setExportedJson] = useState('');
  const [backupError, setBackupError] = useState('');

  const handleExportBackup = () => {
    audio.playCoin();
    setBackupError('');
    try {
      const dataToExport = {
        username: loggedInUser || 'guest',
        displayName: profile.name,
        profile,
        timestamp: Date.now()
      };
      const signedBackup = generateBackupString(dataToExport);
      setExportedJson(signedBackup);
      setSuccessMsg('Berkas cadangan terenkripsi berhasil dibuat!');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (e) {
      setBackupError('Gagal membuat berkas cadangan.');
    }
  };

  const handleImportBackup = () => {
    setBackupError('');
    if (!importText.trim()) {
      setBackupError('Tempelkan string cadangan terlebih dahulu.');
      return;
    }

    try {
      const data = verifyAndImportBackup(importText.trim());
      if (data.profile) {
        onUpdateProfile(data.profile);
      }
      audio.playLevelUp();
      setSuccessMsg('Data cadangan berhasil dipulihkan!');
      setShowImportArea(false);
      setImportText('');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (e: any) {
      audio.playGameOver();
      setBackupError(e.message || 'Gagal memulihkan cadangan.');
    }
  };

  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      <h3 className="text-xs font-mono font-bold text-text-primary tracking-wider uppercase flex items-center gap-2">
        <Save className="w-4 h-4 text-indigo-500" /> CADANGAN & PEMULIHAN DATA
      </h3>

      <div className="space-y-3">
        <div className="flex gap-2">
          <button
            onClick={handleExportBackup}
            className="flex-1 py-2 bg-surface-subtle hover:bg-surface-hover border border-border-medium rounded-xl text-xs font-mono font-bold text-text-primary transition cursor-pointer"
          >
            EKSPOR CADANGAN
          </button>
          <button
            onClick={() => {
              setShowImportArea(!showImportArea);
              setBackupError('');
            }}
            className="flex-1 py-2 bg-surface-subtle hover:bg-surface-hover border border-border-medium rounded-xl text-xs font-mono font-bold text-text-primary transition cursor-pointer"
          >
            IMPOR CADANGAN
          </button>
        </div>

        {exportedJson && (
          <div className="space-y-1.5 p-3 bg-surface-subtle rounded-xl border border-border-subtle">
            <span className="text-[10px] font-mono text-text-secondary uppercase">Kode Cadangan Terenkripsi:</span>
            <textarea
              readOnly
              value={exportedJson}
              className="w-full h-20 bg-surface-card border border-border-subtle rounded-lg p-2 text-[10px] font-mono text-indigo-300 resize-none"
            />
          </div>
        )}

        {showImportArea && (
          <div className="space-y-2 p-3 bg-surface-subtle rounded-xl border border-border-subtle">
            <span className="text-[10px] font-mono text-text-secondary uppercase">Tempelkan Kode Cadangan:</span>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Tempel JSON cadangan di sini..."
              className="w-full h-20 bg-surface-card border border-border-subtle rounded-lg p-2 text-[10px] font-mono text-text-primary resize-none focus:outline-none focus:border-indigo-500"
            />
            {backupError && (
              <span className="text-[10px] font-mono text-rose-400 block">{backupError}</span>
            )}
            <button
              onClick={handleImportBackup}
              className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-mono font-bold transition cursor-pointer"
            >
              VERIFIKASI & TERAPKAN
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
