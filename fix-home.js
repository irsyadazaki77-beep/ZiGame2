const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.tsx', 'utf8');

// Find where it ends
const splitIndex = code.indexOf('{/* 2. RECOMMENDED FOR YOU */}');
if (splitIndex !== -1) {
  code = code.substring(0, splitIndex);
}

const restOfFile = `
      {/* 2. SEMUA PERMAINAN (ALL GAMES) */}
      <section className="space-y-4">
        <SectionHeading icon={<Gamepad2 size={24} className="text-indigo-400" />} title="Semua Permainan" />
        
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Cari permainan..."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={categoryTab}
              onChange={(v: any) => setCategoryTab(v)}
              options={[
                { value: 'all', label: 'Semua Kategori' },
                { value: 'classic', label: 'Klasik' },
                { value: 'action', label: 'Aksi' },
                { value: 'puzzle', label: 'Teka-Teki' },
                { value: 'reflex', label: 'Refleks' },
                { value: 'fav', label: 'Favorit' },
                { value: 'recent', label: 'Baru Dimainkan' }
              ]}
              icon={<Filter size={14} />}
            />
            <Select
              value={difficultyFilter}
              onChange={(v: any) => setDifficultyFilter(v)}
              options={[
                { value: 'all', label: 'Semua Kesulitan' },
                { value: 'Easy', label: 'Mudah' },
                { value: 'Medium', label: 'Sedang' },
                { value: 'Hard', label: 'Sulit' }
              ]}
            />
            <Select
              value={sortOption}
              onChange={(v: any) => setSortOption(v)}
              options={[
                { value: 'popular', label: 'Populer' },
                { value: 'newest', label: 'Terbaru' },
                { value: 'highScore', label: 'Skor Tertinggi' },
                { value: 'title', label: 'A-Z' }
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredGames.length > 0 ? (
            filteredGames.map(game => (
              <GameCard
                key={game.id}
                game={game}
                onSelect={() => onSelectGame(game.id)}
                isFavorite={favorites?.includes(game.id)}
                onToggleFavorite={() => toggleFavorite(game.id)}
              />
            ))
          ) : (
            <div className="col-span-full">
              <EmptyState 
                icon={<Search size={32} className="text-zinc-600" />}
                title="Tidak Ada Permainan Ditemukan"
                description="Coba ubah filter atau kata kunci pencarian."
                action={
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryTab('all');
                      setDifficultyFilter('all');
                    }}
                  >
                    Reset Filter
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </section>

      {/* 3. QUICK HUB MODALS */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#0f131c] border border-white/[0.06]">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <Shield size={16} className="text-indigo-400" />
          Quick Hub
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { audio.playCoin(); setShowLeaderboardModal(true); }}
            className="px-3.5 py-1.5 rounded-xl bg-[#151a26] hover:bg-[#1a2030] border border-white/[0.08] text-zinc-400 hover:text-white text-[11px] font-mono font-bold tracking-wide uppercase flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <Trophy size={14} /> Leaderboard
          </button>
          <button
            onClick={() => { audio.playCoin(); setShowChallengesModal(true); }}
            className="px-3.5 py-1.5 rounded-xl bg-[#151a26] hover:bg-[#1a2030] border border-white/[0.08] text-zinc-400 hover:text-white text-[11px] font-mono font-bold tracking-wide uppercase flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <Target size={14} /> Misi
          </button>
          <button
            onClick={() => { audio.playCoin(); setShowFriendsModal(true); }}
            className="px-3.5 py-1.5 rounded-xl bg-[#151a26] hover:bg-[#1a2030] border border-white/[0.08] text-zinc-400 hover:text-white text-[11px] font-mono font-bold tracking-wide uppercase flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <Users size={14} /> Teman
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showLeaderboardModal && (
          <LeaderboardsModal
            profile={profile}
            onClose={() => setShowLeaderboardModal(false)}
          />
        )}

        {showChallengesModal && (
          <ChallengesModal
            profile={profile}
            onUpdateProfile={onUpdateProfile}
            onClose={() => setShowChallengesModal(false)}
          />
        )}

        {showFriendsModal && (
          <FriendsModal
            profile={profile}
            onUpdateProfile={onUpdateProfile}
            onClose={() => setShowFriendsModal(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
`;

fs.writeFileSync('src/pages/Home.tsx', code + restOfFile);
