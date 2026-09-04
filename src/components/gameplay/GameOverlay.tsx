import React from 'react';
import { Play, RotateCcw, Trophy, Sparkles, Home, Gamepad2, Medal, Zap } from 'lucide-react';

export type GameState = 'ready' | 'countdown' | 'playing' | 'paused' | 'gameover' | 'levelcomplete';

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
  instructions = 'Tap, click, atau gunakan kontrol untuk bermain.',
  gameoverMessage = 'GAME OVER'
}) => {
  if (gameState === 'playing') return null;

  const isNewRecord = score > 0 && score > highScore;
  const coinsEarned = score > 0 ? Math.max(2, Math.floor(score / 10)) : 0;
  const xpEarned = score > 0 ? Math.floor(score * 1.5) : 0;

  return (
    <>
      {/* Ready / Start Overlay */}
      {gameState === 'ready' && (
        <div className="absolute inset-0 bg-zinc-950/90 flex flex-col items-center justify-center p-6 text-center z-20 transition-all duration-300">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3">
            <Gamepad2 size={24} />
          </div>
          <h3 className="font-display font-black text-2xl md:text-3xl text-indigo-400 mb-2 tracking-widest drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]">
            SIAP BERMAIN?
          </h3>
          <p className="text-zinc-300 font-sans text-xs md:text-sm mb-6 max-w-[320px] leading-relaxed border border-zinc-800 bg-zinc-900/60 p-4 rounded-2xl shadow-inner">
            {instructions}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onStart(); }}
            className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 min-h-[48px] px-10 py-3.5 rounded-2xl font-bold font-display tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer select-none text-sm"
          >
            <Play size={18} fill="currentColor" /> MULAI SEKARANG
          </button>
        </div>
      )}

      {/* Countdown Overlay */}
      {gameState === 'countdown' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
          <div
            key={countdown}
            className="text-8xl font-black font-display text-amber-400 drop-shadow-[0_0_30px_rgba(245,158,11,0.8)] animate-bounce scale-110"
          >
            {countdown}
          </div>
        </div>
      )}

      {/* Paused Overlay */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 z-20">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3">
            <Zap size={24} />
          </div>
          <h3 className="font-display font-black text-3xl md:text-4xl text-indigo-400 mb-6 tracking-widest drop-shadow-[0_0_15px_rgba(99,102,241,0.4)]">
            DIPAUZE
          </h3>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={(e) => { e.stopPropagation(); onResume ? onResume() : onStart(); }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white min-h-[48px] px-8 py-3 rounded-2xl font-bold font-display tracking-wider shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center justify-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer text-sm"
            >
              <Play size={18} fill="currentColor" /> LANJUTKAN BERMAIN
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRestart(); }}
              className="bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 min-h-[44px] px-8 py-2.5 rounded-2xl font-bold font-mono text-xs tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw size={14} /> RESTART PERMAINAN
            </button>
          </div>
        </div>
      )}

      {/* Standardized Rich Game Over Experience */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 text-center z-30 pointer-events-auto overflow-y-auto">
          <div className="w-full max-w-sm bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col items-center gap-4 my-auto">
            {/* Header / New High Score Badge */}
            <div className="space-y-1">
              {isNewRecord ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[11px] font-mono font-bold tracking-wider uppercase animate-pulse">
                  <Sparkles size={12} /> REKOR BARU TERCAPAI!
                </div>
              ) : (
                <span className="text-rose-500 font-display font-black text-2xl uppercase tracking-widest">
                  {gameoverMessage}
                </span>
              )}
            </div>

            {/* Final Score Display */}
            <div className="w-full bg-zinc-950/80 border border-zinc-800/80 p-4 rounded-2xl space-y-1">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">
                SKOR AKHIR
              </span>
              <div className="text-4xl sm:text-5xl font-black font-display text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 tracking-wider">
                {score.toLocaleString()}
              </div>
            </div>

            {/* Rewards & Metrics Row */}
            <div className="grid grid-cols-2 gap-2.5 w-full">
              <div className="bg-zinc-950/60 border border-zinc-800/60 p-2.5 rounded-xl text-left flex items-center gap-2.5">
                <span className="text-lg">🪙</span>
                <div>
                  <div className="text-[9px] font-mono text-zinc-500 uppercase">Koin Diperoleh</div>
                  <div className="text-xs font-mono font-bold text-amber-400">+{coinsEarned} Coins</div>
                </div>
              </div>

              <div className="bg-zinc-950/60 border border-zinc-800/60 p-2.5 rounded-xl text-left flex items-center gap-2.5">
                <span className="text-lg">⚡</span>
                <div>
                  <div className="text-[9px] font-mono text-zinc-500 uppercase">XP Diperoleh</div>
                  <div className="text-xs font-mono font-bold text-indigo-400">+{xpEarned} XP</div>
                </div>
              </div>
            </div>

            {/* Personal Best info */}
            <div className="w-full flex items-center justify-between px-3 py-2 bg-zinc-950/40 border border-zinc-800/50 rounded-xl text-xs font-mono">
              <span className="text-zinc-500 flex items-center gap-1">
                <Trophy size={13} className="text-amber-400" /> Personal Best:
              </span>
              <span className="font-bold text-zinc-200">{Math.max(score, highScore).toLocaleString()}</span>
            </div>

            {/* Primary Action Button: Play Again */}
            <button
              onClick={(e) => { e.stopPropagation(); onRestart(); }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold min-h-[48px] py-3 px-6 rounded-2xl font-display tracking-wider transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center justify-center gap-2 cursor-pointer select-none text-sm uppercase"
            >
              <RotateCcw size={16} /> MAIN LAGI
            </button>

            {/* Secondary CTAs */}
            <div className="flex items-center justify-center gap-2 w-full pt-1 border-t border-zinc-800/60">
              {onOpenLeaderboard && (
                <button
                  onClick={onOpenLeaderboard}
                  className="flex-1 py-2 px-2.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-amber-400 text-[11px] font-mono font-bold rounded-xl flex items-center justify-center gap-1 transition cursor-pointer"
                  title="Papan Skor"
                >
                  <Medal size={13} /> Leaderboard
                </button>
              )}

              {onOpenGameDrawer && (
                <button
                  onClick={onOpenGameDrawer}
                  className="flex-1 py-2 px-2.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-indigo-400 text-[11px] font-mono font-bold rounded-xl flex items-center justify-center gap-1 transition cursor-pointer"
                  title="Game Lain"
                >
                  <Gamepad2 size={13} /> Game Lain
                </button>
              )}

              {onNavigateHome && (
                <button
                  onClick={onNavigateHome}
                  className="py-2 px-3 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white text-[11px] font-mono font-bold rounded-xl flex items-center justify-center gap-1 transition cursor-pointer"
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

