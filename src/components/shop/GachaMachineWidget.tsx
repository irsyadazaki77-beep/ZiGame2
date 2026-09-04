import React, { useState } from 'react';
import { Gift, Sparkles, Trophy, RefreshCw } from 'lucide-react';
import { ShopItem } from '../../types';
import { audio } from '../../utils/audio';

interface GachaMachineWidgetProps {
  coins: number;
  unlockedAvatars: string[];
  unlockedThemes: string[];
  onSpinGacha: () => void;
  gachaState: 'idle' | 'spinning' | 'revealed';
  gachaReward: ShopItem | null;
  gachaPreviewItem: ShopItem | null;
  onCloseReward: () => void;
}

export const GachaMachineWidget: React.FC<GachaMachineWidgetProps> = ({
  coins,
  onSpinGacha,
  gachaState,
  gachaReward,
  gachaPreviewItem,
  onCloseReward,
}) => {
  const [leverPulled, setLeverPulled] = useState(false);

  const handlePullLever = () => {
    if (gachaState !== 'idle') return;
    setLeverPulled(true);
    audio.playCoin();
    setTimeout(() => {
      setLeverPulled(false);
      onSpinGacha();
    }, 300);
  };

  return (
    <div className="bg-gradient-to-r from-zinc-900 via-indigo-950/40 to-zinc-900 border border-indigo-500/30 rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden select-none">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(99,102,241,0.3)] shrink-0 animate-pulse">
            🎰
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-wider border border-indigo-500/30">
                GACHA LUKY SPIN
              </span>
              <span className="text-amber-400 text-xs font-mono font-bold flex items-center gap-1">
                Biaya: 50🪙
              </span>
            </div>
            <h3 className="text-lg font-black font-display text-white mt-1 uppercase tracking-wider">
              Mesin Hadiah Kosmetik Acak
            </h3>
            <p className="text-xs text-zinc-400 font-sans mt-0.5 max-w-md">
              Uji keberuntungan Anda untuk memenangkan Avatar & Tema Premium acak dengan diskon harga spesial!
            </p>
          </div>
        </div>

        {/* Spin Mechanism Lever */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePullLever}
            disabled={gachaState !== 'idle' || coins < 50}
            className={`px-6 py-3.5 rounded-xl font-display font-black text-xs uppercase tracking-wider transition-all duration-200 flex items-center gap-2.5 shadow-lg cursor-pointer ${
              coins < 50
                ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
                : gachaState === 'spinning'
                ? 'bg-indigo-600/50 text-white border border-indigo-400 animate-pulse'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.4)] active:scale-95'
            }`}
          >
            {gachaState === 'spinning' ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                MEMUTAR MESIN GACHA...
              </>
            ) : (
              <>
                <Sparkles size={16} className="text-yellow-300" />
                TARIK TUAS GACHA (50🪙)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preview Rolling Box during spin */}
      {gachaState === 'spinning' && gachaPreviewItem && (
        <div className="mt-4 p-4 bg-zinc-950/80 border border-indigo-500/40 rounded-xl flex items-center justify-center gap-3 animate-pulse">
          <span className="text-3xl animate-bounce">{gachaPreviewItem.value}</span>
          <span className="text-xs font-mono font-bold text-indigo-300 uppercase tracking-widest">
            {gachaPreviewItem.name}...
          </span>
        </div>
      )}

      {/* Reveal Reward Modal */}
      {gachaState === 'revealed' && gachaReward && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-zinc-900 border-2 border-indigo-500 p-6 md:p-8 rounded-3xl max-w-md w-full text-center relative shadow-[0_0_50px_rgba(99,102,241,0.5)]">
            <div className="w-20 h-20 mx-auto rounded-full bg-indigo-500/20 border border-indigo-400 flex items-center justify-center text-4xl mb-4 animate-bounce">
              {gachaReward.value}
            </div>
            <div className="inline-block px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-full text-xs font-black uppercase tracking-widest mb-2">
              🎉 HADIAH GACHA DIBUKA!
            </div>
            <h3 className="text-xl font-black font-display text-white uppercase mb-1">
              {gachaReward.name}
            </h3>
            <p className="text-xs text-zinc-400 font-sans mb-6">
              {gachaReward.description}
            </p>
            <button
              onClick={onCloseReward}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
            >
              SIMPAN HADIAH KE PROFIL
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
