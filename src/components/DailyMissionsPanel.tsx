import React from 'react';
import { motion } from 'motion/react';
import { Target, CheckCircle2, Circle } from 'lucide-react';
import { DailyMission } from '../types';

interface DailyMissionsPanelProps {
  missions: DailyMission[];
  themeColor: string;
}

export default function DailyMissionsPanel({ missions, themeColor }: DailyMissionsPanelProps) {
  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-3xl p-6 w-full relative overflow-hidden backdrop-blur-md shadow-2xl">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(ellipse_at_center,rgba(79,70,229,0.1)_0%,transparent_70%)] pointer-events-none transform translate-x-1/2 -translate-y-1/2"></div>
      
      <div className="flex justify-between items-center mb-6 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/10 rounded-xl border border-red-500/20">
            <Target className="text-red-400" size={18} />
          </div>
          <h3 className="font-display font-black text-sm md:text-base tracking-widest text-white uppercase drop-shadow-md">
            Misi Harian
          </h3>
        </div>
        <span className="text-[10px] md:text-xs text-zinc-500 uppercase tracking-widest font-mono">
          Reset Setiap Malam
        </span>
      </div>

      <div className="space-y-4 relative z-10">
        {missions.map((mission) => {
          const progressPercent = Math.min(100, Math.max(0, (mission.progress / mission.target) * 100));
          return (
            <div 
              key={mission.id}
              className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 ${
                mission.completed 
                  ? 'bg-zinc-900/40 opacity-70 border-zinc-800 shadow-inner' 
                  : 'bg-zinc-900/80 border-zinc-700/50 hover:border-indigo-500/30 hover:shadow-[0_0_20px_rgba(79,70,229,0.15)] group'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {mission.completed ? (
                    <CheckCircle2 className="text-emerald-500 shrink-0 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" size={18} />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-zinc-600 group-hover:border-indigo-400 transition-colors shrink-0" />
                  )}
                  <h4 className={`text-xs md:text-sm font-bold tracking-wide ${mission.completed ? 'text-zinc-500 line-through' : 'text-zinc-200 group-hover:text-white'}`}>
                    {mission.description}
                  </h4>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-3 bg-zinc-950 px-2 py-1 rounded-md border border-zinc-800">
                  <span className="text-[10px] md:text-xs font-bold text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">+{mission.rewardCoins}</span>
                  <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">Coins</span>
                </div>
              </div>
              
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                  <div 
                    className="h-full rounded-full transition-all duration-1000 ease-out relative"
                    style={{ 
                      width: `${progressPercent}%`,
                      backgroundColor: mission.completed ? '#10b981' : themeColor 
                    }}
                  >
                    {!mission.completed && (
                      <div className="absolute inset-0 bg-white/20 animate-pulse mix-blend-overlay"></div>
                    )}
                  </div>
                </div>
                <div className="text-[10px] font-mono font-bold text-zinc-400 w-12 text-right shrink-0 tracking-widest">
                  {mission.progress}/{mission.target}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
