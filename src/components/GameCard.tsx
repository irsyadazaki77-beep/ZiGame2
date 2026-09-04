import React from 'react';
import { Star, Play, Eye } from 'lucide-react';
import { GameStats } from '../types';
import { Badge } from './UI';

interface GameCardProps {
  game: GameStats;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent, gameId: string) => void;
  onClick: () => void;
}

export const GameCard: React.FC<GameCardProps> = ({
  game,
  isFavorite,
  onToggleFavorite,
  onClick
}) => {
  const playCount = game.plays || 0;
  
  const getRating = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const rating = 4.3 + (Math.abs(hash) % 7) * 0.1;
    return rating.toFixed(1);
  };

  const rating = getRating(game.id);

  const difficultyVariant = (diff?: string) => {
    if (!diff) return 'secondary';
    const d = diff.toLowerCase();
    if (d.includes('easy')) return 'success';
    if (d.includes('hard')) return 'danger';
    return 'warning';
  };

  return (
    <div
      onClick={onClick}
      className="group flex flex-col h-full bg-[#0f131c] hover:bg-[#151a26] border border-white/[0.06] hover:border-indigo-500/40 rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer shadow-md hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] relative select-none"
    >
      {/* Thumbnail with 16:10 aspect ratio */}
      <div className="aspect-[16/10] w-full bg-zinc-950 relative overflow-hidden shrink-0">
        <img
          src={game.coverImage}
          alt={game.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
        />
        {/* Soft bottom vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f131c] via-[#0f131c]/40 to-transparent" />

        {/* Favorite Button */}
        <button 
          onClick={(e) => onToggleFavorite(e, game.id)}
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all hover:bg-black/80 hover:scale-110 text-zinc-400 hover:text-white z-10"
          aria-label={isFavorite ? "Hapus dari Favorit" : "Tambah ke Favorit"}
          title={isFavorite ? "Hapus dari Favorit" : "Tambah ke Favorit"}
        >
          <Star size={13} className={isFavorite ? "fill-amber-400 text-amber-400" : "text-zinc-400"} />
        </button>

        {/* Game Icon */}
        <div className="absolute bottom-2.5 left-2.5 w-9 h-9 rounded-xl bg-zinc-900/90 border border-white/10 flex items-center justify-center text-lg shadow-md z-10">
          {game.icon}
        </div>

        {/* Play Action Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 backdrop-blur-[1px] transition-opacity duration-200">
          <div className="w-11 h-11 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/40 transform scale-90 group-hover:scale-100 transition-transform duration-200">
            <Play size={18} className="ml-0.5 fill-white" />
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="primary">{game.genre || 'Arcade'}</Badge>
            <Badge variant={difficultyVariant(game.difficulty)}>{game.difficulty || 'Medium'}</Badge>
          </div>

          <h3 className="font-display font-bold text-sm text-white tracking-wide uppercase group-hover:text-indigo-400 transition-colors line-clamp-1">
            {game.title}
          </h3>

          <p className="text-xs text-zinc-400 font-sans line-clamp-2 leading-relaxed">
            {game.description}
          </p>
        </div>

        {/* Footer info */}
        <div className="pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <div className="flex items-center gap-1">
            <Eye size={12} className="text-zinc-500" />
            <span>{playCount} main</span>
          </div>
          <div className="flex items-center gap-1">
            <Star size={11} className="fill-amber-400 text-amber-400" />
            <span className="text-zinc-300 font-bold">{rating}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameCard;
