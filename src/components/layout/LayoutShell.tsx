import React from 'react';

interface LayoutShellProps {
  children: React.ReactNode;
  isGamePage?: boolean;
}

export const LayoutShell: React.FC<LayoutShellProps> = ({ children, isGamePage = false }) => {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#080a0f] text-zinc-100 font-sans antialiased overflow-hidden selection:bg-indigo-500/30">
      {children}
    </div>
  );
};
