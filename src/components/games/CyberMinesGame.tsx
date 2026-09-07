import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';
import { audio } from '../../utils/audio';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Bomb, Flag, Eye, Sparkles } from 'lucide-react';

interface GameProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
  highScore: number;
}

interface Cell {
  r: number;
  c: number;
  isMine: boolean;
  isOpen: boolean;
  isFlagged: boolean;
  neighborMines: number;
}

const ROWS = 9;
const COLS = 9;
const MINES_COUNT = 10;

export default function CyberMinesGame({ onScoreUpdate, onGameOver, highScore }: GameProps) {
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [flagsRemaining, setFlagsRemaining] = useState(MINES_COUNT);
  const [actionMode, setActionMode] = useState<'reveal' | 'flag'>('reveal');
  const [firstClickDone, setFirstClickDone] = useState(false);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredRef = useRef(false);

  const {
    gameState,
    score,
    updateScore,
    triggerGameOver,
    startWithCountdown,
    countdown
  } = useGameEngine({
    gameId: 'cyber-mines',
    onGameOver,
    onScoreUpdate
  });

  // Initialize empty grid
  const initializeGrid = useCallback((): Cell[][] => {
    const newGrid: Cell[][] = [];
    for (let r = 0; r < ROWS; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < COLS; c++) {
        row.push({
          r,
          c,
          isMine: false,
          isOpen: false,
          isFlagged: false,
          neighborMines: 0
        });
      }
      newGrid.push(row);
    }
    return newGrid;
  }, []);

  // Place mines safely avoiding the first clicked cell
  const placeMines = (initialGrid: Cell[][], safeR: number, safeC: number): Cell[][] => {
    const newGrid = initialGrid.map(row => row.map(cell => ({ ...cell })));
    let placed = 0;

    while (placed < MINES_COUNT) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);

      // Don't place on first click cell or adjacent neighbors
      const isNearSafe = Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1;
      if (!newGrid[r][c].isMine && !isNearSafe) {
        newGrid[r][c].isMine = true;
        placed++;
      }
    }

    // Compute neighbor counts
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!newGrid[r][c].isMine) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && newGrid[nr][nc].isMine) {
                count++;
              }
            }
          }
          newGrid[r][c].neighborMines = count;
        }
      }
    }

    return newGrid;
  };

  // Reveal Cell Logic (with cascade)
  const revealCell = useCallback((r: number, c: number, currentGrid?: Cell[][]) => {
    if (gameState !== 'playing') return;

    const g = currentGrid || grid;
    if (!g || !g[r] || !g[r][c]) return;
    const target = g[r][c];

    if (target.isOpen || target.isFlagged) return;

    let activeGrid = g;

    // First click safe setup
    if (!firstClickDone) {
      activeGrid = placeMines(g, r, c);
      setFirstClickDone(true);
    }

    const nextGrid = activeGrid.map(row => row.map(cell => ({ ...cell })));
    const clickedCell = nextGrid[r][c];

    // Mine hit
    if (clickedCell.isMine) {
      clickedCell.isOpen = true;
      audio.playExplosion();
      inputManager.vibrateGamepad(250, 0.85);

      // Open all mines
      for (let i = 0; i < ROWS; i++) {
        for (let j = 0; j < COLS; j++) {
          if (nextGrid[i][j].isMine) {
            nextGrid[i][j].isOpen = true;
          }
        }
      }

      setGrid(nextGrid);
      triggerGameOver();
      return;
    }

    // Cascade reveal for empty cells
    const queue: [number, number][] = [[r, c]];
    clickedCell.isOpen = true;
    let newlyOpened = 1;

    while (queue.length > 0) {
      const [currR, currC] = queue.shift()!;
      const curr = nextGrid[currR][currC];

      if (curr.neighborMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = currR + dr;
            const nc = currC + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
              const neighbor = nextGrid[nr][nc];
              if (!neighbor.isOpen && !neighbor.isFlagged && !neighbor.isMine) {
                neighbor.isOpen = true;
                newlyOpened++;
                if (neighbor.neighborMines === 0) {
                  queue.push([nr, nc]);
                }
              }
            }
          }
        }
      }
    }

    audio.playScore();
    setGrid(nextGrid);

    // Calculate score
    let totalOpen = 0;
    for (let i = 0; i < ROWS; i++) {
      for (let j = 0; j < COLS; j++) {
        if (nextGrid[i][j].isOpen && !nextGrid[i][j].isMine) totalOpen++;
      }
    }

    const points = totalOpen * 15;
    updateScore(points);

    // Check Win Condition
    const nonMineCount = ROWS * COLS - MINES_COUNT;
    if (totalOpen >= nonMineCount) {
      audio.playPowerup();
      updateScore(points + 500); // Win bonus
      triggerGameOver();
    }
  }, [firstClickDone, gameState, grid, triggerGameOver, updateScore]);

  // Toggle Flag Logic
  const toggleFlag = useCallback((r: number, c: number) => {
    if (gameState !== 'playing' || !grid[r] || !grid[r][c]) return;
    const target = grid[r][c];
    if (target.isOpen) return;

    const nextGrid = grid.map(row => row.map(cell => ({ ...cell })));
    const nextFlagged = !target.isFlagged;

    if (nextFlagged && flagsRemaining <= 0) return;

    nextGrid[r][c].isFlagged = nextFlagged;
    setGrid(nextGrid);
    setFlagsRemaining(prev => nextFlagged ? prev - 1 : prev + 1);
    audio.playLaser();
    inputManager.vibrateGamepad(40, 0.3);
  }, [flagsRemaining, gameState, grid]);

  // Click / Touch Handler
  const handleCellClick = (r: number, c: number) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    if (actionMode === 'flag') {
      toggleFlag(r, c);
    } else {
      revealCell(r, c);
    }
  };

  // Long press for touch mobile flag
  const handleTouchStart = (r: number, c: number) => {
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      toggleFlag(r, c);
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Start lifecycle
  const startGame = useCallback(() => {
    const fresh = initializeGrid();
    setGrid(fresh);
    setFlagsRemaining(MINES_COUNT);
    setFirstClickDone(false);
    updateScore(0);

    startWithCountdown(() => {});
  }, [initializeGrid, startWithCountdown, updateScore]);

  useEffect(() => {
    setGrid(initializeGrid());
  }, [initializeGrid]);

  return (
    <div className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-[#090b14]">
      {/* HUD */}
      <div className="w-full max-w-[360px] flex-none flex justify-between items-center mb-2 px-3 py-1 bg-[#121622]/80 border border-white/[0.06] rounded-xl text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <Flag size={14} className="text-rose-400" />
          <span className="text-zinc-400">BENDERA:</span>
          <span className="text-rose-400 font-bold">{flagsRemaining}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-zinc-400">SKOR:</span>
          <span className="text-white font-bold">{score}</span>
        </div>
      </div>

      {/* Mode Switcher Toggle */}
      <div className="w-full max-w-[360px] flex-none flex gap-2 mb-2">
        <button
          onClick={() => setActionMode('reveal')}
          className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            actionMode === 'reveal'
              ? 'bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-600/30'
              : 'bg-white/[0.04] text-zinc-400 border-white/[0.06] hover:bg-white/[0.08]'
          }`}
        >
          <Eye size={14} /> Buka Petak
        </button>
        <button
          onClick={() => setActionMode('flag')}
          className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            actionMode === 'flag'
              ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-600/30'
              : 'bg-white/[0.04] text-zinc-400 border-white/[0.06] hover:bg-white/[0.08]'
          }`}
        >
          <Flag size={14} /> Pasang Bendera
        </button>
      </div>

      {/* Grid Container */}
      <div className="relative flex-none w-full max-w-[360px] aspect-square bg-[#101424] p-2.5 rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden select-none">
        <div className="grid grid-cols-9 grid-rows-9 gap-1 w-full h-full">
          {grid.map((row, r) =>
            row.map((cell, c) => {
              let cellContent: React.ReactNode = null;
              let cellStyle = 'bg-white/[0.05] border-white/[0.06] hover:bg-white/[0.1] text-zinc-300';

              if (cell.isOpen) {
                if (cell.isMine) {
                  cellStyle = 'bg-rose-900/80 border-rose-500 text-rose-300 animate-pulse';
                  cellContent = <Bomb size={16} className="text-rose-400" />;
                } else {
                  cellStyle = 'bg-[#090d18] border-white/[0.04] text-white';
                  if (cell.neighborMines > 0) {
                    const colors = [
                      'text-sky-400',
                      'text-emerald-400',
                      'text-amber-400',
                      'text-indigo-400',
                      'text-rose-400',
                      'text-pink-400',
                      'text-purple-400',
                      'text-white'
                    ];
                    cellContent = (
                      <span className={`font-black text-sm ${colors[cell.neighborMines - 1]}`}>
                        {cell.neighborMines}
                      </span>
                    );
                  }
                }
              } else if (cell.isFlagged) {
                cellStyle = 'bg-rose-950/60 border-rose-600/50 text-rose-400';
                cellContent = <Flag size={14} className="text-rose-400" />;
              }

              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => handleCellClick(r, c)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    toggleFlag(r, c);
                  }}
                  onTouchStart={() => handleTouchStart(r, c)}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                  className={`flex items-center justify-center rounded-lg border transition-all duration-100 font-bold select-none cursor-pointer ${cellStyle}`}
                >
                  {cellContent}
                </button>
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
          instructions="Bongkar seluruh ladang ranjau siber tanpa meledakkan bom! Gunakan mode bendera atau tekan lama untuk menandai ranjau."
        />
      </div>
    </div>
  );
}
