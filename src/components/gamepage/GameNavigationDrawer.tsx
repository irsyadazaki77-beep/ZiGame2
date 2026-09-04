import React from 'react';
import { ArrowLeft, ArrowRight, Play, Sparkles, Clock } from 'lucide-react';
import { GameStats } from '../../types';
import { audio } from '../../utils/audio';

interface GameNavigationDrawerProps {
  currentGame: GameStats;
  allGames: GameStats[];
  recentlyPlayedIds: string[];
  onSelectGame: (gameId: string) => void;
}

export const GameNavigationDrawer: React.FC<GameNavigationDrawerProps> = ({
  currentGame,
  allGames,
  recentlyPlayedIds,
  onSelectGame,
}) => {
  const currentIndex = allGames.findIndex((g) => g.id === currentGame.id);
  const prevGame = allGames[(currentIndex - 1 + allGames.length) % allGames.length];
  const nextGame = allGames[(currentIndex + 1) % allGames.length];

  // Similar games (same genre, excluding current)
  const similarGames = allGames
    .filter((g) => g.id !== currentGame.id && g.genre === currentGame.genre)
    .slice(0, 3);

  // Fallback similar games if genre matches are few
  const fallbackGames = similarGames.length > 0
    ? similarGames
    : allGames.filter((g) => g.id !== currentGame.id).slice(0, 3);

  // Recently played games list
  const recentGames = recentlyPlayedIds
    .map((id) => allGames.find((g) => g.id === id))
    .filter((g): g is GameStats => g !== undefined && g.id !== currentGame.id)
    .slice(0, 4);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 md:p-6 space-y-6 shadow-2xl select-none" id="game-navigation-drawer">
      {/* Quick Nav Header with Previous / Next Game Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-5 border-b border-zinc-800">
        <button
          onClick={() => {
            audio.playCoin();
            onSelectGame(prevGame.id);
          }}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition flex items-center justify-center sm:justify-start gap-3 group cursor-pointer"
        >
          <ArrowLeft size={16} className="text-zinc-500 group-hover:-translate-x-1 transition-transform" />
          <div className="text-left">
            <div className="text-[10px] font-mono text-zinc-500 uppercase">GAME SEBELUMNYA</div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>{prevGame.icon}</span> {prevGame.title}
            </div>
          </div>
        </button>

        <div className="text-center font-mono text-xs text-zinc-500 hidden md:block">
          GELANGGANG ARKADE ZIGAME • {currentIndex + 1} / {allGames.length}
        </div>

        <button
          onClick={() => {
            audio.playCoin();
            onSelectGame(nextGame.id);
          }}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-white transition flex items-center justify-center sm:justify-end gap-3 group cursor-pointer"
        >
          <div className="text-right">
            <div className="text-[10px] font-mono text-indigo-400 uppercase">GAME SELANJUTNYA</div>
            <div className="text-xs font-bold text-white flex items-center justify-end gap-1.5">
              {nextGame.title} <span>{nextGame.icon}</span>
            </div>
          </div>
          <ArrowRight size={16} className="text-indigo-400 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Similar Games Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-black font-display text-white uppercase tracking-wider">
          <Sparkles size={14} className="text-indigo-400" />
          <span>Game Serupa ({currentGame.genre || 'Arcade'})</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {fallbackGames.map((g) => (
            <div
              key={g.id}
              onClick={() => {
                audio.playCoin();
                onSelectGame(g.id);
              }}
              className="p-3 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 hover:border-indigo-500/40 rounded-xl flex items-center justify-between cursor-pointer transition group"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <span className="text-2xl shrink-0 p-1.5 bg-zinc-950 rounded-lg border border-zinc-800">{g.icon}</span>
                <div className="truncate">
                  <div className="text-xs font-bold text-white group-hover:text-indigo-400 transition truncate">{g.title}</div>
                  <div className="text-[10px] font-mono text-zinc-500">{g.difficulty || 'Normal'}</div>
                </div>
              </div>
              <Play size={14} className="text-zinc-600 group-hover:text-indigo-400 shrink-0 ml-1" />
            </div>
          ))}
        </div>
      </div>

      {/* Recently Played Section */}
      {recentGames.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-xs font-black font-display text-zinc-400 uppercase tracking-wider">
            <Clock size={14} className="text-amber-400" />
            <span>Terakhir Dimainkan</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {recentGames.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  audio.playCoin();
                  onSelectGame(g.id);
                }}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-mono font-bold text-zinc-300 hover:text-white transition flex items-center gap-2 cursor-pointer"
              >
                <span>{g.icon}</span>
                <span>{g.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
