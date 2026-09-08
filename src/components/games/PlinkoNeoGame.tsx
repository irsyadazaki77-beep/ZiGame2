import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { useGameEngine } from '../../hooks/useGameEngine';
import { Particle } from '../../types';
import { GameContainer } from '../gameplay/GameContainer';
import { GameHUD } from '../gameplay/GameHUD';
import { GameOverlay } from '../gameplay/GameOverlay';
import { MobileControls } from '../gameplay/MobileControls';
import { ArrowDown } from 'lucide-react';

interface PlinkoNeoGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface PlinkoPeg {
  x: number;
  y: number;
  radius: number;
}

interface PlinkoBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface PlinkoBucket {
  label: string;
  multiplier: number;
  color: string;
  xStart: number;
  xEnd: number;
}

export default function PlinkoNeoGame({ onGameOver, onScoreUpdate, highScore }: PlinkoNeoGameProps) {
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
    scoreRef,
    gameLoopRef
  } = useGameEngine({
    gameId: 'plinkoneo',
    onGameOver,
    onScoreUpdate,
  });

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const [ballsLeft, setBallsLeft] = useState(5);
  const ballsLeftRef = useRef(5);

  
  useEffect(() => {
    scoreRef.current = score;
    ballsLeftRef.current = ballsLeft;
  }, [score, ballsLeft]);

  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 500;

  // Plinko structure
  const pegsRef = useRef<PlinkoPeg[]>([]);
  const activeBallsRef = useRef<PlinkoBall[]>([]);
  const particlesRef = useRef<Particle[]>([]);

  // Define multiplier buckets at the bottom
  const buckets: PlinkoBucket[] = [
    { label: '5x', multiplier: 5, color: '#f43f5e', xStart: 0, xEnd: 66 },
    { label: '2x', multiplier: 2, color: '#ec4899', xStart: 66, xEnd: 133 },
    { label: '0.5x', multiplier: 0.5, color: '#a855f7', xStart: 133, xEnd: 200 },
    { label: '0.5x', multiplier: 0.5, color: '#a855f7', xStart: 200, xEnd: 266 },
    { label: '2x', multiplier: 2, color: '#ec4899', xStart: 266, xEnd: 333 },
    { label: '5x', multiplier: 5, color: '#f43f5e', xStart: 333, xEnd: 400 },
  ];

  useEffect(() => {
    generatePegGrid();
    drawStatic();
    return () => {
      if (gameLoopRef?.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, []);

  const generatePegGrid = () => {
    const list: PlinkoPeg[] = [];
    const startY = 90;
    const endY = 410;
    const rowGap = 35;
    
    let rowIndex = 0;
    for (let y = startY; y < endY; y += rowGap) {
      // Alternating offsets for hexagonal grid
      const count = rowIndex % 2 === 0 ? 8 : 9;
      const xGap = CANVAS_WIDTH / (count + 1);

      for (let i = 1; i <= count; i++) {
        list.push({
          x: i * xGap,
          y,
          radius: 4,
        });
      }
      rowIndex++;
    }
    pegsRef.current = list;
  };

  const drawStatic = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid wires
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < CANVAS_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 20px 'Space Grotesk', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('PLINKO NEO ARCADE', CANVAS_WIDTH / 2, 40);

    ctx.fillStyle = '#ec4899';
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillText('JATUHKAN BOLA NEON UNTUK MERAIH MULTIPLIER', CANVAS_WIDTH / 2, 65);

    // Pegs
    ctx.fillStyle = '#3f3f46';
    pegsRef.current.forEach(peg => {
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Buckets rendering
    buckets.forEach(b => {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(b.xStart + 2, 450, b.xEnd - b.xStart - 4, 50);
      ctx.fillStyle = b.color;
      ctx.font = "bold 13px 'Space Grotesk', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText(b.label, (b.xStart + b.xEnd) / 2, 480);
    });
  };

  const startGame = useCallback(() => {
    audio.playCoin();
    updateScore(0);
    setBallsLeft(5);

    activeBallsRef.current = [];
    particlesRef.current = [];

    startWithCountdown(() => {
      startLoop(gameStep);
    });
  }, [updateScore, startWithCountdown, startLoop]);

  const dropBall = () => {
    if (gameStateRef.current !== 'playing' || ballsLeft <= 0 || activeBallsRef.current.length > 0) return;

    audio.playCoin();
    setBallsLeft(prev => prev - 1);

    // Drop from top near center (with small random variation)
    const dropX = CANVAS_WIDTH / 2 + (Math.random() - 0.5) * 35;
    activeBallsRef.current.push({
      x: dropX,
      y: 65,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 1.0,
      radius: 6,
      color: '#10b981',
    });
  };

  const createPegSparks = (x: number, y: number, color: string) => {
    for (let i = 0; i < 6; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        color,
        radius: Math.random() * 1.5 + 1,
        alpha: 1,
        decay: Math.random() * 0.08 + 0.04,
      });
    }
  };

  const gameStep = useCallback((timestamp: number, dt: number) => {
    if (gameStateRef.current !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const delta = dt / 16.666;
    const gravity = 0.14;
    const bounceCoeff = 0.48; // bounciness factor

    // Update balls physics
    activeBallsRef.current.forEach(ball => {
      ball.vy += gravity * delta;
      
      // Air resistance
      ball.vx *= 0.99;

      ball.x += ball.vx * delta;
      ball.y += ball.vy * delta;

      // Bounce at side walls
      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
        ball.vx = -ball.vx * bounceCoeff;
        audio.playJump();
      } else if (ball.x + ball.radius > CANVAS_WIDTH) {
        ball.x = CANVAS_WIDTH - ball.radius;
        ball.vx = -ball.vx * bounceCoeff;
        audio.playJump();
      }

      // Check Peg collisions
      pegsRef.current.forEach(peg => {
        const dist = Math.hypot(ball.x - peg.x, ball.y - peg.y);
        const minDist = ball.radius + peg.radius;

        if (dist < minDist) {
          // Resolve collision
          const nx = (ball.x - peg.x) / dist;
          const ny = (ball.y - peg.y) / dist;

          // Push out of peg
          ball.x = peg.x + nx * minDist;
          ball.y = peg.y + ny * minDist;

          // Bounce velocity vector
          const dotProd = ball.vx * nx + ball.vy * ny;
          ball.vx = (ball.vx - 2 * dotProd * nx) * bounceCoeff;
          ball.vy = (ball.vy - 2 * dotProd * ny) * bounceCoeff;

          // Add a tiny random force to avoid getting stuck
          ball.vx += (Math.random() - 0.5) * 0.5;

          // Sparks and sound
          createPegSparks(peg.x, peg.y, '#eab308');
          audio.playHit();
        }
      });

      // Bottom bucket landing check
      if (ball.y > 450) {
        // Find bucket index
        const bx = ball.x;
        const bucket = buckets.find(b => bx >= b.xStart && bx <= b.xEnd) || buckets[2];

        // Rewarding points based on multiplier!
        const earnedPoints = Math.floor(100 * bucket.multiplier);
        addScore(earnedPoints);

        audio.playLevelUp();
        createPegSparks(ball.x, 455, bucket.color);

        // Delete ball
        ball.y = CANVAS_HEIGHT + 200;

        // Check game end condition
        if (ballsLeftRef.current <= 0) {
          setTimeout(() => {
            triggerGameOver();
          }, 1200);
        }
      }
    });

    activeBallsRef.current = activeBallsRef.current.filter(b => b.y < CANVAS_HEIGHT + 50);

    // DRAW
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Pegs
    pegsRef.current.forEach(peg => {
      ctx.fillStyle = '#52525b';
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Buckets
    buckets.forEach(b => {
      // Bucket wall divider vertical bars
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b.xStart, 440);
      ctx.lineTo(b.xStart, CANVAS_HEIGHT);
      ctx.stroke();

      ctx.fillStyle = '#18181b';
      ctx.fillRect(b.xStart + 2, 450, b.xEnd - b.xStart - 4, 50);

      // Glow multiplier
      ctx.fillStyle = b.color;
      ctx.font = "bold 12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText(b.label, (b.xStart + b.xEnd) / 2, 480);
    });

    // Draw particle effects
    particlesRef.current.forEach(p => {
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.alpha -= p.decay * delta;

      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
    particlesRef.current = particlesRef.current.filter(p => p.alpha > 0);

    // Draw Falling Ball (if active)
    activeBallsRef.current.forEach(ball => {
      ctx.shadowBlur = 10;
      ctx.shadowColor = ball.color;
      ctx.fillStyle = ball.color;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Header stats
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.textAlign = 'left';
    ctx.fillText(`BOLA: ${ballsLeftRef.current}`, 15, 30);
    ctx.textAlign = 'right';
    ctx.fillText(`SKOR: ${score}`, CANVAS_WIDTH - 15, 30);
  }, [addScore, triggerGameOver]);

  return (
    <GameContainer aspect="portrait" maxWidth="sm">
      {gameState === 'playing' && (
        <GameHUD 
          stats={[
            { id: 'score', label: 'SKOR', value: score, emphasized: true },
            { id: 'balls', label: 'BOLA', value: ballsLeft }
          ]} 
        />
      )}

      <GameOverlay
        gameState={gameState}
        score={score}
        countdown={countdown}
        onStart={startGame}
        onRestart={startGame}
        instructions="Jatuhkan bola neon untuk meraih multiplier. Kumpulkan skor sebanyak-banyaknya!"
      />

      <div className="w-full h-full border-4 border-zinc-900 bg-black rounded-2xl overflow-hidden shadow-2xl relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full object-fill block bg-zinc-950"
        />
      </div>

      {gameState === 'playing' && (
        <div className="mt-4 flex gap-4 w-full">
          <button
            onClick={dropBall}
            disabled={ballsLeft <= 0 || activeBallsRef.current.length > 0}
            className="w-full py-4 bg-pink-600 hover:bg-pink-500 disabled:bg-zinc-800 disabled:text-zinc-500 active:scale-95 border border-pink-500 disabled:border-transparent rounded-xl text-sm font-black text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-pink-600/20 transition-all uppercase tracking-wider"
          >
            <ArrowDown size={15} /> JATUHKAN BOLA ({ballsLeft})
          </button>
        </div>
      )}
    </GameContainer>
  );
}
