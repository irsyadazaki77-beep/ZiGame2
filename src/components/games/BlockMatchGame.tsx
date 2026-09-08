import React, { useState, useEffect, useRef } from 'react';
import { audio } from '../../utils/audio';
import { GameContainer } from '../gameplay/GameContainer';
import { GameHUD } from '../gameplay/GameHUD';
import { GameOverlay } from '../gameplay/GameOverlay';
import { RefreshCw } from 'lucide-react';

interface GameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

type BlockColor = 'red' | 'blue' | 'yellow' | 'green' | 'purple';

interface GridCell {
  id: string;
  color: BlockColor;
  isMatched: boolean;
}

const COLORS: BlockColor[] = ['red', 'blue', 'yellow', 'green', 'purple'];
const COLOR_STYLES: Record<BlockColor, string> = {
  red: 'bg-red-500 border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.4)] text-red-100',
  blue: 'bg-blue-500 border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.4)] text-blue-100',
  yellow: 'bg-yellow-500 border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.4)] text-yellow-100',
  green: 'bg-emerald-500 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)] text-emerald-100',
  purple: 'bg-purple-500 border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.4)] text-purple-100',
};

const GRID_SIZE = 6;

export default function BlockMatchGame({ onGameOver, onScoreUpdate, highScore }: GameProps) {
  const scoreRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [grid, setGrid] = useState<GridCell[][]>([]);
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(25);
  const [hasValidMoves, setHasValidMoves] = useState(true);
  const [combo, setCombo] = useState(1);

  useEffect(() => {
    scoreRef.current = score;
    onScoreUpdate(score);
  }, [score, onScoreUpdate]);

  const initGrid = (): GridCell[][] => {
    const newGrid: GridCell[][] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      const row: GridCell[] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        row.push({
          id: `${r}-${c}-${Math.random()}`,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          isMatched: false,
        });
      }
      newGrid.push(row);
    }
    return newGrid;
  };

  const startNewGame = () => {
    audio.playCoin();
    setScore(0);
    setMovesLeft(25);
    setCombo(1);
    setGrid(initGrid());
    setIsPlaying(true);
    setHasValidMoves(true);
  };

  // BFS / Flood-fill to find connected matching blocks
  const getConnectedBlocks = (startRow: number, startCol: number, color: BlockColor, currentGrid: GridCell[][]): [number, number][] => {
    const queue: [number, number][] = [[startRow, startCol]];
    const connected: [number, number][] = [];
    const visited = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(false));
    visited[startRow][startCol] = true;

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      connected.push([r, c]);

      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;

        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
          if (!visited[nr][nc] && currentGrid[nr][nc].color === color) {
            visited[nr][nc] = true;
            queue.push([nr, nc]);
          }
        }
      }
    }

    return connected;
  };

  const checkAnyMovesLeft = (currentGrid: GridCell[][]): boolean => {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const matches = getConnectedBlocks(r, c, currentGrid[r][c].color, currentGrid);
        if (matches.length >= 2) return true;
      }
    }
    return false;
  };

  const handleCellClick = (r: number, c: number) => {
    if (!isPlaying || movesLeft <= 0) return;

    const targetColor = grid[r][c].color;
    const matchingCoordinates = getConnectedBlocks(r, c, targetColor, grid);

    // Blast only if 2 or more are connected
    if (matchingCoordinates.length < 2) {
      audio.playHit();
      return;
    }

    audio.playLaser();
    
    // Calculate points
    const earnedPoints = matchingCoordinates.length * 10 * combo;
    setScore(prev => prev + earnedPoints);
    setMovesLeft(prev => prev - 1);

    // Apply blast (nullify color)
    const nextGrid = grid.map(row => row.map(cell => ({ ...cell })));
    for (const [br, bc] of matchingCoordinates) {
      nextGrid[br][bc].isMatched = true;
    }

    // Apply Gravity (blocks fall down)
    for (let col = 0; col < GRID_SIZE; col++) {
      // Collect non-empty cells in the column from bottom to top
      const columnCells: GridCell[] = [];
      for (let row = GRID_SIZE - 1; row >= 0; row--) {
        if (!nextGrid[row][col].isMatched) {
          columnCells.push(nextGrid[row][col]);
        }
      }

      // Fill remaining top slots with brand-new cells
      while (columnCells.length < GRID_SIZE) {
        columnCells.push({
          id: `new-${col}-${Math.random()}`,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          isMatched: false,
        });
      }

      // Re-populate nextGrid for this column
      for (let row = GRID_SIZE - 1; row >= 0; row--) {
        nextGrid[row][col] = columnCells[GRID_SIZE - 1 - row];
      }
    }

    setGrid(nextGrid);

    // Trigger combo increase
    if (matchingCoordinates.length >= 4) {
      setCombo(prev => prev + 1);
    } else {
      setCombo(1);
    }

    // Check if we ran out of moves or if board is deadlocked
    setTimeout(() => {
      if (!checkAnyMovesLeft(nextGrid)) {
        // Automatically reshuffle board if no moves are left but turns are left!
        if (movesLeft > 1) {
          audio.playLevelUp();
          let shuffledGrid = nextGrid;
          let safety = 0;
          do {
            shuffledGrid = initGrid();
            safety++;
          } while (!checkAnyMovesLeft(shuffledGrid) && safety < 10);
          setGrid(shuffledGrid);
        } else {
          endGame();
        }
      }
    }, 300);
  };

  const endGame = () => {
    setIsPlaying(false);
    audio.playGameOver();
    onGameOver(score);
  };

  useEffect(() => {
    if (isPlaying && movesLeft <= 0) {
      endGame();
    }
  }, [movesLeft, isPlaying]);

  const getGameState = () => {
    if (!isPlaying && score === 0 && movesLeft === 25) return 'ready';
    if (!isPlaying) return 'gameover';
    return 'playing';
  };

  return (
    <GameContainer aspect="square" maxWidth="sm">
      {isPlaying && (
        <GameHUD 
          stats={[
            { id: 'moves', label: 'LANGKAH', value: `${movesLeft} KALI`, emphasized: movesLeft <= 5 },
            { id: 'combo', label: 'KOMBO', value: `x${combo}` },
            { id: 'score', label: 'SKOR', value: score, emphasized: true }
          ]} 
        />
      )}

      <GameOverlay
        gameState={getGameState()}
        score={score}
        onStart={startNewGame}
        onRestart={startNewGame}
        instructions="Hancurkan barisan balok neon berwarna sama yang saling terhubung."
      />

      <div className="grid grid-cols-6 gap-1 sm:gap-2 p-2 sm:p-3 bg-zinc-900 border-2 border-zinc-800 rounded-3xl w-full max-w-[400px] aspect-square mx-auto">
        {grid.map((row, r) =>
          row.map((cell, c) => (
            <button
              key={cell.id}
              onClick={() => handleCellClick(r, c)}
              className={`w-full aspect-square rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 ${
                COLOR_STYLES[cell.color]
              }`}
            />
          ))
        )}
      </div>

      {isPlaying && (
        <div className="game-mobile-controls mt-4 flex items-center gap-2 text-zinc-500 font-mono text-xs uppercase tracking-wider mx-auto">
          <RefreshCw size={10} className="animate-spin text-zinc-600" />
          Papan otomatis diacak kembali jika menemui jalan buntu.
        </div>
      )}
    </GameContainer>
  );
}
