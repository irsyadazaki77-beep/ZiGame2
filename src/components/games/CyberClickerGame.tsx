import React, { useState, useEffect, useRef } from 'react';
import { audio } from '../../utils/audio';
import { GameContainer } from '../gameplay/GameContainer';
import { GameHUD } from '../gameplay/GameHUD';
import { GameOverlay } from '../gameplay/GameOverlay';

interface GameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface Upgrade {
  id: string;
  name: string;
  cost: number;
  cps: number; // Click per second boost
  count: number;
  icon: string;
}

export default function CyberClickerGame({ onGameOver, onScoreUpdate, highScore }: GameProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [energy, setEnergy] = useState(0);
  const [cps, setCps] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isFever, setIsFever] = useState(false);
  const [feverProgress, setFeverProgress] = useState(0);
  const [feverTimer, setFeverTimer] = useState(0);
  const [clickScale, setClickScale] = useState(1);
  const [clicksCount, setClicksCount] = useState(0);

  const [upgrades, setUpgrades] = useState<Upgrade[]>([
    { id: 'extractor', name: 'Auto-Extractor', cost: 15, cps: 1, count: 0, icon: '⚡' },
    { id: 'overclocker', name: 'Quantum Overclocker', cost: 100, cps: 8, count: 0, icon: '🌀' },
    { id: 'condenser', name: 'Gravity Condenser', cost: 500, cps: 45, count: 0, icon: '🌌' },
    { id: 'reactor', name: 'AI Fusion Grid', cost: 2500, cps: 250, count: 0, icon: '🤖' },
  ]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cpsRef = useRef<NodeJS.Timeout | null>(null);
  const energyRef = useRef(0);

  useEffect(() => {
    energyRef.current = energy;
    onScoreUpdate(Math.floor(energy));
  }, [energy, onScoreUpdate]);

  // Click handler
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isPlaying) return;
    audio.playCoin();
    
    const clickPower = 1 + upgrades.reduce((sum, up) => sum + up.count * (up.cps * 0.1), 0);
    const multiplier = isFever ? 5 : 1;
    const gained = clickPower * multiplier;

    setEnergy(prev => prev + gained);
    setClicksCount(prev => prev + 1);
    
    // Fever charge
    if (!isFever) {
      setFeverProgress(prev => {
        const next = prev + 4;
        if (next >= 100) {
          triggerFever();
          return 0;
        }
        return next;
      });
    }

    // Squash effect
    setClickScale(0.9);
    setTimeout(() => setClickScale(1), 80);

    // Dynamic rising numbers
    createClickParticle(e.clientX, e.clientY, `+${gained.toFixed(0)}`);
  };

  const triggerFever = () => {
    audio.playLevelUp();
    setIsFever(true);
    setFeverTimer(10);
  };

  // Click particles helper
  const createClickParticle = (x: number, y: number, text: string) => {
    const el = document.createElement('div');
    el.innerText = text;
    el.className = 'fixed font-mono font-black pointer-events-none text-amber-400 select-none text-sm z-50 animate-bounce transition-all duration-700 opacity-100';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);

    setTimeout(() => {
      el.style.transform = `translateY(-40px) scale(1.5)`;
      el.style.opacity = '0';
    }, 50);

    setTimeout(() => {
      document.body.removeChild(el);
    }, 800);
  };

  const buyUpgrade = (id: string) => {
    if (!isPlaying) return;
    const upIndex = upgrades.findIndex(u => u.id === id);
    if (upIndex === -1) return;
    const upgrade = upgrades[upIndex];

    if (energy >= upgrade.cost) {
      audio.playScore();
      setEnergy(prev => prev - upgrade.cost);
      
      const updated = [...upgrades];
      updated[upIndex] = {
        ...upgrade,
        count: upgrade.count + 1,
        cost: Math.floor(upgrade.cost * 1.3),
      };

      setUpgrades(updated);
      
      // Calculate total CPS
      const newCps = updated.reduce((sum, u) => sum + u.count * u.cps, 0);
      setCps(newCps);
    }
  };

  // Main game timer
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });

        // Fever duration tracker
        setFeverTimer(prev => {
          if (prev <= 1) {
            setIsFever(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Auto extraction ticks (10 times a second for smoother accumulation)
      cpsRef.current = setInterval(() => {
        const upgradePower = upgrades.reduce((sum, u) => sum + u.count * u.cps, 0);
        if (upgradePower > 0) {
          const tickGain = (upgradePower / 10) * (isFever ? 2 : 1);
          setEnergy(prev => prev + tickGain);
        }
      }, 100);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (cpsRef.current) clearInterval(cpsRef.current);
    };
  }, [isPlaying, upgrades, isFever]);

  const startGame = () => {
    audio.playCoin();
    setEnergy(0);
    setCps(0);
    setTimeLeft(60);
    setIsFever(false);
    setFeverProgress(0);
    setClicksCount(0);
    setUpgrades([
      { id: 'extractor', name: 'Auto-Extractor', cost: 15, cps: 1, count: 0, icon: '⚡' },
      { id: 'overclocker', name: 'Quantum Overclocker', cost: 100, cps: 8, count: 0, icon: '🌀' },
      { id: 'condenser', name: 'Gravity Condenser', cost: 500, cps: 45, count: 0, icon: '🌌' },
      { id: 'reactor', name: 'AI Fusion Grid', cost: 2500, cps: 250, count: 0, icon: '🤖' },
    ]);
    setIsPlaying(true);
  }

;

  const endGame = () => {
    setIsPlaying(false);
    audio.playGameOver();
    onGameOver(Math.floor(energyRef.current));
  };

  return (
    <GameContainer maxWidth="md" aspect="auto">
      {isPlaying && (
        <GameHUD 
          stats={[
            { id: 'time', label: 'WAKTU', value: timeLeft < 10 ? `0${timeLeft}` : timeLeft, emphasized: timeLeft < 10, highlight: timeLeft < 10 ? 'text-red-500' : undefined },
            { id: 'score', label: 'Z-ENERGY', value: Math.floor(energy), emphasized: true },
            { id: 'cps', label: 'AUTO-CPS', value: `+${cps}` }
          ]} 
        />
      )}

      <GameOverlay
        gameState={isPlaying ? 'playing' : 'ready'}
        score={Math.floor(energyRef.current)}
        onStart={startGame}
        onRestart={startGame}
        instructions="Ekstrak energi siber sebanyak mungkin dalam 60 detik. Beli upgrade untuk melipatgandakan penghasilan!"
      />

      {isPlaying && (
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 p-4 md:p-6 animate-fadeIn">
          {/* Active play panel */}
          <div className="flex flex-col items-center justify-center bg-zinc-900/30 border border-zinc-900/80 rounded-2xl p-6 min-h-[380px]">
            {/* Core Energy Circle */}
            <div className="relative my-6 flex items-center justify-center">
              {isFever && (
                <div className="absolute inset-0 rounded-full bg-amber-500/10 border-4 border-amber-400 animate-ping opacity-40"></div>
              )}
              <button
                onClick={handleClick}
                style={{ transform: `scale(${clickScale})` }}
                className={`w-40 h-40 rounded-full flex flex-col items-center justify-center border-4 relative outline-none select-none transition-transform duration-700 cursor-pointer ${
                  isFever
                    ? 'bg-amber-950/30 border-amber-400 shadow-[0_0_40px_rgba(245,158,11,0.4)]'
                    : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 shadow-[0_0_20px_rgba(255,255,255,0.02)]'
                }`}
              >
                <div className={`text-4xl mb-2 ${isFever ? 'animate-bounce' : ''}`}>
                  {isFever ? '🔥' : '⚛️'}
                </div>
                <span className="text-sm font-mono text-zinc-500 font-bold tracking-wider uppercase">
                  {isFever ? 'FEVER 5X!' : 'TAP CORE'}
                </span>
              </button>
            </div>

            {/* Fever charging progress */}
            <div className="w-full mt-6 max-w-[240px]">
              <div className="flex justify-between text-xs font-mono text-zinc-500 uppercase mb-2">
                <span>{isFever ? 'FEVER MODE AKTIF' : 'PENGISI FEVER'}</span>
                <span>{isFever ? `${feverTimer}s` : `${feverProgress}%`}</span>
              </div>
              <div className="w-full h-2 bg-zinc-950 border border-zinc-900 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${isFever ? 'bg-amber-400 ' : 'bg-zinc-700'}`}
                  style={{ width: `${isFever ? (feverTimer / 10) * 100 : feverProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Upgrades panel */}
          <div className="flex flex-col bg-zinc-900/30 border border-zinc-900/80 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-mono font-black text-zinc-400 uppercase tracking-wider border-b border-zinc-800 pb-2">
              UPGRADES TOKO
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 max-h-[320px] pr-1">
              {upgrades.map((upgrade) => {
                const canBuy = energy >= upgrade.cost;
                return (
                  <button
                    key={upgrade.id}
                    disabled={!canBuy}
                    onClick={() => buyUpgrade(upgrade.id)}
                    className={`w-full p-3 rounded-xl border flex items-center justify-between transition outline-none text-left select-none cursor-pointer ${
                      canBuy
                        ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/40 text-white'
                        : 'bg-zinc-950/40 border-zinc-950 text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl bg-zinc-900 p-2 rounded-lg border border-zinc-800/60">{upgrade.icon}</span>
                      <div>
                        <div className="text-xs font-mono font-black uppercase tracking-wider">{upgrade.name}</div>
                        <div className="text-[10px] font-mono text-zinc-500 uppercase mt-0.5">
                          + {upgrade.cps} CPS • JUMLAH: {upgrade.count}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-mono font-black ${canBuy ? 'text-amber-400' : 'text-zinc-600'}`}>
                        {upgrade.cost} Z-E
                      </div>
                      <span className="text-[8px] font-mono text-zinc-600 uppercase block mt-1">BELI 💸</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </GameContainer>
  );
}
