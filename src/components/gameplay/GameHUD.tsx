import React from 'react';

export interface GameHUDStat {
  id: string;
  label: string;
  value: string | number;
  emphasized?: boolean;
  highlight?: boolean | string;
  icon?: React.ReactNode;
}

export interface GameHUDProps {
  stats: GameHUDStat[];
  position?: 'top-left' | 'top-center' | 'top-right';
  compact?: boolean;
  className?: string;
}

export const GameHUD: React.FC<GameHUDProps> = ({ stats, position = 'top-left', compact, className = '' }) => {
  let positionClass = 'top-0 left-0';
  if (position === 'top-center') positionClass = 'top-0 left-1/2 -translate-x-1/2';
  if (position === 'top-right') positionClass = 'top-0 right-0';

  return (
    <div className={`absolute z-10 flex gap-2 sm:gap-3.5 pointer-events-none p-3 sm:p-4 ${positionClass} ${className}`}>
      {stats.map(stat => {
        const isEmp = stat.emphasized;
        const cardBg = isEmp 
          ? 'bg-indigo-950/40 border-indigo-500/25 text-indigo-400' 
          : 'bg-zinc-950/75 border-white/[0.06] text-white';

        return (
          <div 
            key={stat.id} 
            className={`
              flex flex-col border backdrop-blur-md rounded-xl transition-all duration-200
              px-2.5 py-1 sm:px-3.5 sm:py-1.5 min-w-[64px] sm:min-w-[80px]
              ${compact ? 'items-center text-center' : 'items-start'}
              ${cardBg}
            `}
          >
            <span className="text-[9px] sm:text-[10px] font-sans font-semibold uppercase tracking-wider text-zinc-400/90 mb-0.5 leading-none">
              {stat.label}
            </span>
            <span 
              className={`
                font-mono font-bold leading-none tracking-tight tabular-nums
                ${compact ? 'text-xs sm:text-lg' : 'text-sm sm:text-xl'}
                ${isEmp ? 'text-indigo-400' : 'text-white'}
              `}
            >
              {stat.value}
            </span>
          </div>
        );
      })}
    </div>
  );
};
