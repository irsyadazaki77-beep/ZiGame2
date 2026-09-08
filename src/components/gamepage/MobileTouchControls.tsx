import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Play, CircleDot } from 'lucide-react';
import { audio } from '../../utils/audio';
import { inputManager } from '../../services/inputService';
import { InputAction } from '../../types';

interface MobileTouchControlsProps {
  visible: boolean;
  controlType?: string;
}

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({ visible, controlType = 'directional-action' }) => {
  if (!visible) return null;

  const showDPad = controlType === 'directional' || controlType === 'directional-action' || controlType === 'dpad' || controlType === 'dpad-action' || controlType === 'joystick' || controlType === 'joystick-action';
  const showHorizontalOnly = controlType === 'horizontal';
  const showAction = controlType === 'action' || controlType === 'directional-action' || controlType === 'dpad-action' || controlType === 'joystick-action';

  if (!showDPad && !showHorizontalOnly && !showAction) return null;

  const triggerAction = (action: InputAction, isDown: boolean, keyName: string, codeName: string) => {
    // 1. Unified direct input dispatch
    if (isDown) {
      inputManager.setActiveSource('touch');
    }

    // 2. Fallback key event for games listening to window keyboard events
    try {
      const event = new KeyboardEvent(isDown ? 'keydown' : 'keyup', {
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

  const handleTouchStart = (action: InputAction, keyName: string, codeName: string, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    audio.playHit();
    triggerAction(action, true, keyName, codeName);
  };

  const handleTouchEnd = (action: InputAction, keyName: string, codeName: string, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    triggerAction(action, false, keyName, codeName);
  };

  return (
    <>
      {/* PORTRAIT MODE DECK (Bottom bar on vertical screens) */}
      <div 
        className="lg:hidden landscape:hidden flex-none py-2 px-3 sm:px-6 bg-[#080a0f]/95 backdrop-blur-md border-t border-white/[0.06] flex items-center justify-between select-none touch-none w-full max-w-lg mx-auto pb-safe"
        id="virtual-mobile-gamepad-deck-portrait"
      >
        {/* D-Pad Controller */}
        {showDPad ? (
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 bg-[#121622] rounded-2xl border border-white/[0.08] p-1 flex items-center justify-center shadow-lg shrink-0">
            <button
              onTouchStart={(e) => handleTouchStart('UP', 'ArrowUp', 'ArrowUp', e)}
              onTouchEnd={(e) => handleTouchEnd('UP', 'ArrowUp', 'ArrowUp', e)}
              onMouseDown={(e) => handleTouchStart('UP', 'ArrowUp', 'ArrowUp', e)}
              onMouseUp={(e) => handleTouchEnd('UP', 'ArrowUp', 'ArrowUp', e)}
              className="absolute top-1 w-9 h-9 bg-[#1a2030] active:bg-indigo-600 rounded-xl flex items-center justify-center text-zinc-200 active:text-white border border-white/[0.06] cursor-pointer active:scale-95 transition-all"
              aria-label="Atas"
            >
              <ArrowUp size={18} />
            </button>

            <button
              onTouchStart={(e) => handleTouchStart('LEFT', 'ArrowLeft', 'ArrowLeft', e)}
              onTouchEnd={(e) => handleTouchEnd('LEFT', 'ArrowLeft', 'ArrowLeft', e)}
              onMouseDown={(e) => handleTouchStart('LEFT', 'ArrowLeft', 'ArrowLeft', e)}
              onMouseUp={(e) => handleTouchEnd('LEFT', 'ArrowLeft', 'ArrowLeft', e)}
              className="absolute left-1 w-9 h-9 bg-[#1a2030] active:bg-indigo-600 rounded-xl flex items-center justify-center text-zinc-200 active:text-white border border-white/[0.06] cursor-pointer active:scale-95 transition-all"
              aria-label="Kiri"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="w-6 h-6 rounded-full bg-[#0d1017] border border-white/[0.04] flex items-center justify-center">
              <CircleDot size={12} className="text-zinc-600" />
            </div>

            <button
              onTouchStart={(e) => handleTouchStart('RIGHT', 'ArrowRight', 'ArrowRight', e)}
              onTouchEnd={(e) => handleTouchEnd('RIGHT', 'ArrowRight', 'ArrowRight', e)}
              onMouseDown={(e) => handleTouchStart('RIGHT', 'ArrowRight', 'ArrowRight', e)}
              onMouseUp={(e) => handleTouchEnd('RIGHT', 'ArrowRight', 'ArrowRight', e)}
              className="absolute right-1 w-9 h-9 bg-[#1a2030] active:bg-indigo-600 rounded-xl flex items-center justify-center text-zinc-200 active:text-white border border-white/[0.06] cursor-pointer active:scale-95 transition-all"
              aria-label="Kanan"
            >
              <ArrowRight size={18} />
            </button>

            <button
              onTouchStart={(e) => handleTouchStart('DOWN', 'ArrowDown', 'ArrowDown', e)}
              onTouchEnd={(e) => handleTouchEnd('DOWN', 'ArrowDown', 'ArrowDown', e)}
              onMouseDown={(e) => handleTouchStart('DOWN', 'ArrowDown', 'ArrowDown', e)}
              onMouseUp={(e) => handleTouchEnd('DOWN', 'ArrowDown', 'ArrowDown', e)}
              className="absolute bottom-1 w-9 h-9 bg-[#1a2030] active:bg-indigo-600 rounded-xl flex items-center justify-center text-zinc-200 active:text-white border border-white/[0.06] cursor-pointer active:scale-95 transition-all"
              aria-label="Bawah"
            >
              <ArrowDown size={18} />
            </button>
          </div>
        ) : showHorizontalOnly ? (
          <div className="flex items-center gap-4">
            <button
              onTouchStart={(e) => handleTouchStart('LEFT', 'ArrowLeft', 'ArrowLeft', e)}
              onTouchEnd={(e) => handleTouchEnd('LEFT', 'ArrowLeft', 'ArrowLeft', e)}
              onMouseDown={(e) => handleTouchStart('LEFT', 'ArrowLeft', 'ArrowLeft', e)}
              onMouseUp={(e) => handleTouchEnd('LEFT', 'ArrowLeft', 'ArrowLeft', e)}
              className="w-14 h-14 bg-[#121622] active:bg-indigo-600 rounded-2xl flex items-center justify-center text-zinc-200 border border-white/10 active:scale-95 transition-all"
              aria-label="Kiri"
            >
              <ArrowLeft size={20} />
            </button>
            <button
              onTouchStart={(e) => handleTouchStart('RIGHT', 'ArrowRight', 'ArrowRight', e)}
              onTouchEnd={(e) => handleTouchEnd('RIGHT', 'ArrowRight', 'ArrowRight', e)}
              onMouseDown={(e) => handleTouchStart('RIGHT', 'ArrowRight', 'ArrowRight', e)}
              onMouseUp={(e) => handleTouchEnd('RIGHT', 'ArrowRight', 'ArrowRight', e)}
              className="w-14 h-14 bg-[#121622] active:bg-indigo-600 rounded-2xl flex items-center justify-center text-zinc-200 border border-white/10 active:scale-95 transition-all"
              aria-label="Kanan"
            >
              <ArrowRight size={20} />
            </button>
          </div>
        ) : <div />}

        {/* Action Button */}
        {showAction ? (
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onTouchStart={(e) => handleTouchStart('PRIMARY', ' ', 'Space', e)}
              onTouchEnd={(e) => handleTouchEnd('PRIMARY', ' ', 'Space', e)}
              onMouseDown={(e) => handleTouchStart('PRIMARY', ' ', 'Space', e)}
              onMouseUp={(e) => handleTouchEnd('PRIMARY', ' ', 'Space', e)}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-400 text-white font-mono font-bold text-xs border border-indigo-400/30 shadow-md shadow-indigo-950/60 flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95 transition-all"
              aria-label="Aksi / Tembak / Lompat"
            >
              <Play size={18} className="rotate-[-90deg]" />
              <span className="text-[10px] tracking-wider">ACTION</span>
            </button>
          </div>
        ) : <div />}
      </div>

      {/* LANDSCAPE MODE OVERLAY (Floating semi-transparent controls on left/right, 0 vertical height block) */}
      <div 
        className="hidden lg:hidden landscape:block pointer-events-none fixed inset-0 z-40 select-none pl-safe pr-safe pb-safe"
        id="virtual-mobile-gamepad-deck-landscape"
      >
        {/* Floating Left Overlay: D-Pad */}
        {showDPad && (
          <div className="pointer-events-auto absolute bottom-4 left-4 sm:left-6 w-28 h-28 bg-black/40 backdrop-blur-md rounded-2xl border border-white/15 p-1 flex items-center justify-center shadow-2xl opacity-75 hover:opacity-100 transition-opacity">
            <button
              onTouchStart={(e) => handleTouchStart('UP', 'ArrowUp', 'ArrowUp', e)}
              onTouchEnd={(e) => handleTouchEnd('UP', 'ArrowUp', 'ArrowUp', e)}
              className="absolute top-1 w-8 h-8 bg-white/10 active:bg-indigo-600/80 rounded-lg flex items-center justify-center text-white border border-white/10 cursor-pointer active:scale-95"
              aria-label="Atas"
            >
              <ArrowUp size={16} />
            </button>
            <button
              onTouchStart={(e) => handleTouchStart('LEFT', 'ArrowLeft', 'ArrowLeft', e)}
              onTouchEnd={(e) => handleTouchEnd('LEFT', 'ArrowLeft', 'ArrowLeft', e)}
              className="absolute left-1 w-8 h-8 bg-white/10 active:bg-indigo-600/80 rounded-lg flex items-center justify-center text-white border border-white/10 cursor-pointer active:scale-95"
              aria-label="Kiri"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="w-5 h-5 rounded-full bg-black/60 border border-white/10" />
            <button
              onTouchStart={(e) => handleTouchStart('RIGHT', 'ArrowRight', 'ArrowRight', e)}
              onTouchEnd={(e) => handleTouchEnd('RIGHT', 'ArrowRight', 'ArrowRight', e)}
              className="absolute right-1 w-8 h-8 bg-white/10 active:bg-indigo-600/80 rounded-lg flex items-center justify-center text-white border border-white/10 cursor-pointer active:scale-95"
              aria-label="Kanan"
            >
              <ArrowRight size={16} />
            </button>
            <button
              onTouchStart={(e) => handleTouchStart('DOWN', 'ArrowDown', 'ArrowDown', e)}
              onTouchEnd={(e) => handleTouchEnd('DOWN', 'ArrowDown', 'ArrowDown', e)}
              className="absolute bottom-1 w-8 h-8 bg-white/10 active:bg-indigo-600/80 rounded-lg flex items-center justify-center text-white border border-white/10 cursor-pointer active:scale-95"
              aria-label="Bawah"
            >
              <ArrowDown size={16} />
            </button>
          </div>
        )}

        {/* Floating Right Overlay: Action Button */}
        {showAction && (
          <div className="pointer-events-auto absolute bottom-4 right-4 sm:right-6 opacity-75 hover:opacity-100 transition-opacity">
            <button
              onTouchStart={(e) => handleTouchStart('PRIMARY', ' ', 'Space', e)}
              onTouchEnd={(e) => handleTouchEnd('PRIMARY', ' ', 'Space', e)}
              className="w-14 h-14 rounded-2xl bg-indigo-600/80 hover:bg-indigo-600 active:bg-indigo-400 text-white font-mono font-bold text-xs border border-indigo-400/30 shadow-2xl backdrop-blur-md flex flex-col items-center justify-center cursor-pointer active:scale-95"
              aria-label="Aksi / Tembak / Lompat"
            >
              <Play size={16} className="rotate-[-90deg]" />
              <span className="text-[9px] tracking-wider">ACTION</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
};
