import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { GameContainer } from '../gameplay/GameContainer';
import { GameHUD } from '../gameplay/GameHUD';
import { GameOverlay } from '../gameplay/GameOverlay';
import { audio } from '../../utils/audio';

interface GameProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
  highScore: number;
}

export default function JumpRopeGame({ onScoreUpdate, onGameOver, highScore }: GameProps) {
  const [score, setScore] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [ropePosition, setRopePosition] = useState(100);
  const [gameOver, setGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const startNewGame = () => {
    setScore(0);
    setGameOver(false);
    setIsPlaying(true);
    setRopePosition(100);
    audio.playCoin();
  };

  const jump = useCallback(() => {
    if (isJumping || gameOver || !isPlaying) return;
    setIsJumping(true);
    setTimeout(() => {
      setIsJumping(false);
    }, 500); // Jump duration
  }, [isJumping, gameOver]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jump]);

  useEffect(() => {
    if (gameOver || !isPlaying) return;

    let speed = 2 + Math.floor(score / 5); // Speed increases with score
    let animationFrameId: number;

    const gameLoop = () => {
      setRopePosition((prev) => {
        let newPos = prev - speed;
        
        // Check collision when rope is under the player (between 40 and 60)
        // Player is jumping if isJumping is true
        if (newPos > 40 && newPos < 60 && !isJumping) {
          audio.playExplosion();
          setGameOver(true);
          setIsPlaying(false);
          onGameOver(score);
          return prev;
        }

        if (newPos <= 0) {
          audio.playScore();
          setScore(s => {
            const next = s + 1;
            onScoreUpdate(next);
            return next;
          });
          return 100; // Reset rope
        }
        return newPos;
      });
      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameOver, isJumping, score, onScoreUpdate, onGameOver]);

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
            { id: 'score', label: 'SKOR', value: score, emphasized: true }
          ]} 
        />
      )}

      <GameOverlay
        gameState={getGameState()}
        score={score}
        onStart={startNewGame}
        onRestart={startNewGame}
        instructions="Lompat! Tekan SPASI, panah ATAS, atau klik area layar. Hindari rintangan neon yang lewat."
      />

      <div 
        className="w-full aspect-video bg-zinc-950 border-4 border-zinc-900 rounded-xl relative overflow-hidden mb-4 shadow-2xl cursor-pointer"
        onClick={jump}
      >
        {/* Ground */}
        <div className="absolute bottom-0 w-full h-1/3 bg-zinc-900 border-t-2 border-indigo-500/30"></div>

        {/* Player */}
        <motion.div 
          className="absolute bottom-1/3 w-10 sm:w-12 h-10 sm:h-12 bg-indigo-500 rounded-md shadow-[0_0_15px_rgba(79,70,229,0.8)]"
          animate={{ y: isJumping ? -100 : 0 }}
          transition={{ type: 'tween', duration: 0.25 }} 
          style={{
              left: '50%',
              transform: 'translateX(-50%)',
              transition: 'transform 0.25s ease-out'
          }}
        />

        {/* Rope/Obstacle */}
        {isPlaying && (
          <div 
            className="absolute bottom-[33%] h-6 sm:h-8 w-3 sm:w-4 bg-red-500 rounded-sm shadow-[0_0_15px_rgba(239,68,68,0.8)] z-30"
            style={{ left: `${ropePosition}%` }}
          />
        )}
      </div>
    </GameContainer>
  );
}
