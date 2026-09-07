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

const COLS = 10;
const ROWS = 15;

const SHAPES = [
  [[1, 1, 1, 1]], // I
  [[1, 1, 1], [0, 1, 0]], // T
  [[1, 1], [1, 1]], // O
  [[1, 1, 0], [0, 1, 1]], // Z
  [[0, 1, 1], [1, 1, 0]], // S
  [[1, 1, 1], [1, 0, 0]], // L
  [[1, 1, 1], [0, 0, 1]], // J
];

const COLORS = [
  'bg-cyan-500 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.5)]',
  'bg-purple-500 border-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.5)]',
  'bg-yellow-500 border-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.5)]',
  'bg-red-500 border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
  'bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
  'bg-orange-500 border-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.5)]',
  'bg-blue-500 border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]',
];

export default function CyberTetrisGame({ onGameOver, onScoreUpdate, highScore }: GameProps) {
  const gameLoopRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [board, setBoard] = useState<number[][]>(() => Array(ROWS).fill(null).map(() => Array(COLS).fill(0)));
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [linesCleared, setLinesCleared] = useState(0);

  const boardRef = useRef<number[][]>([]);
  const scoreRef = useRef(0);
  const isPlayingRef = useRef(false);

  // Active falling piece
  const currentPiece = useRef<number[][]>([]);
  const currentPos = useRef<{ r: number; c: number }>({ r: 0, c: 0 });
  const currentColorIdx = useRef<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cabinetRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; color: string; radius: number; alpha: number; decay: number }[]>([]);
  const floatingTextsRef = useRef<{ x: number; y: number; text: string; color: string; alpha: number; vy: number }[]>([]);
  const shakeRef = useRef<number>(0);

  useEffect(() => {
    scoreRef.current = score;
    onScoreUpdate(score);
  }, [score, onScoreUpdate]);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const spawnPiece = () => {
    const idx = Math.floor(Math.random() * SHAPES.length);
    currentPiece.current = SHAPES[idx];
    currentColorIdx.current = idx + 1; // 1-indexed for colored cells

    // Center piece at the top
    const startCol = Math.floor((COLS - currentPiece.current[0].length) / 2);
    currentPos.current = { r: 0, c: startCol };

    // Check collision right away (Game over state)
    if (checkCollision(0, startCol, currentPiece.current)) {
      endGame();
    }
  };

  const checkCollision = (nextR: number, nextC: number, piece: number[][]): boolean => {
    const currentBoard = boardRef.current;
    for (let r = 0; r < piece.length; r++) {
      for (let c = 0; c < piece[r].length; c++) {
        if (piece[r][c] !== 0) {
          const boardR = nextR + r;
          const boardC = nextC + c;

          // Check walls
          if (boardC < 0 || boardC >= COLS || boardR >= ROWS) {
            return true;
          }

          // Check static blocks
          if (boardR >= 0 && currentBoard[boardR][boardC] !== 0) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const triggerLineClearEffects = (rows: number[]) => {
    let shakeAmt = 5;
    let feedbackText = "SINGLE!";
    let textColor = "#06b6d4"; // cyan

    if (rows.length === 2) {
      shakeAmt = 12;
      feedbackText = "DOUBLE! +300";
      textColor = "#a855f7"; // purple
    } else if (rows.length === 3) {
      shakeAmt = 20;
      feedbackText = "TRIPLE! +600";
      textColor = "#fbbf24"; // gold
    } else if (rows.length >= 4) {
      shakeAmt = 35;
      feedbackText = "TETRIS! +1000";
      textColor = "#ec4899"; // pink
    }

    shakeRef.current = Math.max(shakeRef.current, shakeAmt);

    if (rows.length > 0) {
      const midRow = rows[Math.floor(rows.length / 2)];
      const yPos = (midRow + 0.5) * (420 / ROWS);
      floatingTextsRef.current.push({
        x: 140, // center of 280
        y: yPos,
        text: feedbackText,
        color: textColor,
        alpha: 1.0,
        vy: -0.6
      });

      rows.forEach(r => {
        const yCoord = (r + 0.5) * (420 / ROWS);
        for (let i = 0; i < 20; i++) {
          particlesRef.current.push({
            x: Math.random() * 260 + 10,
            y: yCoord + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 3,
            color: textColor,
            radius: Math.random() * 2.5 + 1.5,
            alpha: 1.0,
            decay: Math.random() * 0.04 + 0.02
          });
        }
      });
    }
  };

  const triggerMergeEffects = (piece: number[][], rStart: number, cStart: number) => {
    shakeRef.current = Math.max(shakeRef.current, 3);
    for (let r = 0; r < piece.length; r++) {
      for (let c = 0; c < piece[r].length; c++) {
        if (piece[r][c] !== 0) {
          const cellX = (cStart + c + 0.5) * (280 / COLS);
          const cellY = (rStart + r + 1) * (420 / ROWS);
          for (let i = 0; i < 3; i++) {
            particlesRef.current.push({
              x: cellX + (Math.random() - 0.5) * 12,
              y: cellY - 2,
              vx: (Math.random() - 0.5) * 2,
              vy: -Math.random() * 1.5,
              color: '#6b7280', // grey dust
              radius: Math.random() * 1.5 + 1,
              alpha: 0.7,
              decay: 0.05
            });
          }
        }
      }
    }
  };

  const mergePiece = () => {
    const nextBoard = boardRef.current.map(row => [...row]);
    const piece = currentPiece.current;
    const { r: startR, c: startC } = currentPos.current;

    for (let r = 0; r < piece.length; r++) {
      for (let c = 0; c < piece[r].length; c++) {
        if (piece[r][c] !== 0) {
          const boardR = startR + r;
          const boardC = startC + c;
          if (boardR >= 0 && boardR < ROWS) {
            nextBoard[boardR][boardC] = currentColorIdx.current;
          }
        }
      }
    }

    // Check for row completions
    const rowsToClear: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      if (nextBoard[r].every(val => val !== 0)) {
        rowsToClear.push(r);
      }
    }

    if (rowsToClear.length > 0) {
      audio.playLevelUp();
      triggerLineClearEffects(rowsToClear);
      // Filter out completed rows
      const remainingRows = nextBoard.filter((_, idx) => !rowsToClear.includes(idx));
      // Re-populate with empty rows at the top
      while (remainingRows.length < ROWS) {
        remainingRows.unshift(Array(COLS).fill(0));
      }

      setBoard(remainingRows);
      
      // Update scores based on line clears
      const multiplier = [0, 100, 300, 600, 1000];
      const clearedCount = rowsToClear.length;
      setScore(prev => prev + multiplier[clearedCount] * level);
      setLinesCleared(prev => {
        const next = prev + clearedCount;
        if (next >= level * 10) {
          setLevel(l => l + 1);
        }
        return next;
      });
    } else {
      audio.playHit();
      triggerMergeEffects(piece, startR, startC);
      setBoard(nextBoard);
    }

    spawnPiece();
  };

  const moveLeft = () => {
    if (!isPlayingRef.current) return;
    const { r, c } = currentPos.current;
    if (!checkCollision(r, c - 1, currentPiece.current)) {
      audio.playCoin();
      currentPos.current.c = c - 1;
      forceUpdateBoardState();
    }
  };

  const moveRight = () => {
    if (!isPlayingRef.current) return;
    const { r, c } = currentPos.current;
    if (!checkCollision(r, c + 1, currentPiece.current)) {
      audio.playCoin();
      currentPos.current.c = c + 1;
      forceUpdateBoardState();
    }
  };

  const rotatePiece = () => {
    if (!isPlayingRef.current) return;
    const piece = currentPiece.current;
    const N = piece.length;
    const M = piece[0].length;

    // Transpose and reverse rows
    const rotated = Array(M).fill(null).map(() => Array(N).fill(0));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < M; c++) {
        rotated[c][N - 1 - r] = piece[r][c];
      }
    }

    const { r, c } = currentPos.current;
    if (!checkCollision(r, c, rotated)) {
      audio.playJump();
      currentPiece.current = rotated;
      forceUpdateBoardState();
    }
  };

  const dropDown = () => {
    if (!isPlayingRef.current) return;
    const { r, c } = currentPos.current;
    if (!checkCollision(r + 1, c, currentPiece.current)) {
      currentPos.current.r = r + 1;
      forceUpdateBoardState();
    } else {
      mergePiece();
    }
  };

  // Trigger UI update
  const [, setTick] = useState(0);
  const forceUpdateBoardState = () => {
    setTick(t => t + 1);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        moveLeft();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        moveRight();
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        rotatePiece();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        dropDown();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  // Main automatic drop timer loop
  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (isPlaying) {
      timerId = setInterval(() => {
        dropDown();
      }, Math.max(1000 - level * 100, 150));
    }
    return () => clearInterval(timerId);
  }, [isPlaying, level]);

  const startNewGame = () => {
    audio.playCoin();
    setBoard(Array(ROWS).fill(null).map(() => Array(COLS).fill(0)));
    setScore(0);
    setLevel(1);
    setLinesCleared(0);
    setIsPlaying(true);
    setTimeout(() => {
      spawnPiece();
      forceUpdateBoardState();
    }, 100);
  };

  const endGame = () => {
    setIsPlaying(false);
    audio.playGameOver();
    onGameOver(scoreRef.current);
  };

  // Canvas render loop for piece settlement & line-clear particle explosions
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, 280, 420);

      // Direct DOM camera shake on the grid cabinet stage
      const cabinet = cabinetRef.current;
      if (cabinet) {
        if (shakeRef.current > 0) {
          const dx = (Math.random() - 0.5) * shakeRef.current;
          const dy = (Math.random() - 0.5) * shakeRef.current;
          cabinet.style.transform = `translate(${dx}px, ${dy}px)`;
          // decay shake
          shakeRef.current *= 0.88;
          if (shakeRef.current < 0.5) {
            shakeRef.current = 0;
            cabinet.style.transform = 'none';
          }
        } else {
          cabinet.style.transform = 'none';
        }
      }

      // Update & Render neon block clear particles
      particlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
      particlesRef.current = particlesRef.current.filter(p => p.alpha > 0);

      // Update & Render floating multiplier score texts
      floatingTextsRef.current.forEach(t => {
        t.y += t.vy;
        t.alpha -= 0.022;

        ctx.fillStyle = t.color;
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 3;
        ctx.globalAlpha = Math.max(0, t.alpha);
        ctx.font = 'bold 9px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x, t.y);
      });
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
      floatingTextsRef.current = floatingTextsRef.current.filter(t => t.alpha > 0);

      animId = requestAnimationFrame(render);
    };

    if (isPlaying) {
      animId = requestAnimationFrame(render);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (cabinetRef.current) {
        cabinetRef.current.style.transform = 'none';
      }
    };
  }, [isPlaying]);

  const getGameState = () => {
    if (!isPlaying && score === 0 && level === 1) return 'ready';
    if (!isPlaying) return 'gameover';
    return 'playing';
  };

  return (
    <GameContainer aspect="portrait" maxWidth="sm">
      {isPlaying && (
        <GameHUD 
          stats={[
            { id: 'level', label: 'LEVEL', value: level },
            { id: 'lines', label: 'BARIS', value: linesCleared },
            { id: 'score', label: 'SKOR', value: score, emphasized: true }
          ]} 
        />
      )}

      <GameOverlay
        gameState={getGameState()}
        score={score}
        onStart={startNewGame}
        onRestart={startNewGame}
        instructions="Tumpuk dan rapikan barisan balok neon yang jatuh untuk membersihkan jalur grid."
      />

      <div ref={cabinetRef} className="relative w-full aspect-[10/15] mx-auto bg-zinc-950 rounded-xl border-4 border-zinc-900 shadow-2xl overflow-hidden transition-transform duration-75">
        <canvas ref={canvasRef} width={280} height={420} className="absolute inset-0 pointer-events-none z-20 w-full h-full" />
        <div className="grid grid-cols-10 gap-px w-full h-full p-1">
          {Array(ROWS).fill(null).map((_, r) =>
            Array(COLS).fill(null).map((_, c) => {
              let blockColorIdx = board[r]?.[c] || 0;
              
              const piece = currentPiece.current;
              const { r: startR, c: startC } = currentPos.current;
              
              if (
                r >= startR && r < startR + piece.length &&
                c >= startC && c < startC + piece[0].length
              ) {
                if (piece[r - startR][c - startC] !== 0) {
                  blockColorIdx = currentColorIdx.current;
                }
              }

              return (
                <div
                  key={`${r}-${c}`}
                  className={`w-full h-full rounded-sm border ${
                    blockColorIdx !== 0
                      ? COLORS[blockColorIdx - 1]
                      : 'bg-zinc-950 border-zinc-900/40 shadow-inner'
                  }`}
                />
              );
            })
          )}
        </div>
      </div>

      {isPlaying && (
        <MobileControls
          onUp={rotatePiece}
          onDown={dropDown}
          onLeft={moveLeft}
          onRight={moveRight}
        />
      )}
    </GameContainer>
  );
}
