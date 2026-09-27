import React, { useEffect } from 'react';
import { Play, RotateCcw, Trophy, Sparkles, Home, Gamepad2, Medal, Zap, Coins } from 'lucide-react';

export type GameState = 'initialize' | 'ready' | 'countdown' | 'playing' | 'paused' | 'gameover' | 'levelcomplete' | 'restart' | string;

export interface GameOverlayProps {
  gameState: GameState;
  countdown?: number;
  score?: number;
  highScore?: number;
  onStart: () => void;
  onResume?: () => void;
  onRestart: () => void;
  onOpenLeaderboard?: () => void;
  onOpenGameDrawer?: () => void;
  onNavigateHome?: () => void;
  instructions?: string;
  gameoverMessage?: string;
}

export const GameOverlay: React.FC<GameOverlayProps> = ({
  gameState,
  countdown,
  score = 0,
  highScore = 0,
  onStart,
  onResume,
  onRestart,
  onOpenLeaderboard,
  onOpenGameDrawer,
  onNavigateHome,
  instructions = 'Gunakan kontrol untuk mengarahkan permainan.',
  gameoverMessage = 'Permainan Selesai'
}) => {
  // Support quick replay with Space or Enter key when on game over
  useEffect(() => {
    if (gameState !== 'gameover' && gameState !== 'ready') return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        if (gameState === 'gameover') {
          onRestart();
        } else if (gameState === 'ready') {
          onStart();
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, onRestart, onStart]);

  if (gameState === 'playing') return null;

  const isNewRecord = score > 0 && score > highScore;
  const coinsEarned = score > 0 ? Math.max(2, Math.floor(score / 10)) : 0;
  const xpEarned = score > 0 ? Math.floor(score * 1.5) : 0;

  return (
    <>
      {/* Ready / Start Overlay */}
      {gameState === 'ready' && (
        <div className="absolute inset-0 bg-zinc-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/[0.06] flex items-center justify-center text-indigo-400 mb-4 shadow-md shadow-black/30">
            <Gamepad2 size={20} />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">
            Siap Bermain?
          </h3>
          <p className="text-zinc-400 text-xs sm:text-sm mb-6 max-w-[320px] leading-relaxed bg-zinc-900/80 border border-white/[0.06] p-4 rounded-xl font-normal shadow-sm">
            {instructions}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onStart(); }}
            className="bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden text-white min-h-[44px] px-8 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2 transition-all duration-150 ease-out cursor-pointer border border-indigo-500/20"
            aria-label="Mulai permainan dengan tombol spasi atau enter"
            autoFocus
          >
            <Play size={16} fill="currentColor" /> Mulai (Spasi)
          </button>
        </div>
      )}

      {/* Countdown Overlay */}
      {gameState === 'countdown' && (
        <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-center z-20">
          <div
            key={countdown}
            className="text-7xl sm:text-8xl font-black text-amber-400 tracking-tight animate-in zoom-in-75 duration-200 font-mono"
          >
            {countdown}
          </div>
        </div>
      )}

      {/* Paused Overlay */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 z-20 animate-in fade-in duration-150">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/[0.06] flex items-center justify-center text-amber-400 mb-4 shadow-md shadow-black/30">
            <Zap size={20} />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-6 tracking-tight">
            Permainan Dijeda
          </h3>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={(e) => { 
                e.stopPropagation(); 
                if (onResume) {
                  onResume();
                } else {
                  onStart();
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden text-white min-h-[44px] px-6 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-indigo-600/10 transition-all duration-150 ease-out cursor-pointer flex items-center justify-center gap-2 border border-indigo-500/20"
              aria-label="Lanjutkan Sesi Permainan"
              autoFocus
            >
              <Play size={16} fill="currentColor" /> Lanjutkan Sesi
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRestart(); }}
              className="bg-white/[0.03] hover:bg-white/[0.08] hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden text-zinc-300 hover:text-white border border-white/[0.06] min-h-[44px] px-6 py-2 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all duration-150 ease-out cursor-pointer"
              aria-label="Mulai ulang sesi permainan"
            >
              <RotateCcw size={14} /> Restart
            </button>
          </div>
        </div>
      )}

      {/* Standardized Console-Style Game Over Result Card */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 text-center z-30 pointer-events-auto overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-zinc-900 border border-white/[0.06] rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 my-auto shadow-black/60">
            {/* Header Status */}
            <div className="space-y-1 w-full flex flex-col items-center">
              {isNewRecord ? (
                <div className="space-y-2.5 w-full flex flex-col items-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
                    <Sparkles size={13} className="text-amber-400 animate-pulse" /> Rekor Baru Tercapai!
                  </div>
                  <div className="w-full bg-amber-500/[0.02] border border-amber-500/10 p-3.5 rounded-xl text-xs space-y-1">
                    <div className="text-zinc-500 font-medium font-sans">Melampaui Rekor Sebelumnya</div>
                    <div className="flex justify-center items-center gap-3 font-mono">
                      <span className="text-zinc-500 line-through text-xs">{highScore.toLocaleString()}</span>
                      <span className="text-zinc-400">➡️</span>
                      <span className="text-amber-400 font-bold text-sm">{score.toLocaleString()}</span>
                    </div>
                    <div className="text-emerald-400 font-bold text-[10px] font-mono mt-1">
                      Kenaikan Rekor: +{(score - highScore).toLocaleString()} poin!
                    </div>
                  </div>
                </div>
              ) : (
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {gameoverMessage}
                </h3>
              )}
            </div>

            {/* Final Score Display */}
            <div className="w-full bg-zinc-950/60 border border-white/[0.04] p-4.5 rounded-xl space-y-1 shadow-inner">
              <span className="text-xs text-zinc-400 font-medium font-sans">
                Skor Akhir
              </span>
              <div className="text-4xl sm:text-5xl font-black text-white tracking-tight font-mono">
                {score.toLocaleString()}
              </div>
              <div className="text-xs text-zinc-400 pt-1 flex items-center justify-center gap-1.5 font-sans">
                <Trophy size={13} className="text-amber-400" />
                <span>Rekor: <strong className="text-zinc-200">{Math.max(score, highScore).toLocaleString()}</strong></span>
              </div>
            </div>

            {/* Rewards & Metrics Row */}
            <div className="grid grid-cols-2 gap-2.5 w-full">
              <div className="bg-zinc-950/40 border border-white/[0.04] p-2.5 rounded-xl text-left flex items-center gap-2.5 shadow-sm">
                <Coins className="text-amber-400 w-4.5 h-4.5 shrink-0" />
                <div>
                  <div className="text-[10px] text-zinc-500 font-sans">Hadiah Koin</div>
                  <div className="text-xs font-bold text-amber-300 font-mono">+{coinsEarned} koin</div>
                </div>
              </div>

              <div className="bg-zinc-950/40 border border-white/[0.04] p-2.5 rounded-xl text-left flex items-center gap-2.5 shadow-sm">
                <Zap className="text-indigo-400 w-4.5 h-4.5 shrink-0" />
                <div>
                  <div className="text-[10px] text-zinc-500 font-sans">Bonus XP</div>
                  <div className="text-xs font-bold text-indigo-300 font-mono">+{xpEarned} XP</div>
                </div>
              </div>
            </div>

            {/* Primary Action Button: Play Again (1-click / Space) */}
            <button
              onClick={(e) => { e.stopPropagation(); onRestart(); }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden text-white font-semibold min-h-[44px] py-2.5 px-6 rounded-xl transition shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer select-none text-sm border border-indigo-500/20 transition-all duration-150 ease-out"
              aria-label="Main lagi untuk meraih skor yang lebih tinggi"
              autoFocus
            >
              <RotateCcw size={15} /> Main Lagi (Spasi)
            </button>

            {/* Secondary CTAs */}
            <div className="flex items-center justify-center gap-2 w-full pt-2.5 border-t border-white/[0.06]">
              {onOpenLeaderboard && (
                <button
                  onClick={onOpenLeaderboard}
                  className="flex-1 py-2 px-1.5 bg-white/[0.03] hover:bg-white/[0.07] hover:scale-[1.03] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden border border-white/[0.05] text-zinc-300 hover:text-white text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition duration-150 ease-out cursor-pointer min-h-[44px]"
                  title="Papan Skor"
                  aria-label="Buka papan skor atau papan peringkat"
                >
                  <Medal size={13} className="text-amber-400" /> Skor
                </button>
              )}

              {onOpenGameDrawer && (
                <button
                  onClick={onOpenGameDrawer}
                  className="flex-1 py-2 px-1.5 bg-white/[0.03] hover:bg-white/[0.07] hover:scale-[1.03] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden border border-white/[0.05] text-zinc-300 hover:text-white text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition duration-150 ease-out cursor-pointer min-h-[44px]"
                  title="Game Lain"
                  aria-label="Buka katalog game lain"
                >
                  <Gamepad2 size={13} className="text-indigo-400" /> Katalog
                </button>
              )}

              {onNavigateHome && (
                <button
                  onClick={onNavigateHome}
                  className="py-2 px-2.5 bg-white/[0.03] hover:bg-white/[0.07] hover:scale-[1.03] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden border border-white/[0.05] text-zinc-400 hover:text-white text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition duration-150 ease-out cursor-pointer min-h-[44px]"
                  title="Ke Home"
                  aria-label="Kembali ke Lobi Utama"
                >
                  <Home size={13} /> Lobi
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
