import React from 'react';
import { Gamepad2, MessageSquare } from 'lucide-react';
import { audio } from '../../utils/audio';

interface GamePageMobileNavProps {
  mobileTab: 'game' | 'community';
  setMobileTab: (tab: 'game' | 'community') => void;
}

export const GamePageMobileNav: React.FC<GamePageMobileNavProps> = ({
  mobileTab,
  setMobileTab,
}) => {
  return (
    <div className="lg:hidden flex-none bg-zinc-950 border-b border-zinc-800 p-1 flex items-center justify-around select-none">
      <button
        onClick={() => { audio.playCoin(); setMobileTab('game'); }}
        className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold uppercase transition-all ${
          mobileTab === 'game' ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-400' : 'text-zinc-500'
        }`}
      >
        <Gamepad2 size={14} />
        <span>Permainan</span>
      </button>

      <button
        onClick={() => { audio.playCoin(); setMobileTab('community'); }}
        className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold uppercase transition-all ${
          mobileTab === 'community' ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-400' : 'text-zinc-500'
        }`}
      >
        <MessageSquare size={14} />
        <span>Komunitas</span>
      </button>
    </div>
  );
};
