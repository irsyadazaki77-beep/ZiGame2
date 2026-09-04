import React from 'react';
import { Zap, Clock, Sparkles } from 'lucide-react';
import { eventService } from '../services/eventService';

export default function DynamicEventsBanner() {
  const activeEvents = eventService.getActiveEvents();

  if (activeEvents.length === 0) return null;

  return (
    <div className="space-y-3">
      {activeEvents.map((evt) => (
        <div
          key={evt.id}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/30 p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_0_25px_rgba(245,158,11,0.1)]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl shrink-0">
              {evt.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 bg-amber-500 text-black rounded-full">
                  EVENT AKTIF
                </span>
                <h3 className="font-display font-black text-xs sm:text-sm text-white tracking-wider uppercase">
                  {evt.name}
                </h3>
              </div>
              <p className="text-zinc-300 text-xs mt-0.5 leading-relaxed">
                {evt.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {evt.xpMultiplier > 1 && (
              <span className="text-xs font-mono font-black px-2.5 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-lg flex items-center gap-1">
                <Zap size={12} className="text-amber-400 fill-amber-400" /> {evt.xpMultiplier}x XP
              </span>
            )}
            {evt.coinMultiplier > 1 && (
              <span className="text-xs font-mono font-black px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-lg flex items-center gap-1">
                <Sparkles size={12} className="text-emerald-400" /> {evt.coinMultiplier}x KOIN
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
