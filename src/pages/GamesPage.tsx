import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { GameStats } from '../types';
import { Search, Gamepad2, SlidersHorizontal, Star, Flame, Trophy, Award, Smartphone, Zap, Clock, Shield, Sparkles, Filter, X } from 'lucide-react';
import GameCard from '../components/GameCard';
import { Button, SearchInput, Select, EmptyState } from '../components/UI';
import { audioController } from '../sdk/audioController';
import { getGameQualityInfo } from '../config/qualityTiers';

interface GamesPageProps {
  games: GameStats[];
  onSelectGame: (id: string) => void;
}

export default function GamesPage({ games, onSelectGame }: GamesPageProps) {
  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('zigame_search_query') || '');
  const [categoryTab, setCategoryTab] = useState<'all' | 'classic' | 'action' | 'puzzle' | 'reflex' | 'fav'>('all');
  const [sortOption, setSortOption] = useState<'popular' | 'highScore' | 'title' | 'newest'>('popular');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'Easy' | 'Medium' | 'Hard'>('all');
  const [inputFilter, setInputFilter] = useState<'all' | 'gamepad' | 'mobile' | 'keyboard'>('all');
  const [durationFilter, setDurationFilter] = useState<'all' | 'quick' | 'standard' | 'deep'>('all');
  const [tierFilter, setTierFilter] = useState<'all' | 'flagship' | 'competitive'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Debounce syncing searchQuery to sessionStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem('zigame_search_query', searchQuery);
      } catch {}
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Keyboard shortcut '/' to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.closest?.('[role="dialog"]')
        )
      ) {
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    audioController.playCoin();
    const updated = favorites.includes(gameId)
      ? favorites.filter(id => id !== gameId)
      : [...favorites, gameId];
    setFavorites(updated);
    localStorage.setItem('arcade_favorite_games', JSON.stringify(updated));
  };

  const getCategoryFromGenre = (genre?: string) => {
    if (!genre) return 'action';
    const g = genre.toLowerCase();
    if (g.includes('classic') || g.includes('retro')) return 'classic';
    if (g.includes('action') || g.includes('shooter') || g.includes('endless') || g.includes('arcade')) return 'action';
    if (g.includes('puzzle') || g.includes('logic') || g.includes('math')) return 'puzzle';
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

  const featuredGames = useMemo(() => {
    return games.filter(g => g.featured).slice(0, 4);
  }, [games]);

  const filteredGames = useMemo(() => {
    const list = games.filter(g => {
      const matchesSearch = isFuzzyMatch(g.title, g.description, searchQuery);
      const isFav = favorites.includes(g.id);
      const quality = getGameQualityInfo(g.id);

      if (categoryTab === 'fav' && !isFav) return false;
      if (categoryTab !== 'all' && categoryTab !== 'fav' && getCategoryFromGenre(g.genre) !== categoryTab) return false;
      if (difficultyFilter !== 'all' && g.difficulty !== difficultyFilter) return false;

      if (inputFilter === 'gamepad' && !quality.gamepadOptimized) return false;
      if (inputFilter === 'mobile' && !quality.mobileOptimized) return false;

      if (durationFilter !== 'all' && quality.estimatedDuration !== durationFilter) return false;
      if (tierFilter === 'flagship' && quality.tier !== 'flagship') return false;
      if (tierFilter === 'competitive' && !quality.competitiveSupported) return false;

      return matchesSearch;
    });

    return list.sort((a, b) => {
      if (sortOption === 'popular') return b.plays - a.plays;
      if (sortOption === 'highScore') return b.highScore - a.highScore;
      if (sortOption === 'title') return a.title.localeCompare(b.title);
      if (sortOption === 'newest') {
        const newIds = [
          'world-box',
          'desk-racer',
          'wizard-chess',
          'neon-drift',
          'jump-rope',
          'whack-a-drone',
          'cyber-mines',
          'neon-2048',
          'cyber-tetris'
        ];
        const aIndex = newIds.indexOf(a.id);
        const bIndex = newIds.indexOf(b.id);
        if (aIndex !== -1 && bIndex === -1) return -1;
        if (aIndex === -1 && bIndex !== -1) return 1;
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        return 0;
      }
      return 0;
    });
  }, [games, searchQuery, categoryTab, sortOption, difficultyFilter, inputFilter, durationFilter, tierFilter, favorites]);

  const categories = [
    { value: 'all', label: 'Semua' },
    { value: 'classic', label: 'Klasik' },
    { value: 'action', label: 'Aksi' },
    { value: 'puzzle', label: 'Teka-Teki' },
    { value: 'reflex', label: 'Refleks' },
    { value: 'fav', label: 'Favorit' }
  ];

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (categoryTab !== 'all') count++;
    if (difficultyFilter !== 'all') count++;
    if (inputFilter !== 'all') count++;
    if (durationFilter !== 'all') count++;
    if (tierFilter !== 'all') count++;
    if (sortOption !== 'popular') count++;
    if (searchQuery.trim() !== '') count++;
    return count;
  }, [categoryTab, difficultyFilter, inputFilter, durationFilter, tierFilter, sortOption, searchQuery]);

  const hasActiveCustomFilters = activeFilterCount > 0;

  const resetAllFilters = () => {
    audioController.playCoin();
    setSearchQuery('');
    setCategoryTab('all');
    setDifficultyFilter('all');
    setInputFilter('all');
    setDurationFilter('all');
    setTierFilter('all');
    setSortOption('popular');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6"
    >
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-wider text-text-primary uppercase font-display flex items-center gap-2.5">
            <Gamepad2 className="text-indigo-500 w-5 h-5 sm:w-6 sm:h-6" />
            Eksplorasi Arkade
          </h1>
          <p className="text-xs text-text-muted mt-1 uppercase tracking-widest font-mono">
            {games.length} Koleksi Permainan Cyber Siap Main · Filter &amp; Discovery Cerdas
          </p>
        </div>

        {/* Quick Discovery Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => {
              audioController.playHit();
              setDurationFilter(durationFilter === 'quick' ? 'all' : 'quick');
            }}
            className={`min-h-[36px] px-3 py-1 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1 transition cursor-pointer border ${
              durationFilter === 'quick'
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-500 dark:text-amber-300'
                : 'bg-surface-subtle border-border-subtle text-text-secondary hover:text-text-primary'
            }`}
          >
            <Zap size={11} className="text-amber-500" />
            <span>5-Menit Kilat</span>
          </button>

          <button
            onClick={() => {
              audioController.playHit();
              setInputFilter(inputFilter === 'gamepad' ? 'all' : 'gamepad');
            }}
            className={`min-h-[36px] px-3 py-1 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1 transition cursor-pointer border ${
              inputFilter === 'gamepad'
                ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-600 dark:text-indigo-300'
                : 'bg-surface-subtle border-border-subtle text-text-secondary hover:text-text-primary'
            }`}
          >
            <Gamepad2 size={11} className="text-indigo-500" />
            <span>Gamepad Ready</span>
          </button>

          <button
            onClick={() => {
              audioController.playHit();
              setTierFilter(tierFilter === 'flagship' ? 'all' : 'flagship');
            }}
            className={`min-h-[36px] px-3 py-1 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1 transition cursor-pointer border ${
              tierFilter === 'flagship'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-300'
                : 'bg-surface-subtle border-border-subtle text-text-secondary hover:text-text-primary'
            }`}
          >
            <Sparkles size={11} className="text-emerald-500" />
            <span>Flagship Tier</span>
          </button>
        </div>
      </div>

      {/* Discovery Tool Controls */}
      <div className="flex flex-col gap-3">
        {/* Search Row */}
        <div className="flex gap-2 items-center w-full">
          <div className="flex-1 relative">
            <SearchInput
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama game, genre, atau mekanisme (Tekan '/')..."
              className="w-full pr-8"
            />
            <kbd className="hidden sm:inline-block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-text-muted px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle pointer-events-none">
              /
            </kbd>
          </div>
          <Button
            variant={showFilters || hasActiveCustomFilters ? "primary" : "secondary"}
            size="sm"
            onClick={() => { audioController.playCoin(); setShowFilters(!showFilters); }}
            className="flex items-center gap-2 !min-h-[40px] px-3.5 rounded-xl relative cursor-pointer"
          >
            <SlidersHorizontal size={14} />
            <span className="hidden sm:inline text-xs font-mono">
              Filter {activeFilterCount > 0 ? `(${activeFilterCount})` : 'Lanjutan'}
            </span>
            {hasActiveCustomFilters && (
              <span className="w-4 h-4 rounded-full bg-amber-400 text-zinc-950 font-bold text-[9px] font-mono flex items-center justify-center tabular-nums">
                {activeFilterCount}
              </span>
            )}
          </Button>
          {hasActiveCustomFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetAllFilters}
              className="!min-h-[40px] px-3 rounded-xl text-xs font-mono text-rose-400 border-rose-500/30 hover:bg-rose-500/10 cursor-pointer"
            >
              <X size={12} className="mr-1 inline" /> Reset
            </Button>
          )}
        </div>

        {/* Categories Tab Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
            {categories.map((cat) => {
              const isActive = categoryTab === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => { audioController.playHit(); setCategoryTab(cat.value as any); }}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold uppercase transition-all duration-200 shrink-0 border cursor-pointer select-none ${
                    isActive
                      ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'bg-surface-subtle border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-medium'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {hasActiveCustomFilters && (
            <button
              onClick={resetAllFilters}
              className="text-[11px] font-mono text-text-muted hover:text-rose-500 flex items-center gap-1 shrink-0 px-2.5 py-1 bg-surface-subtle hover:bg-rose-500/10 rounded-full transition cursor-pointer"
            >
              <X size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Collapsible Filter Panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-4 bg-surface-card border border-border-subtle rounded-2xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 shadow-sm"
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
              label="Perangkat / Kontrol"
              value={inputFilter}
              onChange={(e) => setInputFilter(e.target.value as any)}
              options={[
                { value: 'all', label: 'Semua Kontrol' },
                { value: 'gamepad', label: 'Gamepad API' },
                { value: 'mobile', label: 'Mobile / Touch' }
              ]}
            />
            <Select
              label="Estimasi Durasi"
              value={durationFilter}
              onChange={(e) => setDurationFilter(e.target.value as any)}
              options={[
                { value: 'all', label: 'Semua Durasi' },
                { value: 'quick', label: '< 3 Menit (Quick Play)' },
                { value: 'standard', label: '3-5 Menit (Standard)' },
                { value: 'deep', label: '5+ Menit (Deep Run)' }
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

      {/* Curated Featured / Top Picks Shelf when not filtering */}
      {!hasActiveCustomFilters && featuredGames.length > 0 && (
        <section className="space-y-3" aria-label="Featured Top Picks">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
              <Trophy size={15} className="text-amber-500 shrink-0" />
              <span>Featured / Top Picks</span>
            </h2>
            <span className="text-[11px] font-mono text-text-muted tabular-nums">
              {featuredGames.length} Unggulan
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {featuredGames.map((game) => (
              <GameCard
                key={`featured-${game.id}`}
                game={game}
                onClick={() => onSelectGame(game.id)}
                isFavorite={favorites.includes(game.id)}
                onToggleFavorite={(e) => toggleFavorite(e, game.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Game Grid Container */}
      <div className="space-y-3">
        {!hasActiveCustomFilters && featuredGames.length > 0 && (
          <h2 className="text-sm sm:text-base font-bold text-text-primary">
            Semua Koleksi ({filteredGames.length})
          </h2>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 pt-1">
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
                  onClick={resetAllFilters}
                  className="rounded-full"
                >
                  Reset Filter
                </Button>
              }
            />
          </div>
        )}
        </div>
      </div>
    </motion.div>
  );
}
