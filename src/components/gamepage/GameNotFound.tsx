import React from 'react';

interface GameNotFoundProps {
  gameId?: string;
  onNavigateHome: () => void;
}

export const GameNotFound: React.FC<GameNotFoundProps> = ({ gameId, onNavigateHome }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-6 select-none font-sans">
      <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 text-2xl mb-4 animate-bounce">
        ⚠️
      </div>
      <h2 className="text-xl font-black font-display uppercase tracking-wider mb-2">PERMAINAN TIDAK DITEMUKAN</h2>
      <p className="text-sm text-zinc-400 font-mono mb-6 max-w-sm text-center">
        ID permainan "{gameId}" tidak terdaftar dalam registry Zigame.
      </p>
      <button
        onClick={onNavigateHome}
        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 font-bold font-mono text-xs rounded-xl shadow-lg transition cursor-pointer"
      >
        KEMBALI KE LOBI UTAMA
      </button>
    </div>
  );
};
