import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { audio } from '../utils/audio';
import { PlayerProfile, GameStats, Achievement, RecentlyPlayedEntry } from '../types';
import { Lock, User, KeyRound, Palette, UserPlus, LogIn, Sparkles, AlertCircle, CheckCircle2, RefreshCw, Clock, ArrowUpRight, Play, Globe } from 'lucide-react';
import { authService } from '../services/authService';
import { isFirebaseReady } from '../services/firebase';

interface LoginProps {
  onLoginSuccess: (
    profile: PlayerProfile,
    games: GameStats[],
    achievements: Achievement[],
    recentlyPlayed: RecentlyPlayedEntry[]
  ) => void;
  onLogout: () => void;
  currentProfile: PlayerProfile;
  recentlyPlayed: RecentlyPlayedEntry[];
  games: GameStats[];
  achievements?: Achievement[];
  onClearRecentlyPlayed: () => void;
  onSelectGame: (id: string) => void;
}

export default function Login({ 
  onLoginSuccess, 
  onLogout, 
  currentProfile, 
  recentlyPlayed, 
  games, 
  achievements = [],
  onClearRecentlyPlayed, 
  onSelectGame 
}: LoginProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Status & Lock handling
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  
  // Register settings
  const [selectedAvatar, setSelectedAvatar] = useState('👾');
  const [selectedColor, setSelectedColor] = useState('#ef4444');

  const avatars = ['👾', '🚀', '🤖', '🛸', '🎮', '⚡', '👑', '🧙‍♂️', '🦊', '🐱'];
  const colors = [
    { value: '#ef4444', label: 'NEON MERAH' },
    { value: '#06b6d4', label: 'NEON SIAN' },
    { value: '#eab308', label: 'NEON KUNING' },
    { value: '#a855f7', label: 'NEON UNGU' },
    { value: '#ec4899', label: 'NEON MERAH MUDA' },
    { value: '#10b981', label: 'NEON HIJAU' }
  ];

  useEffect(() => {
    const active = localStorage.getItem('zigame_active_user');
    if (active) {
      setLoggedInUser(active);
    }
  }, []);

  useEffect(() => {
    const checkCooldown = () => {
      const cooldownTime = localStorage.getItem('zigame_login_cooldown_until');
      if (cooldownTime) {
        const remaining = Math.ceil((parseInt(cooldownTime) - Date.now()) / 1000);
        if (remaining > 0) {
          setCooldownRemaining(remaining);
        } else {
          setCooldownRemaining(0);
          localStorage.removeItem('zigame_login_failures');
          localStorage.removeItem('zigame_login_cooldown_until');
        }
      }
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleFailedAttempt = () => {
    const currentFailures = parseInt(localStorage.getItem('zigame_login_failures') || '0') + 1;
    localStorage.setItem('zigame_login_failures', currentFailures.toString());
    
    if (currentFailures >= 3) {
      const cooldownUntil = Date.now() + 30000; // 30 seconds cooldown lock
      localStorage.setItem('zigame_login_cooldown_until', cooldownUntil.toString());
      setCooldownRemaining(30);
      setError('Batas percobaan terlampaui! Sistem dikunci selama 30 detik untuk perlindungan brute-force.');
    } else {
      setError(`Password salah! Sisa percobaan sebelum sistem dikunci: ${3 - currentFailures}`);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const cooldownTime = localStorage.getItem('zigame_login_cooldown_until');
    if (cooldownTime && parseInt(cooldownTime) > Date.now()) {
      const remaining = Math.ceil((parseInt(cooldownTime) - Date.now()) / 1000);
      setError(`Sistem Dikunci! Harap tunggu ${remaining} detik.`);
      audio.playGameOver();
      return;
    }

    if (!username.trim() || !password) {
      setError('Harap masukkan Username dan Password.');
      audio.playGameOver();
      return;
    }

    setIsLoading(true);
    const guestData = {
      profile: currentProfile,
      games,
      achievements,
      recentlyPlayed
    };

    const res = await authService.loginLocal(username, password, guestData);
    setIsLoading(false);

    if (!res.success) {
      handleFailedAttempt();
      audio.playGameOver();
      return;
    }

    // Clear failed counts on success
    localStorage.removeItem('zigame_login_failures');
    localStorage.removeItem('zigame_login_cooldown_until');

    audio.playLevelUp();
    setSuccess(res.message);
    setLoggedInUser(username.trim().toLowerCase());
    
    if (res.session) {
      setTimeout(() => {
        onLoginSuccess(
          res.session!.profile,
          res.session!.games,
          res.session!.achievements,
          res.session!.recentlyPlayed
        );
      }, 1000);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim() || !displayName.trim() || !password) {
      setError('Harap lengkapi semua bidang isian.');
      audio.playGameOver();
      return;
    }

    setIsLoading(true);
    const guestData = {
      profile: {
        ...currentProfile,
        name: displayName.trim().toUpperCase(),
        avatar: selectedAvatar,
        colorTheme: selectedColor,
        coins: Math.max(currentProfile.coins, 100)
      },
      games,
      achievements,
      recentlyPlayed
    };

    const res = await authService.registerLocal(username, displayName, password, guestData);
    setIsLoading(false);

    if (!res.success) {
      setError(res.message);
      audio.playGameOver();
      return;
    }

    audio.playLevelUp();
    setSuccess(res.message);
    setLoggedInUser(username.trim().toLowerCase());

    if (res.session) {
      setTimeout(() => {
        onLoginSuccess(
          res.session!.profile,
          res.session!.games,
          res.session!.achievements,
          res.session!.recentlyPlayed
        );
      }, 1000);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    const guestData = {
      profile: currentProfile,
      games,
      achievements,
      recentlyPlayed
    };

    const res = await authService.loginWithGoogle(guestData);
    setIsLoading(false);

    if (!res.success) {
      setError(res.message);
      audio.playGameOver();
      return;
    }

    audio.playLevelUp();
    setSuccess(res.message);
    if (res.session) {
      setLoggedInUser(res.session.username);
      setTimeout(() => {
        onLoginSuccess(
          res.session!.profile,
          res.session!.games,
          res.session!.achievements,
          res.session!.recentlyPlayed
        );
      }, 1000);
    }
  };

  const handleLogoutClick = async () => {
    audio.playCoin();
    await authService.logout();
    setLoggedInUser(null);
    setUsername('');
    setPassword('');
    onLogout();
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg bg-zinc-950/80 border border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden"
        id="login-panel"
      >
        {/* Background Ambient Glow */}
        <div 
          className="absolute -top-24 -left-24 w-48 h-48 rounded-full filter blur-[80px] opacity-25"
          style={{ backgroundColor: currentProfile.colorTheme }}
        ></div>
        <div 
          className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full filter blur-[80px] opacity-25"
          style={{ backgroundColor: currentProfile.colorTheme }}
        ></div>

        {/* Title */}
        <div className="text-center mb-8 relative z-10">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-zinc-900 border border-zinc-800 mb-3 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.25)]">
            {isRegistering ? <UserPlus className="w-8 h-8" /> : <LogIn className="w-8 h-8" />}
          </div>
          <h2 className="text-2xl font-display font-black tracking-wider text-white uppercase">
            {loggedInUser ? 'AKUN SAYA' : isRegistering ? 'DAFTAR PEMAIN' : 'MASUK SYSTEM'}
          </h2>
          <p className="text-xs font-mono text-zinc-400 mt-1 uppercase tracking-wider">
            {loggedInUser ? `SEDANG ONLINE SEBAGAI @${loggedInUser}` : 'SIMPAN SKOR & COIN KAMU DI CLOUD LOCAL'}
          </p>
        </div>

        {/* Alert Notifications */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-400 text-xs font-mono"
            id="login-error-alert"
          >
            <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
            <span>{error}</span>
          </motion.div>
        )}

        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-emerald-400 text-xs font-mono"
            id="login-success-alert"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
            <span>{success}</span>
          </motion.div>
        )}

        {/* LOGGED IN VIEW */}
        {loggedInUser ? (
          <div className="space-y-6 relative z-10" id="logged-in-profile">
            <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-zinc-950 border-2 border-red-500/80 flex items-center justify-center text-4xl mb-4 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                {currentProfile.avatar}
              </div>
              <h3 className="text-xl font-display font-black text-white tracking-wider">
                {currentProfile.name}
              </h3>
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mt-1">
                ID PEMAIN: @{loggedInUser}
              </p>

              <div className="grid grid-cols-2 gap-4 w-full mt-6 pt-6 border-t border-zinc-800/60">
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/50">
                  <span className="block text-xs text-zinc-500 font-mono tracking-wider uppercase">SALDO COIN</span>
                  <span className="text-lg font-black text-amber-400 mt-1 block">🪙 {currentProfile.coins}</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/50">
                  <span className="block text-xs text-zinc-500 font-mono tracking-wider uppercase">TEMA WARNA</span>
                  <span className="text-xs font-mono font-black mt-2 block flex items-center justify-center gap-1.5" style={{ color: currentProfile.colorTheme }}>
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: currentProfile.colorTheme }}></span>
                    AKTIF
                  </span>
                </div>
              </div>
            </div>

            {/* RECENTLY PLAYED IN PROFILE */}
            {recentlyPlayed.length > 0 && (
              <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-cyan-400" />
                    <h4 className="font-display font-black text-sm text-white tracking-widest uppercase">Terakhir Dimainkan</h4>
                  </div>
                  <button 
                    onClick={() => {
                      if(window.confirm('Yakin ingin menghapus riwayat permainan?')) {
                        onClearRecentlyPlayed();
                      }
                    }}
                    className="text-xs font-mono text-zinc-500 hover:text-red-400 uppercase tracking-wider transition-colors"
                  >
                    Hapus
                  </button>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {recentlyPlayed.map(entry => {
                    const game = games.find(g => g.id === entry.gameId);
                    if (!game) return null;
                    return (
                      <div 
                        key={entry.gameId}
                        onClick={() => onSelectGame(game.id)}
                        className="flex items-center gap-4 bg-zinc-950 p-3 rounded-xl border border-zinc-800/60 hover:border-indigo-500/30 cursor-pointer transition-colors group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                          {game.icon}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <h5 className="text-xs font-black text-white uppercase tracking-wider truncate group-hover:text-indigo-400 transition-colors">{game.title}</h5>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-mono text-zinc-500">SKOR: <span className="text-white font-bold">{entry.lastScore !== undefined ? entry.lastScore : '-'}</span></span>
                            <span className="text-[10px] font-mono text-zinc-500">{new Date(entry.lastPlayedAt).toLocaleDateString('id-ID')}</span>
                          </div>
                        </div>
                        <ArrowUpRight size={16} className="text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={handleLogoutClick}
              className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-mono font-bold uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(239,68,68,0.2)]"
            >
              <span>KELUAR AKUN</span>
            </button>
          </div>
        ) : cooldownRemaining > 0 ? (
          <div className="p-6 rounded-2xl bg-red-950/20 border border-red-500/30 flex flex-col items-center text-center space-y-4" id="cooldown-lockout-panel">
            <div className="w-16 h-16 rounded-full bg-red-900/10 border-2 border-red-500 flex items-center justify-center text-3xl  text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]">
              🛡️
            </div>
            <h3 className="text-base font-display font-black text-red-500 tracking-wider uppercase">
              SISTEM DIKUNCI (BRUTE-FORCE DETECTED)
            </h3>
            <p className="text-zinc-400 text-xs font-mono max-w-sm leading-relaxed uppercase">
              Terlalu banyak percobaan masuk yang gagal. Demi keamanan enkripsi akun Anda, formulir dikunci selama:
            </p>
            <div className="text-4xl font-mono font-black text-red-500 ">
              00:{cooldownRemaining.toString().padStart(2, '0')}
            </div>
            <p className="text-xs text-zinc-600 font-mono uppercase tracking-wider">
              Mengamankan enkripsi database lokal...
            </p>
          </div>
        ) : (
          /* FORM VIEW */
          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-5 relative z-10" id="login-form">
            
            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-black tracking-wider text-zinc-400 uppercase">
                USERNAME (KECIL & TANPA SPASI)
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="contoh: zaki_retro"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none rounded-xl py-3 pl-11 pr-4 text-sm font-mono text-white placeholder-zinc-600 outline-none transition"
                />
              </div>
            </div>

            {/* Display Name Input (Only on Register) */}
            {isRegistering && (
              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-black tracking-wider text-zinc-400 uppercase">
                  NAMA TAMPILAN ARKADE (KAPITAL)
                </label>
                <div className="relative">
                  <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-500" />
                  <input
                    type="text"
                    maxLength={14}
                    placeholder="contoh: GALAXY KING"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value.toUpperCase())}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none rounded-xl py-3 pl-11 pr-4 text-sm font-mono text-white placeholder-zinc-600 outline-none transition"
                  />
                </div>
              </div>
            )}

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-black tracking-wider text-zinc-400 uppercase">
                PASSWORD
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-500" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none rounded-xl py-3 pl-11 pr-4 text-sm font-mono text-white placeholder-zinc-600 outline-none transition"
                />
              </div>
            </div>

            {/* Avatar & Theme Selector (Only on Register) */}
            {isRegistering && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4 pt-2 border-t border-zinc-900"
              >
                {/* Avatar Row */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono font-black tracking-wider text-zinc-400 uppercase">
                    PILIH AVATAR KARAKTER
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 bg-zinc-950 rounded-xl border border-zinc-900">
                    {avatars.map((av) => (
                      <button
                        key={av}
                        type="button"
                        onClick={() => { audio.playCoin(); setSelectedAvatar(av); }}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl cursor-pointer transition select-none ${
                          selectedAvatar === av
                            ? 'bg-zinc-800 border border-red-500 scale-110 shadow-md'
                            : 'bg-zinc-900 border border-transparent hover:bg-zinc-800/50'
                        }`}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Row */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono font-black tracking-wider text-zinc-400 uppercase">
                    TEMA WARNA GLOW
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {colors.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => { audio.playCoin(); setSelectedColor(c.value); }}
                        className={`py-2 rounded-lg text-xs font-mono font-bold flex flex-col items-center gap-1 cursor-pointer border select-none transition ${
                          selectedColor === c.value
                            ? 'bg-zinc-900 border-zinc-700 text-white'
                            : 'bg-zinc-950 border-zinc-900/60 text-zinc-500 hover:text-zinc-300'
                        }`}
                        title={c.label}
                      >
                        <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: c.value }}></span>
                        <span className="text-[7px] truncate max-w-full uppercase">{c.label.split(' ')[1]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 disabled:opacity-50 text-white font-mono font-bold uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(239,68,68,0.25)]"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : isRegistering ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>DAFTAR SEKARANG</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>MASUK SYSTEM</span>
                </>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-[1px] bg-zinc-800"></div>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">ATAU</span>
              <div className="flex-1 h-[1px] bg-zinc-800"></div>
            </div>

            {/* Google Sign-in Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 disabled:opacity-50 text-zinc-200 hover:text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>MASUK DENGAN GOOGLE (FIREBASE)</span>
            </button>

            {/* Toggle Switch */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { audio.playCoin(); setIsRegistering(!isRegistering); setError(''); setSuccess(''); }}
                className="text-xs font-mono text-zinc-500 hover:text-red-400 transition cursor-pointer uppercase tracking-wider"
              >
                {isRegistering ? 'Sudah punya akun? Masuk di sini' : 'Belum punya akun? Daftar gratis'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
