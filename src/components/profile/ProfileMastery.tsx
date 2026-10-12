import React from 'react';
import { GameMastery, GameStats } from '../../types';
import { Sparkles, Trophy, Award } from 'lucide-react';
import { formatNumber } from '../../utils/format';

interface ProfileMasteryProps {
  masteries: Record<string, GameMastery>;
  games: GameStats[];
  onSelectGame: (id: string) => void;
}

export const ProfileMastery: React.FC<ProfileMasteryProps> = ({
  masteries,
  games,
  onSelectGame
}) => {
  const gamesList = games.map(g => {
    const m = masteries[g.id] || { gameId: g.id, level: 1, xp: 0, highestScore: 0, totalPlays: 0, milestonesUnlocked: [] };
    const xpForNext = m.level * 100;
    const progress = Math.min(100, Math.round((m.xp / xpForNext) * 100));
    return {
      game: g,
      mastery: m,
      progress,
      xpForNext
    };
  });

  return (
    <div className="space-y-6">
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-sm">
        <h3 className="font-display font-black text-sm uppercase text-text-primary tracking-wide flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          PENGUASAAN GAME (MASTERY)
        </h3>
        <p className="text-xs text-text-secondary font-mono">
          Tingkatkan level mastery tiap game untuk membuka avatar, gelar, dan lencana eksklusif.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gamesList.map(({ game, mastery, progress, xpForNext }) => (
          <div
            key={game.id}
            className="bg-surface-card border border-border-subtle rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 hover:border-border-medium transition cursor-pointer"
            onClick={() => onSelectGame(game.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{game.icon}</div>
                <div>
                  <h4 className="font-bold text-sm text-text-primary">{game.title}</h4>
                  <span className="text-[10px] font-mono text-text-secondary uppercase">
                    Level Mastery {mastery.level}
                  </span>
                </div>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-mono font-bold text-xs">
                LV {mastery.level}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-text-secondary">
                <span>XP {mastery.xp} / {xpForNext}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2 bg-surface-subtle rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-text-secondary border-t border-border-subtle">
              <span>Highscore: {formatNumber(mastery.highestScore || game.highScore || 0)}</span>
              <span>Plays: {mastery.totalPlays || game.plays || 0}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
