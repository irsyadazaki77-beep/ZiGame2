import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Zap, Grip } from 'lucide-react';

export interface MobileControlButtonProps {
  icon: React.ReactNode;
  label?: string;
  onPress: () => void;
  onRelease?: () => void;
  className?: string;
}

export const MobileControlButton: React.FC<MobileControlButtonProps> = ({ icon, label, onPress, onRelease, className = '' }) => {
  const handleStart = (e: React.SyntheticEvent) => {
    e.preventDefault();
    onPress();
  };
  const handleEnd = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (onRelease) onRelease();
  };

  return (
    <button
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      className={`flex flex-col items-center justify-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl active:bg-zinc-800 active:border-zinc-700 select-none shadow text-zinc-400 active:text-white transition-colors ${className}`}
    >
      {icon}
      {label && <span className="text-[10px] font-mono font-bold tracking-wider">{label}</span>}
    </button>
  );
};

export interface MobileDpadProps {
  onDirection: (dir: 'up' | 'down' | 'left' | 'right', active: boolean) => void;
  className?: string;
}

export const MobileDpad: React.FC<MobileDpadProps> = ({ onDirection, className = '' }) => {
  return (
    <div className={`grid grid-cols-3 gap-1 w-32 h-32 ${className}`}>
      <div />
      <MobileControlButton 
        icon={<ArrowUp size={20} />} 
        onPress={() => onDirection('up', true)} 
        onRelease={() => onDirection('up', false)} 
      />
      <div />
      <MobileControlButton 
        icon={<ArrowLeft size={20} />} 
        onPress={() => onDirection('left', true)} 
        onRelease={() => onDirection('left', false)} 
      />
      <div className="flex items-center justify-center bg-zinc-900/50 rounded-xl">
        <Grip size={16} className="text-zinc-700" />
      </div>
      <MobileControlButton 
        icon={<ArrowRight size={20} />} 
        onPress={() => onDirection('right', true)} 
        onRelease={() => onDirection('right', false)} 
      />
      <div />
      <MobileControlButton 
        icon={<ArrowDown size={20} />} 
        onPress={() => onDirection('down', true)} 
        onRelease={() => onDirection('down', false)} 
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
    <div className={`w-full mt-4 flex justify-between items-center gap-4 ${className}`}>
      {(onDirection || onLeft || onRight || onUp || onDown) && (
         <MobileDpad onDirection={(dir, active) => {
           if (onDirection && active) {
             onDirection(dir);
           }
           // Trigger legacy bindings
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
         <MobileControlButton
            icon={<Zap size={24} />}
            label={resolvedActionLabel}
            onPress={resolvedAction}
            className="flex-1 h-32"
         />
      )}
    </div>
  );
};
