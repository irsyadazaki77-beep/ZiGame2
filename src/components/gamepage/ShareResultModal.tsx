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

  const shareText = `🎮 ZIGAME ARCADE • ${data.gameTitle}
🏆 Skor: ${data.score.toLocaleString()} PTS ${data.isPersonalBest ? '🔥 REKOR BARU!' : ''}
⚡ Level Mastery: Lv.${data.masteryLevel} (+${data.masteryXpGained} XP)
${data.competitiveTier ? `🛡️ Rank: ${data.competitiveTier}` : ''}
Ayo mainkan di ZiGame Arcade Platform!`;

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
          title: `ZIGAME - ${data.gameTitle}`,
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
      className="fixed inset-0 z-[140] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none font-sans animate-fade-in"
      id="share-result-modal"
    >
      <div className="bg-[#0e121c] border border-indigo-500/40 rounded-3xl max-w-md w-full overflow-hidden shadow-[0_0_50px_rgba(99,102,241,0.3)] relative flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#0d1017] via-indigo-950/40 to-[#0d1017] border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs font-bold uppercase tracking-widest">
            <Share2 size={14} /> KARTU HASIL PERMAINAN
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Visual Card Preview */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="relative rounded-2xl overflow-hidden border border-indigo-500/30 bg-gradient-to-br from-[#121624] via-[#0b0e17] to-zinc-950 p-5 shadow-2xl space-y-4">
            {/* Top Brand Watermark */}
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{data.gameIcon}</span>
                <div>
                  <div className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest">
                    ZIGAME CYBER ARCADE
                  </div>
                  <h3 className="text-sm font-black font-display text-white tracking-wide">{data.gameTitle}</h3>
                </div>
              </div>
              {data.isPersonalBest && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-bold text-[10px] flex items-center gap-1 animate-pulse">
                  <Flame size={10} /> REKOR BARU!
                </span>
              )}
            </div>

            {/* Big Score Center */}
            <div className="text-center py-2 space-y-1">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                SKOR SESI INI
              </div>
              <div className="text-3xl sm:text-4xl font-black font-display text-amber-400 tracking-wider">
                {data.score.toLocaleString()}
              </div>
              <div className="text-[11px] font-mono text-zinc-400">
                Rekor Terbaik:{' '}
                <span className="text-white font-bold">{Math.max(data.highScore, data.score).toLocaleString()} PTS</span>
              </div>
            </div>

            {/* Badges Strip */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06] text-left">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05]">
                <div className="text-[9px] font-mono text-zinc-400 uppercase font-bold">GAME MASTERY</div>
                <div className="text-xs font-bold text-indigo-300 font-mono mt-0.5">
                  Lv.{data.masteryLevel} (+{data.masteryXpGained} XP)
                </div>
              </div>

              {data.competitiveTier ? (
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05]">
                  <div className="text-[9px] font-mono text-zinc-400 uppercase font-bold">SKILL RATING</div>
                  <div className="text-xs font-bold text-emerald-400 font-mono mt-0.5 flex items-center gap-1">
                    <Shield size={12} /> {data.competitiveTier}
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05]">
                  <div className="text-[9px] font-mono text-zinc-400 uppercase font-bold">TANGGAL</div>
                  <div className="text-xs font-bold text-zinc-300 font-mono mt-0.5">
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
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-semibold font-mono flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copied ? 'Tersalin ke Clipboard!' : 'Salin Teks Skor'}
            </button>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleNativeShare}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold font-mono flex items-center justify-center gap-2 transition cursor-pointer shadow-sm shadow-indigo-600/20"
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
