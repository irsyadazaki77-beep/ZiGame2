import React, { useState } from 'react';
import { Coins, Sparkles, AlertCircle } from 'lucide-react';
import { audio } from '../../utils/audio';

interface CoinGambleWidgetProps {
  coins: number;
  onGamble: (bet: number, choice: 'heads' | 'tails') => Promise<{ success: boolean; won?: boolean; outcomeSide?: 'heads' | 'tails'; changeCoins?: number; message?: string }>;
}

export const CoinGambleWidget: React.FC<CoinGambleWidgetProps> = ({ coins, onGamble }) => {
  const [bet, setBet] = useState(20);
  const [choice, setChoice] = useState<'heads' | 'tails'>('heads');
  const [isFlipping, setIsFlipping] = useState(false);
  const [resultSide, setResultSide] = useState<'heads' | 'tails' | null>(null);

  const handleFlip = async () => {
    if (isFlipping) return;
    if (coins < bet) {
      audio.playHit();
      // local error handling handled by UI disabled state or here
      return;
    }

    setIsFlipping(true);
    setResultSide(null);
    audio.playCoin();

    const res = await onGamble(bet, choice);
    
    // Slight delay for animation feel
    setTimeout(() => {
      setIsFlipping(false);
      
      if (!res.success) {
        audio.playHit();
        return;
      }

      setResultSide(res.outcomeSide!);
      
      if (res.won) {
        audio.playScore();
      } else {
        audio.playHit();
      }
    }, 1200);
  };

  return (
    <div className="bg-zinc-900/80 border border-amber-500/30 rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden select-none">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl shrink-0 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            🪙
          </div>
          <div>
            <div className="inline-block px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider border border-amber-500/30 mb-1">
              DOUBLE OR NOTHING (PERTARUHAN KOIN)
            </div>
            <h3 className="text-base font-black font-display text-white uppercase tracking-wider">
              Lempar Koin Keberuntungan 50/50
            </h3>
            <p className="text-xs text-zinc-400 font-sans mt-0.5">
              Pilih Kepala (HEADS) atau Ekor (TAILS). Jika tebakan benar, gandakan taruhan Anda!
            </p>
          </div>
        </div>

        {/* Gamble Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Bet Picker */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {[10, 20, 50, 100].map((val) => (
              <button
                key={val}
                onClick={() => setBet(val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  bet === val
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                {val}🪙
              </button>
            ))}
          </div>

          {/* Heads or Tails Switch */}
          <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setChoice('heads')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                choice === 'heads' ? 'bg-indigo-600 text-white' : 'text-zinc-400'
              }`}
            >
              👑 HEADS
            </button>
            <button
              onClick={() => setChoice('tails')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                choice === 'tails' ? 'bg-indigo-600 text-white' : 'text-zinc-400'
              }`}
            >
              ⭐ TAILS
            </button>
          </div>

          {/* Flip Action Button */}
          <button
            onClick={handleFlip}
            disabled={isFlipping || coins < bet}
            className={`px-5 py-2.5 rounded-xl font-display font-black text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              coins < bet
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : isFlipping
                ? 'bg-amber-500/50 text-black animate-spin'
                : 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)] active:scale-95'
            }`}
          >
            {isFlipping ? 'LEMPAR...' : `LEMPAR KOIN (${bet}🪙)`}
          </button>
        </div>
      </div>
    </div>
  );
};
