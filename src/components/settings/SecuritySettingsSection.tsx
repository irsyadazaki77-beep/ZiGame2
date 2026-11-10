import React, { useState } from 'react';
import { ShieldCheck, Lock, KeyRound, CheckCircle2, Trash2, AlertCircle } from 'lucide-react';
import { audio } from '../../utils/audio';
import { storageService } from '../../services/storageService';
import { hashSecurityPinSync } from '../../utils/sessionCrypto';

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
  const [hasPin, setHasPin] = useState<boolean>(() => Boolean(storageService.getSessionPinHash()));
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPinEditor, setShowPinEditor] = useState(false);
  const [vaultReport, setVaultReport] = useState(() => storageService.verifyVaultIntegrity());

  const handleVerifyVault = () => {
    audio.playCoin();
    const report = storageService.verifyVaultIntegrity();
    setVaultReport(report);
    if (report.isIntact) {
      setSuccessMsg(`Brankas lokal aman: ${report.encryptedKeysCount} entri terenkripsi & terverifikasi SHA-256.`);
    } else {
      setSuccessMsg(`Ditemukan dan dibersihkan ${report.tamperedKeys.length} entri yang dimanipulasi.`);
    }
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleAutolockChange = (val: string) => {
    audio.playCoin();
    setAutolockVal(val);
    storageService.setSessionAutolock(val);
    setSuccessMsg(`Auto-lock disetel ke ${val === 'off' ? 'Nonaktif' : val + ' menit'}`);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleSavePin = () => {
    setPinError('');
    const cleanPin = pinInput.trim();
    if (!/^\d{4,6}$/.test(cleanPin)) {
      setPinError('PIN harus berupa 4 hingga 6 angka numerik.');
      return;
    }
    if (cleanPin !== pinConfirm.trim()) {
      setPinError('Konfirmasi PIN tidak cocok.');
      return;
    }

    const hashed = hashSecurityPinSync(cleanPin);
    storageService.setSessionPinHash(hashed);
    setHasPin(true);
    setPinInput('');
    setPinConfirm('');
    setShowPinEditor(false);
    audio.playLevelUp();
    setSuccessMsg('PIN Keamanan Sesi berhasil diaktifkan!');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleRemovePin = () => {
    storageService.setSessionPinHash(null);
    storageService.setSessionLocked(false);
    setHasPin(false);
    setShowPinEditor(false);
    audio.playCoin();
    setSuccessMsg('PIN Keamanan Sesi telah dihapus.');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleLockSessionNow = () => {
    if (!hasPin) {
      setPinError('Aktifkan PIN Keamanan terlebih dahulu untuk mengunci sesi instan.');
      setShowPinEditor(true);
      return;
    }
    audio.playCoin();
    storageService.setSessionLocked(true);
  };

  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-mono font-bold text-text-primary tracking-wider uppercase flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-500" /> KEAMANAN & AUTOLOCK SESI
        </h3>
        {hasPin && (
          <button
            type="button"
            onClick={handleLockSessionNow}
            className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-[11px] font-mono font-bold uppercase transition cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Lock className="w-3 h-3" /> KUNCI SESI SEKARANG
          </button>
        )}
      </div>

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
              type="button"
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

      {/* Session Security PIN Section */}
      <div className="p-3.5 bg-surface-subtle border border-border-subtle rounded-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-bold text-text-primary uppercase tracking-wide">PIN Proteksi Sesi (4–6 Digit)</span>
              {hasPin && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> AKTIF
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary font-mono">
              Lindungi sesi aktif dengan PIN terenkripsi SHA-256 saat layar terkunci otomatis atau manual.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowPinEditor(!showPinEditor);
                setPinError('');
              }}
              className="px-3 py-1.5 rounded-lg bg-surface-card hover:bg-surface-hover border border-border-medium text-xs font-mono font-bold text-text-primary transition cursor-pointer whitespace-nowrap"
            >
              {showPinEditor ? 'TUTUP' : hasPin ? 'UBAH PIN' : 'SETEL PIN'}
            </button>
            {hasPin && (
              <button
                type="button"
                onClick={handleRemovePin}
                className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/25 text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap"
                title="Hapus PIN Keamanan"
              >
                <Trash2 className="w-3.5 h-3.5" /> HAPUS
              </button>
            )}
          </div>
        </div>

        {showPinEditor && (
          <div className="pt-2 border-t border-border-subtle space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-mono font-bold text-text-secondary uppercase block mb-1">
                  PIN Baru (4–6 Angka)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Contoh: 4829"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-surface-card border border-border-medium rounded-lg px-3 py-2 text-xs font-mono text-text-primary tracking-widest focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono font-bold text-text-secondary uppercase block mb-1">
                  Konfirmasi PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Ulangi PIN"
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-surface-card border border-border-medium rounded-lg px-3 py-2 text-xs font-mono text-text-primary tracking-widest focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            {pinError && (
              <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-mono">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSavePin}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-mono font-bold transition cursor-pointer whitespace-nowrap"
              >
                SIMPAN PIN KEAMANAN
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Encrypted & Signed Local Storage Vault Section */}
      <div className="p-3.5 bg-surface-subtle border border-border-subtle rounded-xl space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-bold text-text-primary uppercase tracking-wide">
                Brankas Penyimpanan Lokal Anti-DevTools (SHA-256)
              </span>
            </div>
            <p className="text-xs text-text-secondary font-mono">
              Enkripsi dan tanda tangan integritas otomatis pada profil, koin, dan statistik lokal.
            </p>
          </div>
          <button
            type="button"
            onClick={handleVerifyVault}
            className="px-3 py-1.5 rounded-lg bg-surface-card hover:bg-surface-hover border border-border-medium text-xs font-mono font-bold text-text-primary transition cursor-pointer whitespace-nowrap shrink-0"
          >
            VERIFIKASI BRANKAS
          </button>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-text-secondary tabular-nums pt-1 border-t border-border-subtle">
          <span>
            Status: <strong className={vaultReport.isIntact ? 'text-emerald-400' : 'text-amber-400'}>{vaultReport.isIntact ? 'TERSEGEL AMAN' : 'DIPULIHKAN'}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>Entri Terenkripsi: <strong className="text-text-primary">{vaultReport.encryptedKeysCount}</strong></span>
          <span aria-hidden="true">·</span>
          <span>Percobaan Manipulasi Ditolak: <strong className="text-rose-400">{vaultReport.tamperAttemptsCount}</strong></span>
        </div>
      </div>
    </div>
  );
};

