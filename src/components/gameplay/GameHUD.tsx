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
    <div className={`absolute z-10 flex gap-1.5 sm:gap-4 pointer-events-none p-1.5 sm:p-4 ${positionClass} ${className}`}>
      {stats.map(stat => (
        <div key={stat.id} className={`flex flex-col bg-black/70 backdrop-blur-md border border-white/10 rounded px-2 py-0.5 sm:px-3 sm:py-1 ${compact ? 'items-center' : 'items-start'} ${stat.emphasized ? 'border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : ''}`}>
          <span className="text-[8px] sm:text-[10px] uppercase tracking-wider text-zinc-400">{stat.label}</span>
          <span className={`font-mono font-bold text-white leading-none text-xs sm:text-lg ${compact ? 'text-xs sm:text-lg' : 'text-sm sm:text-xl'} ${stat.emphasized ? 'text-cyan-400' : ''}`}>
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  );
};
