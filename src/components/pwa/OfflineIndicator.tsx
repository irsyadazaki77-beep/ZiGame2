import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500/90 text-zinc-950 font-bold px-3.5 py-2 text-xs shadow-xl backdrop-blur-md border border-amber-400/40 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <span className="w-2 h-2 rounded-full bg-amber-950 animate-ping" />
      <WifiOff size={14} className="shrink-0" />
      <span>Mode Offline Aktif · Game Berjalan dari Cache</span>
    </div>
  );
};
