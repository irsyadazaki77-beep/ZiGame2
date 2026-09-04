import React, { useState, useEffect, useRef } from 'react';
import { audio } from '../../utils/audio';
import { Flag, Bomb } from 'lucide-react';
import { motion } from 'motion/react';
import { GameContainer } from '../gameplay/GameContainer';
import { GameHUD } from '../gameplay/GameHUD';
import { GameOverlay } from '../gameplay/GameOverlay';

interface CyberMinesProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface Cell {
  x: number;
  y: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborMines: number;
}

const ROWS = 10;
const COLS = 10;
const TOTAL_MINES = 15;

export default function CyberMinesGame({ onGameOver, onScoreUpdate, highScore }: CyberMinesProps) {
  const [board, setBoard] = useState<Cell[][]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [score, setScore] = useState(0);
  const [muted, setMuted] = useState(audio.getMuteState());
  const [flagsRemaining, setFlagsRemaining] = useState(TOTAL_MINES);
  
  // Create a new board
  const initializeBoard = () => {
    let newBoard: Cell[][] = [];
    for (let y = 0; y < ROWS; y++) {
      let row: Cell[] = [];
      for (let x = 0; x < COLS; x++) {
        row.push({
          x,
          y,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          neighborMines: 0
        });
      }
      newBoard.push(row);
    }
    
    // Plant mines
    let minesPlanted = 0;
    while (minesPlanted < TOTAL_MINES) {
      const rx = Math.floor(Math.random() * COLS);
      const ry = Math.floor(Math.random() * ROWS);
      if (!newBoard[ry][rx].isMine) {
        newBoard[ry][rx].isMine = true;
        minesPlanted++;
      }
    }
    
    // Calculate neighbors
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!newBoard[y][x].isMine) {
          let count = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (y + dy >= 0 && y + dy < ROWS && x + dx >= 0 && x + dx < COLS) {
                if (newBoard[y + dy][x + dx].isMine) count++;
              }
            }
          }
          newBoard[y][x].neighborMines = count;
        }
      }
    }
    
    setBoard(newBoard);
    setFlagsRemaining(TOTAL_MINES);
    setScore(0);
    setGameOver(false);
    setWon(false);
  };

  useEffect(() => {
    initializeBoard();
  }, []);

  const startGame = () => {
    initializeBoard();
    setIsPlaying(true);
    audio.playCoin();
  }

;

  const revealCell = (x: number, y: number) => {
    if (!isPlaying || gameOver || won || board[y][x].isRevealed || board[y][x].isFlagged) return;

    let newBoard = [...board];
    
    if (newBoard[y][x].isMine) {
      // Game Over
      newBoard[y][x].isRevealed = true;
      setBoard(newBoard);
      handleGameOver(false);
      return;
    }

    // Flood fill to reveal
    let revealedCount = 0;
    const stack = [[x, y]];
    while (stack.length > 0) {
      const [cx, cy] = stack.pop()!;
      if (!newBoard[cy][cx].isRevealed && !newBoard[cy][cx].isFlagged) {
        newBoard[cy][cx].isRevealed = true;
        revealedCount++;
        
        if (newBoard[cy][cx].neighborMines === 0) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = cx + dx;
              const ny = cy + dy;
              if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
                if (!newBoard[ny][nx].isRevealed) {
                  stack.push([nx, ny]);
                }
              }
            }
          }
        }
      }
    }

    setBoard(newBoard);
    const newScore = score + (revealedCount * 10);
    setScore(newScore);
    onScoreUpdate(newScore);
    audio.playHit();
    
    checkWinCondition(newBoard);
  };

  const toggleFlag = (e: React.MouseEvent, x: number, y: number) => {
    e.preventDefault();
    if (!isPlaying || gameOver || won || board[y][x].isRevealed) return;

    let newBoard = [...board];
    if (newBoard[y][x].isFlagged) {
      newBoard[y][x].isFlagged = false;
      setFlagsRemaining(prev => prev + 1);
      audio.playJump();
    } else {
      if (flagsRemaining > 0) {
        newBoard[y][x].isFlagged = true;
        setFlagsRemaining(prev => prev - 1);
        audio.playLaser();
      }
    }
    setBoard(newBoard);
    checkWinCondition(newBoard);
  };

  const checkWinCondition = (currentBoard: Cell[][]) => {
    let unrevealedSafeCells = 0;
    let correctlyFlaggedMines = 0;

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!currentBoard[y][x].isMine && !currentBoard[y][x].isRevealed) {
          unrevealedSafeCells++;
        }
        if (currentBoard[y][x].isMine && currentBoard[y][x].isFlagged) {
          correctlyFlaggedMines++;
        }
      }
    }

    if (unrevealedSafeCells === 0 || correctlyFlaggedMines === TOTAL_MINES) {
      handleGameOver(true);
    }
  };

  const handleGameOver = (isWin: boolean) => {
    setGameOver(true);
    setIsPlaying(false);
    setWon(isWin);
    
    // Reveal all mines
    const finalBoard = [...board];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (finalBoard[y][x].isMine) {
          finalBoard[y][x].isRevealed = true;
        }
      }
    }
    setBoard(finalBoard);
    
    const finalScore = isWin ? score + 500 : score;
    setScore(finalScore);
    if (isWin) {
      audio.playLevelUp();
    } else {
      audio.playExplosion();
    }
    setTimeout(() => {
      onGameOver(finalScore);
    }, 1500);
  };

  const toggleMute = () => {
    const newMute = !muted;
    setMuted(newMute);
    audio.toggleMute();
  };

  const getNumberColor = (count: number) => {
    switch (count) {
      case 1: return 'text-blue-400';
      case 2: return 'text-green-400';
      case 3: return 'text-red-400';
      case 4: return 'text-purple-400';
      case 5: return 'text-yellow-400';
      case 6: return 'text-cyan-400';
      case 7: return 'text-orange-400';
      case 8: return 'text-pink-400';
      default: return 'text-white';
    }
  };

  const getGameState = () => {
    if (!isPlaying && score === 0 && !gameOver && !won) return 'ready';
    if (!isPlaying) return 'gameover';
    return 'playing';
  };

  return (
    <GameContainer aspect="square" maxWidth="sm">
      {isPlaying && (
        <GameHUD 
          stats={[
            { id: 'flags', label: 'BENDERA', value: flagsRemaining, icon: <Flag size={14} className="text-red-400" /> },
            { id: 'score', label: 'SKOR', value: score, emphasized: true }
          ]} 
        />
      )}

      <GameOverlay
        gameState={getGameState()}
        score={score}
        onStart={startGame}
        onRestart={startGame}
        instructions="Klik kiri untuk membuka area, klik kanan (atau tahan di HP) untuk memasang bendera."
      />

      <div className="w-full h-full p-4 flex flex-col items-center justify-center">
        <div className="w-full max-w-sm aspect-square bg-zinc-950/80 p-2 sm:p-4 rounded-xl border border-zinc-800 shadow-2xl">
          <div className="grid gap-1 w-full h-full" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
            {board.map((row, y) => (
              row.map((cell, x) => (
                <div 
                  key={`${x}-${y}`}
                  onClick={() => revealCell(x, y)}
                  onContextMenu={(e) => toggleFlag(e, x, y)}
                  className={`
                    aspect-square rounded flex items-center justify-center font-bold text-xs sm:text-sm cursor-pointer transition-colors duration-200
                    ${!cell.isRevealed 
                      ? 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 shadow-[inset_0_2px_4px_rgba(255,255,255,0.1)]' 
                      : cell.isMine 
                        ? 'bg-red-900/50 border border-red-500' 
                        : 'bg-zinc-900 border border-zinc-800/50 shadow-inner'
                    }
                  `}
                >
                  <motion.div
                    initial={cell.isRevealed || cell.isFlagged ? { scale: 0.5, opacity: 0 } : false}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    {cell.isRevealed ? (
                      cell.isMine ? (
                        <Bomb size={16} className="text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
                      ) : cell.neighborMines > 0 ? (
                        <span className={getNumberColor(cell.neighborMines)}>{cell.neighborMines}</span>
                      ) : null
                    ) : cell.isFlagged ? (
                      <Flag size={14} className="text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
                    ) : null}
                  </motion.div>
                </div>
              ))
            ))}
          </div>
        </div>
      </div>
    </GameContainer>
  );
}
