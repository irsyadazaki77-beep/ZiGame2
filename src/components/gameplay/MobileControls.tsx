import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Zap, CircleDot } from 'lucide-react';

export interface MobileControlButtonProps {
  icon: React.ReactNode;
  label?: string;
  onPress: () => void;
  onRelease?: () => void;
  className?: string;
  variant?: 'dpad' | 'action';
}

export const MobileControlButton: React.FC<MobileControlButtonProps> = ({ 
  icon, 
  label, 
  onPress, 
  onRelease, 
  className = '',
  variant = 'dpad'
}) => {
  const handleStart = (e: React.SyntheticEvent) => {
    e.preventDefault();
    onPress();
  };
  const handleEnd = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (onRelease) onRelease();
  };

  const variantStyles = variant === 'action'
    ? 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white border border-indigo-500/20 shadow-lg shadow-indigo-600/10'
    : 'bg-zinc-900/90 hover:bg-zinc-850 active:scale-95 text-zinc-200 border border-white/[0.06] backdrop-blur-md shadow-lg shadow-black/20';

  return (
    <button
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      aria-label={label || 'Game Control'}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-xl select-none cursor-pointer transition-all duration-150 ease-out touch-none active:scale-[0.95] active:brightness-110 min-w-[48px] min-h-[48px] ${variantStyles} ${className}`}
    >
      {icon}
      {label && <span className="text-[10px] font-sans font-semibold tracking-wider uppercase leading-none">{label}</span>}
    </button>
  );
};

export interface MobileDpadProps {
  onDirection: (dir: 'up' | 'down' | 'left' | 'right', active: boolean) => void;
  className?: string;
}

export const MobileDpad: React.FC<MobileDpadProps> = ({ onDirection, className = '' }) => {
  return (
    <div className={`grid grid-cols-3 gap-2 w-32 h-32 sm:w-36 sm:h-36 shrink-0 opacity-80 hover:opacity-100 pointer-events-auto ${className}`}>
      <div />
      <MobileControlButton 
        icon={<ArrowUp size={18} />} 
        onPress={() => onDirection('up', true)} 
        onRelease={() => onDirection('up', false)} 
        label="UP"
      />
      <div />
      <MobileControlButton 
        icon={<ArrowLeft size={18} />} 
        onPress={() => onDirection('left', true)} 
        onRelease={() => onDirection('left', false)} 
        label="LEFT"
      />
      <div className="flex items-center justify-center bg-zinc-950/60 rounded-xl border border-white/[0.04] backdrop-blur-sm">
        <CircleDot size={12} className="text-zinc-600" />
      </div>
      <MobileControlButton 
        icon={<ArrowRight size={18} />} 
        onPress={() => onDirection('right', true)} 
        onRelease={() => onDirection('right', false)} 
        label="RIGHT"
      />
      <div />
      <MobileControlButton 
        icon={<ArrowDown size={18} />} 
        onPress={() => onDirection('down', true)} 
        onRelease={() => onDirection('down', false)} 
        label="DOWN"
      />
      <div />
    </div>
  );
};

export interface MobileControlsProps {
  onDirection?: (dir: 'up' | 'down' | 'left' | 'right') => void;
  onAction?: () => void;
  actionLabel?: string;
  className?: string;

  // Backward compatibility properties for non-migrated games
  onLeft?: () => void;
  onLeftRelease?: () => void;
  onRight?: () => void;
  onRightRelease?: () => void;
  onUp?: () => void;
  onDown?: () => void;
  onA?: () => void;
  labelA?: string;
  labelLeft?: string;
  labelRight?: string;
}

export const MobileControls: React.FC<MobileControlsProps> = ({ 
  onDirection, 
  onAction, 
  actionLabel = 'ACTION', 
  className = '',
  onLeft,
  onLeftRelease,
  onRight,
  onRightRelease,
  onUp,
  onDown,
  onA,
  labelA,
  labelLeft,
  labelRight
}) => {
  const resolvedAction = onAction || onA;
  const resolvedActionLabel = actionLabel || labelA || 'ACTION';

  return (
    <div className={`absolute bottom-4 left-0 right-0 w-full max-w-lg mx-auto flex lg:hidden items-end justify-between gap-3 px-4 pb-[env(safe-area-inset-bottom,16px)] z-50 select-none touch-none pointer-events-none ${className}`}>
      {(onDirection || onLeft || onRight || onUp || onDown) && (
        <MobileDpad className="pointer-events-auto" onDirection={(dir, active) => {
          if (onDirection && active) {
            onDirection(dir);
          }
          // Legacy bindings
          if (dir === 'left') {
            if (active && onLeft) onLeft();
            if (!active && onLeftRelease) onLeftRelease();
          } else if (dir === 'right') {
            if (active && onRight) onRight();
            if (!active && onRightRelease) onRightRelease();
          } else if (dir === 'up') {
            if (active && onUp) onUp();
          } else if (dir === 'down') {
            if (active && onDown) onDown();
          }
        }} />
      )}
      
      {resolvedAction && (
        <div className="flex-1 flex justify-end">
          <MobileControlButton
            icon={<Zap size={22} />}
            label={resolvedActionLabel}
            onPress={resolvedAction}
            variant="action"
            className="w-24 sm:w-32 h-24 sm:h-32 rounded-2xl pointer-events-auto opacity-70 hover:opacity-100"
          />
        </div>
      )}
    </div>
  );
};
