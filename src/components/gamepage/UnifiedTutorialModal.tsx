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
      className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none font-sans animate-fade-in"
      id="game-unified-tutorial-modal"
    >
      <div className="bg-[#0e121c] border border-indigo-500/40 rounded-3xl max-w-xl w-full overflow-hidden shadow-[0_0_50px_rgba(99,102,241,0.25)] relative flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#0d1017] via-indigo-950/40 to-[#0d1017] border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl p-2 rounded-2xl bg-zinc-900/90 border border-white/[0.08] shadow-inner">
              {game.icon}
            </span>
            <div>
              <div className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                <Gamepad2 size={12} /> PANDUAN RESMI ARKADE
              </div>
              <h2 className="text-lg sm:text-xl font-black font-display text-white uppercase tracking-wider">
                {game.title}
              </h2>
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
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 text-zinc-300">
          {/* Objective & Personal Record */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 p-3.5 bg-black/40 border border-white/[0.06] rounded-2xl space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Lightbulb size={14} />
                <span>Objektif Utama</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                {tutorial.objective}
              </p>
            </div>

            <div className="p-3.5 bg-black/40 border border-white/[0.06] rounded-2xl flex flex-col justify-center space-y-1 font-mono">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">REKOR PRIBADI</div>
              <div className="text-lg font-bold text-amber-400 font-display">
                {(game.highScore || 0).toLocaleString()}{' '}
                <span className="text-[10px] font-mono text-zinc-500">PTS</span>
              </div>
              <div className="text-[10px] text-indigo-400 font-bold uppercase">
                TINGKAT: {game.difficulty || 'MEDIUM'}
              </div>
            </div>
          </div>

          {/* Controls Box (Responsive to active input) */}
          <div className="p-3.5 bg-black/40 border border-white/[0.06] rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                <Keyboard size={15} />
                <span>Kontrol Permainan</span>
              </div>
              {isGamepadConnected && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
                  🎮 Gamepad Terdeteksi
                </span>
              )}
            </div>

            {/* Keyboard shortcuts */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">Keyboard / PC:</div>
              <div className="flex flex-wrap gap-1.5">
                {tutorial.controls.keyboard.map((k, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-zinc-800 border border-white/[0.1] text-white font-mono font-bold text-xs rounded-lg shadow-sm"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>

            {/* Gamepad / Controller */}
            {tutorial.controls.gamepad && (
              <div className="space-y-1.5 pt-1 border-t border-white/[0.04]">
                <div className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">Gamepad Controller:</div>
                <div className="flex flex-wrap gap-1.5">
                  {tutorial.controls.gamepad.map((k, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-indigo-950/50 border border-indigo-500/30 text-indigo-200 font-mono font-bold text-xs rounded-lg"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Touch / Mobile */}
            <div className="space-y-1.5 pt-1 border-t border-white/[0.04]">
              <div className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">Sentuhan Layar / Mobile:</div>
              <div className="text-xs text-zinc-300 font-sans">
                {tutorial.controls.touch.join(' • ')}
              </div>
            </div>
          </div>

          {/* Scoring Rules & Pro Tips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Scoring */}
            <div className="p-3.5 bg-indigo-950/20 border border-indigo-500/20 rounded-2xl space-y-2">
              <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-indigo-400" />
                <span>Sistem Poin & Skor</span>
              </div>
              <ul className="space-y-1 text-xs text-zinc-300 font-sans list-disc list-inside leading-relaxed">
                {tutorial.scoring.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>

            {/* Pro Tips & Advanced Mechanic */}
            <div className="p-3.5 bg-amber-950/20 border border-amber-500/20 rounded-2xl space-y-2">
              <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Zap size={13} className="text-amber-400" />
                <span>Tips Pro & Taktik</span>
              </div>
              <div className="text-xs text-zinc-300 space-y-1.5 font-sans leading-relaxed">
                <p className="font-semibold text-amber-200/90">{tutorial.firstPlayHint}</p>
                {tutorial.advancedMechanic && (
                  <p className="text-[11px] text-zinc-400">{tutorial.advancedMechanic}</p>
                )}
              </div>
            </div>
          </div>

          {/* Don't show again checkbox */}
          <label className="flex items-center gap-2.5 text-xs text-zinc-400 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-0 cursor-pointer"
            />
            <span>Jangan tampilkan panduan ini secara otomatis lagi untuk game ini</span>
          </label>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-[#0d1017] border-t border-white/[0.08] flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 font-mono font-bold text-xs transition cursor-pointer"
          >
            Lewati
          </button>
          <button
            onClick={handleStart}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs shadow-[0_0_20px_rgba(99,102,241,0.3)] transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Play size={14} className="fill-white" />
            MULAI BERMAIN
          </button>
        </div>
      </div>
    </div>
  );
};
