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
        <div className="absolute inset-0 bg-[#090b10]/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20 animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-indigo-400 mb-3.5">
            <Gamepad2 size={22} />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">
            Siap Bermain?
          </h3>
          <p className="text-zinc-400 text-xs sm:text-sm mb-6 max-w-[320px] leading-relaxed bg-[#11151f]/80 border border-white/[0.06] p-3.5 rounded-xl font-normal">
            {instructions}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onStart(); }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white min-h-[44px] px-8 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
          >
            <Play size={16} fill="currentColor" /> Mulai (Spasi)
          </button>
        </div>
      )}

      {/* Countdown Overlay */}
      {gameState === 'countdown' && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center z-20">
          <div
            key={countdown}
            className="text-7xl sm:text-8xl font-black text-amber-400 tracking-tight animate-in zoom-in-75 duration-200"
          >
            {countdown}
          </div>
        </div>
      )}

      {/* Paused Overlay */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 bg-[#090b10]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 z-20 animate-in fade-in duration-150">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-amber-400 mb-3">
            <Zap size={22} />
          </div>
          <h3 className="text-2xl font-bold text-white mb-6 tracking-tight">
            Permainan Dijeda
          </h3>
          <div className="flex flex-col gap-2.5 w-full max-w-xs">
            <button
              onClick={(e) => { e.stopPropagation(); onResume ? onResume() : onStart(); }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white min-h-[44px] px-6 py-2.5 rounded-xl font-semibold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
            >
              <Play size={16} fill="currentColor" /> Lanjutkan Sesi
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRestart(); }}
              className="bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.08] min-h-[40px] px-6 py-2 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw size={14} /> Restart
            </button>
          </div>
        </div>
      )}

      {/* Standardized Console-Style Game Over Result Card */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 text-center z-30 pointer-events-auto overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#11151f] border border-white/[0.08] rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 my-auto">
            {/* Header Status */}
            <div className="space-y-1">
              {isNewRecord ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                  <Sparkles size={13} /> Rekor Baru Tercapai!
                </div>
              ) : (
                <h3 className="text-xl font-bold text-white tracking-tight">
                  {gameoverMessage}
                </h3>
              )}
            </div>

            {/* Final Score Display */}
            <div className="w-full bg-[#090b10] border border-white/[0.06] p-4 rounded-xl space-y-0.5">
              <span className="text-xs text-zinc-400 font-medium">
                Skor Akhir
              </span>
              <div className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                {score.toLocaleString()}
              </div>
              <div className="text-xs text-zinc-400 pt-1 flex items-center justify-center gap-1.5">
                <Trophy size={13} className="text-amber-400" />
                <span>Rekor: <strong className="text-zinc-200">{Math.max(score, highScore).toLocaleString()}</strong></span>
              </div>
            </div>

            {/* Rewards & Metrics Row */}
            <div className="grid grid-cols-2 gap-2.5 w-full">
              <div className="bg-[#090b10]/60 border border-white/[0.06] p-2.5 rounded-xl text-left flex items-center gap-2.5">
                <Coins className="text-amber-400 w-5 h-5 shrink-0" />
                <div>
                  <div className="text-[11px] text-zinc-400">Hadiah Koin</div>
                  <div className="text-xs font-semibold text-amber-300">+{coinsEarned} koin</div>
                </div>
              </div>

              <div className="bg-[#090b10]/60 border border-white/[0.06] p-2.5 rounded-xl text-left flex items-center gap-2.5">
                <Zap className="text-indigo-400 w-5 h-5 shrink-0" />
                <div>
                  <div className="text-[11px] text-zinc-400">Bonus XP</div>
                  <div className="text-xs font-semibold text-indigo-300">+{xpEarned} XP</div>
                </div>
              </div>
            </div>

            {/* Primary Action Button: Play Again (1-click / Space) */}
            <button
              onClick={(e) => { e.stopPropagation(); onRestart(); }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold min-h-[44px] py-2.5 px-6 rounded-xl transition shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer select-none text-sm active:scale-98"
            >
              <RotateCcw size={15} /> Main Lagi (Spasi)
            </button>

            {/* Secondary CTAs */}
            <div className="flex items-center justify-center gap-2 w-full pt-2 border-t border-white/[0.06]">
              {onOpenLeaderboard && (
                <button
                  onClick={onOpenLeaderboard}
                  className="flex-1 py-2 px-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 hover:text-white text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Papan Skor"
                >
                  <Medal size={13} className="text-amber-400" /> Skor
                </button>
              )}

              {onOpenGameDrawer && (
                <button
                  onClick={onOpenGameDrawer}
                  className="flex-1 py-2 px-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 hover:text-white text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Game Lain"
                >
                  <Gamepad2 size={13} className="text-indigo-400" /> Katalog
                </button>
              )}

              {onNavigateHome && (
                <button
                  onClick={onNavigateHome}
                  className="py-2 px-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 hover:text-white text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Ke Home"
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
