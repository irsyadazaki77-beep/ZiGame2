import React, { useEffect, useRef, useState } from 'react';
import { Lock, KeyRound, ShieldAlert, LogOut } from 'lucide-react';
import { storageService } from '../../services/storageService';
import { verifySecurityPinSync } from '../../utils/sessionCrypto';
import { audio } from '../../utils/audio';

interface SessionAutolockProps {
  onLockTriggered: () => void;
}

export const SessionAutolock: React.FC<SessionAutolockProps> = ({ onLockTriggered }) => {
  const lastActivityRef = useRef<number>(Date.now());
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isPinLocked, setIsPinLocked] = useState<boolean>(() => {
    return storageService.isSessionLocked() && Boolean(storageService.getSessionPinHash());
  });
  const [pinAttempt, setPinAttempt] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    const handleLockStateChange = () => {
      const locked = storageService.isSessionLocked();
      const pinHash = storageService.getSessionPinHash();
      setIsPinLocked(locked && Boolean(pinHash));
      setPinAttempt('');
      setErrorMsg('');
    };

    window.addEventListener('zigame-session-lock-change', handleLockStateChange);
    return () => window.removeEventListener('zigame-session-lock-change', handleLockStateChange);
  }, []);

  useEffect(() => {
    const checkAndSchedule = () => {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }

      const autolockSetting = storageService.getSessionAutolock();
      const activeUser = storageService.getActiveUser();
      const pinHash = storageService.getSessionPinHash();

      if ((!activeUser && !pinHash) || autolockSetting === 'off') {
        return;
      }

      const timeoutMinutes = parseInt(autolockSetting, 10);
      if (isNaN(timeoutMinutes) || timeoutMinutes <= 0) {
        return;
      }

      const timeoutMs = timeoutMinutes * 60 * 1000;
      const elapsed = Date.now() - lastActivityRef.current;
      const remaining = Math.max(0, timeoutMs - elapsed);

      idleTimeoutRef.current = setTimeout(() => {
        const currentPinHash = storageService.getSessionPinHash();
        if (currentPinHash) {
          storageService.setSessionLocked(true);
          setIsPinLocked(true);
          onLockTriggered();
        } else {
          onLockTriggered();
          storageService.clearActiveUser();
          setTimeout(() => {
            window.location.reload();
          }, 2500);
        }
      }, remaining);
    };

    // Throttled activity listener (ignores events fired within 5 seconds of the last one)
    const handleUserActivity = () => {
      if (storageService.isSessionLocked()) return;
      const now = Date.now();
      if (now - lastActivityRef.current > 5000) {
        lastActivityRef.current = now;
        checkAndSchedule();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !storageService.isSessionLocked()) {
        lastActivityRef.current = Date.now();
        checkAndSchedule();
      }
    };

    const targetEvents: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'touchstart'];

    targetEvents.forEach((evt) => {
      document.addEventListener(evt, handleUserActivity, { passive: true, capture: true });
    });
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });

    // Initial check
    checkAndSchedule();

    return () => {
      targetEvents.forEach((evt) => {
        document.removeEventListener(evt, handleUserActivity, true);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
    };
  }, [onLockTriggered]);

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const expectedHash = storageService.getSessionPinHash();
    if (!expectedHash) {
      storageService.setSessionLocked(false);
      setIsPinLocked(false);
      return;
    }

    if (verifySecurityPinSync(pinAttempt.trim(), expectedHash)) {
      audio.playLevelUp();
      storageService.setSessionLocked(false);
      setIsPinLocked(false);
      setPinAttempt('');
      setErrorMsg('');
      setFailedCount(0);
      lastActivityRef.current = Date.now();
    } else {
      audio.playGameOver();
      const nextFailed = failedCount + 1;
      setFailedCount(nextFailed);
      setPinAttempt('');
      if (nextFailed >= 5) {
        // Emergency wipe active session on 5 brute-force PIN failures
        storageService.setSessionLocked(false);
        storageService.setSessionPinHash(null);
        storageService.clearActiveUser();
        window.location.reload();
      } else {
        setErrorMsg(`PIN tidak valid (${nextFailed}/5 percobaan).`);
      }
    }
  };

  const handleForceLogout = () => {
    storageService.setSessionLocked(false);
    storageService.setSessionPinHash(null);
    storageService.clearActiveUser();
    window.location.reload();
  };

  if (!isPinLocked) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0f1322] border border-indigo-500/30 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-display font-black uppercase text-white tracking-wide">
              SESI TERKUNCI KEAMANAN
            </h2>
            <p className="text-xs font-mono text-zinc-400">
              Masukkan PIN Keamanan Sesi (4–6 digit) untuk melanjutkan.
            </p>
          </div>
        </div>

        <form onSubmit={handleUnlockSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase block mb-1.5">
              PIN KEAMANAN SESI
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                value={pinAttempt}
                onChange={(e) => setPinAttempt(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full bg-black/50 border border-white/15 rounded-xl pl-10 pr-4 py-3 text-sm font-mono text-white tracking-[0.35em] focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 flex items-center gap-2 text-rose-300 text-xs font-mono">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer whitespace-nowrap"
            >
              BUKA KUNCI SESI
            </button>
            <button
              type="button"
              onClick={handleForceLogout}
              className="py-2.5 px-3.5 bg-white/5 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-300 border border-white/10 rounded-xl text-xs font-mono font-bold uppercase transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Keluar & Reset Sesi"
            >
              <LogOut className="w-3.5 h-3.5" /> KELUAR
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

