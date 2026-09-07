import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Play, CircleDot } from 'lucide-react';
import { audio } from '../../utils/audio';

interface MobileTouchControlsProps {
  visible: boolean;
  controlType?: string;
}

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({ visible, controlType = 'directional-action' }) => {
  if (!visible) return null;

  const showDPad = controlType === 'directional' || controlType === 'directional-action';
  const showAction = controlType === 'action' || controlType === 'directional-action';

  if (!showDPad && !showAction) return null;

  const dispatchKey = (keyName: string, codeName: string, type: 'keydown' | 'keyup') => {
    try {
      const event = new KeyboardEvent(type, {
        key: keyName,
        code: codeName,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(event);
    } catch (e) {
      console.warn("Touch dispatch exception:", e);
    }
  };

  const handleTouchStart = (keyName: string, codeName: string, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    audio.playHit();
    dispatchKey(keyName, codeName, 'keydown');
  };

  const handleTouchEnd = (keyName: string, codeName: string, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    dispatchKey(keyName, codeName, 'keyup');
  };

  return (
    <div 
      className="lg:hidden flex-none py-2 px-3 sm:px-6 bg-[#080a0f]/95 backdrop-blur-md border-t border-white/[0.06] flex items-center justify-between select-none touch-none w-full max-w-lg mx-auto pb-safe"
      id="virtual-mobile-gamepad-deck"
    >
      {/* D-Pad Controller */}
      {showDPad ? (
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 bg-[#121622] rounded-2xl border border-white/[0.08] p-1 flex items-center justify-center shadow-lg shrink-0">
          <button
            onTouchStart={(e) => handleTouchStart('ArrowUp', 'ArrowUp', e)}
            onTouchEnd={(e) => handleTouchEnd('ArrowUp', 'ArrowUp', e)}
            onMouseDown={(e) => handleTouchStart('ArrowUp', 'ArrowUp', e)}
            onMouseUp={(e) => handleTouchEnd('ArrowUp', 'ArrowUp', e)}
            className="absolute top-1 w-9 h-9 bg-[#1a2030] active:bg-indigo-600 rounded-xl flex items-center justify-center text-zinc-200 active:text-white border border-white/[0.06] cursor-pointer active:scale-95 transition-all"
            aria-label="Atas"
          >
            <ArrowUp size={18} />
          </button>

          <button
            onTouchStart={(e) => handleTouchStart('ArrowLeft', 'ArrowLeft', e)}
            onTouchEnd={(e) => handleTouchEnd('ArrowLeft', 'ArrowLeft', e)}
            onMouseDown={(e) => handleTouchStart('ArrowLeft', 'ArrowLeft', e)}
            onMouseUp={(e) => handleTouchEnd('ArrowLeft', 'ArrowLeft', e)}
            className="absolute left-1 w-9 h-9 bg-[#1a2030] active:bg-indigo-600 rounded-xl flex items-center justify-center text-zinc-200 active:text-white border border-white/[0.06] cursor-pointer active:scale-95 transition-all"
            aria-label="Kiri"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="w-6 h-6 rounded-full bg-[#0d1017] border border-white/[0.04] flex items-center justify-center">
            <CircleDot size={12} className="text-zinc-600" />
          </div>

          <button
            onTouchStart={(e) => handleTouchStart('ArrowRight', 'ArrowRight', e)}
            onTouchEnd={(e) => handleTouchEnd('ArrowRight', 'ArrowRight', e)}
            onMouseDown={(e) => handleTouchStart('ArrowRight', 'ArrowRight', e)}
            onMouseUp={(e) => handleTouchEnd('ArrowRight', 'ArrowRight', e)}
            className="absolute right-1 w-9 h-9 bg-[#1a2030] active:bg-indigo-600 rounded-xl flex items-center justify-center text-zinc-200 active:text-white border border-white/[0.06] cursor-pointer active:scale-95 transition-all"
            aria-label="Kanan"
          >
            <ArrowRight size={18} />
          </button>

          <button
            onTouchStart={(e) => handleTouchStart('ArrowDown', 'ArrowDown', e)}
            onTouchEnd={(e) => handleTouchEnd('ArrowDown', 'ArrowDown', e)}
            onMouseDown={(e) => handleTouchStart('ArrowDown', 'ArrowDown', e)}
            onMouseUp={(e) => handleTouchEnd('ArrowDown', 'ArrowDown', e)}
            className="absolute bottom-1 w-9 h-9 bg-[#1a2030] active:bg-indigo-600 rounded-xl flex items-center justify-center text-zinc-200 active:text-white border border-white/[0.06] cursor-pointer active:scale-95 transition-all"
            aria-label="Bawah"
          >
            <ArrowDown size={18} />
          </button>
        </div>
      ) : <div />}

      {/* Action Buttons */}
      {showAction ? (
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onTouchStart={(e) => handleTouchStart(' ', 'Space', e)}
            onTouchEnd={(e) => handleTouchEnd(' ', 'Space', e)}
            onMouseDown={(e) => handleTouchStart(' ', 'Space', e)}
            onMouseUp={(e) => handleTouchEnd(' ', 'Space', e)}
            className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-400 text-white font-mono font-bold text-xs border border-indigo-400/30 shadow-md shadow-indigo-950/60 flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95 transition-all"
            aria-label="Aksi / Tembak / Lompat"
          >
            <Play size={18} className="rotate-[-90deg]" />
            <span className="text-[10px] tracking-wider">ACTION</span>
          </button>
        </div>
      ) : <div />}
    </div>
  );
};
