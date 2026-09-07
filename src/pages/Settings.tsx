import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { audio } from '../utils/audio';
import { PlayerProfile, GameStats, Achievement } from '../types';
import { 
  Settings as SettingsIcon, 
  Volume2, 
  VolumeX, 
  Trash2, 
  RefreshCw, 
  Monitor, 
  Save, 
  ShieldAlert, 
  Smile, 
  Sparkles, 
  Code2, 
  BookOpen, 
  LogOut,
  Cpu,
  Lock,
  ShieldCheck
} from 'lucide-react';

const generateBackupString = (accountData: any): string => {
  const dataToSign = {
    username: accountData.username,
    displayName: accountData.displayName,
    password: accountData.password,
    profile: accountData.profile,
    games: accountData.games,
    achievements: accountData.achievements,
    timestamp: Date.now()
  };
  
  const serialized = JSON.stringify(dataToSign);
  let hash = 0;
  for (let i = 0; i < serialized.length; i++) {
    const char = serialized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const signature = `SIG-${Math.abs(hash).toString(16).toUpperCase()}`;
  return JSON.stringify({ data: dataToSign, signature });
};

const verifyAndImportBackup = (jsonString: string): any => {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.data || !parsed.signature) {
      throw new Error("Format cadangan tidak valid.");
    }
    
    const serialized = JSON.stringify(parsed.data);
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const expectedSignature = `SIG-${Math.abs(hash).toString(16).toUpperCase()}`;
    
    if (parsed.signature !== expectedSignature) {
      throw new Error("INTEGRITAS RUSAK: Terdapat manipulasi data cadangan atau kode tidak cocok!");
    }
    
    return parsed.data;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal mengurai berkas cadangan.";
    throw new Error(msg, { cause: e });
  }
};

interface SettingsProps {
  profile: PlayerProfile;
  onUpdateProfile: (newProfile: PlayerProfile) => void;
  onResetStats: () => void;
  onLogout: () => void;
}

export default function Settings({ profile, onUpdateProfile, onResetStats, onLogout }: SettingsProps) {
  // Screen size preference
  const [defaultScreenSize, setDefaultScreenSize] = useState<'standard' | 'wide' | 'theater'>(() => {
    return (localStorage.getItem('zigame-screensize') as 'standard' | 'wide' | 'theater') || 'wide';
  });

  // Graphics & FPS states
  const [graphicsQuality, setGraphicsQuality] = useState<'low' | 'medium' | 'high'>(() => {
    return (localStorage.getItem('zigame-graphics') as 'low' | 'medium' | 'high') || 'high';
  });

  const [fpsLimit, setFpsLimit] = useState<'30' | '60' | '120' | 'auto'>(() => {
    return (localStorage.getItem('zigame-fps') as '30' | '60' | '120' | 'auto') || 'auto';
  });

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

  // Profile fields
  const [displayName, setDisplayName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [themeColor, setThemeColor] = useState(profile.colorTheme);

  // Audio state
  const [isMuted, setIsMuted] = useState(() => audio.getMuteState());

  // Delete/Reset confirmation alerts
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Security & Backup states
  const [autolockVal, setAutolockVal] = useState(() => {
    return localStorage.getItem('zigame_session_autolock') || 'off';
  });
  const [showImportArea, setShowImportArea] = useState(false);
  const [importText, setImportText] = useState('');
  const [exportedJson, setExportedJson] = useState('');
  const [backupError, setBackupError] = useState('');

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

    // If logged in, update in database list too
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

  const handleToggleMute = () => {
    const nextMute = audio.toggleMute();
    setIsMuted(nextMute);
    if (!nextMute) {
      audio.playCoin();
    }
  };

  const handleScreenSize = (size: 'standard' | 'wide' | 'theater') => {
    audio.playCoin();
    setDefaultScreenSize(size);
    localStorage.setItem('zigame-screensize', size);
  };

  const handleTestSound = () => {
    audio.playCoin();
    setTimeout(() => audio.playScore(), 150);
    setTimeout(() => audio.playLaser(), 300);
  };

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
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#0f131c] border border-white/[0.06] text-indigo-400">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-display font-black tracking-wide text-white uppercase">PENGATURAN</h2>
          <p className="text-xs font-mono text-zinc-400 uppercase tracking-wider mt-0.5">Konfigurasi sesi, audio, tampilan, dan keamanan</p>
        </div>
      </div>

      {/* Success Banner */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-400 text-xs font-mono"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>{successMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: General Settings */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Audio Settings Card */}
          <div className="bg-[#0f131c] border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-mono font-bold text-white tracking-wider uppercase flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-indigo-400" /> SINTESIS AUDIO & SUARA
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 bg-[#151a26] border border-white/[0.06] rounded-xl">
                <div>
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide block">Bungkam Semua Suara</span>
                  <span className="text-xs text-zinc-400 font-mono mt-0.5 block">Matikan seluruh efek audio synthesizer.</span>
                </div>
                <button
                  onClick={handleToggleMute}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 cursor-pointer focus:outline-none ${
                    isMuted ? 'bg-zinc-800' : 'bg-indigo-600'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
                    isMuted ? 'translate-x-0' : 'translate-x-5'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-[#151a26] border border-white/[0.06] rounded-xl">
                <div>
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide block">Uji Generator Suara</span>
                  <span className="text-xs text-zinc-400 font-mono mt-0.5 block">Tes respon audio Web-Audio API.</span>
                </div>
                <button
                  onClick={handleTestSound}
                  disabled={isMuted}
                  className="px-3.5 py-1.5 rounded-lg border border-white/[0.08] bg-[#0f131c] text-xs font-mono font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 cursor-pointer transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  TES SUARA 🎵
                </button>
              </div>
            </div>
          </div>

          {/* Video / Display Preferences */}
          <div className="bg-[#0f131c] border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-mono font-bold text-white tracking-wider uppercase flex items-center gap-2">
              <Monitor className="w-4 h-4 text-indigo-400" /> TAMPILAN LAYAR GAME
            </h3>

            <div className="space-y-2">
              <div>
                <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide block mb-1">Ukuran Canvas Standar</span>
                <span className="text-xs text-zinc-400 font-mono block mb-3">Pilih ukuran lebar layar canvas game yang sesuai resolusi monitor/layar.</span>
                
                <div className="grid grid-cols-3 gap-2 bg-[#151a26] border border-white/[0.06] rounded-xl p-1">
                  <button
                    onClick={() => handleScreenSize('standard')}
                    className={`py-2 rounded-lg text-xs font-mono font-bold flex flex-col items-center gap-1 cursor-pointer transition select-none ${
                      defaultScreenSize === 'standard'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span>📱</span>
                    <span>STANDAR (460px)</span>
                  </button>
                  <button
                    onClick={() => handleScreenSize('wide')}
                    className={`py-2 rounded-lg text-xs font-mono font-bold flex flex-col items-center gap-1 cursor-pointer transition select-none ${
                      defaultScreenSize === 'wide'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span>💻</span>
                    <span>LEBAR (560px)</span>
                  </button>
                  <button
                    onClick={() => handleScreenSize('theater')}
                    className={`py-2 rounded-lg text-xs font-mono font-bold flex flex-col items-center gap-1 cursor-pointer transition select-none ${
                      defaultScreenSize === 'theater'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span>📺</span>
                    <span>TEATER (660px)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Graphics & Performance Settings Card */}
          <div className="bg-[#0f131c] border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
            <h3 className="text-xs font-mono font-bold text-white tracking-wider uppercase flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" /> PERFORMA & GRAFIS
            </h3>

            <div className="space-y-4">
              {/* Graphics Quality */}
              <div>
                <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide block mb-1">Kualitas Grafis (Fidelity)</span>
                <span className="text-xs text-zinc-400 font-mono block mb-2.5">
                  Pilih kualitas efek partikel dan shadow untuk mengoptimalkan frame rate.
                </span>
                
                <div className="grid grid-cols-3 gap-2 bg-[#151a26] border border-white/[0.06] rounded-xl p-1">
                  <button
                    onClick={() => handleGraphicsChange('low')}
                    className={`py-2 rounded-lg text-xs font-mono font-bold flex flex-col items-center gap-1 cursor-pointer transition select-none ${
                      graphicsQuality === 'low'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span className="text-base">⚡</span>
                    <span>RENDAH (MAX FPS)</span>
                  </button>
                  <button
                    onClick={() => handleGraphicsChange('medium')}
                    className={`py-2 rounded-lg text-xs font-mono font-bold flex flex-col items-center gap-1 cursor-pointer transition select-none ${
                      graphicsQuality === 'medium'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span className="text-base">⚖️</span>
                    <span>SEDANG (BALANCED)</span>
                  </button>
                  <button
                    onClick={() => handleGraphicsChange('high')}
                    className={`py-2 rounded-lg text-xs font-mono font-bold flex flex-col items-center gap-1 cursor-pointer transition select-none ${
                      graphicsQuality === 'high'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span className="text-base">💎</span>
                    <span>TINGGI (FULL FX)</span>
                  </button>
                </div>
              </div>

              {/* FPS Limit */}
              <div>
                <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide block mb-1">Target Batasan FPS</span>
                <span className="text-xs text-zinc-400 font-mono block mb-2.5">
                  Batasi frame rate untuk menghemat daya baterai atau menjaga stabilitas.
                </span>
                
                <div className="grid grid-cols-4 gap-1.5 bg-[#151a26] border border-white/[0.06] rounded-xl p-1">
                  {(['30', '60', '120', 'auto'] as const).map((limit) => (
                    <button
                      key={limit}
                      onClick={() => handleFpsChange(limit)}
                      className={`py-2 rounded-lg text-xs font-mono font-bold flex flex-col items-center gap-0.5 cursor-pointer transition select-none ${
                        fpsLimit === limit
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span className="text-sm">
                        {limit === '30' ? '🔋' : limit === '60' ? '🎮' : limit === '120' ? '🚀' : '♾️'}
                      </span>
                      <span>{limit === 'auto' ? 'AUTO' : `${limit} FPS`}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Security & Backup Card */}
          <div className="bg-[#0f131c] border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
            <h3 className="text-xs font-mono font-bold text-white tracking-wider uppercase flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> INTEGRITAS & KEAMANAN
            </h3>

            <div className="space-y-5">
              {/* Auto Lock Session */}
              <div>
                <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide block mb-1">
                  Kunci Sesi Otomatis (Auto-Lock)
                </span>
                <span className="text-xs text-zinc-400 font-mono block mb-2.5">
                  Sistem mengunci akun jika tidak ada aktivitas dalam waktu tertentu.
                </span>
                
                <div className="grid grid-cols-4 gap-1.5 bg-[#151a26] border border-white/[0.06] rounded-xl p-1">
                  {([
                    { value: 'off', label: 'OFF' },
                    { value: '1', label: '1 MENIT' },
                    { value: '5', label: '5 MENIT' },
                    { value: '15', label: '15 MENIT' }
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        audio.playCoin();
                        setAutolockVal(opt.value);
                        localStorage.setItem('zigame_session_autolock', opt.value);
                        setSuccessMsg(`Auto-Lock disetel ke: ${opt.label}`);
                        setTimeout(() => setSuccessMsg(''), 2000);
                      }}
                      className={`py-2 rounded-lg text-xs font-mono font-bold flex flex-col items-center gap-0.5 cursor-pointer transition select-none ${
                        autolockVal === opt.value
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span>🔒</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Encrypted Backups Row */}
              <div className="border-t border-white/[0.06] pt-4 space-y-3">
                <div>
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide block mb-1">
                    Cadangan Terenkripsi
                  </span>
                  <span className="text-xs text-zinc-400 font-mono block mb-3">
                    Ekspor seluruh koin dan highscore Anda ke format bertanda tangan kriptografis.
                  </span>
                </div>

                {loggedInUser ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          audio.playCoin();
                          try {
                            const accounts = JSON.parse(localStorage.getItem('zigame_accounts') || '[]');
                            const activeAcc = accounts.find((a: any) => a.username.toLowerCase() === loggedInUser.toLowerCase());
                            if (activeAcc) {
                              const backupStr = generateBackupString(activeAcc);
                              setExportedJson(backupStr);
                              navigator.clipboard.writeText(backupStr);
                              setSuccessMsg('Cadangan aman disalin ke papan klip! 📋');
                              setTimeout(() => setSuccessMsg(''), 3000);
                            } else {
                              throw new Error("Akun tidak ditemukan.");
                            }
                          } catch (err: any) {
                            setBackupError(err.message || 'Gagal mengekspor data.');
                          }
                        }}
                        className="flex-1 py-2 px-3 bg-[#151a26] hover:bg-zinc-800 border border-white/[0.06] text-zinc-200 rounded-xl text-xs font-mono font-bold tracking-wider cursor-pointer flex items-center justify-center gap-2 transition"
                      >
                        📥 EKSPOR CADANGAN
                      </button>
                      <button
                        onClick={() => {
                          audio.playCoin();
                          setShowImportArea(!showImportArea);
                          setBackupError('');
                        }}
                        className="flex-1 py-2 px-3 bg-[#151a26] hover:bg-zinc-800 border border-white/[0.06] text-zinc-200 rounded-xl text-xs font-mono font-bold tracking-wider cursor-pointer flex items-center justify-center gap-2 transition"
                      >
                        📤 IMPOR CADANGAN
                      </button>
                    </div>

                    {exportedJson && (
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-mono text-zinc-500 uppercase">KODE ENKRIPSI CADANGAN ANDA</label>
                        <textarea
                          readOnly
                          value={exportedJson}
                          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                          className="w-full h-16 bg-zinc-950 border border-white/[0.06] rounded-xl p-2 font-mono text-xs text-zinc-300 outline-none resize-none"
                        />
                      </div>
                    )}

                    {showImportArea && (
                      <div className="space-y-3 p-3 bg-[#151a26] border border-white/[0.06] rounded-xl">
                        <span className="block text-xs font-mono font-bold text-zinc-300 uppercase">Tempel Kode Cadangan</span>
                        <textarea
                          placeholder='Tempel JSON cadangan di sini (termasuk kode "signature")...'
                          value={importText}
                          onChange={(e) => setImportText(e.target.value)}
                          className="w-full h-16 bg-zinc-950 border border-white/[0.06] rounded-xl p-2 font-mono text-xs text-zinc-200 outline-none resize-none focus:border-indigo-500"
                        />
                        {backupError && (
                          <p className="text-xs font-mono text-rose-400 uppercase leading-normal">
                            🚨 {backupError}
                          </p>
                        )}
                        <button
                          onClick={() => {
                            audio.playCoin();
                            setBackupError('');
                            try {
                              if (!importText.trim()) throw new Error("Kolom input kosong.");
                              const verifiedData = verifyAndImportBackup(importText);
                              
                              const accounts = JSON.parse(localStorage.getItem('zigame_accounts') || '[]');
                              const otherIndex = accounts.findIndex((a: any) => a.username.toLowerCase() === verifiedData.username.toLowerCase());
                              
                              if (otherIndex !== -1) {
                                accounts[otherIndex] = {
                                  ...accounts[otherIndex],
                                  profile: verifiedData.profile,
                                  games: verifiedData.games,
                                  achievements: verifiedData.achievements,
                                  password: verifiedData.password || accounts[otherIndex].password
                                };
                              } else {
                                accounts.push(verifiedData);
                              }
                              
                              localStorage.setItem('zigame_accounts', JSON.stringify(accounts));
                              
                              onUpdateProfile(verifiedData.profile);
                              localStorage.setItem('arcade_player_profile', JSON.stringify(verifiedData.profile));
                              localStorage.setItem('arcade_games_stats', JSON.stringify(verifiedData.games));
                              localStorage.setItem('arcade_achievements', JSON.stringify(verifiedData.achievements));
                              
                              audio.playLevelUp();
                              setSuccessMsg('PEMULIHAN AKUN BERHASIL! DATA VALID');
                              setImportText('');
                              setShowImportArea(false);
                              setTimeout(() => {
                                setSuccessMsg('');
                                window.location.reload();
                              }, 2000);
                            } catch (err: any) {
                              audio.playGameOver();
                              setBackupError(err.message || 'Format data rusak.');
                            }
                          }}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider cursor-pointer transition"
                        >
                          VERIFIKASI & MUAT DATA
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-[#151a26] border border-white/[0.06] rounded-xl text-center">
                    <span className="text-xs text-zinc-400 font-mono uppercase tracking-wider block">
                      Masuk akun terlebih dahulu untuk menggunakan fitur enkripsi & cadangan.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reset stats options */}
          <div className="bg-[#0f131c] border border-rose-500/20 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-mono font-bold text-rose-400 tracking-wider uppercase flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" /> ZONA BERBAHAYA
            </h3>

            <div className="space-y-3">
              <div className="p-3.5 bg-rose-500/[0.04] border border-rose-500/10 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <span className="text-xs font-bold text-rose-300 uppercase tracking-wide block">Reset Rekor & Skor</span>
                  <span className="text-xs text-zinc-400 font-mono mt-0.5 block">Kembalikan plays, highscore, dan misi ke 0.</span>
                </div>
                {!showResetConfirm ? (
                  <button
                    onClick={() => { audio.playCoin(); setShowResetConfirm(true); }}
                    className="px-3.5 py-1.5 bg-[#151a26] border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-mono font-bold tracking-wider cursor-pointer transition"
                  >
                    RESET DATA
                  </button>
                ) : (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={triggerResetStats}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-mono font-bold cursor-pointer uppercase"
                    >
                      YA, RESET
                    </button>
                    <button
                      onClick={() => { audio.playCoin(); setShowResetConfirm(false); }}
                      className="px-3 py-1.5 bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg text-xs font-mono font-bold cursor-pointer uppercase"
                    >
                      BATAL
                    </button>
                  </div>
                )}
              </div>

              {loggedInUser && (
                <div className="p-3.5 bg-rose-500/[0.04] border border-rose-500/10 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <span className="text-xs font-bold text-rose-300 uppercase tracking-wide block">Hapus Akun Aktif</span>
                    <span className="text-xs text-zinc-400 font-mono mt-0.5 block">Hapus permanen akun @{loggedInUser}.</span>
                  </div>
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => { audio.playCoin(); setShowDeleteConfirm(true); }}
                      className="px-3.5 py-1.5 bg-[#151a26] border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-mono font-bold tracking-wider cursor-pointer transition"
                    >
                      HAPUS AKUN
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={triggerDeleteAccount}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-mono font-bold cursor-pointer uppercase"
                      >
                        YA, HAPUS
                      </button>
                      <button
                        onClick={() => { audio.playCoin(); setShowDeleteConfirm(false); }}
                        className="px-3 py-1.5 bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg text-xs font-mono font-bold cursor-pointer uppercase"
                      >
                        BATAL
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Side: Profile Customization & Credits */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Profile Customization Card */}
          <div className="bg-[#0f131c] border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-mono font-bold text-white tracking-wider uppercase flex items-center gap-2">
              <Smile className="w-4 h-4 text-indigo-400" /> KUSTOMISASI PROFIL
            </h3>

            <div className="space-y-4">
              {/* Profile Avatar Preview */}
              <div className="flex flex-col items-center py-4 bg-[#151a26] border border-white/[0.06] rounded-xl">
                <div 
                  className="w-16 h-16 rounded-2xl bg-[#0f131c] border border-white/10 flex items-center justify-center text-3xl shadow-sm relative"
                  style={{ borderColor: themeColor }}
                >
                  {avatar}
                </div>
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mt-2">PRATINJAU AVATAR</span>
              </div>

              {/* Edit Display Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-bold tracking-wider text-zinc-300 uppercase">
                  NAMA PEMAIN
                </label>
                <input
                  type="text"
                  maxLength={14}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.toUpperCase())}
                  className="w-full bg-[#151a26] border border-white/[0.06] focus:border-indigo-500 rounded-xl py-2.5 px-3.5 text-xs font-mono text-white placeholder-zinc-500 outline-none transition uppercase"
                />
              </div>

              {/* Edit Avatar Row */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-bold tracking-wider text-zinc-300 uppercase">
                  PILIH IKON AVATAR
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-[#151a26] rounded-xl border border-white/[0.06]">
                  {avatars.map((av) => (
                    <button
                      key={av}
                      type="button"
                      onClick={() => { audio.playCoin(); setAvatar(av); }}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg cursor-pointer transition select-none ${
                        avatar === av
                          ? 'bg-indigo-600 text-white'
                          : 'bg-[#0f131c] hover:bg-zinc-800'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Themes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-bold tracking-wider text-zinc-300 uppercase">
                  TEMA WARNA AKSEN
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {colors.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => { audio.playCoin(); setThemeColor(c.value); }}
                      className={`py-2 px-2.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 cursor-pointer border select-none transition ${
                        themeColor === c.value
                          ? 'bg-[#151a26] border-white/20 text-white'
                          : 'bg-[#151a26]/40 border-white/[0.04] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.value }}></span>
                      <span className="truncate uppercase text-[11px]">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={!displayName.trim()}
                className="w-full mt-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>SIMPAN PERUBAHAN</span>
              </button>
            </div>
          </div>

          {/* Credits / About card */}
          <div className="bg-[#0f131c] border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-mono font-bold text-white tracking-wider uppercase flex items-center gap-2">
              <Code2 className="w-4 h-4 text-indigo-400" /> INFORMASI ZIGAME
            </h3>

            <div className="space-y-2.5 font-mono text-xs text-zinc-400 uppercase tracking-wider">
              <div className="flex justify-between border-b border-white/[0.06] pb-2">
                <span>VERSI SISTEM</span>
                <span className="text-zinc-200">ZIGAME V3.0-PRO</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.06] pb-2">
                <span>FRAMEWORK</span>
                <span className="text-zinc-200">REACT 19 + VITE + TAILWIND</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.06] pb-2">
                <span>SOUND ENGINE</span>
                <span className="text-zinc-200">WEB AUDIO OSCILLATOR</span>
              </div>
              <div className="flex justify-between pb-1">
                <span>STUDIO</span>
                <span className="text-zinc-200">ARKADE STUDIO</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
