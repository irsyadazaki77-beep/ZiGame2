import React, { useState } from 'react';
import { Gamepad2, Lightbulb, Keyboard, MousePointer, CheckCircle2, Play, X } from 'lucide-react';
import { GameStats } from '../../types';
import { audio } from '../../utils/audio';

interface GameTutorialModalProps {
  game: GameStats;
  controls: {
    keys?: string[];
    mouse?: string;
    tips: string;
  };
  onClose: () => void;
  onStartGame: () => void;
}

export const GameTutorialModal: React.FC<GameTutorialModalProps> = ({
  game,
  controls,
  onClose,
  onStartGame,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleStart = () => {
    audio.playCoin();
    if (dontShowAgain) {
      try {
        localStorage.setItem(`tutorial_disabled_${game.id}`, 'true');
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }
    }
    onStartGame();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none font-sans animate-fade-in" id="game-onboarding-modal">
      <div className="bg-zinc-900 border-2 border-indigo-500/50 rounded-3xl max-w-lg w-full overflow-hidden shadow-[0_0_50px_rgba(99,102,241,0.3)] relative flex flex-col">
        {/* Header Bar */}
        <div className="p-5 md:p-6 bg-gradient-to-r from-zinc-950 via-indigo-950/50 to-zinc-950 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl p-2 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-md">{game.icon}</span>
            <div>
              <div className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                <Gamepad2 size={12} /> PANDUAN CARA BERMAIN
              </div>
              <h2 className="text-lg md:text-xl font-black font-display text-white uppercase tracking-wider">
                {game.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 md:p-6 space-y-5 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 text-zinc-300">
          {/* Mission Objective & Personal Best Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 p-4 bg-zinc-950/80 border border-zinc-800 rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Lightbulb size={15} />
                <span>Tujuan Game</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                {game.description}
              </p>
            </div>

            <div className="p-4 bg-zinc-950/80 border border-zinc-800 rounded-2xl flex flex-col justify-center space-y-1 font-mono">
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">REKOR PRIBADI</div>
              <div className="text-xl font-bold text-amber-400 font-display">
                {(game.highScore || 0).toLocaleString()} <span className="text-[10px] font-mono text-zinc-500">PTS</span>
              </div>
              <div className="text-[10px] text-indigo-400 font-bold uppercase pt-1">
                TINGKAT: {game.difficulty || 'MEDIUM'}
              </div>
            </div>
          </div>

          {/* Controls Box */}
          <div className="p-4 bg-zinc-950/80 border border-zinc-800 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
              <Keyboard size={16} />
              <span>Kontrol Tombol & Navigasi</span>
            </div>

            {controls.keys && controls.keys.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {controls.keys.map((k, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 bg-zinc-800 border-2 border-t-zinc-700 border-b-zinc-950 border-x-zinc-800 text-white font-mono font-bold text-xs rounded-lg shadow"
                  >
                    {k}
                  </span>
                ))}
              </div>
            )}

            {controls.mouse && (
              <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                <MousePointer size={14} className="text-zinc-500" />
                <span>Input Tambahan: <strong className="text-zinc-200">{controls.mouse}</strong></span>
              </div>
            )}
          </div>

          {/* Pro Tips Box */}
          <div className="p-4 bg-indigo-950/20 border border-indigo-500/20 rounded-2xl space-y-1.5">
            <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-indigo-400" />
              <span>Strategi Meraih Skor Tinggi:</span>
            </div>
            <p className="text-xs text-zinc-300 font-mono leading-relaxed">
              {controls.tips}
            </p>
          </div>

          {/* Don't show again checkbox */}
          <label className="flex items-center gap-2.5 text-xs text-zinc-400 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-0 cursor-pointer"
            />
            <span>Jangan tampilkan panduan ini secara otomatis lagi untuk {game.title}</span>
          </label>
        </div>

        {/* Modal Footer */}
        <div className="p-4 md:p-5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono font-bold text-xs transition cursor-pointer"
          >
            Nanti Saja
          </button>
          <button
            onClick={handleStart}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs shadow-[0_0_20px_rgba(99,102,241,0.4)] transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Play size={14} className="fill-white" />
            PAHAM, MULAI MAIN!
          </button>
        </div>
      </div>
    </div>
  );
};
