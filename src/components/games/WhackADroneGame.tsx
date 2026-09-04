import React, { useState, useEffect, useRef } from 'react';
import { audio } from '../../utils/audio';
import { GameContainer } from '../gameplay/GameContainer';
import { GameHUD } from '../gameplay/GameHUD';
import { GameOverlay } from '../gameplay/GameOverlay';
import { motion, AnimatePresence } from 'motion/react';
import { Target } from 'lucide-react';

interface WhackADroneProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface Hole {
  id: number;
  droneType: 'none' | 'normal' | 'fast' | 'bomb' | 'golden';
  active: boolean;
  hit: boolean;
}

const HOLE_COUNT = 9;
const GAME_DURATION = 30; // 30 seconds

export default function WhackADroneGame({ onGameOver, onScoreUpdate, highScore }: WhackADroneProps) {
  const [holes, setHoles] = useState<Hole[]>(Array(HOLE_COUNT).fill(null).map((_, i) => ({ id: i, droneType: 'none', active: false, hit: false })));
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [muted, setMuted] = useState(audio.getMuteState());

  const spawnTimerRef = useRef<number | null>(null);
  const gameTimerRef = useRef<number | null>(null);

  const startGame = () => {
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setIsPlaying(true);
    setGameOver(false);
    setHoles(Array(HOLE_COUNT).fill(null).map((_, i) => ({ id: i, droneType: 'none', active: false, hit: false })));


    audio.playCoin();

    // Start game timer
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    gameTimerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    spawnDrones();
  };

  const spawnDrones = () => {
    if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);

    const timeRemainingRatio = timeLeft / GAME_DURATION;
    // Faster spawning as time runs out
    const spawnRate = 400 + (timeRemainingRatio * 800); 

    setHoles(prevHoles => {
      const activeHoles = prevHoles.filter(h => h.active).length;
      if (activeHoles >= 4) return prevHoles; // Max 4 drones at a time

      const availableHoles = prevHoles.filter(h => !h.active && !h.hit);
      if (availableHoles.length === 0) return prevHoles;

      const newHoles = [...prevHoles];
      const randomHole = availableHoles[Math.floor(Math.random() * availableHoles.length)];
      
      // Determine drone type
      const rand = Math.random();
      let type: Hole['droneType'] = 'normal';
      let duration = 1200;

      if (rand > 0.95) {
        type = 'golden';
        duration = 800;
      } else if (rand > 0.8) {
        type = 'bomb';
        duration = 1500;
      } else if (rand > 0.6) {
        type = 'fast';
        duration = 700;
      }

      newHoles[randomHole.id] = { ...newHoles[randomHole.id], droneType: type, active: true, hit: false };

      // Despawn timeout
      setTimeout(() => {
        setHoles(current => {
          if (!current[randomHole.id].hit) {
            const resetHoles = [...current];
            resetHoles[randomHole.id] = { ...resetHoles[randomHole.id], droneType: 'none', active: false, hit: false };
            return resetHoles;
          }
          return current;
        });
      }, duration);

      return newHoles;
    });

    spawnTimerRef.current = window.setTimeout(spawnDrones, spawnRate);
  };

  useEffect(() => {
    if (isPlaying && !gameOver) {
      // Adjust spawn rate occasionally based on time left
      spawnDrones();
    }
  }, [timeLeft]);


  const endGame = () => {
    setIsPlaying(false);
    setGameOver(true);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
    
    // Clear all holes
    setHoles(Array(HOLE_COUNT).fill(null).map((_, i) => ({ id: i, droneType: 'none', active: false, hit: false })));

    audio.playLevelUp();
    setTimeout(() => {
      onGameOver(score);
    }, 1500);
  };

  const hitDrone = (id: number, type: Hole['droneType']) => {
    if (!isPlaying || gameOver || type === 'none') return;

    setHoles(prev => {
      if (!prev[id].active || prev[id].hit) return prev;
      const newHoles = [...prev];
      newHoles[id] = { ...newHoles[id], hit: true, active: false };
      return newHoles;
    });

    let points = 0;
    switch (type) {
      case 'normal':
        points = 10;
        audio.playHit();
        break;
      case 'fast':
        points = 25;
        audio.playLaser();
        break;
      case 'golden':
        points = 100;
        audio.playCoin();
        break;
      case 'bomb':
        points = -50;
        audio.playExplosion();
        // Shake effect could be added here
        break;
    }

    const newScore = Math.max(0, score + points);
    setScore(newScore);
    onScoreUpdate(newScore);

    // Reset hole quickly after hit
    setTimeout(() => {
      setHoles(current => {
        const resetHoles = [...current];
        resetHoles[id] = { ...resetHoles[id], droneType: 'none', hit: false };
        return resetHoles;
      });
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
    };
  }, []);

  const toggleMute = () => {
    const newMute = !muted;
    setMuted(newMute);
    audio.toggleMute();
  };

  const getDroneVisuals = (type: Hole['droneType'], isHit: boolean) => {
    if (isHit) {
      return (
        <motion.div 
          initial={{ scale: 1, opacity: 1 }}
          animate={{ scale: 1.5, opacity: 0 }}
          className="text-yellow-400 font-black text-2xl drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]"
        >
          {type === 'bomb' ? 'BAM!' : 'HIT!'}
        </motion.div>
      );
    }

    switch (type) {
      case 'normal':
        return <div className="w-12 h-12 bg-blue-500 rounded-full border-4 border-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.6)] flex items-center justify-center text-white"><Target size={24} /></div>;
      case 'fast':
        return <div className="w-10 h-10 bg-pink-500 rounded-full border-2 border-pink-300 shadow-[0_0_20px_rgba(236,72,153,0.8)]  flex items-center justify-center text-white"><Target size={20} /></div>;
      case 'golden':
        return <div className="w-14 h-14 bg-yellow-400 rounded-xl border-4 border-yellow-200 shadow-[0_0_30px_rgba(250,204,21,0.9)] animate-bounce flex items-center justify-center text-black font-black text-xs">$$$</div>;
      case 'bomb':
        return <div className="w-12 h-12 bg-red-600 rounded-full border-4 border-red-900 shadow-[0_0_20px_rgba(220,38,38,0.8)] flex items-center justify-center text-white animate-[pulse_0.2s_infinite]">💣</div>;
      default:
        return null;
    }
  };

  const getGameState = () => {
    if (!isPlaying && score === 0 && timeLeft === 30) return 'ready';
    if (!isPlaying) return 'gameover';
    return 'playing';
  };

  return (
    <GameContainer aspect="square" maxWidth="sm">
      {isPlaying && (
        <GameHUD 
          stats={[
            { id: 'score', label: 'SKOR', value: score, emphasized: true },
            { id: 'time', label: 'WAKTU', value: `00:${timeLeft.toString().padStart(2, '0')}` }
          ]} 
        />
      )}

      <GameOverlay
        gameState={getGameState()}
        score={score}
        onStart={startGame}
        onRestart={startGame}
        instructions="Ketuk atau klik drone cyber yang muncul dari lubang! Hindari bom merah. Kumpulkan skor sebanyak mungkin dalam 30 detik."
      />

      <div className="w-full aspect-square bg-zinc-950 p-6 rounded-2xl border-4 border-zinc-800 shadow-2xl relative">
        <div className="grid grid-cols-3 gap-4 h-full">
          {holes.map((hole) => (
            <div 
              key={hole.id} 
              className="bg-zinc-900 rounded-full border-4 border-zinc-800 shadow-[inset_0_10px_20px_rgba(0,0,0,0.8)] overflow-hidden relative flex items-center justify-center cursor-crosshair touch-none"
              onMouseDown={() => hole.active && !hole.hit ? hitDrone(hole.id, hole.droneType) : null}
              onTouchStart={(e) => {
                e.preventDefault();
                if (hole.active && !hole.hit) hitDrone(hole.id, hole.droneType);
              }}
            >
              <AnimatePresence>
                {(hole.active || hole.hit) && (
                  <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 50, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="absolute z-10 pointer-events-none"
                  >
                    {getDroneVisuals(hole.droneType, hole.hit)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-4 text-zinc-500 font-mono text-xs uppercase tracking-wider">
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Normal: +10</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-pink-500"></div> Fast: +25</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-400"></div> Golden: +100</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-600"></div> Bomb: -50</div>
      </div>
    </GameContainer>
  );
}
