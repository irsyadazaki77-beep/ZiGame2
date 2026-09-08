import React, { useState, useEffect, useRef } from 'react';
import { audio } from '../../utils/audio';
import { GameContainer } from '../gameplay/GameContainer';
import { GameHUD } from '../gameplay/GameHUD';
import { GameOverlay } from '../gameplay/GameOverlay';
import { MobileControls } from '../gameplay/MobileControls';

interface GameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

type MazeCell = 'wall' | 'path' | 'start' | 'goal';

const GRID_SIZE = 7; // Odd size works perfectly for standard recursive division maze generation

export default function MazeRunnerGame({ onGameOver, onScoreUpdate, highScore }: GameProps) {
  const scoreRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [grid, setGrid] = useState<MazeCell[][]>([]);
  const [playerPos, setPlayerPos] = useState<{ r: number; c: number }>({ r: 1, c: 1 });
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(40);

  useEffect(() => {
    scoreRef.current = score;
    onScoreUpdate(score);
  }, [score, onScoreUpdate]);

  // Procedural 7x7 Neon Maze Generator
  const generateMaze = (): MazeCell[][] => {
    // 0 = wall, 1 = path
    const maze: MazeCell[][] = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill('wall'));

    // Setup basic paths
    for (let r = 1; r < GRID_SIZE - 1; r++) {
      for (let c = 1; c < GRID_SIZE - 1; c++) {
        // Create grid channels
        if (r % 2 !== 0 || c % 2 !== 0) {
          maze[r][c] = 'path';
        }
      }
    }

    // Add random walls to make it a real maze but guarantee paths
    maze[2][2] = 'wall';
    maze[4][4] = 'wall';
    maze[2][4] = Math.random() > 0.5 ? 'wall' : 'path';
    maze[4][2] = Math.random() > 0.5 ? 'wall' : 'path';

    // Ensure start & goal are always clear
    maze[1][1] = 'start';
    maze[GRID_SIZE - 2][GRID_SIZE - 2] = 'goal';

    return maze;
  };

  const startNewGame = () => {
    audio.playCoin();
    setScore(0);
    setTimeLeft(40);
    setPlayerPos({ r: 1, c: 1 });
    setGrid(generateMaze());
    setIsPlaying(true);
  };

  const movePlayer = (dr: number, dc: number) => {
    if (!isPlaying) return;
    const nr = playerPos.r + dr;
    const nc = playerPos.c + dc;

    if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
      if (grid[nr][nc] !== 'wall') {
        audio.playCoin();
        setPlayerPos({ r: nr, c: nc });

        // Check Goal
        if (grid[nr][nc] === 'goal') {
          audio.playLevelUp();
          setScore(prev => prev + 100);
          setTimeLeft(prev => Math.min(prev + 12, 60)); // Gain bonus time
          setPlayerPos({ r: 1, c: 1 });
          setGrid(generateMaze());
        }
      } else {
        audio.playHit();
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        movePlayer(-1, 0);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        movePlayer(1, 0);
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        movePlayer(0, -1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        movePlayer(0, 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, playerPos]);

  // Timer Countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  const endGame = () => {
    setIsPlaying(false);
    audio.playGameOver();
    onGameOver(score);
  };

  const getGameState = () => {
    if (!isPlaying && score === 0 && timeLeft === 40) return 'ready';
    if (!isPlaying) return 'gameover';
    return 'playing';
  };

  return (
    <GameContainer aspect="portrait" maxWidth="sm">
      {isPlaying && (
        <GameHUD 
          stats={[
            { id: 'time', label: 'SISA WAKTU', value: `${timeLeft} DETIK`, emphasized: timeLeft < 10 },
            { id: 'score', label: 'SKOR', value: score, emphasized: true }
          ]} 
        />
      )}

      <GameOverlay
        gameState={getGameState()}
        score={score}
        onStart={startNewGame}
        onRestart={startNewGame}
        instructions="Arahkan kapsul siber melewati labirin acak menuju portal keluar berwarna ungu neon. Selesaikan secepatnya untuk mendapatkan bonus waktu!"
      />

      <div className="grid grid-cols-7 gap-px sm:gap-0.5 border-4 border-zinc-900 p-1 bg-zinc-950 rounded-xl w-full aspect-square mx-auto shadow-2xl overflow-hidden">
        {grid.map((row, r) =>
          row.map((cell, c) => {
            const isPlayer = playerPos.r === r && playerPos.c === c;
            return (
              <div
                key={`${r}-${c}`}
                className={`w-full aspect-square rounded-md transition-all duration-150 flex items-center justify-center text-xs sm:text-base select-none ${
                  isPlayer
                    ? 'bg-yellow-400 border border-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.8)] text-black font-black scale-105 z-10'
                    : cell === 'wall'
                    ? 'bg-zinc-900 shadow-inner'
                    : cell === 'goal'
                    ? 'bg-purple-600 border border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.8)] animate-pulse'
                    : 'bg-zinc-950 border border-zinc-950/20'
                }`}
              >
                {isPlayer ? '👾' : cell === 'goal' ? '🌀' : ''}
              </div>
            );
          })
        )}
      </div>

      {isPlaying && (
        <MobileControls
          onUp={() => movePlayer(-1, 0)}
          onDown={() => movePlayer(1, 0)}
          onLeft={() => movePlayer(0, -1)}
          onRight={() => movePlayer(0, 1)}
        />
      )}
    </GameContainer>
  );
}
