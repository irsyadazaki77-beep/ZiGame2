import React, { useState } from 'react';
import { GameStats } from '../types';

interface GameArtworkProps {
  game: GameStats;
  className?: string;
}

// Curated high-quality, high-contrast, beautiful gaming/abstract/neon photos corresponding to each game's theme.
const GAME_THUMBNAILS: Record<string, string> = {
  snake: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
  brick: 'https://images.unsplash.com/photo-1595829830861-b54fc126b8b6?auto=format&fit=crop&w=600&q=80',
  flappy: 'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?auto=format&fit=crop&w=600&q=80',
  space: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=600&q=80',
  memory: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80',
  runner: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
  pong: 'https://images.unsplash.com/photo-1611996575749-79a3a250f948?auto=format&fit=crop&w=600&q=80',
  stacker: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80',
  racer: 'https://images.unsplash.com/photo-1515248137880-45e105b710e0?auto=format&fit=crop&w=600&q=80',
  lockbreaker: 'https://images.unsplash.com/photo-1510511459019-5dda7724fd87?auto=format&fit=crop&w=600&q=80',
  sinerider: 'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?auto=format&fit=crop&w=600&q=80',
  cosmicdodge: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
  lasergrid: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=80',
  simon: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
  plinko: 'https://images.unsplash.com/photo-1606167668584-78701c57f13d?auto=format&fit=crop&w=600&q=80',
  asteroid: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=600&q=80',
  slasher: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&w=600&q=80',
  clicker: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
  blockmatch: 'https://images.unsplash.com/photo-1553481187-be93c21490a9?auto=format&fit=crop&w=600&q=80',
  typer: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80',
  maze: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=600&q=80',
  path: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=80',
  matrixmemory: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=80',
  rhythm: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
  golf: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?auto=format&fit=crop&w=600&q=80',
  puttgolf: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?auto=format&fit=crop&w=600&q=80',
  dino: 'https://images.unsplash.com/photo-1535663116935-7daf1c1ef0cf?auto=format&fit=crop&w=600&q=80',
  dinorun: 'https://images.unsplash.com/photo-1535663116935-7daf1c1ef0cf?auto=format&fit=crop&w=600&q=80',
  tetris: 'https://images.unsplash.com/photo-1574717024453-354056afd6fc?auto=format&fit=crop&w=600&q=80',
  archery: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?auto=format&fit=crop&w=600&q=80',
  mines: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
  twozero: 'https://images.unsplash.com/photo-1502239608882-93b729c6af43?auto=format&fit=crop&w=600&q=80',
  '2048': 'https://images.unsplash.com/photo-1502239608882-93b729c6af43?auto=format&fit=crop&w=600&q=80',
  whack: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=600&q=80',
  jumprope: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80',
  drift: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=600&q=80',
  neondrift: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=600&q=80',
  heist: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=600&q=80',
  'neon-heist': 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=600&q=80',
  void: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
  'void-survivor': 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
  orbital: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=600&q=80',
  'orbital-defense': 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=600&q=80',
  gravity: 'https://images.unsplash.com/photo-1454789548928-9efd52dc4031?auto=format&fit=crop&w=600&q=80',
  'gravity-shift': 'https://images.unsplash.com/photo-1454789548928-9efd52dc4031?auto=format&fit=crop&w=600&q=80',
  hex: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  'hex-dominion': 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
};

export const GameArtwork: React.FC<GameArtworkProps> = ({ game, className = '' }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const color = game.themeColor || '#6366f1';
  const imageUrl = GAME_THUMBNAILS[game.id] || game.coverImage;

  // Define fallback pattern based on genre if image fails to load
  const getPattern = () => {
    const genre = game.genre?.toLowerCase() || '';
    if (genre.includes('puzzle') || genre.includes('strategy')) {
      return `radial-gradient(circle at center, transparent 0, #0a0d14 100%), 
              linear-gradient(${color}22 1px, transparent 1px), 
              linear-gradient(90deg, ${color}22 1px, transparent 1px)`;
    }
    if (genre.includes('shooter') || genre.includes('action')) {
      return `radial-gradient(circle at 50% 120%, ${color}44 0%, transparent 60%),
              repeating-linear-gradient(45deg, ${color}11 0px, ${color}11 2px, transparent 2px, transparent 8px)`;
    }
    if (genre.includes('endless') || genre.includes('platformer')) {
      return `linear-gradient(180deg, transparent 0%, ${color}22 100%),
              repeating-linear-gradient(90deg, transparent 0px, transparent 40px, ${color}11 40px, ${color}11 42px)`;
    }
    return `radial-gradient(circle at center, ${color}33 0%, transparent 70%),
            linear-gradient(45deg, #0a0d14 25%, transparent 25%, transparent 75%, #0a0d14 75%, #0a0d14),
            linear-gradient(45deg, #0a0d14 25%, transparent 25%, transparent 75%, #0a0d14 75%, #0a0d14)`;
  };

  const getBackgroundSize = () => {
    const genre = game.genre?.toLowerCase() || '';
    if (genre.includes('puzzle') || genre.includes('strategy')) return '100% 100%, 20px 20px, 20px 20px';
    if (genre.includes('shooter') || genre.includes('action')) return '100% 100%, 100% 100%';
    if (genre.includes('endless') || genre.includes('platformer')) return '100% 100%, 100% 100%';
    return '100% 100%, 20px 20px, 20px 20px';
  };

  return (
    <div className={`w-full h-full relative overflow-hidden bg-[#07090e] flex items-center justify-center ${className}`}>
      {imageUrl && !hasError ? (
        <>
          {/* Main Photo Thumbnail */}
          <img
            src={imageUrl}
            alt={game.title}
            referrerPolicy="no-referrer"
            onLoad={() => setIsLoading(false)}
            onError={() => setHasError(true)}
            className={`w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-105 ${
              isLoading ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100 blur-0'
            }`}
          />

          {/* Futuristic subtle color overlay tint to blend the photo into the UI theme */}
          <div 
            className="absolute inset-0 opacity-20 mix-blend-color" 
            style={{ backgroundColor: color }}
          />

          {/* Vignette & Contrast Overlay to keep UI elements on top readable */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />

          {/* Small floating HUD-style game icon badge on top corner of image */}
          <div 
            className="absolute bottom-2.5 left-2.5 w-7 h-7 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-md select-none pointer-events-none transition-transform duration-300 group-hover:scale-110"
            style={{ boxShadow: `0 0 10px ${color}33` }}
          >
            <span className="text-sm leading-none filter drop-shadow-[0_0_5px_rgba(255,255,255,0.4)]">
              {game.icon}
            </span>
          </div>
        </>
      ) : (
        /* Fallback procedural artwork with grid patterns and huge centered emoji */
        <div 
          className="w-full h-full absolute inset-0 flex items-center justify-center"
          style={{
            backgroundImage: getPattern(),
            backgroundSize: getBackgroundSize(),
            backgroundPosition: '0 0, 0 0, 10px 10px'
          }}
        >
          {/* Glow effect behind icon */}
          <div 
            className="absolute w-24 h-24 rounded-full blur-2xl opacity-40 transition-transform duration-700 ease-out group-hover:scale-150"
            style={{ backgroundColor: color }}
          />
          
          {/* Central Icon container */}
          <div 
            className="relative z-10 text-5xl opacity-90 drop-shadow-2xl transition-transform duration-500 ease-out group-hover:scale-110"
            style={{ filter: `drop-shadow(0 0 12px ${color}88)` }}
          >
            {game.icon}
          </div>

          {/* Decorative tech lines */}
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
        </div>
      )}
    </div>
  );
};

