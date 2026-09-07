import React, { useState, useEffect, useRef, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { motion, AnimatePresence } from 'motion/react';
import { GameContainer } from '../gameplay/GameContainer';
import { GameHUD } from '../gameplay/GameHUD';
import { GameOverlay } from '../gameplay/GameOverlay';
import { MobileControls } from '../gameplay/MobileControls';

interface Neon2048Props {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

const GRID_SIZE = 4;

export default function Neon2048Game({ onGameOver, onScoreUpdate, highScore }: Neon2048Props) {
  const [board, setBoard] = useState<number[][]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [muted, setMuted] = useState(audio.getMuteState());

  const getEmptyCoordinates = (currentBoard: number[][]) => {
    const emptyCoords = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (currentBoard[r][c] === 0) {
          emptyCoords.push({ r, c });
        }
      }
    }
    return emptyCoords;
  };

  const addRandomTile = (currentBoard: number[][]) => {
    const emptyCoords = getEmptyCoordinates(currentBoard);
    if (emptyCoords.length === 0) return currentBoard;

    const randomCoord = emptyCoords[Math.floor(Math.random() * emptyCoords.length)];
    const newBoard = currentBoard.map(row => [...row]);
    newBoard[randomCoord.r][randomCoord.c] = Math.random() < 0.9 ? 2 : 4;
    return newBoard;
  };

  const initializeBoard = () => {
    let initialBoard = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));
    initialBoard = addRandomTile(initialBoard);
    initialBoard = addRandomTile(initialBoard);
    setBoard(initialBoard);
    setScore(0);
    setGameOver(false);
    setIsPlaying(true);
  };

  const startGame = () => {
    initializeBoard();
    audio.playCoin();
  };

  const toggleMute = () => {
    const newMute = !muted;
    setMuted(newMute);
    audio.toggleMute();
  };

  const moveLeft = (currentBoard: number[][]) => {
    const newBoard = currentBoard.map(row => [...row]);
    let pointsAdded = 0;
    let moved = false;

    for (let r = 0; r < GRID_SIZE; r++) {
      let row = newBoard[r].filter(val => val !== 0);
      for (let c = 0; c < row.length - 1; c++) {
        if (row[c] === row[c + 1]) {
          row[c] *= 2;
          pointsAdded += row[c];
          row[c + 1] = 0;
        }
      }
      row = row.filter(val => val !== 0);
      while (row.length < GRID_SIZE) {
        row.push(0);
      }
      if (newBoard[r].join(',') !== row.join(',')) {
        moved = true;
      }
      newBoard[r] = row;
    }
    return { newBoard, pointsAdded, moved };
  };

  const rotateRight = (matrix: number[][]) => {
    const result = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      const newRow = [];
      for (let r = GRID_SIZE - 1; r >= 0; r--) {
        newRow.push(matrix[r][c]);
      }
      result.push(newRow);
    }
    return result;
  };

  const rotateLeft = (matrix: number[][]) => {
    const result = [];
    for (let c = GRID_SIZE - 1; c >= 0; c--) {
      const newRow = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        newRow.push(matrix[r][c]);
      }
      result.push(newRow);
    }
    return result;
  };

  const moveRight = (currentBoard: number[][]) => {
    const rotated = rotateRight(rotateRight(currentBoard));
    const { newBoard, pointsAdded, moved } = moveLeft(rotated);
    return { newBoard: rotateLeft(rotateLeft(newBoard)), pointsAdded, moved };
  };

  const moveUp = (currentBoard: number[][]) => {
    const rotated = rotateLeft(currentBoard);
    const { newBoard, pointsAdded, moved } = moveLeft(rotated);
    return { newBoard: rotateRight(newBoard), pointsAdded, moved };
  };

  const moveDown = (currentBoard: number[][]) => {
    const rotated = rotateRight(currentBoard);
    const { newBoard, pointsAdded, moved } = moveLeft(rotated);
    return { newBoard: rotateLeft(newBoard), pointsAdded, moved };
  };

  const checkGameOver = (currentBoard: number[][]) => {
    if (getEmptyCoordinates(currentBoard).length > 0) return false;

    // Check horizontal merges
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE - 1; c++) {
        if (currentBoard[r][c] === currentBoard[r][c + 1]) return false;
      }
    }

    // Check vertical merges
    for (let c = 0; c < GRID_SIZE; c++) {
      for (let r = 0; r < GRID_SIZE - 1; r++) {
        if (currentBoard[r][c] === currentBoard[r + 1][c]) return false;
      }
    }

    return true;
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isPlaying || gameOver) return;

    let result = { newBoard: board, pointsAdded: 0, moved: false };

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        result = moveUp(board);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        result = moveDown(board);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        result = moveLeft(board);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        result = moveRight(board);
        break;
      default:
        return;
    }

    if (result.moved) {
      const finalBoard = addRandomTile(result.newBoard);
      setBoard(finalBoard);
      
      if (result.pointsAdded > 0) {
        const newScore = score + result.pointsAdded;
        setScore(newScore);
        onScoreUpdate(newScore);
        audio.playHit();
      } else {
        audio.playJump();
      }

      if (checkGameOver(finalBoard)) {
        setGameOver(true);
        setIsPlaying(false);
        audio.playExplosion();
        setTimeout(() => {
          onGameOver(score + result.pointsAdded);
        }, 1500);
      }
    }
  }, [board, isPlaying, gameOver, score]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !isPlaying || gameOver) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const dx = touchEndX - touchStartRef.current.x;
    const dy = touchEndY - touchStartRef.current.y;

    if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return; // Ignore small taps

    let result = { newBoard: board, pointsAdded: 0, moved: false };

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) result = moveRight(board);
      else result = moveLeft(board);
    } else {
      if (dy > 0) result = moveDown(board);
      else result = moveUp(board);
    }

    if (result.moved) {
      const finalBoard = addRandomTile(result.newBoard);
      setBoard(finalBoard);
      
      if (result.pointsAdded > 0) {
        const newScore = score + result.pointsAdded;
        setScore(newScore);
        onScoreUpdate(newScore);
        audio.playHit();
      } else {
        audio.playJump();
      }

      if (checkGameOver(finalBoard)) {
        setGameOver(true);
        setIsPlaying(false);
        audio.playExplosion();
        setTimeout(() => {
          onGameOver(score + result.pointsAdded);
        }, 1500);
      }
    }
    
    touchStartRef.current = null;
  };

  const getTileColor = (val: number) => {
    switch (val) {
      case 2: return 'bg-zinc-800 text-zinc-300 shadow-[inset_0_0_10px_rgba(255,255,255,0.05)]';
      case 4: return 'bg-zinc-700 text-zinc-200 shadow-[inset_0_0_15px_rgba(255,255,255,0.1)]';
      case 8: return 'bg-orange-500/80 text-white shadow-[0_0_10px_rgba(249,115,22,0.4)]';
      case 16: return 'bg-orange-600 text-white shadow-[0_0_15px_rgba(234,88,12,0.5)]';
      case 32: return 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.6)]';
      case 64: return 'bg-red-600 text-white shadow-[0_0_25px_rgba(220,38,38,0.7)]';
      case 128: return 'bg-yellow-400 text-black shadow-[0_0_20px_rgba(250,204,21,0.6)] text-xl font-black';
      case 256: return 'bg-yellow-500 text-black shadow-[0_0_25px_rgba(234,179,8,0.7)] text-xl font-black';
      case 512: return 'bg-lime-400 text-black shadow-[0_0_25px_rgba(163,230,53,0.7)] text-lg font-black';
      case 1024: return 'bg-lime-500 text-black shadow-[0_0_30px_rgba(132,204,22,0.8)] text-lg font-black';
      case 2048: return 'bg-cyan-400 text-black shadow-[0_0_35px_rgba(34,211,238,0.9)] text-lg font-black ';
      case 4096: return 'bg-cyan-500 text-black shadow-[0_0_40px_rgba(6,182,212,1)] text-lg font-black ';
      case 8192: return 'bg-purple-500 text-white shadow-[0_0_40px_rgba(168,85,247,1)] text-lg font-black ';
      default: return 'bg-zinc-900';
    }
  };

  // Setup initial board for display if not playing
  useEffect(() => {
    if (!isPlaying && board.length === 0) {
       setBoard(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0)));
    }
  }, []);

  const getGameState = () => {
    if (!isPlaying && score === 0 && (!board || board.length === 0 || board[0][0] === 0)) return 'ready';
    if (!isPlaying) return 'gameover';
    return 'playing';
  };

  return (
    <GameContainer aspect="square" maxWidth="sm">
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
        onStart={startGame}
        onRestart={startGame}
        instructions="Geser ke arah mana saja (atau gunakan panah) untuk menggabungkan ubin berangka sama dan capai 2048!"
      />

      <div 
        className="w-full aspect-square bg-zinc-950 p-2 sm:p-4 rounded-xl border-4 border-zinc-900 shadow-2xl relative select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 bg-zinc-900/50 p-1.5 sm:p-2 rounded-lg border border-zinc-800/50 shadow-inner w-full h-full">
          {board.map((row, rowIndex) => (
            row.map((cell, colIndex) => (
              <motion.div
                key={`${rowIndex}-${colIndex}-${cell}`}
                initial={cell > 0 ? { scale: 0.5, opacity: 0 } : false}
                animate={cell > 0 ? { scale: 1, opacity: 1 } : false}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`
                  aspect-square w-full rounded-md flex items-center justify-center font-display font-bold text-lg md:text-2xl transition-colors duration-200
                  ${cell === 0 ? 'bg-zinc-800/30' : getTileColor(cell)}
                `}
              >
                {cell > 0 ? cell : ''}
              </motion.div>
            ))
          ))}
        </div>
      </div>

      {isPlaying && (
        <MobileControls
          onUp={() => {
            const result = moveUp(board);
            if (result.moved) {
               const finalBoard = addRandomTile(result.newBoard);
               setBoard(finalBoard);
               if (result.pointsAdded > 0) {
                 const newScore = score + result.pointsAdded;
                 setScore(newScore);
                 onScoreUpdate(newScore);
                 audio.playHit();
               } else {
                 audio.playJump();
               }
               if (checkGameOver(finalBoard)) {
                 setGameOver(true);
                 setIsPlaying(false);
                 audio.playExplosion();
                 setTimeout(() => onGameOver(score + result.pointsAdded), 1500);
               }
            }
          }}
          onDown={() => {
            const result = moveDown(board);
            if (result.moved) {
               const finalBoard = addRandomTile(result.newBoard);
               setBoard(finalBoard);
               if (result.pointsAdded > 0) {
                 const newScore = score + result.pointsAdded;
                 setScore(newScore);
                 onScoreUpdate(newScore);
                 audio.playHit();
               } else {
                 audio.playJump();
               }
               if (checkGameOver(finalBoard)) {
                 setGameOver(true);
                 setIsPlaying(false);
                 audio.playExplosion();
                 setTimeout(() => onGameOver(score + result.pointsAdded), 1500);
               }
            }
          }}
          onLeft={() => {
            const result = moveLeft(board);
            if (result.moved) {
               const finalBoard = addRandomTile(result.newBoard);
               setBoard(finalBoard);
               if (result.pointsAdded > 0) {
                 const newScore = score + result.pointsAdded;
                 setScore(newScore);
                 onScoreUpdate(newScore);
                 audio.playHit();
               } else {
                 audio.playJump();
               }
               if (checkGameOver(finalBoard)) {
                 setGameOver(true);
                 setIsPlaying(false);
                 audio.playExplosion();
                 setTimeout(() => onGameOver(score + result.pointsAdded), 1500);
               }
            }
          }}
          onRight={() => {
            const result = moveRight(board);
            if (result.moved) {
               const finalBoard = addRandomTile(result.newBoard);
               setBoard(finalBoard);
               if (result.pointsAdded > 0) {
                 const newScore = score + result.pointsAdded;
                 setScore(newScore);
                 onScoreUpdate(newScore);
                 audio.playHit();
               } else {
                 audio.playJump();
               }
               if (checkGameOver(finalBoard)) {
                 setGameOver(true);
                 setIsPlaying(false);
                 audio.playExplosion();
                 setTimeout(() => onGameOver(score + result.pointsAdded), 1500);
               }
            }
          }}
        />
      )}
    </GameContainer>
  );
}
