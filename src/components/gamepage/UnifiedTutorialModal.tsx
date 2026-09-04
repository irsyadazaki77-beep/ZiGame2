import React, { useState } from 'react';
import { Gamepad2, Lightbulb, Keyboard, MousePointer, CheckCircle2, Play, X, Zap, Sparkles } from 'lucide-react';
import { GameStats } from '../../types';
import { getTutorialForGame } from '../../config/gameTutorials';
import { audio } from '../../utils/audio';
import { inputManager } from '../../services/inputService';

interface UnifiedTutorialModalProps {
  game: GameStats;
  onClose: () => void;
  onStartGame: () => void;
}

export const UnifiedTutorialModal: React.FC<UnifiedTutorialModalProps> = ({
  game,
  onClose,
  onStartGame
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const activeInputSource = inputManager.getActiveSource();
  const isGamepadConnected = inputManager.isGamepadConnected();

  const tutorial = getTutorialForGame(game.id, game.title, game.description);

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
    <div
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none font-sans"
      id="game-unified-tutorial-modal"
    >
      <div className="bg-[#11151f] border border-white/[0.08] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl shadow-black/90 relative flex flex-col max-h-[88vh]">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-[#0d1017] border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl w-10 h-10 rounded-xl bg-[#181c2b] border border-white/[0.08] flex items-center justify-center shrink-0">
              {game.icon}
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-white">
                {game.title}
              </h2>
              <div className="text-xs text-zinc-400 flex items-center gap-2">
                <span>Panduan Bermain</span>
                <span>•</span>
                <span className="text-amber-400 font-medium">Rekor: {(game.highScore || 0).toLocaleString()} pts</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-zinc-300 text-xs">
          {/* Objective */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-zinc-200 font-semibold">
              <Lightbulb size={14} className="text-amber-400" />
              <span>Objektif Permainan</span>
            </div>
            <p className="text-zinc-300 leading-relaxed pl-5 font-normal">
              {tutorial.objective}
            </p>
          </div>

          {/* Controls */}
          <div className="space-y-2.5 pt-3 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-zinc-200 font-semibold">
                <Keyboard size={14} className="text-indigo-400" />
                <span>Kontrol</span>
              </div>
              {isGamepadConnected && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-medium">
                  Gamepad Terhubung
                </span>
              )}
            </div>

            {/* Keyboard Keys */}
            <div className="space-y-1.5 pl-5">
              <div className="text-[11px] text-zinc-400 font-medium">Keyboard:</div>
              <div className="flex flex-wrap gap-1.5">
                {tutorial.controls.keyboard.map((k, i) => (
                  <kbd
                    key={i}
                    className="px-2 py-1 bg-[#181c2b] border border-white/[0.1] text-zinc-100 font-mono text-[11px] font-semibold rounded-md shadow-sm"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>

            {/* Gamepad */}
            {tutorial.controls.gamepad && (
              <div className="space-y-1.5 pl-5 pt-1">
                <div className="text-[11px] text-zinc-400 font-medium">Gamepad:</div>
                <div className="flex flex-wrap gap-1.5">
                  {tutorial.controls.gamepad.map((k, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-indigo-950/40 border border-indigo-500/20 text-indigo-200 font-mono text-[11px] font-medium rounded-md"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Touch / Mobile */}
            <div className="space-y-1 pl-5 pt-1">
              <div className="text-[11px] text-zinc-400 font-medium">Layar Sentuh (Mobile):</div>
              <div className="text-zinc-300">
                {tutorial.controls.touch.join(' • ')}
              </div>
            </div>
          </div>

          {/* Scoring & Pro Tip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/[0.06]">
            {/* Scoring */}
            <div className="p-3 bg-[#161a27] border border-white/[0.05] rounded-xl space-y-1.5">
              <div className="text-zinc-200 font-semibold flex items-center gap-1.5">
                <Sparkles size={13} className="text-indigo-400" />
                <span>Sistem Skor</span>
              </div>
              <ul className="space-y-1 text-zinc-400 list-disc list-inside leading-relaxed text-[11px]">
                {tutorial.scoring.slice(0, 3).map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>

            {/* Pro Tip */}
            <div className="p-3 bg-[#161a27] border border-white/[0.05] rounded-xl space-y-1.5">
              <div className="text-zinc-200 font-semibold flex items-center gap-1.5">
                <Zap size={13} className="text-amber-400" />
                <span>Tips Taktik</span>
              </div>
              <p className="text-zinc-400 leading-relaxed text-[11px]">
                {tutorial.firstPlayHint}
              </p>
            </div>
          </div>

          {/* Don't show again checkbox */}
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-white/20 bg-zinc-900 text-indigo-600 focus:ring-0 cursor-pointer"
            />
            <span>Jangan tampilkan panduan ini otomatis lagi untuk game ini</span>
          </label>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#0d1017] border-t border-white/[0.06] flex items-center justify-end gap-2.5 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white text-xs font-medium transition cursor-pointer"
          >
            Tutup
          </button>
          <button
            onClick={handleStart}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm shadow-indigo-600/20 transition flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <Play size={13} fill="currentColor" />
            Mulai Bermain
          </button>
        </div>
      </div>
    </div>
  );
};
