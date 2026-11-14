import React from 'react';
import { Star, Play, Eye, Trophy } from 'lucide-react';
import { GameStats } from '../types';
import { GameArtwork } from './GameArtwork';

interface GameCardProps {
  game: GameStats;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent, gameId: string) => void;
  onClick: () => void;
}

export const GameCard: React.FC<GameCardProps> = React.memo(({
  game,
  isFavorite,
  onToggleFavorite,
  onClick
}) => {
  const playCount = game.plays || 0;

  const difficultyTone = (diff?: string) => {
    if (!diff) return 'text-amber-400';
    const d = diff.toLowerCase();
    if (d.includes('easy')) return 'text-emerald-400';
    if (d.includes('hard')) return 'text-rose-400';
    return 'text-amber-400';
  };

  const tierLabel =
    game.tier === 'flagship'
      ? 'Flagship'
      : game.tier === 'classic'
        ? 'Classic'
        : game.tier === 'arcade'
          ? 'Arcade'
          : null;

  return (
    <div
      onClick={onClick}
      className="group flex flex-col h-full bg-surface-card hover:bg-surface-card-hover border border-border-subtle hover:border-border-medium rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer shadow-md hover:-translate-y-1 relative select-none"
    >
      {/* Thumbnail with 16:10 aspect ratio */}
      <div className="aspect-[16/10] w-full bg-surface-sunken relative overflow-hidden shrink-0">
        <GameArtwork game={game} />
        {/* Soft bottom vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-surface-card/30 to-transparent" />

        {/* Favorite Button (>=44px tap area on touch viewports) */}
        <button 
          onClick={(e) => onToggleFavorite(e, game.id)}
          className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-surface-base/85 backdrop-blur-md border border-border-subtle flex items-center justify-center transition-all hover:bg-surface-card active:scale-95 text-text-secondary hover:text-text-primary z-10 cursor-pointer shadow-sm"
          aria-label={isFavorite ? "Hapus dari Favorit" : "Tambah ke Favorit"}
          title={isFavorite ? "Hapus dari Favorit" : "Tambah ke Favorit"}
        >
          <Star size={14} className={isFavorite ? "fill-amber-400 text-amber-400" : "text-text-muted"} />
        </button>

        {/* Play Action Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-surface-base/20 backdrop-blur-[2px] transition-opacity duration-200">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-200 font-bold">
            <Play size={15} className="ml-0.5 fill-current" />
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between gap-2">
        <div className="space-y-1 sm:space-y-1.5">
          {/* Unboxed middot-separated metadata (zero pill clutter) */}
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium text-text-muted truncate tabular-nums">
            <span className="text-indigo-400 font-semibold truncate">{game.genre || 'Arcade'}</span>
            <span aria-hidden="true">·</span>
            <span className={`font-semibold shrink-0 ${difficultyTone(game.difficulty)}`}>
              {game.difficulty || 'Medium'}
            </span>
            {tierLabel && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-text-secondary shrink-0">{tierLabel}</span>
              </>
            )}
          </div>

          <h3 className="font-bold text-xs sm:text-sm text-text-primary group-hover:text-indigo-500 transition-colors line-clamp-1">
            {game.title}
          </h3>

          <p className="text-[11px] sm:text-xs text-text-muted line-clamp-2 leading-relaxed font-normal">
            {game.description}
          </p>
        </div>

        {/* Footer info */}
        <div className="pt-2 sm:pt-2.5 border-t border-border-subtle flex items-center justify-between text-[10px] sm:text-[11px] text-text-muted tabular-nums">
          <div className="flex items-center gap-1">
            <Eye size={11} className="text-text-muted opacity-70" />
            <span>{playCount.toLocaleString()} main</span>
          </div>
          {game.highScore ? (
            <div className="flex items-center gap-1 text-emerald-500 font-medium">
              <Trophy size={11} />
              <span>PB: {game.highScore.toLocaleString()}</span>
            </div>
          ) : (
            <span className="text-text-muted opacity-70 font-medium truncate max-w-[110px]">
              {game.controls || 'Siap Main'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

export default GameCard;
