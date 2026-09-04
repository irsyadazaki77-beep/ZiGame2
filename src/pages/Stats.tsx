import { formatNumber } from "../utils/format";
import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { GameStats, Achievement } from '../types';
import { BarChart2, Award, Gamepad2, TrendingUp, Zap, Target, Flame, Check, Sparkles, Trophy } from 'lucide-react';
import { audio } from '../utils/audio';

interface StatsProps {
  games: GameStats[];
  achievements: Achievement[];
  totalPlays: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 350, damping: 25 } }
};

export default function Stats({ games, achievements, totalPlays }: StatsProps) {
  // Compute analytics
  const totalCoinsEarned = useMemo(() => {
    return achievements
      .filter(a => a.unlocked)
      .reduce((sum, curr) => sum + curr.rewardCoins, 0);
  }, [achievements]);

  const achievementUnlocks = useMemo(() => {
    const unlocked = achievements.filter(a => a.unlocked).length;
    const total = achievements.length || 1;
    return {
      unlocked,
      total,
      percent: Math.round((unlocked / total) * 100)
    };
  }, [achievements]);

  // Overall player tier/rank based on total plays
  const playerRank = useMemo(() => {
    if (totalPlays === 0) return { title: 'LOBI GUEST', desc: 'Mulai mainkan game pertamamu!', color: 'text-zinc-500', glow: 'shadow-[0_0_15px_rgba(113,113,122,0.1)] border-zinc-800' };
    if (totalPlays < 5) return { title: 'REKREASI CADET', desc: 'Baru memulai petualangan di NeoArcade.', color: 'text-cyan-400', glow: 'shadow-[0_0_15px_rgba(34,211,238,0.2)] border-cyan-500/20' };
    if (totalPlays < 15) return { title: 'BYTE HACKER', desc: 'Mulai memahami mekanik game siber.', color: 'text-indigo-400', glow: 'shadow-[0_0_15px_rgba(129,140,248,0.2)] border-indigo-500/20' };
    if (totalPlays < 35) return { title: 'CORE RUNNER', desc: 'Pemain berdedikasi tinggi dengan refleks tajam.', color: 'text-purple-400', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.2)] border-purple-500/20' };
    return { title: 'ARCADE LEGEND', desc: 'Master siber sejati yang menguasai seluruh lobi!', color: 'text-pink-500', glow: 'shadow-[0_0_20px_rgba(236,72,153,0.3)] border-pink-500/40' };
  }, [totalPlays]);

  // Data for Plays bar chart
  const barChartData = useMemo(() => {
    const sorted = [...games]
      .filter(g => g.plays > 0)
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 5); // top 5 played games
    
    const maxPlays = sorted.length > 0 ? Math.max(...sorted.map(s => s.plays)) : 10;
    return {
      sorted,
      maxPlays
    };
  }, [games]);

  return (
    <motion.div 
      className="space-y-6 md:space-y-12 pb-16"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Banner */}
      <section className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-[#0f131c] flex flex-col justify-center px-6 md:px-10 py-8 md:py-10 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f131c] via-[#0f131c]/90 to-transparent z-10"></div>
        <img 
          src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1200&auto=format&fit=crop" 
          alt="Cyber analytics stats background"
          referrerPolicy="no-referrer" loading="lazy"
          className="absolute inset-0 w-full h-full object-cover opacity-20 z-0"
        />

        <div className="relative z-20 max-w-xl space-y-2">
          <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono font-bold px-3 py-1 rounded-md w-fit uppercase tracking-wider flex items-center gap-2">
            <TrendingUp size={12} className="text-indigo-400" />
            DIAL ANALITIK PENGGUNA
          </div>
          <h1 className="text-2xl md:text-4xl font-black tracking-wide text-white font-display uppercase">
            STATISTIK <span className="text-indigo-400">& INSIGHTS</span>
          </h1>
          <p className="text-zinc-400 text-xs md:text-sm leading-relaxed max-w-md font-sans">
            Pantau aktivitas bermain, catat rekor skor terbaik, dan lacak progres pencapaian prestasi arkade Anda.
          </p>
        </div>
      </section>

      {/* Bento Grid Analytics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Play Rank Title */}
        <div className="bg-[#0f131c] border border-white/[0.06] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <Zap className="text-amber-400 size-4 sm:size-5" />
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Pangkat</span>
          </div>
          <div>
            <h4 className={`text-xs sm:text-base font-bold tracking-wider uppercase font-display ${playerRank.color}`}>
              {playerRank.title}
            </h4>
            <p className="text-[11px] text-zinc-400 mt-1 leading-snug line-clamp-2">{playerRank.desc}</p>
          </div>
        </div>

        {/* Total Plays count */}
        <div className="bg-[#0f131c] border border-white/[0.06] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <Gamepad2 className="text-cyan-400 size-4 sm:size-5" />
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Bermain</span>
          </div>
          <div>
            <h4 className="text-lg sm:text-2xl font-bold tracking-tight text-white font-mono">
              {formatNumber(totalPlays)} <span className="text-xs text-zinc-500 font-sans font-normal uppercase">KALI</span>
            </h4>
            <p className="text-[11px] text-zinc-400 mt-1 leading-snug">Total sesi arkade dimainkan.</p>
          </div>
        </div>

        {/* Total coins earned */}
        <div className="bg-[#0f131c] border border-white/[0.06] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <Award className="text-indigo-400 size-4 sm:size-5" />
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Koin Prestasi</span>
          </div>
          <div>
            <h4 className="text-lg sm:text-2xl font-bold tracking-tight text-white font-mono truncate">
              🪙 {formatNumber(totalCoinsEarned)}
            </h4>
            <p className="text-[11px] text-zinc-400 mt-1 leading-snug">Koin dari klaim prestasi.</p>
          </div>
        </div>

        {/* Achievement Unlock rate */}
        <div className="bg-[#0f131c] border border-white/[0.06] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <Target className="text-pink-400 size-4 sm:size-5" />
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Pencapaian</span>
          </div>
          <div>
            <h4 className="text-lg sm:text-2xl font-bold tracking-tight text-white font-mono">
              {achievementUnlocks.percent}%
            </h4>
            <p className="text-[11px] text-zinc-400 mt-1 leading-snug">{achievementUnlocks.unlocked} dari {achievementUnlocks.total} prestasi.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-6 items-start">
        {/* Favorite games custom bar chart block */}
        <div className="xl:col-span-3 bg-[#0f131c] border border-white/[0.06] p-5 sm:p-6 rounded-2xl space-y-5 shadow-sm">
          <div className="flex justify-between items-center">
            <div className="space-y-0.5">
              <h3 className="font-display font-bold text-sm text-zinc-100 tracking-wide uppercase">Permainan Terfavorit</h3>
              <p className="text-xs text-zinc-500 font-mono">5 GAME DENGAN DURASI BERMAIN PALING TINGGI</p>
            </div>
            <Flame className="text-orange-400" size={18} />
          </div>

          {barChartData.sorted.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs font-mono border border-dashed border-white/10 rounded-xl bg-black/20">
              Belum ada data bermain! Mainkan game beberapa kali untuk merekam analitik.
            </div>
          ) : (
            <div className="space-y-4">
              {barChartData.sorted.map((game, idx) => {
                const percentage = (game.plays / barChartData.maxPlays) * 100;
                return (
                  <div key={game.id} className="space-y-1.5 font-mono">
                    <div className="flex justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 bg-[#151a26] px-1.5 py-0.5 rounded border border-white/[0.06] font-bold">0{idx + 1}</span>
                        <span className="text-zinc-300 font-bold">{game.icon} {game.title}</span>
                      </div>
                      <span className="text-zinc-300 font-bold">{game.plays} kali</span>
                    </div>

                    <div className="h-4 w-full bg-[#151a26] rounded-full overflow-hidden border border-white/[0.06] p-[2px] relative">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-full bg-indigo-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Highscore Summary list */}
        <div className="xl:col-span-2 space-y-4 sm:space-y-6">
          <div className="bg-[#0f131c] border border-white/[0.06] p-5 sm:p-6 rounded-2xl space-y-4 shadow-sm">
            <div className="space-y-0.5">
              <h3 className="font-display font-bold text-sm text-zinc-100 tracking-wide uppercase">Ikhtisar Rekor Terbaik</h3>
              <p className="text-xs text-zinc-500 font-mono">SKOR TERTINGGI PER GAME</p>
            </div>

            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {games.map((g) => (
                <div 
                  key={g.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#151a26] border border-white/[0.06] hover:border-white/10 transition-all duration-200"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg shrink-0">{g.icon}</span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate font-sans">{g.title}</h4>
                      <p className="text-[11px] text-zinc-500">{g.plays} sesi</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <span className="text-xs font-bold font-mono text-amber-400">
                      {g.highScore}
                    </span>
                    <p className="text-[10px] font-mono text-zinc-600 uppercase">REKOR</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Visual achievements checklist progress widget */}
      <section className="bg-[#0f131c] border border-white/[0.06] rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Trophy className="text-amber-400" size={16} />
              <h3 className="font-display font-bold text-sm text-white tracking-wide uppercase">Daftar Kemajuan Prestasi</h3>
            </div>
            <p className="text-xs text-zinc-500 font-mono">KOLEKSI LENGKAP PENCAPAIAN</p>
          </div>
          <span className="font-mono text-xs text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-lg border border-indigo-500/20 font-bold">
            {achievementUnlocks.unlocked} / {achievementUnlocks.total} TERBUKA
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {achievements.map((achievement) => (
            <div 
              key={achievement.id}
              className={`p-3.5 rounded-xl border flex items-center gap-3.5 transition-all duration-200 ${
                achievement.unlocked
                  ? 'bg-[#151a26] border-indigo-500/30'
                  : 'bg-zinc-950/40 border-white/[0.04] opacity-60'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl border shrink-0 ${
                achievement.unlocked
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                  : 'bg-zinc-900 border-white/10 text-zinc-600'
              }`}>
                {achievement.unlocked ? achievement.icon : '🔒'}
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h4 className={`text-xs font-bold truncate ${achievement.unlocked ? 'text-white' : 'text-zinc-500'}`}>
                    {achievement.title}
                  </h4>
                  {achievement.unlocked && (
                    <span className="text-emerald-400 shrink-0">
                      <Check size={12} className="stroke-[3]" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                  {achievement.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </motion.div>
  );
}
