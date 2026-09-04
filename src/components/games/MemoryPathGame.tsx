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

const MATRIX_SIZE = 16; // 4x4 grid

export default function MemoryPathGame({ onGameOver, onScoreUpdate, highScore }: GameProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sequence, setSequence] = useState<number[]>([]);
  const [userSelected, setUserSelected] = useState<number[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gridState, setGridState] = useState<'idle' | 'flash' | 'player'>('idle');

  const scoreRef = useRef(0);
  const sequenceRef = useRef<number[]>([]);

  useEffect(() => {
    scoreRef.current = score;
    onScoreUpdate(score);
  }, [score, onScoreUpdate]);

  const startNewGame = () => {
    audio.playCoin();
    setScore(0);
    setLives(3);
    setLevel(1);
    setIsPlaying(true);
    startNewLevel(1);
  };

  const startNewLevel = (currentLevel: number) => {
    setUserSelected([]);
    setIsRevealing(true);
    setGridState('flash');
    
    // Generate a sequence of (level + 2) distinct cells
    const newSeq: number[] = [];
    const count = Math.min(currentLevel + 2, 9); // Max 9 boxes to memorize
    while (newSeq.length < count) {
      const idx = Math.floor(Math.random() * MATRIX_SIZE);
      if (!newSeq.includes(idx)) {
        newSeq.push(idx);
      }
    }

    setSequence(newSeq);
    sequenceRef.current = newSeq;

    // Turn off flashing after delay
    setTimeout(() => {
      setIsRevealing(false);
      setGridState('player');
    }, 1500 + currentLevel * 100); // dynamic memory peek time
  };

  const handleCellClick = (idx: number) => {
    if (!isPlaying || isRevealing || gridState !== 'player') return;

    // Check if the clicked cell is in the target sequence
    if (sequenceRef.current.includes(idx)) {
      if (userSelected.includes(idx)) return; // Avoid double clicking same

      audio.playCoin();
      const nextSelected = [...userSelected, idx];
      setUserSelected(nextSelected);

      // Check if all correct boxes are clicked
      if (nextSelected.length === sequenceRef.current.length) {
        audio.playLevelUp();
        setScore(prev => prev + level * 50);
        const nextLvl = level + 1;
        setLevel(nextLvl);
        setGridState('idle');
        setTimeout(() => startNewLevel(nextLvl), 1000);
      }
    } else {
      // Wrong click
      audio.playHit();
      setLives(prev => {
        const next = prev - 1;
        if (next <= 0) {
          endGame();
        } else {
          // Restart same level as penalty
          setUserSelected([]);
          setGridState('idle');
          setTimeout(() => startNewLevel(level), 1000);
        }
        return next;
      });
    }
  };

  const endGame = () => {
    setIsPlaying(false);
    audio.playGameOver();
    onGameOver(scoreRef.current);
  };

  const getGameState = () => {
    if (!isPlaying && score === 0 && lives === 3) return 'ready';
    if (!isPlaying) return 'gameover';
    return 'playing';
  };

  return (
    <GameContainer aspect="square" maxWidth="sm">
      {isPlaying && (
        <GameHUD 
          stats={[
            { id: 'level', label: 'LEVEL', value: level },
            { id: 'lives', label: 'NYAWA', value: Array(lives).fill('❤️').join('') },
            { id: 'score', label: 'SKOR', value: score, emphasized: true }
          ]} 
        />
      )}

      <GameOverlay
        gameState={getGameState()}
        score={score}
        onStart={startNewGame}
        onRestart={startNewGame}
        instructions="Hafalkan letak grid siber biru yang menyala sekejap, lalu ketuk kembali semua sel tersebut dengan presisi kognitif sempurna!"
      />

      <div className="w-full aspect-square bg-zinc-950 p-2 sm:p-4 rounded-xl border-4 border-zinc-900 shadow-2xl relative flex flex-col justify-center items-center">
        {/* Mode Indicator Toast */}
        {isPlaying && (
          <div className="mb-4 font-mono text-xs uppercase tracking-wider text-center h-4">
            {gridState === 'flash' ? (
              <span className="text-yellow-400 font-black">HAFALKAN GRID TEAL! 👁️</span>
            ) : gridState === 'player' ? (
              <span className="text-cyan-400 font-black">KETUK KEMBALI SEKARANG! ⚡</span>
            ) : (
              <span className="text-zinc-500 font-black">...</span>
            )}
          </div>
        )}

        {/* 4x4 Grid Matrix */}
        <div className="grid grid-cols-4 gap-2 sm:gap-2.5 p-2 sm:p-3 bg-zinc-900 border border-zinc-800 rounded-3xl w-full h-full">
          {Array(16).fill(null).map((_, idx) => {
            const isTargetFlashing = gridState === 'flash' && sequence.includes(idx);
            const isSelected = gridState === 'player' && userSelected.includes(idx);
            
            return (
              <button
                key={idx}
                onClick={() => handleCellClick(idx)}
                className={`w-full aspect-square rounded-xl border-2 transition-all duration-300 ${
                  isTargetFlashing
                    ? 'bg-cyan-500 border-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.8)] scale-105 z-10'
                    : isSelected
                    ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-95'
                    : 'bg-zinc-950 border-zinc-800/80 hover:border-zinc-700 cursor-pointer'
                }`}
              />
            );
          })}
        </div>
      </div>
    </GameContainer>
  );
}
