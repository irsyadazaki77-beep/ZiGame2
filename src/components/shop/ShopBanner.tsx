import React from 'react';
import { ShoppingBag, Coins, HelpCircle } from 'lucide-react';
import { PlayerProfile } from '../../types';
import { audio } from '../../utils/audio';

interface ShopBannerProps {
  profile: PlayerProfile;
  tab: 'all' | 'avatars' | 'themes';
  setTab: (t: 'all' | 'avatars' | 'themes') => void;
  onOpenGuide: () => void;
}

export const ShopBanner: React.FC<ShopBannerProps> = ({
  profile,
  tab,
  setTab,
  onOpenGuide,
}) => {
  return (
    <div className="bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden select-none" id="shop-hero-banner">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ShoppingBag size={18} />
            </span>
            <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest">
              ZIGAME COSMETIC MARKET
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black font-display text-white uppercase tracking-wider">
            TOKO KOSMETIK & AVATAR PREMIUM
          </h1>
          <p className="text-xs md:text-sm text-zinc-400 font-sans mt-1 max-w-xl leading-relaxed">
            Tukarkan koin emas dari hasil skor tinggi permainan Anda dengan Avatar eksklusif dan Tema Warna Lobi kustom!
          </p>
        </div>

        {/* Coins Wallet Badge */}
        <div className="flex items-center gap-4 bg-zinc-950/80 border border-amber-500/30 p-4 rounded-2xl shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl shrink-0 animate-pulse">
            <Coins size={24} />
          </div>
          <div>
            <div className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">Saldo Koin Anda:</div>
            <div className="text-2xl font-black font-mono text-amber-400 tracking-tight">
              {profile.coins.toLocaleString()} <span className="text-xs font-normal text-amber-500/80">🪙</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex items-center justify-between mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-zinc-800/80 flex-wrap gap-3 sm:gap-4">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800 w-full sm:w-auto">
          <button
            onClick={() => { audio.playCoin(); setTab('all'); }}
            className={`flex-1 sm:flex-initial px-3 sm:px-5 py-2 rounded-xl text-[11px] sm:text-xs font-bold font-display uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              tab === 'all'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            SEMUA ITEM
          </button>
          <button
            onClick={() => { audio.playCoin(); setTab('avatars'); }}
            className={`flex-1 sm:flex-initial px-3 sm:px-5 py-2 rounded-xl text-[11px] sm:text-xs font-bold font-display uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              tab === 'avatars'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            AVATAR
          </button>
          <button
            onClick={() => { audio.playCoin(); setTab('themes'); }}
            className={`flex-1 sm:flex-initial px-3 sm:px-5 py-2 rounded-xl text-[11px] sm:text-xs font-bold font-display uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              tab === 'themes'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            TEMA LOBI
          </button>
        </div>

        <button
          onClick={onOpenGuide}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-mono text-xs font-bold rounded-xl border border-zinc-800 transition cursor-pointer"
        >
          <HelpCircle size={15} className="text-indigo-400" />
          PANDUAN & PETUNJUK
        </button>
      </div>
    </div>
  );
};
