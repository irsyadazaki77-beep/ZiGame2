import React, { Suspense } from 'react';
import { RefreshCw, Sparkles, Minimize2, RotateCcw } from 'lucide-react';
import { GameStats } from '../../types';
import { GameErrorBoundary } from '../gameplay/GameErrorBoundary';
import { saveStateService } from '../../services/saveStateService';

import { GameViewportEffects } from './GameViewportEffects';

interface MemoizedGameFrameProps {
  GameComponent: React.ComponentType<any>;
  gameKey: number;
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
  gameTitle: string;
  onReset: () => void;
}

const MemoizedGameFrame = React.memo<MemoizedGameFrameProps>(({
  GameComponent,
  gameKey,
  onGameOver,
  onScoreUpdate,
  highScore,
  gameTitle,
  onReset,
}) => {
  return (
    <GameErrorBoundary gameTitle={gameTitle} onReset={onReset}>
      <Suspense
        fallback={
          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-[#090b10]">
            <RefreshCw size={26} className="animate-spin text-indigo-400 mb-3" />
            <span className="font-medium text-xs text-zinc-300">
              Merender {gameTitle}...
            </span>
          </div>
        }
      >
        <GameComponent
          key={gameKey}
          onGameOver={onGameOver}
          onScoreUpdate={onScoreUpdate}
          highScore={highScore}
        />
      </Suspense>
    </GameErrorBoundary>
  );
}, (prev, next) => {
  return (
    prev.GameComponent === next.GameComponent &&
    prev.gameKey === next.gameKey &&
    prev.highScore === next.highScore &&
    prev.gameTitle === next.gameTitle &&
    prev.onGameOver === next.onGameOver &&
    prev.onScoreUpdate === next.onScoreUpdate
  );
});

interface GameHeroCanvasProps {
  activeGame: GameStats;
  GameComponent: React.ComponentType<any> | null;
  gameKey: number;
  aspectRatio: string;
  isStartingSession: boolean;
  sessionError: string | null;
  isRankedMode: boolean;
  isCrtFilter: boolean;
  isFocusMode: boolean;
  setIsFocusMode: (val: boolean) => void;
  hasExistingSave: boolean;
  setHasExistingSave: (val: boolean) => void;
  controlsHint?: string;
  onRestart: () => void;
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
}

export const GameHeroCanvas: React.FC<GameHeroCanvasProps> = ({
  activeGame,
  GameComponent,
  gameKey,
  aspectRatio,
  isStartingSession,
  sessionError,
  isRankedMode,
  isCrtFilter,
  isFocusMode,
  setIsFocusMode,
  hasExistingSave,
  setHasExistingSave,
  controlsHint,
  onRestart,
  onGameOver,
  onScoreUpdate
}) => {
  return (
    <>
      {/* Floating Focus Mode Banner */}
      {isFocusMode && (
        <div className="w-full max-w-5xl flex items-center justify-between px-3 py-1.5 bg-zinc-950/80 border border-white/[0.08] rounded-xl mb-2 text-xs font-mono">
          <div className="flex items-center gap-2 text-indigo-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span>FOCUS THEATER MODE AKTIF</span>
          </div>
          <button
            onClick={() => setIsFocusMode(false)}
            className="px-2 py-0.5 bg-white/[0.08] hover:bg-white/[0.15] text-zinc-300 rounded text-[10px] flex items-center gap-1 cursor-pointer transition"
          >
            <Minimize2 size={12} /> Keluar (F)
          </button>
        </div>
      )}

      {/* Save-State Restore Prompt Banner */}
      {hasExistingSave && (
        <div className="w-full max-w-5xl mb-2 p-2.5 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl flex items-center justify-between gap-3 text-xs font-sans">
          <div className="flex items-center gap-2 text-indigo-200">
            <RotateCcw size={14} className="text-indigo-400" />
            <span>Ditemukan progres permainan yang tersimpan dari sesi sebelumnya.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                saveStateService.clearState(activeGame.id);
                setHasExistingSave(false);
                onRestart();
              }}
              className="px-2.5 py-1 text-[11px] font-mono text-zinc-400 hover:text-white transition cursor-pointer"
            >
              Mulai Baru
            </button>
            <button
              onClick={() => setHasExistingSave(false)}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-mono font-bold transition cursor-pointer"
            >
              Lanjutkan
            </button>
          </div>
        </div>
      )}

      {/* Clean Focused Canvas Stage with GameViewportEffects */}
      <div className="flex-1 w-full max-w-5xl flex items-center justify-center relative min-h-0 p-1 sm:p-4">
        <GameViewportEffects isCrtFilter={isCrtFilter}>
          <div 
            className="relative w-full h-full max-w-full max-h-full flex items-center justify-center bg-[#090b10] border border-white/[0.08] rounded-xl sm:rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden transition-all duration-300"
            style={{
              boxShadow: `0 4px 24px rgba(0,0,0,0.6)`,
              aspectRatio,
            }}
          >
            {isStartingSession ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-[#090b10]">
                <RefreshCw size={26} className="animate-spin text-indigo-400 mb-3" />
                <span className="font-medium text-xs text-zinc-300">
                  {isRankedMode ? 'Memvalidasi Tiket Ranked...' : `Memuat ${activeGame.title}...`}
                </span>
              </div>
            ) : sessionError ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-[#090b10]">
                <div className="text-rose-500 mb-3 text-2xl">⚠️</div>
                <span className="font-medium text-sm text-zinc-300 mb-4">{sessionError}</span>
                <button onClick={onRestart} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 transition rounded-xl text-xs font-bold text-white cursor-pointer">Coba Lagi</button>
              </div>
            ) : GameComponent ? (
              <MemoizedGameFrame
                GameComponent={GameComponent}
                gameKey={gameKey}
                onGameOver={onGameOver}
                onScoreUpdate={onScoreUpdate}
                highScore={activeGame.highScore}
                gameTitle={activeGame.title}
                onReset={onRestart}
              />
            ) : (
              <div className="text-center p-8">
                <Sparkles size={32} className="text-amber-400 mx-auto mb-2" />
                <h3 className="font-semibold text-sm text-white">Modul Game Sedang Dikembangkan</h3>
              </div>
            )}
          </div>
        </GameViewportEffects>
      </div>

      {/* 1-Line Controls Hint Strip */}
      {controlsHint && (
        <div className="w-full max-w-5xl px-3 py-1 text-center text-[11px] text-zinc-400 truncate select-none">
          <span className="text-indigo-400 font-semibold">Kontrol:</span> {controlsHint}
        </div>
      )}
    </>
  );
};

