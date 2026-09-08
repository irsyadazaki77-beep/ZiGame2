import React, { useState } from 'react';
import { Gamepad2, Sparkles, Compass, Trophy, ArrowRight, Check, X, Shield, Zap, Flame } from 'lucide-react';
import { GameStats, PlayerProfile } from '../../types';
import { audio } from '../../utils/audio';
import { GameArtwork } from '../GameArtwork';

interface NewPlayerOnboardingModalProps {
  games: GameStats[];
  profile: PlayerProfile;
  onComplete: (favoriteGenres: string[], selectedGameId?: string) => void;
  onSkip: () => void;
}

const GENRE_OPTIONS = [
  { id: 'Classic', label: 'Klasik Retro', icon: '🐍', desc: 'Snake, Pong, Breakout' },
  { id: 'Action', label: 'Aksi & Kecepatan', icon: '🏎️', desc: 'Racer, Dino, Cyber Runner' },
  { id: 'Puzzle', label: 'Teka-Teki & Logika', icon: '🧱', desc: 'Tetris, 2048, Memory Grid' },
  { id: 'Shooter', label: 'Shooter & Refleks', icon: '🚀', desc: 'Space Defender, Asteroid' }
];

export const NewPlayerOnboardingModal: React.FC<NewPlayerOnboardingModalProps> = ({
  games,
  profile,
  onComplete,
  onSkip
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(['Classic', 'Action']);

  const toggleGenre = (id: string) => {
    audio.playCoin();
    setSelectedGenres((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((g) => g !== id) : prev) : [...prev, id]
    );
  };

  // Recommend 3 starter games matching selected genres
  const recommendedStarters = React.useMemo(() => {
    const matched = games.filter((g) => selectedGenres.some((genre) => g.genre?.toLowerCase().includes(genre.toLowerCase())));
    const flagships = matched.filter((g) => ['snake', 'space', 'brick', 'runner', 'racer', 'pong', 'dinorun', 'tetris'].includes(g.id));
    return (flagships.length >= 3 ? flagships : matched).slice(0, 3);
  }, [games, selectedGenres]);

  const handleFinish = (selectedGameId?: string) => {
    audio.playCoin();
    onComplete(selectedGenres, selectedGameId);
  };

  return (
    <div
      className="fixed inset-0 z-[130] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none font-sans animate-fade-in"
      id="new-player-onboarding-modal"
    >
      <div className="bg-[#0e121c] border border-indigo-500/40 rounded-3xl max-w-lg w-full overflow-hidden shadow-[0_0_50px_rgba(99,102,241,0.3)] relative flex flex-col">
        {/* Header Bar */}
        <div className="p-5 bg-gradient-to-r from-[#0d1017] via-indigo-950/40 to-[#0d1017] border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-widest">
                Langkah {step} dari 3
              </div>
              <h2 className="text-base sm:text-lg font-black font-display text-white tracking-wide">
                {step === 1 && 'Pilih Gaya Permainanmu'}
                {step === 2 && '3 Game Awal Pilihan Untukmu'}
                {step === 3 && 'Sistem Progresi Platform ZiGame'}
              </h2>
            </div>
          </div>
          <button
            onClick={onSkip}
            className="text-xs text-zinc-400 hover:text-white px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] font-mono transition cursor-pointer"
          >
            Lewati
          </button>
        </div>

        {/* Step 1: Genre Selection */}
        {step === 1 && (
          <div className="p-5 sm:p-6 space-y-4">
            <p className="text-xs text-zinc-300 font-sans leading-relaxed">
              Selamat datang di ZiGame! Pilih genre yang paling kamu sukai agar kami dapat menyesuaikan rekomendasi lobi arkademu.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {GENRE_OPTIONS.map((opt) => {
                const isSelected = selectedGenres.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleGenre(opt.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500/50 shadow-sm shadow-indigo-500/20'
                        : 'bg-black/40 border-white/[0.06] hover:border-white/[0.15]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{opt.icon}</span>
                      {isSelected && <Check size={14} className="text-indigo-400" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white font-display">{opt.label}</div>
                      <div className="text-[10px] text-zinc-400 font-sans mt-0.5 truncate">{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  audio.playCoin();
                  setStep(2);
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm shadow-indigo-600/20"
              >
                Lanjutkan <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: 3 Starter Games Recommendations */}
        {step === 2 && (
          <div className="p-5 sm:p-6 space-y-4">
            <p className="text-xs text-zinc-300 font-sans leading-relaxed">
              Berdasarkan preferensimu, berikut adalah 3 game teratas dengan kualitas gameplay tertinggi untuk dicoba pertama kali:
            </p>

            <div className="space-y-2">
              {recommendedStarters.map((g) => (
                <div
                  key={g.id}
                  className="p-3 bg-black/40 border border-white/[0.06] hover:border-indigo-500/30 rounded-2xl flex items-center justify-between gap-3 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/[0.06] relative shrink-0">
                      <GameArtwork game={g} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white font-display truncate group-hover:text-indigo-400 transition">
                        {g.title}
                      </h4>
                      <p className="text-[10px] text-zinc-400 font-sans line-clamp-1">{g.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleFinish(g.id)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold rounded-xl shrink-0 transition cursor-pointer"
                  >
                    Main Ini
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="text-xs text-zinc-400 hover:text-white font-mono transition cursor-pointer"
              >
                Kembali
              </button>
              <button
                onClick={() => {
                  audio.playCoin();
                  setStep(3);
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm shadow-indigo-600/20"
              >
                Pahami Sistem Skor <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Progression Briefing */}
        {step === 3 && (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 bg-black/40 border border-white/[0.06] rounded-2xl space-y-1">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                  <Flame size={16} />
                </div>
                <div className="text-[11px] font-bold text-white font-display">1. Akun & XP</div>
                <div className="text-[10px] text-zinc-400 font-sans leading-tight">
                  Selesaikan misi harian untuk naik level akun.
                </div>
              </div>

              <div className="p-3 bg-black/40 border border-white/[0.06] rounded-2xl space-y-1">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto">
                  <Trophy size={16} />
                </div>
                <div className="text-[11px] font-bold text-white font-display">2. Mastery</div>
                <div className="text-[10px] text-zinc-400 font-sans leading-tight">
                  Tingkatkan level keahlian spesifik tiap game.
                </div>
              </div>

              <div className="p-3 bg-black/40 border border-white/[0.06] rounded-2xl space-y-1">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                  <Shield size={16} />
                </div>
                <div className="text-[11px] font-bold text-white font-display">3. Skill Rating</div>
                <div className="text-[10px] text-zinc-400 font-sans leading-tight">
                  Raih rank Bronze hingga Cyber Master di game kompetitif.
                </div>
              </div>
            </div>

            <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-2xl text-[11px] text-indigo-200 font-sans leading-relaxed">
              🎮 Platform mendukung Keyboard, Layar Sentuh Mobile, dan Gamepad Controller secara otomatis.
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={() => setStep(2)}
                className="text-xs text-zinc-400 hover:text-white font-mono transition cursor-pointer"
              >
                Kembali
              </button>
              <button
                onClick={() => handleFinish()}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm shadow-indigo-600/20 active:scale-95"
              >
                <Sparkles size={14} /> Mulai Eksplorasi Sekarang
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
