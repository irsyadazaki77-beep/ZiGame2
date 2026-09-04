const fs = require('fs');

let content = fs.readFileSync('src/pages/Home.tsx', 'utf8');

// Inject import for recommendationEngine
if (!content.includes('getRecommendedGames')) {
  content = content.replace(
    "import { challengeService } from '../services/challengeService';",
    "import { challengeService } from '../services/challengeService';\nimport { getRecommendedGames, getTrendingGames, getHiddenGems } from '../utils/recommendationEngine';"
  );
}

// Replace recommendedGames logic
const recommendedGamesBlock = /const recommendedGames = useMemo\(\(\) => \{[\s\S]*?\}\, \[games\]\);/m;
content = content.replace(recommendedGamesBlock, `
  const recommendedGames = useMemo(() => getRecommendedGames(games, profile, recentlyPlayed), [games, profile, recentlyPlayed]);
  const trendingGames = useMemo(() => getTrendingGames(games), [games]);
  const hiddenGems = useMemo(() => getHiddenGems(games), [games]);
`);

// Add trending and hidden gems sections below recommended games
const sectionEndRegex = /<\/section>\s*\{\/\* 4\. Compact Recently Played Area/m;
const newSections = `
      </section>

      {/* Discovery Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-[#0f1322] border border-white/[0.04] p-4 sm:p-5 rounded-3xl space-y-4 shadow-sm">
          <h3 className="font-display font-black text-xs sm:text-sm text-zinc-200 tracking-wider uppercase flex items-center gap-2">
            <Sparkles className="text-indigo-400 w-4 h-4" /> Trending Now
          </h3>
          <div className="space-y-2">
            {trendingGames.map(game => (
              <div key={game.id} onClick={() => onSelectGame(game.id)} className="flex items-center justify-between p-2 hover:bg-white/[0.02] rounded-xl cursor-pointer group transition">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{game.icon}</span>
                  <div>
                    <div className="font-bold text-xs uppercase group-hover:text-indigo-400 transition">{game.title}</div>
                    <div className="text-[9px] text-zinc-500 font-mono">{formatNumber(game.plays)} plays</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-indigo-400" />
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#0f1322] border border-white/[0.04] p-4 sm:p-5 rounded-3xl space-y-4 shadow-sm">
          <h3 className="font-display font-black text-xs sm:text-sm text-zinc-200 tracking-wider uppercase flex items-center gap-2">
            <Compass className="text-emerald-400 w-4 h-4" /> Hidden Gems
          </h3>
          <div className="space-y-2">
            {hiddenGems.map(game => (
              <div key={game.id} onClick={() => onSelectGame(game.id)} className="flex items-center justify-between p-2 hover:bg-white/[0.02] rounded-xl cursor-pointer group transition">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{game.icon}</span>
                  <div>
                    <div className="font-bold text-xs uppercase group-hover:text-emerald-400 transition">{game.title}</div>
                    <div className="text-[9px] text-zinc-500 font-mono">{game.genre}</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400" />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 4. Compact Recently Played Area`;

content = content.replace(sectionEndRegex, newSections);

fs.writeFileSync('src/pages/Home.tsx', content);
console.log('Home.tsx updated with recommendation engine');
