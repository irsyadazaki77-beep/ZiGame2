import React from 'react';
import { Trophy, Shield, RefreshCw, Swords, Maximize, Minimize } from 'lucide-react';
import { GameStats, CompetitiveRating } from '../../types';
import { audio } from '../../utils/audio';
import { RANKED_GAME_ALLOWLIST } from '../../config/competitiveConfig';

interface GameHUDBarProps {
  activeGame: GameStats;
  isRankedMode: boolean;
  setIsRankedMode: (val: boolean) => void;
  competitiveInfo: CompetitiveRating | undefined;
  onRestart: () => void;
  onOpenChallengeModal?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const GameHUDBar: React.FC<GameHUDBarProps> = ({
  activeGame,
  isRankedMode,
  setIsRankedMode,
  competitiveInfo,
  onRestart,
  onOpenChallengeModal,
  isFullscreen,
  onToggleFullscreen
}) => {
  const isRankedEligible = RANKED_GAME_ALLOWLIST.includes(activeGame.id as any);

  return (
    <div className="relative flex-none w-full max-w-5xl mt-1 sm:mt-2 bg-zinc-900/90 border border-white/[0.06] backdrop-blur-md px-2 py-1 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl flex flex-row items-center justify-between gap-1 sm:gap-2.5 font-sans shadow-lg shadow-black/20">
      {/* Left: Score & Highscore indicators */}
      <div className="flex items-center gap-1 sm:gap-2">
        <div 
          className="flex items-center gap-1 px-1.5 py-0.5 sm:px-3 sm:py-1 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-lg text-[9px] xs:text-[10px] sm:text-xs font-semibold select-none"
          title={`Skor Tertinggi: ${activeGame.highScore.toLocaleString()}`}
        >
          <Trophy size={10} className="text-amber-400 shrink-0" />
          <span className="font-mono">HI: <span className="hidden xs:inline">SCORE: </span>{activeGame.highScore.toLocaleString()}</span>
        </div>

        {isRankedEligible && (
          <button
            onClick={() => {
              audio.playCoin();
              setIsRankedMode(!isRankedMode);
              onRestart();
            }}
            aria-label="Toggle Mode Ranked Competitive"
            aria-pressed={isRankedMode}
            className={`flex items-center gap-1 px-1.5 py-0.5 sm:px-3 sm:py-1 border rounded-lg text-[9px] xs:text-[10px] sm:text-xs font-bold transition-all cursor-pointer select-none ${
              isRankedMode 
                ? 'bg-rose-500/15 border-rose-500/35 text-rose-400 animate-pulse' 
                : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${isRankedMode ? 'bg-rose-500 animate-ping' : 'bg-zinc-600'}`} />
            <span>{isRankedMode ? 'RANK' : 'NORM'}</span>
          </button>
        )}
      </div>

      {/* Right: Quick actions like competitive profile & quick retry */}
      <div className="flex items-center gap-1 sm:gap-2">
        {competitiveInfo && isRankedMode && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 sm:px-3 sm:py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg text-[9px] xs:text-[10px] sm:text-xs font-semibold select-none">
            <Shield size={10} className="text-emerald-400 animate-pulse shrink-0" />
            <span className="font-mono">{competitiveInfo.rating}<span className="hidden xs:inline"> pts</span></span>
          </div>
        )}

        {onToggleFullscreen && (
          <button
            onClick={() => {
              audio.playClick();
              onToggleFullscreen();
            }}
            className="px-1.5 py-0.5 sm:px-3 sm:py-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-teal-500/40 text-zinc-300 hover:text-white rounded-lg text-[9px] xs:text-[10px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 select-none"
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Mode Layar Penuh (Mobile & Desktop)'}
            aria-label="Toggle Layar Penuh"
          >
            {isFullscreen ? <Minimize size={11} className="text-teal-400 shrink-0" /> : <Maximize size={11} className="text-teal-400 shrink-0" />}
            <span className="hidden xs:inline">{isFullscreen ? 'KECIL' : 'FULLSCREEN'}</span>
          </button>
        )}

        {onOpenChallengeModal && (
          <button
            onClick={onOpenChallengeModal}
            className="px-1.5 py-0.5 sm:px-3 sm:py-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-indigo-500/40 text-zinc-300 hover:text-white rounded-lg text-[9px] xs:text-[10px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 select-none"
            title="Tantang Teman"
            aria-label="Tantang Teman"
          >
            <Swords size={11} className="text-indigo-400 shrink-0" />
            <span className="hidden xs:inline">TANTANG</span>
          </button>
        )}

        <button
          onClick={onRestart}
          className="px-2 py-0.5 sm:px-3.5 sm:py-1 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/25 text-white rounded-lg text-[9px] xs:text-[10px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 select-none"
          title="Ulangi Permainan"
          aria-label="Ulangi Permainan"
        >
          <RefreshCw size={10} className="shrink-0" />
          <span>RETRY</span>
        </button>
      </div>
    </div>
  );
};
