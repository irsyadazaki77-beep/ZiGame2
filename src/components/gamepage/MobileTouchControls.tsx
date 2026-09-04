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
      className="flex-none py-3 px-4 bg-zinc-950/90 border-t border-zinc-800 flex items-center justify-between select-none touch-none"
      id="virtual-mobile-gamepad-deck"
    >
      {/* D-Pad Controller */}
      {showDPad ? (
        <div className="relative w-36 h-36 bg-zinc-900/90 rounded-full border border-zinc-800 p-2 flex items-center justify-center shadow-xl">
          <button
            onTouchStart={(e) => handleTouchStart('ArrowUp', 'ArrowUp', e)}
            onTouchEnd={(e) => handleTouchEnd('ArrowUp', 'ArrowUp', e)}
            onMouseDown={(e) => handleTouchStart('ArrowUp', 'ArrowUp', e)}
            onMouseUp={(e) => handleTouchEnd('ArrowUp', 'ArrowUp', e)}
            className="absolute top-2.5 w-10 h-10 bg-zinc-800 active:bg-indigo-600 rounded-lg flex items-center justify-center text-white border border-zinc-700 shadow cursor-pointer"
            aria-label="Atas"
          >
            <ArrowUp size={18} />
          </button>

          <button
            onTouchStart={(e) => handleTouchStart('ArrowLeft', 'ArrowLeft', e)}
            onTouchEnd={(e) => handleTouchEnd('ArrowLeft', 'ArrowLeft', e)}
            onMouseDown={(e) => handleTouchStart('ArrowLeft', 'ArrowLeft', e)}
            onMouseUp={(e) => handleTouchEnd('ArrowLeft', 'ArrowLeft', e)}
            className="absolute left-2.5 w-10 h-10 bg-zinc-800 active:bg-indigo-600 rounded-lg flex items-center justify-center text-white border border-zinc-700 shadow cursor-pointer"
            aria-label="Kiri"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="w-6 h-6 rounded-full bg-zinc-950 border border-zinc-800"></div>

          <button
            onTouchStart={(e) => handleTouchStart('ArrowRight', 'ArrowRight', e)}
            onTouchEnd={(e) => handleTouchEnd('ArrowRight', 'ArrowRight', e)}
            onMouseDown={(e) => handleTouchStart('ArrowRight', 'ArrowRight', e)}
            onMouseUp={(e) => handleTouchEnd('ArrowRight', 'ArrowRight', e)}
            className="absolute right-2.5 w-10 h-10 bg-zinc-800 active:bg-indigo-600 rounded-lg flex items-center justify-center text-white border border-zinc-700 shadow cursor-pointer"
            aria-label="Kanan"
          >
            <ArrowRight size={18} />
          </button>

          <button
            onTouchStart={(e) => handleTouchStart('ArrowDown', 'ArrowDown', e)}
            onTouchEnd={(e) => handleTouchEnd('ArrowDown', 'ArrowDown', e)}
            onMouseDown={(e) => handleTouchStart('ArrowDown', 'ArrowDown', e)}
            onMouseUp={(e) => handleTouchEnd('ArrowDown', 'ArrowDown', e)}
            className="absolute bottom-2.5 w-10 h-10 bg-zinc-800 active:bg-indigo-600 rounded-lg flex items-center justify-center text-white border border-zinc-700 shadow cursor-pointer"
            aria-label="Bawah"
          >
            <ArrowDown size={18} />
          </button>
        </div>
      ) : <div />}

      {/* Action Buttons */}
      {showAction ? (
        <div className="flex items-center gap-3">
          <button
            onTouchStart={(e) => handleTouchStart(' ', 'Space', e)}
            onTouchEnd={(e) => handleTouchEnd(' ', 'Space', e)}
            onMouseDown={(e) => handleTouchStart(' ', 'Space', e)}
            onMouseUp={(e) => handleTouchEnd(' ', 'Space', e)}
            className="w-16 h-16 rounded-full bg-indigo-600 active:bg-indigo-500 text-white font-mono font-black text-xs border-2 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)] flex flex-col items-center justify-center cursor-pointer"
            aria-label="Aksi / Tembak / Lompat"
          >
            <Play size={18} className="rotate-[-90deg] mb-0.5" />
            <span>ACTION</span>
          </button>
        </div>
      ) : <div />}
    </div>
  );
};
