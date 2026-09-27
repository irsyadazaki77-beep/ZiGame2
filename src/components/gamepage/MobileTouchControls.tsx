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
  const showHorizontalOnly = controlType === 'horizontal' || controlType === 'leftright';
  const showAction = controlType === 'action' || controlType === 'directional-action' || controlType === 'dpad-action' || controlType === 'joystick-action';

  if (!showDPad && !showHorizontalOnly && !showAction) return null;

  const handleTouchStart = (action: InputAction, e: React.TouchEvent | React.MouseEvent) => {
    if (e.cancelable) e.preventDefault();
    audio.playHit();
    inputManager.dispatchAction(action, true, 'touch');
  };

  const handleTouchEnd = (action: InputAction, e: React.TouchEvent | React.MouseEvent) => {
    if (e.cancelable) e.preventDefault();
    inputManager.dispatchAction(action, false, 'touch');
  };

  return (
    <>
      {/* PORTRAIT MODE DECK (Super compact bottom bar to maximize game canvas height) */}
      <div 
        className="lg:hidden landscape:hidden flex-none py-2 px-4 sm:px-6 bg-zinc-950/70 backdrop-blur-md border-t border-white/[0.06] flex items-center justify-between select-none touch-none w-full max-w-md mx-auto pb-safe"
        id="virtual-mobile-gamepad-deck-portrait"
      >
        {/* D-Pad Controller */}
        {showDPad ? (
          <div className="relative w-32 h-32 bg-zinc-900/90 rounded-full border border-white/[0.06] p-0.5 flex items-center justify-center shadow-lg shrink-0 backdrop-blur-md touch-none select-none">
            {/* UP BUTTON */}
            <button
              onTouchStart={(e) => handleTouchStart('UP', e)}
              onTouchEnd={(e) => handleTouchEnd('UP', e)}
              onMouseDown={(e) => handleTouchStart('UP', e)}
              onMouseUp={(e) => handleTouchEnd('UP', e)}
              className="absolute top-0.5 left-1/2 -translate-x-1/2 w-11 h-11 bg-zinc-800/90 active:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden rounded-lg flex items-center justify-center text-zinc-300 active:text-white border border-white/[0.06] cursor-pointer active:scale-95 transition-all duration-150 ease-out touch-none select-none shadow-xs"
              aria-label="Atas"
            >
              <ArrowUp size={18} />
            </button>
 
            {/* LEFT BUTTON */}
            <button
              onTouchStart={(e) => handleTouchStart('LEFT', e)}
              onTouchEnd={(e) => handleTouchEnd('LEFT', e)}
              onMouseDown={(e) => handleTouchStart('LEFT', e)}
              onMouseUp={(e) => handleTouchEnd('LEFT', e)}
              className="absolute left-0.5 top-1/2 -translate-y-1/2 w-11 h-11 bg-zinc-800/90 active:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden rounded-lg flex items-center justify-center text-zinc-300 active:text-white border border-white/[0.06] cursor-pointer active:scale-95 transition-all duration-150 ease-out touch-none select-none shadow-xs"
              aria-label="Kiri"
            >
              <ArrowLeft size={18} />
            </button>
 
            {/* Center Cap */}
            <div className="w-8 h-8 rounded-full bg-zinc-950/80 border border-white/[0.04] flex items-center justify-center z-10 shadow-inner select-none touch-none">
              <CircleDot size={12} className="text-zinc-600" />
            </div>
 
            {/* RIGHT BUTTON */}
            <button
              onTouchStart={(e) => handleTouchStart('RIGHT', e)}
              onTouchEnd={(e) => handleTouchEnd('RIGHT', e)}
              onMouseDown={(e) => handleTouchStart('RIGHT', e)}
              onMouseUp={(e) => handleTouchEnd('RIGHT', e)}
              className="absolute right-0.5 top-1/2 -translate-y-1/2 w-11 h-11 bg-zinc-800/90 active:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden rounded-lg flex items-center justify-center text-zinc-300 active:text-white border border-white/[0.06] cursor-pointer active:scale-95 transition-all duration-150 ease-out touch-none select-none shadow-xs"
              aria-label="Kanan"
            >
              <ArrowRight size={18} />
            </button>
 
            {/* DOWN BUTTON */}
            <button
              onTouchStart={(e) => handleTouchStart('DOWN', e)}
              onTouchEnd={(e) => handleTouchEnd('DOWN', e)}
              onMouseDown={(e) => handleTouchStart('DOWN', e)}
              onMouseUp={(e) => handleTouchEnd('DOWN', e)}
              className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-11 h-11 bg-zinc-800/90 active:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden rounded-lg flex items-center justify-center text-zinc-300 active:text-white border border-white/[0.06] cursor-pointer active:scale-95 transition-all duration-150 ease-out touch-none select-none shadow-xs"
              aria-label="Bawah"
            >
              <ArrowDown size={18} />
            </button>
          </div>
        ) : showHorizontalOnly ? (
          <div className="flex items-center gap-3 touch-none select-none">
            <button
              onTouchStart={(e) => handleTouchStart('LEFT', e)}
              onTouchEnd={(e) => handleTouchEnd('LEFT', e)}
              onMouseDown={(e) => handleTouchStart('LEFT', e)}
              onMouseUp={(e) => handleTouchEnd('LEFT', e)}
              className="w-14 h-14 bg-zinc-900/90 active:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden rounded-xl flex items-center justify-center text-zinc-200 border border-white/[0.06] active:scale-95 transition-all duration-150 ease-out touch-none select-none shadow-md backdrop-blur-md"
              aria-label="Kiri"
            >
              <ArrowLeft size={20} />
            </button>
            <button
              onTouchStart={(e) => handleTouchStart('RIGHT', e)}
              onTouchEnd={(e) => handleTouchEnd('RIGHT', e)}
              onMouseDown={(e) => handleTouchStart('RIGHT', e)}
              onMouseUp={(e) => handleTouchEnd('RIGHT', e)}
              className="w-14 h-14 bg-zinc-900/90 active:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden rounded-xl flex items-center justify-center text-zinc-200 border border-white/[0.06] active:scale-95 transition-all duration-150 ease-out touch-none select-none shadow-md backdrop-blur-md"
              aria-label="Kanan"
            >
              <ArrowRight size={20} />
            </button>
          </div>
        ) : <div />}
 
        {/* Action Button */}
        {showAction ? (
          <div className="flex items-center shrink-0 touch-none select-none">
            <button
              onTouchStart={(e) => handleTouchStart('PRIMARY', e)}
              onTouchEnd={(e) => handleTouchEnd('PRIMARY', e)}
              onMouseDown={(e) => handleTouchStart('PRIMARY', e)}
              onMouseUp={(e) => handleTouchEnd('PRIMARY', e)}
              className="w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden text-white font-sans font-bold text-xs border border-indigo-500/20 shadow-lg shadow-indigo-600/20 flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95 transition-all duration-150 ease-out touch-none select-none"
              aria-label="Aksi / Tembak / Lompat"
            >
              <Play size={18} className="rotate-[-90deg]" />
              <span className="text-[9px] tracking-wider font-extrabold text-indigo-100 uppercase">ACTION</span>
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
          <div className="pointer-events-auto absolute bottom-4 left-4 w-32 h-32 bg-zinc-950/70 backdrop-blur-md rounded-full border border-white/[0.06] p-0.5 flex items-center justify-center shadow-2xl opacity-80 hover:opacity-100 transition-opacity select-none touch-none">
            <button
              onTouchStart={(e) => handleTouchStart('UP', e)}
              onTouchEnd={(e) => handleTouchEnd('UP', e)}
              className="absolute top-0.5 left-1/2 -translate-x-1/2 w-11 h-11 bg-zinc-900/90 active:bg-indigo-600 rounded-lg flex items-center justify-center text-white border border-white/[0.06] cursor-pointer active:scale-95 transition-all duration-150 ease-out touch-none select-none"
              aria-label="Atas"
            >
              <ArrowUp size={18} />
            </button>
            <button
              onTouchStart={(e) => handleTouchStart('LEFT', e)}
              onTouchEnd={(e) => handleTouchEnd('LEFT', e)}
              className="absolute left-0.5 top-1/2 -translate-y-1/2 w-11 h-11 bg-zinc-900/90 active:bg-indigo-600 rounded-lg flex items-center justify-center text-white border border-white/[0.06] cursor-pointer active:scale-95 transition-all duration-150 ease-out touch-none select-none"
              aria-label="Kiri"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="w-6 h-6 rounded-full bg-zinc-950/60 border border-white/[0.04] select-none touch-none" />
            <button
              onTouchStart={(e) => handleTouchStart('RIGHT', e)}
              onTouchEnd={(e) => handleTouchEnd('RIGHT', e)}
              className="absolute right-0.5 top-1/2 -translate-y-1/2 w-11 h-11 bg-zinc-900/90 active:bg-indigo-600 rounded-lg flex items-center justify-center text-white border border-white/[0.06] cursor-pointer active:scale-95 transition-all duration-150 ease-out touch-none select-none"
              aria-label="Kanan"
            >
              <ArrowRight size={18} />
            </button>
            <button
              onTouchStart={(e) => handleTouchStart('DOWN', e)}
              onTouchEnd={(e) => handleTouchEnd('DOWN', e)}
              className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-11 h-11 bg-zinc-900/90 active:bg-indigo-600 rounded-lg flex items-center justify-center text-white border border-white/[0.06] cursor-pointer active:scale-95 transition-all duration-150 ease-out touch-none select-none"
              aria-label="Bawah"
            >
              <ArrowDown size={18} />
            </button>
          </div>
        )}

        {/* Floating Left Overlay: Horizontal-Only */}
        {showHorizontalOnly && (
          <div className="pointer-events-auto absolute bottom-4 left-4 flex items-center gap-3 select-none touch-none">
            <button
              onTouchStart={(e) => handleTouchStart('LEFT', e)}
              onTouchEnd={(e) => handleTouchEnd('LEFT', e)}
              className="w-12 h-12 bg-zinc-900/90 backdrop-blur-md active:bg-indigo-600 rounded-xl flex items-center justify-center text-white border border-white/[0.06] active:scale-95 transition-all duration-150 ease-out touch-none select-none shadow-md opacity-80 hover:opacity-100"
              aria-label="Kiri"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              onTouchStart={(e) => handleTouchStart('RIGHT', e)}
              onTouchEnd={(e) => handleTouchEnd('RIGHT', e)}
              className="w-12 h-12 bg-zinc-900/90 backdrop-blur-md active:bg-indigo-600 rounded-xl flex items-center justify-center text-white border border-white/[0.06] active:scale-95 transition-all duration-150 ease-out touch-none select-none shadow-md opacity-80 hover:opacity-100"
              aria-label="Kanan"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Floating Right Overlay: Action Button */}
        {showAction && (
          <div className="pointer-events-auto absolute bottom-4 right-4 opacity-80 hover:opacity-100 transition-opacity select-none touch-none">
            <button
              onTouchStart={(e) => handleTouchStart('PRIMARY', e)}
              onTouchEnd={(e) => handleTouchEnd('PRIMARY', e)}
              className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-400 text-white font-sans font-bold text-xs border border-indigo-500/20 shadow-2xl backdrop-blur-md flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-all duration-150 ease-out touch-none select-none"
              aria-label="Aksi / Tembak / Lompat"
            >
              <Play size={16} className="rotate-[-90deg]" />
              <span className="text-[8px] tracking-wider text-indigo-100 font-extrabold uppercase">ACTION</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
};
