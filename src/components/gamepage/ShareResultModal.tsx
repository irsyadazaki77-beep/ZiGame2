import React, { useState } from 'react';
import { Share2, Copy, Check, Trophy, Sparkles, X, Shield, ArrowUpRight, Flame } from 'lucide-react';
import { ShareResultData } from '../../types';
import { audio } from '../../utils/audio';

interface ShareResultModalProps {
  data: ShareResultData;
  onClose: () => void;
}

export const ShareResultModal: React.FC<ShareResultModalProps> = ({ data, onClose }) => {
  const [copied, setCopied] = useState(false);

  const shareText = `🎮 ZiGame • ${data.gameTitle}
🏆 Skor: ${data.score.toLocaleString()} PTS ${data.isPersonalBest ? '🔥 Rekor Baru!' : ''}
⚡ Level Mastery: Lv.${data.masteryLevel} (+${data.masteryXpGained} XP)
${data.competitiveTier ? `🛡️ Rank: ${data.competitiveTier}` : ''}
Mainkan di ZiGame Arcade Platform!`;

  const handleCopy = async () => {
    audio.playCoin();
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    audio.playCoin();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `ZiGame - ${data.gameTitle}`,
          text: shareText,
          url: window.location.href
        });
      } catch {}
    } else {
      handleCopy();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[140] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans"
      id="share-result-modal"
    >
      <div className="bg-[#11151f] border border-white/[0.08] rounded-2xl max-w-md w-full overflow-hidden shadow-2xl shadow-black/90 relative flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#0d1017] border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-200 text-sm font-semibold">
            <Share2 size={16} className="text-indigo-400" />
            <span>Bagikan Hasil Permainan</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Visual Card Preview */}
        <div className="p-5 space-y-4">
          <div className="relative rounded-xl overflow-hidden border border-white/[0.08] bg-[#161b29] p-5 shadow-lg space-y-4">
            {/* Top Brand Watermark */}
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl w-8 h-8 rounded-lg bg-[#11151f] border border-white/[0.06] flex items-center justify-center">{data.gameIcon}</span>
                <div>
                  <div className="text-[10px] font-mono text-zinc-400">
                    ZiGame Arcade
                  </div>
                  <h3 className="text-sm font-semibold text-white">{data.gameTitle}</h3>
                </div>
              </div>
              {data.isPersonalBest && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-medium flex items-center gap-1">
                  <Flame size={12} /> Rekor Baru!
                </span>
              )}
            </div>

            {/* Big Score Center */}
            <div className="text-center py-2 space-y-1">
              <div className="text-xs text-zinc-400 font-medium">
                Skor Akhir
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-amber-400 tracking-tight">
                {data.score.toLocaleString()}
              </div>
              <div className="text-xs text-zinc-400">
                Rekor Terbaik:{' '}
                <span className="text-white font-medium">{Math.max(data.highScore, data.score).toLocaleString()} pts</span>
              </div>
            </div>

            {/* Badges Strip */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06] text-left">
              <div className="p-2.5 rounded-lg bg-[#11151f] border border-white/[0.04]">
                <div className="text-[10px] text-zinc-400">Mastery Level</div>
                <div className="text-xs font-semibold text-indigo-300 mt-0.5">
                  Lv.{data.masteryLevel} (+{data.masteryXpGained} XP)
                </div>
              </div>

              {data.competitiveTier ? (
                <div className="p-2.5 rounded-lg bg-[#11151f] border border-white/[0.04]">
                  <div className="text-[10px] text-zinc-400">Skill Tier</div>
                  <div className="text-xs font-semibold text-emerald-400 mt-0.5 flex items-center gap-1">
                    <Shield size={12} /> {data.competitiveTier}
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-[#11151f] border border-white/[0.04]">
                  <div className="text-[10px] text-zinc-400">Tanggal</div>
                  <div className="text-xs font-medium text-zinc-300 mt-0.5">
                    {new Date(data.timestamp).toLocaleDateString('id-ID')}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              onClick={handleCopy}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 hover:text-white text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copied ? 'Tersalin ke Clipboard!' : 'Salin Teks Skor'}
            </button>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleNativeShare}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer shadow-sm shadow-indigo-600/20"
              >
                <Share2 size={14} /> Bagikan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
