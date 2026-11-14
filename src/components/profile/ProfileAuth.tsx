import React from 'react';
import { LogIn, UserPlus, Sparkles, AlertCircle, CheckCircle2, Lock, LogOut, ShieldCheck, Globe } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface ProfileAuthProps {
  loggedInUser: string | null;
  isRegistering: boolean;
  setIsRegistering: (val: boolean) => void;
  username: string;
  setUsername: (val: string) => void;
  displayName: string;
  setDisplayName: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  isLoading: boolean;
  authError: string;
  authSuccess: string;
  cooldownRemaining: number;
  selectedAvatar: string;
  setSelectedAvatar: (val: string) => void;
  selectedColor: string;
  setSelectedColor: (val: string) => void;
  avatars: string[];
  colors: { value: string; label: string }[];
  onLogin: (e: React.FormEvent) => void;
  onRegister: (e: React.FormEvent) => void;
  onGoogleLogin: () => void;
  onLogout: () => void;
}

export const ProfileAuth: React.FC<ProfileAuthProps> = ({
  loggedInUser,
  isRegistering,
  setIsRegistering,
  username,
  setUsername,
  displayName,
  setDisplayName,
  password,
  setPassword,
  isLoading,
  authError,
  authSuccess,
  cooldownRemaining,
  selectedAvatar,
  setSelectedAvatar,
  selectedColor,
  setSelectedColor,
  avatars,
  colors,
  onLogin,
  onRegister,
  onGoogleLogin,
  onLogout
}) => {
  const { user, isFirebaseUser, isAdmin } = useAuth();

  if (loggedInUser) {
    return (
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-6 max-w-md mx-auto text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl ${
          isFirebaseUser 
            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' 
            : 'bg-zinc-800 border border-zinc-700 text-zinc-300'
        }`}>
          {isFirebaseUser ? <ShieldCheck size={32} /> : <CheckCircle2 size={32} />}
        </div>
        
        <div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <h3 className="font-display font-black text-lg uppercase text-text-primary">
              {isFirebaseUser ? user?.displayName || loggedInUser : `@${loggedInUser}`}
            </h3>
            {isAdmin && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 font-bold uppercase tracking-wider">
                ADMIN
              </span>
            )}
          </div>
          
          <div className="space-y-1.5 mt-2">
            <p className="text-xs text-text-secondary font-mono">
              {isFirebaseUser ? (
                <span className="text-emerald-400 flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Identitas Terverifikasi Firebase (Cloud & Ranked Aktif)
                </span>
              ) : (
                <span className="text-amber-400">
                  Mode Tamu Offline (Tersimpan Lokal). Leaderboard ranked dan sinkronisasi dompet cloud memerlukan login Firebase.
                </span>
              )}
            </p>
            {isFirebaseUser && user?.uid && (
              <p className="text-[10px] font-mono text-zinc-500 break-all select-all">
                CANONICAL UID: {user.uid}
              </p>
            )}
            {!isFirebaseUser && (
              <div className="pt-3">
                <button
                  type="button"
                  onClick={onGoogleLogin}
                  disabled={isLoading}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
                >
                  <Globe size={14} />
                  HUBUNGKAN DENGAN GOOGLE UNTUK RANKED & CLOUD
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <LogOut size={16} />
          KELUAR DARI AKUN
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-6 max-w-md mx-auto">
      <div className="text-center space-y-1">
        <h3 className="font-display font-black text-lg uppercase text-text-primary">
          {isRegistering ? 'BUAT PROFIL LOKAL' : 'MASUK PROFIL'}
        </h3>
        <p className="text-xs text-text-secondary font-mono">
          {isRegistering 
            ? 'Buat identitas pemain untuk mencatat progres permainan.'
            : 'Masuk untuk melanjutkan petualangan arkade Anda.'}
        </p>
      </div>

      {authError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl flex items-center gap-2 text-rose-400 text-xs font-mono">
          <AlertCircle size={16} className="shrink-0" />
          <span>{authError}</span>
        </div>
      )}

      {authSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center gap-2 text-emerald-400 text-xs font-mono">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{authSuccess}</span>
        </div>
      )}

      {cooldownRemaining > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-center gap-2 text-amber-400 text-xs font-mono">
          <Lock size={16} className="shrink-0" />
          <span>Sistem dikunci sementara. Sisa waktu: {cooldownRemaining}s</span>
        </div>
      )}

      {/* Google Login as primary cloud authentication */}
      <button
        type="button"
        onClick={onGoogleLogin}
        disabled={isLoading}
        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
      >
        <Globe size={16} />
        MASUK DENGAN GOOGLE (FIREBASE)
      </button>

      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-[1px] bg-border-subtle"></div>
        <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">ATAU OFFLINE</span>
        <div className="flex-1 h-[1px] bg-border-subtle"></div>
      </div>

      <form onSubmit={isRegistering ? onRegister : onLogin} className="space-y-4">
        <div>
          <label className="text-[11px] font-mono font-bold text-text-secondary uppercase block mb-1">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="contoh: neo_pilot"
            className="w-full bg-surface-subtle border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary focus:border-indigo-500 focus:outline-hidden"
          />
        </div>

        {isRegistering && (
          <div>
            <label className="text-[11px] font-mono font-bold text-text-secondary uppercase block mb-1">
              Nama Tampilan
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="contoh: NEO PILOT"
              className="w-full bg-surface-subtle border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary focus:border-indigo-500 focus:outline-hidden uppercase"
            />
          </div>
        )}

        <div>
          <label className="text-[11px] font-mono font-bold text-text-secondary uppercase block mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-surface-subtle border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary focus:border-indigo-500 focus:outline-hidden"
          />
        </div>

        {isRegistering && (
          <>
            <div>
              <label className="text-[11px] font-mono font-bold text-text-secondary uppercase block mb-1">
                Pilih Avatar
              </label>
              <div className="flex flex-wrap gap-2 p-2 bg-surface-subtle rounded-xl border border-border-subtle">
                {avatars.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setSelectedAvatar(av)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition ${
                      selectedAvatar === av ? 'bg-indigo-600/20 border border-indigo-500 scale-105' : 'hover:bg-surface-card'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono font-bold text-text-secondary uppercase block mb-1">
                Warna Tema
              </label>
              <div className="grid grid-cols-3 gap-2">
                {colors.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setSelectedColor(c.value)}
                    className={`p-2 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 border transition ${
                      selectedColor === c.value ? 'bg-surface-card border-indigo-500 text-text-primary' : 'bg-surface-subtle border-border-subtle text-text-secondary'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.value }}></span>
                    <span className="truncate">{c.label.replace('NEON ', '')}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={isLoading || cooldownRemaining > 0}
          className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
        >
          {isRegistering ? <UserPlus size={16} /> : <LogIn size={16} />}
          <span>{isRegistering ? 'DAFTAR PROFIL LOKAL' : 'MASUK PROFIL LOKAL'}</span>
        </button>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-xs font-mono text-text-secondary hover:text-indigo-400 transition cursor-pointer"
          >
            {isRegistering ? 'Sudah punya profil? Masuk di sini' : 'Belum punya profil? Buat di sini'}
          </button>
        </div>
      </form>
    </div>
  );
};
