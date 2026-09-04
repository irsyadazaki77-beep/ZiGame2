import React from 'react';

export interface GameContainerProps {
  children: React.ReactNode;
  aspect?: 'square' | 'video' | 'portrait' | 'auto';
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  className?: string;
}

export const GameContainer: React.FC<GameContainerProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`w-full h-full min-h-0 relative flex flex-col items-center justify-center select-none bg-zinc-950 ${className}`}>
      {children}
    </div>
  );
};
