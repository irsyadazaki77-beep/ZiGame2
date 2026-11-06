import React, { useState } from 'react';
import { X, Copy, Check, Share2, Swords, MessageSquare, Trophy, Sparkles } from 'lucide-react';
import { GameStats, PlayerProfile } from '../../types';
import { friendChallengeService, FriendChallenge } from '../../services/friendChallengeService';
import { audio } from '../../utils/audio';
import { haptics } from '../../utils/haptics';

interface CreateFriendChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeGame: GameStats;
  profile: PlayerProfile;
  lastScore?: number;
}

export const CreateFriendChallengeModal: React.FC<CreateFriendChallengeModalProps> = ({
  isOpen,
  onClose,
  activeGame,
  profile,
  lastScore = 0
}) => {
  const [challengerName, setChallengerName] = useState(profile.username || 'Pro Gamer');
  const [targetScore, setTargetScore] = useState<number>(() => {
    return Math.max(lastScore > 0 ? lastScore : activeGame.highScore || 500, 100);
  });
  const [message, setMessage] = useState('Buktikan kemampuanmu, coba kalahkan skorku di game ini!');
  const [createdChallenge, setCreatedChallenge] = useState<FriendChallenge | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    audio.playCoin();
    haptics.trigger('success');

    const challenge = friendChallengeService.createChallenge({
      gameId: activeGame.id,
      gameTitle: activeGame.title,
      challengerName: challengerName.trim() || 'ZIGAME Fighter',
      targetScore: Number(targetScore) || 500,
      message: message.trim(),
      bountyCoins: 150,
      bountyXp: 300
    });

    setCreatedChallenge(challenge);
  };

  const shareUrl = createdChallenge ? friendChallengeService.generateShareUrl(createdChallenge) : '';

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      audio.playScore();
      haptics.trigger('light');
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const handleNativeShare = async () => {
    if (!shareUrl || !createdChallenge) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Tantangan ZIGAME: ${createdChallenge.gameTitle}`,
          text: `${challengerName} menantangmu mencetak skor ${targetScore.toLocaleString()} di ${createdChallenge.gameTitle}! "${message}"`,
          url: shareUrl
        });
      } catch {}
    } else {
      handleCopy();
    }
  };

  const handleWhatsAppShare = () => {
    if (!shareUrl || !createdChallenge) return;
    const text = encodeURIComponent(
      `🕹️ *TANTANGAN ZIGAME ARKADE*\n\n` +
      `*${challengerName}* menantangmu di game *${createdChallenge.gameTitle}*!\n` +
      `🎯 Target Skor: *${targetScore.toLocaleString()} poin*\n` +
      `💬 Pesan: "${message}"\n\n` +
      `Buka link ini untuk langsung bertanding & rebut hadiahnya:\n${shareUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-zinc-900 border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col font-sans animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06] bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Swords size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Tantang Teman Kamu</h3>
              <p className="text-[11px] text-zinc-400">Buat tantangan langsung di {activeGame.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        {!createdChallenge ? (
          <form onSubmit={handleGenerate} className="p-5 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Nama Penantang (Kamu)
              </label>
              <input
                type="text"
                value={challengerName}
                onChange={(e) => setChallengerName(e.target.value)}
                maxLength={25}
                required
                className="w-full px-3 py-2 bg-zinc-950 border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                placeholder="Masukkan namamu..."
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-300">
                  Target Skor Yang Harus Dikalahkan
                </label>
                <span className="text-[10px] text-zinc-400 font-mono">
                  Hi-Score: {activeGame.highScore.toLocaleString()}
                </span>
              </div>
              <input
                type="number"
                min={1}
                value={targetScore}
                onChange={(e) => setTargetScore(Math.max(1, Number(e.target.value)))}
                required
                className="w-full px-3 py-2 bg-zinc-950 border border-white/[0.08] rounded-xl text-sm font-mono font-bold text-amber-300 focus:outline-none focus:border-indigo-500 transition"
              />

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 mt-2">
                {lastScore > 0 && (
                  <button
                    type="button"
                    onClick={() => setTargetScore(lastScore)}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-zinc-300 transition"
                  >
                    Skor Terakhir ({lastScore.toLocaleString()})
                  </button>
                )}
                {activeGame.highScore > 0 && (
                  <button
                    type="button"
                    onClick={() => setTargetScore(activeGame.highScore)}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-zinc-300 transition"
                  >
                    Rekor Terbaik ({activeGame.highScore.toLocaleString()})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setTargetScore(prev => prev + 500)}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-indigo-300 transition"
                >
                  +500
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Pesan Tantangan
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                maxLength={100}
                className="w-full px-3 py-2 bg-zinc-950 border border-white/[0.08] rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 transition resize-none"
                placeholder="Tulis pesan ejekan atau semangat..."
              />
            </div>

            <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/20 flex items-center justify-between text-xs font-sans">
              <div className="flex items-center gap-2 text-indigo-300">
                <Sparkles size={16} className="text-amber-400" />
                <span>Bounty Pemenang:</span>
              </div>
              <span className="font-mono font-bold text-emerald-400">+150 Koin · +300 XP</span>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              <Swords size={15} />
              <span>Buat Tautan Tantangan</span>
            </button>
          </form>
        ) : (
          <div className="p-5 flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-2">
                <Check size={24} />
              </div>
              <h4 className="font-bold text-white text-sm">Tautan Tantangan Siap!</h4>
              <p className="text-xs text-zinc-400 mt-1">
                Kirim tautan ini ke temanmu via WhatsApp, Discord, atau media sosial.
              </p>
            </div>

            <div className="p-3 bg-zinc-950 border border-white/[0.06] rounded-xl flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-transparent text-[11px] font-mono text-zinc-300 focus:outline-none truncate select-all"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition shrink-0 active:scale-95"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? 'Tersalin!' : 'Salin'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleWhatsAppShare}
                className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/20"
              >
                <span>Bagikan ke WhatsApp</span>
              </button>

              <button
                onClick={handleNativeShare}
                className="py-2 px-3 bg-white/[0.08] hover:bg-white/[0.12] active:scale-95 transition rounded-xl text-xs font-bold text-zinc-200 flex items-center justify-center gap-1.5"
              >
                <Share2 size={14} />
                <span>Opsi Lainnya</span>
              </button>
            </div>

            <button
              onClick={() => {
                setCreatedChallenge(null);
                onClose();
              }}
              className="w-full py-2 text-xs font-medium text-zinc-400 hover:text-white transition"
            >
              Tutup
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
