import React from 'react';
import { motion } from 'motion/react';
import { X, Shield, Clock, Award, Star, CheckCircle, Sparkles, Gamepad2 } from 'lucide-react';
import { seasonService } from '../services/seasonService';
import { GameStats } from '../types';
import { audio } from '../utils/audio';
import { GameArtwork } from './GameArtwork';

interface SeasonalHubModalProps {
  games: GameStats[];
  onClose: () => void;
  onSelectGame: (game: GameStats) => void;
}

export default function SeasonalHubModal({ games, onClose, onSelectGame }: SeasonalHubModalProps) {
  const season = seasonService.getActiveSeason();
  const timeLeft = seasonService.getTimeRemaining();

  const featuredGamesList = games.filter(g => season.featuredGames.includes(g.id));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans select-none">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden z-10"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Shield size={22} />
            </div>
            <div>
              <div className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">
                HUB SEASON RESMI
              </div>
              <h2 className="text-lg sm:text-xl font-display font-black text-white tracking-wider uppercase">
                {season.name}
              </h2>
            </div>
          </div>
          <button
            onClick={() => { audio.playCoin(); onClose(); }}
            className="w-9 h-9 hover:bg-zinc-800 rounded-full transition flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Season Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="text-xs font-mono font-bold text-zinc-400 uppercase flex items-center gap-1.5">
                <Clock size={14} className="text-indigo-400" /> Sisa Durasi Season
              </div>
              <div className="text-2xl font-black font-display text-white">{timeLeft.formatted}</div>
              <p className="text-xs text-zinc-400">
                Pencapaian season akan dikunci saat countdown berakhir dan reward akan dikirimkan otomatis.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 space-y-2">
              <div className="text-xs font-mono font-bold text-indigo-400 uppercase flex items-center gap-1.5">
                <Award size={14} /> Lencana Eksklusif Season
              </div>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{season.badgeReward.icon}</span>
                <div>
                  <div className="text-sm font-bold text-white uppercase">{season.badgeReward.name}</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">{season.badgeReward.description}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Featured Games */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Gamepad2 size={16} className="text-indigo-400" />
                <h3 className="text-xs font-display font-black text-white tracking-wider uppercase">
                  GAME UNGGULAN SEASON 1 (+1.5x XP KELAS SIBER)
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {featuredGamesList.map((g) => (
                <div
                  key={g.id}
                  onClick={() => {
                    audio.playHit();
                    onClose();
                    onSelectGame(g);
                  }}
                  className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-indigo-500/50 transition cursor-pointer flex flex-col justify-between group"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-11 h-11 rounded-lg overflow-hidden border border-zinc-800 relative shrink-0">
                      <GameArtwork game={g} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white uppercase group-hover:text-indigo-400 transition-colors">
                        {g.title}
                      </div>
                      <div className="text-[10px] font-mono text-indigo-400 font-bold">Featured</div>
                    </div>
                  </div>
                  <button className="w-full py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 group-hover:bg-indigo-600 group-hover:text-white text-[11px] font-bold transition">
                    Mainkan
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
