const fs = require('fs');

let content = fs.readFileSync('src/pages/ProfilePage.tsx', 'utf8');

// The profile banner header
const currencyBlock = /<div className="flex items-center gap-3 z-10 shrink-0 w-full sm:w-auto justify-center sm:justify-end">[\s\S]*?<span className="block text-\[10px\] text-zinc-500 uppercase font-black">SALDO COIN<\/span>[\s\S]*?<span className="text-sm font-black text-amber-400">🪙 \{formatNumber\(profile\.coins\)\}<\/span>[\s\S]*?<\/div>/m;

// Calculate Level and XP percentage for UI
const injection = `
        {/* Dynamic Action Buttons or Profile Currency Indicators */}
        <div className="flex items-center gap-2 sm:gap-3 z-10 shrink-0 w-full sm:w-auto justify-center sm:justify-end flex-wrap">
          <div className="px-3 sm:px-4 py-2 bg-[#121626] border border-white/[0.05] rounded-2xl font-mono text-center flex flex-col items-center">
            <span className="block text-[9px] sm:text-[10px] text-zinc-500 uppercase font-black">LEVEL {profile.level || 1}</span>
            <div className="w-20 h-1.5 bg-black/50 rounded-full mt-1 overflow-hidden relative">
              <div 
                className="absolute top-0 left-0 h-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" 
                style={{ width: \`\${Math.min(100, (((profile.xp || 0) % 100) / 100) * 100)}%\` }} 
              />
            </div>
            <span className="block text-[8px] text-zinc-600 mt-1">{profile.xp || 0} XP</span>
          </div>
          
          <div className="px-3 sm:px-4 py-2 bg-[#121626] border border-white/[0.05] rounded-2xl font-mono text-center">
            <span className="block text-[9px] sm:text-[10px] text-zinc-500 uppercase font-black">SALDO COIN</span>
            <span className="text-sm font-black text-amber-400">🪙 {formatNumber(profile.coins)}</span>
          </div>
`;

if (content.match(currencyBlock)) {
  content = content.replace(currencyBlock, injection);
  fs.writeFileSync('src/pages/ProfilePage.tsx', content);
  console.log('ProfilePage.tsx patched with XP and Level');
} else {
  console.log('Could not find currency block');
}
