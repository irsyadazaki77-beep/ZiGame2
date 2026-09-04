const fs = require('fs');
let content = fs.readFileSync('src/pages/ProfilePage.tsx', 'utf8');

// Add import GameMastery
content = content.replace(
  "RecentlyPlayedEntry, FriendProfile, ActivityFeedItem, SocialPrivacySettings } from '../types';",
  "RecentlyPlayedEntry, FriendProfile, ActivityFeedItem, SocialPrivacySettings, GameMastery } from '../types';"
);

// Add to props
content = content.replace(
  "recentlyPlayed: RecentlyPlayedEntry[];",
  "recentlyPlayed: RecentlyPlayedEntry[];\n  masteries: Record<string, GameMastery>;"
);

content = content.replace(
  "onClearRecentlyPlayed,",
  "onClearRecentlyPlayed,\n  masteries,"
);

// Find where to render mastery
// Inside return, look for a good place, like next to achievements.
const tabButtonsRegex = /<button[\s\S]*?onClick=\{\(\) => setView\('stats'\)\}[\s\S]*?STATISTIK[\s\S]*?<\/button>/m;
const renderStatsRegex = /\{view === 'stats' && \([\s\S]*?\{!showAdvancedStats && \(/m;

// We can just add a block inside `view === 'stats'`
const statsInjection = `
              <div className="bg-[#121626] border border-white/[0.05] p-5 sm:p-6 rounded-3xl space-y-4">
                <h3 className="font-display font-black text-sm text-zinc-200 tracking-wider uppercase flex items-center gap-2">
                  <Flame className="text-orange-500 w-4 h-4" /> Game Mastery
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {games.slice(0, 6).map(game => {
                    const mst = masteries[game.id];
                    const level = mst?.level || 1;
                    const xp = mst?.xp || 0;
                    return (
                      <div key={game.id} className="bg-[#0a0d17] border border-white/[0.04] p-3 rounded-xl flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/[0.02] border border-white/[0.05] rounded-xl flex items-center justify-center text-xl shrink-0">
                          {game.icon}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xs font-bold text-white uppercase line-clamp-1">{game.title}</h4>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[9px] font-mono text-zinc-500 uppercase">Lv.{level}</span>
                            <span className="text-[9px] font-mono text-indigo-400">{xp} XP</span>
                          </div>
                          <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden mt-1">
                            <div className="h-full bg-indigo-500" style={{ width: \`\${Math.min(100, ((xp % 100) / 100) * 100)}%\` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!showAdvancedStats && (
`;

content = content.replace(renderStatsRegex, (match) => {
  return match.replace("{!showAdvancedStats && (", statsInjection);
});

fs.writeFileSync('src/pages/ProfilePage.tsx', content);
console.log('ProfilePage patched with mastery UI');
