import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';
import { audio } from '../../utils/audio';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { MobileControls } from '../gameplay/MobileControls';
import { Trophy } from 'lucide-react';

interface GameProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
  highScore: number;
}

type Board = number[][];

const BOARD_SIZE = 4;

const TILE_COLORS: Record<number, { bg: string; text: string; glow: string }> = {
  2: { bg: 'bg-zinc-800 text-zinc-100 border-zinc-700', text: 'text-zinc-100', glow: 'shadow-none' },
  4: { bg: 'bg-indigo-950 text-indigo-200 border-indigo-700', text: 'text-indigo-200', glow: 'shadow-[0_0_8px_rgba(99,102,241,0.2)]' },
  8: { bg: 'bg-indigo-900 text-indigo-100 border-indigo-500', text: 'text-indigo-100', glow: 'shadow-[0_0_10px_rgba(99,102,241,0.3)]' },
  16: { bg: 'bg-blue-900 text-blue-100 border-blue-500', text: 'text-blue-100', glow: 'shadow-[0_0_12px_rgba(59,130,246,0.35)]' },
  32: { bg: 'bg-cyan-900 text-cyan-100 border-cyan-400', text: 'text-cyan-100', glow: 'shadow-[0_0_14px_rgba(6,182,212,0.4)]' },
  64: { bg: 'bg-emerald-900 text-emerald-100 border-emerald-400', text: 'text-emerald-100', glow: 'shadow-[0_0_16px_rgba(16,185,129,0.45)]' },
  128: { bg: 'bg-amber-900 text-amber-100 border-amber-400', text: 'text-amber-100', glow: 'shadow-[0_0_18px_rgba(245,158,11,0.5)]' },
  256: { bg: 'bg-orange-900 text-orange-100 border-orange-400', text: 'text-orange-100', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.55)]' },
  512: { bg: 'bg-rose-900 text-rose-100 border-rose-400', text: 'text-rose-100', glow: 'shadow-[0_0_22px_rgba(244,63,94,0.6)]' },
  1024: { bg: 'bg-pink-900 text-pink-100 border-pink-400', text: 'text-pink-100', glow: 'shadow-[0_0_24px_rgba(236,72,153,0.65)]' },
  2048: { bg: 'bg-purple-900 text-purple-100 border-purple-300', text: 'text-purple-100', glow: 'shadow-[0_0_28px_rgba(168,85,247,0.8)]' }
};

export default function Neon2048Game({ onScoreUpdate, onGameOver, highScore }: GameProps) {
  const [board, setBoard] = useState<Board>(() => createEmptyBoard());
  const [highestTile, setHighestTile] = useState(2);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const {
    gameState,
    score,
    updateScore,
    triggerGameOver,
    startWithCountdown,
    countdown
  } = useGameEngine({
    gameId: 'neon-2048',
    onGameOver,
    onScoreUpdate
  });

  function createEmptyBoard(): Board {
    return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
  }

  function addRandomTile(currentBoard: Board): { board: Board; added: boolean } {
    const emptyCells: { r: number; c: number }[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (currentBoard[r][c] === 0) emptyCells.push({ r, c });
      }
    }

    if (emptyCells.length === 0) return { board: currentBoard, added: false };

    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const val = Math.random() < 0.9 ? 2 : 4;
    const newBoard = currentBoard.map(row => [...row]);
    newBoard[randomCell.r][randomCell.c] = val;
    return { board: newBoard, added: true };
  }

  // Check if any valid moves remain
  const checkHasMoves = useCallback((b: Board): boolean => {
    // 1. Any empty cell
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (b[r][c] === 0) return true;
      }
    }

    // 2. Any adjacent horizontal merger
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE - 1; c++) {
        if (b[r][c] === b[r][c + 1]) return true;
      }
    }

    // 3. Any adjacent vertical merger
    for (let r = 0; r < BOARD_SIZE - 1; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (b[r][c] === b[r + 1][c]) return true;
      }
    }

    return false;
  }, []);

  // Slide & Merge a single row
  const slideRow = (row: number[]): { newRow: number[]; gainedScore: number; moved: boolean } => {
    const nonZeros = row.filter(val => val !== 0);
    const newRow: number[] = [];
    let gainedScore = 0;
    let skipNext = false;

    for (let i = 0; i < nonZeros.length; i++) {
      if (skipNext) {
        skipNext = false;
        continue;
      }
      if (i < nonZeros.length - 1 && nonZeros[i] === nonZeros[i + 1]) {
        const mergedVal = nonZeros[i] * 2;
        newRow.push(mergedVal);
        gainedScore += mergedVal;
        skipNext = true;
      } else {
        newRow.push(nonZeros[i]);
      }
    }

    while (newRow.length < BOARD_SIZE) {
      newRow.push(0);
    }

    const moved = row.some((val, idx) => val !== newRow[idx]);
    return { newRow, gainedScore, moved };
  };

  // Move in 4 directions
  const handleMove = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameState !== 'playing') return;

    let movedAny = false;
    let totalScoreGain = 0;
    const nextBoard: Board = createEmptyBoard();

    if (direction === 'left') {
      for (let r = 0; r < BOARD_SIZE; r++) {
        const { newRow, gainedScore, moved } = slideRow(board[r]);
        nextBoard[r] = newRow;
        totalScoreGain += gainedScore;
        if (moved) movedAny = true;
      }
    } else if (direction === 'right') {
      for (let r = 0; r < BOARD_SIZE; r++) {
        const reversed = [...board[r]].reverse();
        const { newRow, gainedScore, moved } = slideRow(reversed);
        nextBoard[r] = newRow.reverse();
        totalScoreGain += gainedScore;
        if (moved) movedAny = true;
      }
    } else if (direction === 'up') {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const col = [board[0][c], board[1][c], board[2][c], board[3][c]];
        const { newRow, gainedScore, moved } = slideRow(col);
        for (let r = 0; r < BOARD_SIZE; r++) {
          nextBoard[r][c] = newRow[r];
        }
        totalScoreGain += gainedScore;
        if (moved) movedAny = true;
      }
    } else if (direction === 'down') {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const col = [board[3][c], board[2][c], board[1][c], board[0][c]];
        const { newRow, gainedScore, moved } = slideRow(col);
        const reversed = newRow.reverse();
        for (let r = 0; r < BOARD_SIZE; r++) {
          nextBoard[r][c] = reversed[r];
        }
        totalScoreGain += gainedScore;
        if (moved) movedAny = true;
      }
    }

    if (!movedAny) return;

    // Play sounds & haptics
    if (totalScoreGain > 0) {
      audio.playPowerup();
      inputManager.vibrateGamepad(60, 0.4);
    } else {
      audio.playScore();
    }

    // Add random tile
    const { board: spawnedBoard } = addRandomTile(nextBoard);
    setBoard(spawnedBoard);

    const newScore = (score || 0) + totalScoreGain;
    updateScore(newScore);

    // Compute highest tile
    let maxT = 2;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (spawnedBoard[r][c] > maxT) maxT = spawnedBoard[r][c];
      }
    }
    setHighestTile(maxT);

    // Check game over
    if (!checkHasMoves(spawnedBoard)) {
      audio.playExplosion();
      triggerGameOver();
    }
  }, [board, checkHasMoves, gameState, score, triggerGameOver, updateScore]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          handleMove('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          handleMove('down');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          handleMove('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          handleMove('right');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, handleMove]);

  // Touch swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos.current || gameState !== 'playing') return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartPos.current.x;
    const dy = touch.clientY - touchStartPos.current.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 30) {
      if (Math.abs(dx) > Math.abs(dy)) {
        handleMove(dx > 0 ? 'right' : 'left');
      } else {
        handleMove(dy > 0 ? 'down' : 'up');
      }
    }
    touchStartPos.current = null;
  };

  // Start lifecycle
  const startGame = useCallback(() => {
    const empty = createEmptyBoard();
    const t1 = addRandomTile(empty);
    const t2 = addRandomTile(t1.board);
    setBoard(t2.board);
    setHighestTile(2);
    updateScore(0);

    startWithCountdown(() => {});
  }, [startWithCountdown, updateScore]);

  return (
    <div className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-[#090b14]">
      {/* HUD */}
      <div className="w-full max-w-[360px] flex-none flex justify-between items-center mb-3 px-3 py-1 bg-[#121622]/80 border border-white/[0.06] rounded-xl text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <Trophy size={14} className="text-amber-400" />
          <span className="text-zinc-400">TERTINGGI:</span>
          <span className="text-amber-300 font-bold">{highestTile}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-zinc-400">SKOR:</span>
          <span className="text-white font-bold">{score}</span>
        </div>
      </div>

      {/* Grid Container */}
      <div
        className="relative flex-none w-full max-w-[360px] aspect-square bg-[#101424] p-3 rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden touch-none select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="grid grid-cols-4 grid-rows-4 gap-2.5 w-full h-full">
          {board.map((row, r) =>
            row.map((val, c) => {
              const tileStyle = TILE_COLORS[val] || {
                bg: 'bg-purple-950 text-white border-purple-400',
                text: 'text-white',
                glow: 'shadow-[0_0_30px_rgba(168,85,247,0.9)]'
              };

              return (
                <div
                  key={`${r}-${c}`}
                  className={`flex items-center justify-center rounded-xl border transition-all duration-150 font-black select-none ${
                    val === 0
                      ? 'bg-white/[0.03] border-white/[0.04]'
                      : `${tileStyle.bg} ${tileStyle.glow} text-lg sm:text-2xl scale-100 animate-in zoom-in-50`
                  }`}
                >
                  {val > 0 ? val : ''}
                </div>
              );
            })
          )}
        </div>

        <GameOverlay
          gameState={gameState}
          score={score}
          highScore={highScore}
          countdown={countdown}
          onStart={startGame}
          onRestart={startGame}
          instructions="Gabungkan kotak berangka sama untuk mencapai 2048! Geser layar atau gunakan tombol panah WASD."
        />
      </div>

      {/* Mobile D-Pad */}
      {gameState === 'playing' && (
        <div className="flex-none mt-3 md:hidden">
          <MobileControls onDirection={handleMove} />
        </div>
      )}
    </div>
  );
}
