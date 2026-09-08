import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { useGameEngine } from '../../hooks/useGameEngine';
import { Particle } from '../../types';
import { GameOverlay } from '../gameplay/GameOverlay';

interface NeonStackerGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface StackerRow {
  y: number;
  startX: number;
  width: number;
  color: string;
}

export default function NeonStackerGame({ onGameOver, onScoreUpdate, highScore }: NeonStackerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    gameState,
    setGameState,
    score,
    updateScore,
    addScore,
    startLoop,
    stopLoop,
    triggerGameOver,
    startWithCountdown,
    countdown,
  } = useGameEngine({
    gameId: 'neonstacker',
    onGameOver,
    onScoreUpdate,
  });

  const [gameWon, setGameWon] = useState(false);
  const gameStateRef = useRef(gameState);
  
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        handleStack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 500;
  const GRID_ROWS = 12;
  const GRID_COLS = 10;
  const CELL_SIZE = CANVAS_WIDTH / GRID_COLS;

  // Stacker State
  const currentRowRef = useRef(0);
  const activeRowWidthRef = useRef(3); // Starting with 3 cells wide
  const activeRowXRef = useRef(0);
  const directionRef = useRef(1); // 1 = right, -1 = left
  const stackedRowsRef = useRef<StackerRow[]>([]);
  const speedRef = useRef(150); // Tick interval in ms
  const lastTickRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef<number>(0);
  const floatingTextsRef = useRef<{ x: number; y: number; text: string; color: string; alpha: number; vy: number }[]>([]);

  useEffect(() => {
    draw();
  }, []);

  const startGame = useCallback(() => {
    setGameWon(false);
    updateScore(0);
    currentRowRef.current = 0;
    activeRowWidthRef.current = 3;
    activeRowXRef.current = Math.floor(Math.random() * (GRID_COLS - 3));
    stackedRowsRef.current = [];
    speedRef.current = 150;
    particlesRef.current = [];
    floatingTextsRef.current = [];
    shakeRef.current = 0;

    startWithCountdown(() => {
      lastTickRef.current = performance.now();
      startLoop(gameStep);
    });
  }, [startWithCountdown, startLoop, updateScore]);

  const gameStep = useCallback((timestamp: number) => {
    if (gameStateRef.current !== 'playing') return;

    if (timestamp - lastTickRef.current > speedRef.current) {
      activeRowXRef.current += directionRef.current;
      
      if (activeRowXRef.current <= 0) {
        activeRowXRef.current = 0;
        directionRef.current = 1;
      } else if (activeRowXRef.current + activeRowWidthRef.current >= GRID_COLS) {
        activeRowXRef.current = GRID_COLS - activeRowWidthRef.current;
        directionRef.current = -1;
      }
      
      lastTickRef.current = timestamp;
    }

    draw();
  }, []);

  const createStackParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 15; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 5,
        vy: -Math.random() * 4 - 1,
        color,
        radius: Math.random() * 2.5 + 1.5,
        alpha: 1,
        decay: Math.random() * 0.04 + 0.02,
      });
    }
  };

  const handleStack = () => {
    if (gameStateRef.current !== 'playing') return;

    const rowIdx = currentRowRef.current;
    const curX = activeRowXRef.current;
    const curWidth = activeRowWidthRef.current;
    const yVal = CANVAS_HEIGHT - (rowIdx + 1) * CELL_SIZE;

    // Row color styling
    const neonColors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16'];
    const rowColor = neonColors[rowIdx % neonColors.length];

    if (rowIdx === 0) {
      // First row always succeeds
      stackedRowsRef.current.push({
        y: yVal,
        startX: curX,
        width: curWidth,
        color: rowColor,
      });
      audio.playScore();
      shakeRef.current = 5;
      floatingTextsRef.current.push({
        x: (curX + curWidth / 2) * CELL_SIZE,
        y: yVal - 10,
        text: "START!",
        color: '#22c55e',
        alpha: 1.0,
        vy: -0.8
      });
      createStackParticles((curX + curWidth / 2) * CELL_SIZE, yVal, rowColor);
      
      // Move up
      currentRowRef.current++;
      speedRef.current = Math.max(40, speedRef.current - 8);
      activeRowXRef.current = Math.floor(Math.random() * (GRID_COLS - curWidth));
    } else {
      const prevRow = stackedRowsRef.current[rowIdx - 1];
      
      // Calculate overlap
      const currentLeft = curX;
      const currentRight = curX + curWidth;
      const prevLeft = prevRow.startX;
      const prevRight = prevRow.startX + prevRow.width;

      const overlapLeft = Math.max(currentLeft, prevLeft);
      const overlapRight = Math.min(currentRight, prevRight);
      const overlapWidth = overlapRight - overlapLeft;

      if (overlapWidth <= 0) {
        // Misstacked completely - Game Over!
        audio.playExplosion();
        shakeRef.current = 20;
        floatingTextsRef.current.push({
          x: CANVAS_WIDTH / 2,
          y: yVal,
          text: "MISSED!",
          color: '#ef4444',
          alpha: 1.0,
          vy: -1.0
        });
        triggerGameOver();
        return;
      }

      // Check for PERFECT placement (perfect match with the previous row)
      const isPerfect = (curX === prevRow.startX && curWidth === prevRow.width);
      let pointsWon = overlapWidth * 15 + rowIdx * 10;
      let textToShow = `+${pointsWon}`;
      let textColor = '#38bdf8';

      if (isPerfect) {
        pointsWon *= 2; // Double points for perfect placement
        textToShow = "PERFECT! x2";
        textColor = '#eab308'; // glowing yellow gold
        shakeRef.current = 12;
        // extra burst of sparkles
        createStackParticles((overlapLeft + overlapWidth / 2) * CELL_SIZE, yVal, '#fbbf24');
      } else {
        shakeRef.current = 6;
      }

      // Successful stack of size overlapWidth
      stackedRowsRef.current.push({
        y: yVal,
        startX: overlapLeft,
        width: overlapWidth,
        color: rowColor,
      });

      // Sparks
      createStackParticles((overlapLeft + overlapWidth / 2) * CELL_SIZE, yVal, rowColor);

      addScore(pointsWon);

      floatingTextsRef.current.push({
        x: (overlapLeft + overlapWidth / 2) * CELL_SIZE,
        y: yVal - 10,
        text: textToShow,
        color: textColor,
        alpha: 1.0,
        vy: -0.8
      });

      if (rowIdx + 1 >= GRID_ROWS) {
        // Reached the top!
        audio.playLevelUp();
        shakeRef.current = 25;
        floatingTextsRef.current.push({
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT / 2,
          text: "VICTORY!!",
          color: '#d946ef',
          alpha: 1.0,
          vy: -1.2
        });
        setGameWon(true);
        addScore(500); // Massive bonus for winning
        triggerGameOver();
        return;
      }

      // Prepare next row
      audio.playScore();
      activeRowWidthRef.current = overlapWidth;
      currentRowRef.current++;
      speedRef.current = Math.max(40, speedRef.current - 8);
      activeRowXRef.current = Math.floor(Math.random() * (GRID_COLS - overlapWidth));
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // --- DRAW FRAME ---
    ctx.save();
    if (shakeRef.current > 0) {
      const dx = (Math.random() - 0.5) * shakeRef.current;
      const dy = (Math.random() - 0.5) * shakeRef.current;
      ctx.translate(dx, dy);
      shakeRef.current *= 0.85;
      if (shakeRef.current < 0.5) shakeRef.current = 0;
    }

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Decorative retro scanline and side columns
    ctx.fillStyle = '#1e1b4b';
    for (let c = 0; c <= GRID_COLS; c++) {
      ctx.fillRect(c * CELL_SIZE, 0, 0.5, CANVAS_HEIGHT);
    }
    for (let r = 0; r <= GRID_ROWS; r++) {
      ctx.fillRect(0, r * CELL_SIZE, CANVAS_WIDTH, 0.5);
    }

    // Render historical stacked rows
    stackedRowsRef.current.forEach(row => {
      ctx.shadowBlur = 12;
      ctx.shadowColor = row.color;
      ctx.fillStyle = row.color;
      for (let i = 0; i < row.width; i++) {
        ctx.fillRect(
          (row.startX + i) * CELL_SIZE + 1.5,
          row.y + 1.5,
          CELL_SIZE - 3,
          CELL_SIZE - 3
        );
      }
    });

    // Render active row scrolling
    if (gameStateRef.current === 'playing') {
      const activeY = CANVAS_HEIGHT - (currentRowRef.current + 1) * CELL_SIZE;
      const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16'];
      const activeColor = colors[currentRowRef.current % colors.length];

      ctx.shadowBlur = 15;
      ctx.shadowColor = activeColor;
      ctx.fillStyle = activeColor;
      for (let i = 0; i < activeRowWidthRef.current; i++) {
        ctx.fillRect(
          (activeRowXRef.current + i) * CELL_SIZE + 1.5,
          activeY + 1.5,
          CELL_SIZE - 3,
          CELL_SIZE - 3
        );
      }
    }
    ctx.shadowBlur = 0;

    // Render particles
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
    particlesRef.current = particlesRef.current.filter(p => p.alpha > 0);

    // Score layout banner
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.textAlign = 'left';
    ctx.fillText(`BARIS: ${currentRowRef.current}/${GRID_ROWS}`, 15, 25);
    ctx.textAlign = 'right';
    ctx.fillText(`SKOR: ${score}`, CANVAS_WIDTH - 15, 25);

    // Render floating texts
    floatingTextsRef.current.forEach(t => {
      t.y += t.vy;
      t.alpha -= 0.025;

      ctx.fillStyle = t.color;
      ctx.globalAlpha = Math.max(0, t.alpha);
      ctx.font = 'bold 9px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1.0;
    floatingTextsRef.current = floatingTextsRef.current.filter(t => t.alpha > 0);

    ctx.restore();
  };

  return (
    <div className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-zinc-950">
      {/* HUD Bar inside the flex layout to prevent overlap */}
      <div className="w-full flex-none flex justify-between items-center mb-2 px-2 font-mono text-xs">
        <div className="text-red-500 font-bold uppercase tracking-wider">
          STATUS: <span className="text-white">ONLINE</span>
        </div>
        <div className="text-pink-500 font-bold uppercase tracking-wider">
          BARIS: <span className="text-white">{currentRowRef.current}/{GRID_ROWS}</span>
        </div>
        <div className="text-yellow-400 font-bold uppercase tracking-wider">
          SKOR: <span className="text-white">{score}</span>
        </div>
      </div>

      {/* Canvas Wrapper */}
      <div 
        onClick={handleStack}
        className="relative flex-1 min-h-0 w-full flex items-center justify-center bg-black rounded-xl border border-zinc-800 shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden cursor-pointer touch-none"
        title="Klik di mana saja untuk STACK!"
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="max-w-full max-h-full object-contain block bg-zinc-950"
        />

        <GameOverlay
          gameState={gameState}
          score={score}
          onStart={startGame}
          onRestart={startGame}
          countdown={countdown}
          instructions="Klik di mana saja pada layar atau tekan Spasi untuk menumpuk blok tepat di atas satu sama lain!"
        />
      </div>

      {gameState === 'playing' && (
        <div className="flex-none mt-2 w-full max-w-xs">
          <button
            onClick={(e) => { e.stopPropagation(); handleStack(); }}
            className="w-full py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold uppercase rounded-xl tracking-wider select-none text-sm transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
          >
            STACK!
          </button>
        </div>
      )}
    </div>
  );
}
