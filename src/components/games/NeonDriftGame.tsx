import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameContainer } from '../gameplay/GameContainer';
import { GameHUD } from '../gameplay/GameHUD';
import { GameOverlay } from '../gameplay/GameOverlay';
import { audio } from '../../utils/audio';

interface GameProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
  highScore: number;
}

export default function NeonDriftGame({ onScoreUpdate, onGameOver, highScore }: GameProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [playerX, setPlayerX] = useState(50);
  const [obstacles, setObstacles] = useState<{ id: number; x: number; y: number }[]>([]);
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const startNewGame = () => {
    setScore(0);
    setGameOver(false);
    setIsPlaying(true);
    setPlayerX(50);
    setObstacles([]);
    audio.playCoin();
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (gameOver || !isPlaying) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      setPlayerX(p => Math.max(10, p - 5));
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      setPlayerX(p => Math.min(90, p + 5));
    }
  }, [gameOver, isPlaying]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const updateGame = useCallback((time: number) => {
    if (gameOver || !isPlaying) return;
    
    if (time - lastTimeRef.current > 1000 - Math.min(800, score * 10)) {
       setObstacles(prev => [...prev, { id: Date.now(), x: Math.random() * 80 + 10, y: -10 }]);
       lastTimeRef.current = time;
    }

    setObstacles(prev => {
      let isHit = false;
      const newObs = prev.map(obs => {
        const newY = obs.y + 1.5 + (score * 0.05);
        if (newY > 85 && newY < 95 && Math.abs(obs.x - playerX) < 8) {
          isHit = true;
        }
        return { ...obs, y: newY };
      }).filter(obs => obs.y < 110);
      
      if (isHit) {
        audio.playExplosion();
        setGameOver(true);
        setIsPlaying(false);
        onGameOver(Math.floor(score));
      }
      return newObs;
    });

    setScore(s => {
       const newScore = s + 0.1; // Accumulate slowly
       if (Math.floor(newScore) > Math.floor(s)) {
          onScoreUpdate(Math.floor(newScore));
       }
       return newScore;
    });

    frameRef.current = requestAnimationFrame(updateGame);
  }, [gameOver, isPlaying, playerX, score, onScoreUpdate, onGameOver]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(updateGame);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [updateGame]);

  const handleClickLeft = () => { if(isPlaying && !gameOver) setPlayerX(p => Math.max(10, p - 10)); };
  const handleClickRight = () => { if(isPlaying && !gameOver) setPlayerX(p => Math.min(90, p + 10)); };

  const getGameState = () => {
    if (!isPlaying && score === 0 && !gameOver) return 'ready';
    if (!isPlaying) return 'gameover';
    return 'playing';
  };

  return (
    <GameContainer aspect="video" maxWidth="md">
      {isPlaying && (
        <GameHUD 
          stats={[
            { id: 'score', label: 'SKOR', value: Math.floor(score), emphasized: true }
          ]} 
        />
      )}

      <GameOverlay
        gameState={getGameState()}
        score={Math.floor(score)}
        onStart={startNewGame}
        onRestart={startNewGame}
        instructions="Gunakan panah KIRI/KANAN atau tap sisi kiri/kanan layar untuk menggeser mobil neon dan menghindari rintangan balok fuchsia!"
      />

      <div className="w-full aspect-video bg-zinc-950 border-4 border-zinc-900 rounded-xl relative overflow-hidden mb-4 shadow-2xl select-none">
        {/* Grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] perspective-1000 pointer-events-none" style={{ transform: 'rotateX(60deg) scale(2)' }} />

        {/* Player */}
        <div 
          className="absolute bottom-[10%] w-8 h-12 bg-cyan-400 rounded-sm shadow-[0_0_20px_rgba(34,211,238,0.8)] z-20 transition-all duration-75 pointer-events-none"
          style={{ left: `${playerX}%`, transform: 'translateX(-50%)' }}
        >
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-orange-500 rounded-full blur-[4px] animate-pulse"></div>
        </div>

        {/* Obstacles */}
        {obstacles.map(obs => (
          <div 
            key={obs.id}
            className="absolute w-10 h-6 bg-fuchsia-600 rounded-sm shadow-[0_0_15px_rgba(192,38,211,0.8)] z-10 pointer-events-none"
            style={{ left: `${obs.x}%`, top: `${obs.y}%`, transform: 'translate(-50%, -50%)' }}
          />
        ))}
        
        {/* Touch Controls */}
        {isPlaying && (
          <div className="absolute inset-0 z-30 flex">
            <div className="flex-1 cursor-pointer" onTouchStart={handleClickLeft} onMouseDown={handleClickLeft}></div>
            <div className="flex-1 cursor-pointer" onTouchStart={(e) => { handleClickRight(); }} onMouseDown={() => { handleClickRight(); }}></div>
          </div>
        )}
      </div>
    </GameContainer>
  );
}
