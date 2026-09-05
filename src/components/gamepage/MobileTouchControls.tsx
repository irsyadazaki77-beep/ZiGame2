import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Play } from 'lucide-react';
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
      className="lg:hidden flex-none py-2.5 sm:py-3 px-3 sm:px-6 bg-zinc-950/95 border-t border-white/[0.08] flex items-center justify-between select-none touch-none w-full max-w-lg mx-auto pb-safe"
      id="virtual-mobile-gamepad-deck"
    >
      {/* D-Pad Controller */}
      {showDPad ? (
        <div className="relative w-28 h-28 sm:w-34 sm:h-34 bg-zinc-900/90 rounded-full border border-zinc-800 p-1.5 flex items-center justify-center shadow-xl shrink-0">
          <button
            onTouchStart={(e) => handleTouchStart('ArrowUp', 'ArrowUp', e)}
            onTouchEnd={(e) => handleTouchEnd('ArrowUp', 'ArrowUp', e)}
            onMouseDown={(e) => handleTouchStart('ArrowUp', 'ArrowUp', e)}
            onMouseUp={(e) => handleTouchEnd('ArrowUp', 'ArrowUp', e)}
            className="absolute top-1 sm:top-2 w-8 h-8 sm:w-9 sm:h-9 bg-zinc-800 active:bg-indigo-600 rounded-lg flex items-center justify-center text-white border border-zinc-700 shadow cursor-pointer active:scale-95 transition-transform"
            aria-label="Atas"
          >
            <ArrowUp size={16} />
          </button>

          <button
            onTouchStart={(e) => handleTouchStart('ArrowLeft', 'ArrowLeft', e)}
            onTouchEnd={(e) => handleTouchEnd('ArrowLeft', 'ArrowLeft', e)}
            onMouseDown={(e) => handleTouchStart('ArrowLeft', 'ArrowLeft', e)}
            onMouseUp={(e) => handleTouchEnd('ArrowLeft', 'ArrowLeft', e)}
            className="absolute left-1 sm:left-2 w-8 h-8 sm:w-9 sm:h-9 bg-zinc-800 active:bg-indigo-600 rounded-lg flex items-center justify-center text-white border border-zinc-700 shadow cursor-pointer active:scale-95 transition-transform"
            aria-label="Kiri"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-zinc-950 border border-zinc-800"></div>

          <button
            onTouchStart={(e) => handleTouchStart('ArrowRight', 'ArrowRight', e)}
            onTouchEnd={(e) => handleTouchEnd('ArrowRight', 'ArrowRight', e)}
            onMouseDown={(e) => handleTouchStart('ArrowRight', 'ArrowRight', e)}
            onMouseUp={(e) => handleTouchEnd('ArrowRight', 'ArrowRight', e)}
            className="absolute right-1 sm:right-2 w-8 h-8 sm:w-9 sm:h-9 bg-zinc-800 active:bg-indigo-600 rounded-lg flex items-center justify-center text-white border border-zinc-700 shadow cursor-pointer active:scale-95 transition-transform"
            aria-label="Kanan"
          >
            <ArrowRight size={16} />
          </button>

          <button
            onTouchStart={(e) => handleTouchStart('ArrowDown', 'ArrowDown', e)}
            onTouchEnd={(e) => handleTouchEnd('ArrowDown', 'ArrowDown', e)}
            onMouseDown={(e) => handleTouchStart('ArrowDown', 'ArrowDown', e)}
            onMouseUp={(e) => handleTouchEnd('ArrowDown', 'ArrowDown', e)}
            className="absolute bottom-1 sm:bottom-2 w-8 h-8 sm:w-9 sm:h-9 bg-zinc-800 active:bg-indigo-600 rounded-lg flex items-center justify-center text-white border border-zinc-700 shadow cursor-pointer active:scale-95 transition-transform"
            aria-label="Bawah"
          >
            <ArrowDown size={16} />
          </button>
        </div>
      ) : <div />}

      {/* Action Buttons */}
      {showAction ? (
        <div className="flex items-center gap-3 shrink-0">
          <button
            onTouchStart={(e) => handleTouchStart(' ', 'Space', e)}
            onTouchEnd={(e) => handleTouchEnd(' ', 'Space', e)}
            onMouseDown={(e) => handleTouchStart(' ', 'Space', e)}
            onMouseUp={(e) => handleTouchEnd(' ', 'Space', e)}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-indigo-600 active:bg-indigo-500 text-white font-mono font-black text-[11px] sm:text-xs border-2 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)] flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform"
            aria-label="Aksi / Tembak / Lompat"
          >
            <Play size={16} className="rotate-[-90deg] mb-0.5" />
            <span>ACTION</span>
          </button>
        </div>
      ) : <div />}
    </div>
  );
};
