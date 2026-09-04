import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { GameStats } from '../types';
import { Search, Gamepad2, SlidersHorizontal, Star, Flame, Trophy, Award } from 'lucide-react';
import GameCard from '../components/GameCard';
import { Button, SearchInput, Select, EmptyState } from '../components/UI';
import { audio } from '../utils/audio';

interface GamesPageProps {
  games: GameStats[];
  onSelectGame: (id: string) => void;
}

export default function GamesPage({ games, onSelectGame }: GamesPageProps) {
  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('zigame_search_query') || '');
  const [categoryTab, setCategoryTab] = useState<'all' | 'classic' | 'action' | 'puzzle' | 'reflex' | 'fav'>('all');
  const [sortOption, setSortOption] = useState<'popular' | 'highScore' | 'title' | 'newest'>('popular');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'Easy' | 'Medium' | 'Hard'>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    sessionStorage.setItem('zigame_search_query', searchQuery);
  }, [searchQuery]);

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('arcade_favorite_games');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorite = (e: React.MouseEvent, gameId: string) => {
    e.stopPropagation();
    audio.playCoin();
    const updated = favorites.includes(gameId)
      ? favorites.filter(id => id !== gameId)
      : [...favorites, gameId];
    setFavorites(updated);
    localStorage.setItem('arcade_favorite_games', JSON.stringify(updated));
  };

  const getCategoryFromGenre = (genre?: string) => {
    if (!genre) return 'action';
    const g = genre.toLowerCase();
    if (g.includes('classic')) return 'classic';
    if (g.includes('action') || g.includes('shooter') || g.includes('endless')) return 'action';
    if (g.includes('puzzle')) return 'puzzle';
    return 'reflex';
  };

  const isFuzzyMatch = (title: string, desc: string, query: string) => {
    if (!query.trim()) return true;
    const cleanQuery = query.toLowerCase().trim();
    const cleanTitle = title.toLowerCase();
    const cleanDesc = desc.toLowerCase();

    if (cleanTitle.includes(cleanQuery) || cleanDesc.includes(cleanQuery)) return true;

    const tokens = cleanQuery.split(/\s+/);
    return tokens.every(token => cleanTitle.includes(token) || cleanDesc.includes(token));
  };

  const filteredGames = useMemo(() => {
    const list = games.filter(g => {
      const matchesSearch = isFuzzyMatch(g.title, g.description, searchQuery);
      const isFav = favorites.includes(g.id);

      if (categoryTab === 'fav' && !isFav) return false;
      if (categoryTab !== 'all' && categoryTab !== 'fav' && getCategoryFromGenre(g.genre) !== categoryTab) return false;
      if (difficultyFilter !== 'all' && g.difficulty !== difficultyFilter) return false;

      return matchesSearch;
    });

    return list.sort((a, b) => {
      if (sortOption === 'popular') return b.plays - a.plays;
      if (sortOption === 'highScore') return b.highScore - a.highScore;
      if (sortOption === 'title') return a.title.localeCompare(b.title);
      if (sortOption === 'newest') {
        const newIds = ['neondrift', 'jumprope', 'whack', 'mines', '2048', 'tetris'];
        const aIndex = newIds.indexOf(a.id);
        const bIndex = newIds.indexOf(b.id);
        if (aIndex !== -1 && bIndex === -1) return -1;
        if (aIndex === -1 && bIndex !== -1) return 1;
        return 0;
      }
      return 0;
    });
  }, [games, searchQuery, categoryTab, sortOption, difficultyFilter, favorites]);

  const categories = [
    { value: 'all', label: 'Semua' },
    { value: 'classic', label: 'Klasik' },
    { value: 'action', label: 'Aksi' },
    { value: 'puzzle', label: 'Teka-Teki' },
    { value: 'reflex', label: 'Refleks' },
    { value: 'fav', label: 'Favorit' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6"
    >
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/[0.05] pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-wider text-white uppercase font-display flex items-center gap-2.5">
            <Gamepad2 className="text-indigo-500 w-5 h-5 sm:w-6 sm:h-6" />
            Eksplorasi Game
          </h1>
          <p className="text-xs text-zinc-400 mt-1 uppercase tracking-widest font-mono">
            Temukan dan mainkan 30+ game arkade cyber premium
          </p>
        </div>
      </div>

      {/* Discovery Tool Controls */}
      <div className="flex flex-col gap-3">
        {/* Search Row */}
        <div className="flex gap-2 items-center w-full">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama game atau genre..."
              className="w-full"
            />
          </div>
          <Button
            variant={showFilters ? "primary" : "secondary"}
            size="sm"
            onClick={() => { audio.playCoin(); setShowFilters(!showFilters); }}
            className="flex items-center gap-2 !min-h-[38px] px-3.5 rounded-full"
          >
            <SlidersHorizontal size={14} />
            <span className="hidden sm:inline text-xs font-mono">Filter</span>
          </Button>
        </div>

        {/* Categories Tab Row */}
        <div className="flex gap-1 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          {categories.map((cat) => {
            const isActive = categoryTab === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => { audio.playHit(); setCategoryTab(cat.value as any); }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-bold uppercase transition-all duration-200 shrink-0 border cursor-pointer select-none ${
                  isActive
                    ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-400 shadow-sm shadow-indigo-600/5'
                    : 'bg-[#121622] border-white/[0.04] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.08]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Collapsible Filter Panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-4 bg-[#121622] border border-white/[0.06] rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <Select
              label="Tingkat Kesulitan"
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value as any)}
              options={[
                { value: 'all', label: 'Semua Kesulitan' },
                { value: 'Easy', label: 'Mudah' },
                { value: 'Medium', label: 'Sedang' },
                { value: 'Hard', label: 'Sulit' }
              ]}
            />
            <Select
              label="Urutkan Berdasarkan"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              options={[
                { value: 'popular', label: 'Terpopuler' },
                { value: 'newest', label: 'Terbaru' },
                { value: 'highScore', label: 'Skor Tertinggi' },
                { value: 'title', label: 'Nama A-Z' }
              ]}
            />
          </motion.div>
        )}
      </div>

      {/* Game Grid Container */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pt-2">
        {filteredGames.length > 0 ? (
          filteredGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onClick={() => onSelectGame(game.id)}
              isFavorite={favorites.includes(game.id)}
              onToggleFavorite={(e) => toggleFavorite(e, game.id)}
            />
          ))
        ) : (
          <div className="col-span-full py-8">
            <EmptyState
              icon={<Search size={32} className="text-zinc-600" />}
              title="Tidak ada game ditemukan"
              description="Cobalah sesuaikan kata kunci pencarian atau ubah kriteria filter kategori."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    audio.playCoin();
                    setSearchQuery('');
                    setCategoryTab('all');
                    setDifficultyFilter('all');
                    setSortOption('popular');
                  }}
                  className="rounded-full"
                >
                  Reset Filter
                </Button>
              }
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
