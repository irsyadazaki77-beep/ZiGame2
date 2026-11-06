import React, { useState } from 'react';
import { Download, Share2, X, Smartphone, CheckCircle } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { audio } from '../../utils/audio';
import { haptics } from '../../utils/haptics';

interface PWAInstallButtonProps {
  variant?: 'topbar' | 'card' | 'inline';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'topbar' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    audio.playCoin();
    haptics.trigger('medium');
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  // Only render if installable or on iOS
  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      {variant === 'card' ? (
        <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Smartphone size={20} />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-white">Instal ZIGAME ke Layar Utama</h4>
              <p className="text-[11px] text-zinc-400">Akses instan seperti aplikasi native dan mainkan offline tanpa kuota.</p>
            </div>
          </div>

          <button
            onClick={handleInstallClick}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-indigo-600/20 shrink-0"
          >
            <Download size={14} />
            <span>Install Sekarang</span>
          </button>
        </div>
      ) : (
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-semibold transition active:scale-95 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
          title="Install ZIGAME ke Desktop / Layar Utama"
        >
          <Download size={13} className="text-indigo-400 animate-bounce" />
          <span>Install App</span>
        </button>
      )}

      {/* iOS Safari Installation Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-white/[0.08] p-6 shadow-2xl flex flex-col font-sans text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white transition"
            >
              <X size={18} />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto mb-3">
              <Share2 size={24} />
            </div>

            <h3 className="text-base font-bold text-white mb-2">Instal di iPhone / iPad</h3>
            <p className="text-xs text-zinc-400 leading-relaxed text-left space-y-2 mb-5">
              <span className="block">1. Ketuk tombol <strong className="text-indigo-300">Bagikan (Share)</strong> di bilah bawah Safari.</span>
              <span className="block">2. Gulir ke bawah lalu pilih <strong className="text-indigo-300">Tambah ke Layar Utama (Add to Home Screen)</strong>.</span>
              <span className="block">3. Ketuk <strong className="text-indigo-300">Tambah (Add)</strong> di pojok kanan atas.</span>
            </p>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition cursor-pointer"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};
