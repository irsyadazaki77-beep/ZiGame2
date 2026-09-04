import React, { useState, useEffect, useRef, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { GameOverlay } from '../gameplay/GameOverlay';
import { MobileControls } from '../gameplay/MobileControls';
import { useGameEngine } from '../../hooks/useGameEngine';

interface SnakeGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

type Point = { x: number; y: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

const GRID_SIZE = 20;
const INITIAL_SNAKE = [
  { x: 10, y: 10 },
  { x: 10, y: 11 },
  { x: 10, y: 12 },
];
const INITIAL_DIRECTION = { x: 0, y: -1 };
const BASE_SPEED = 140; // ms per move

export default function SnakeGame({ onGameOver, onScoreUpdate, highScore }: SnakeGameProps) {
  const {
    gameState,
    setGameState,
    gameStateRef,
    score,
    updateScore,
    triggerGameOver,
    startWithCountdown,
    startLoop,
  } = useGameEngine({ onScoreUpdate, onGameOver });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snakeRef = useRef<Point[]>(INITIAL_SNAKE);
  const directionRef = useRef<Point>(INITIAL_DIRECTION);
  const nextDirectionRef = useRef<Point>(INITIAL_DIRECTION);
  const foodRef = useRef<Point>({ x: 5, y: 5 });
  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef<number>(0);
  
  const moveTimerRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);

  const generateFood = useCallback((currentSnake: Point[]) => {
    let newFood: Point;
    let isOccupied = true;
    while (isOccupied) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      // eslint-disable-next-line no-loop-func
      isOccupied = currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
    }
    return newFood!;
  }, []);

  // Sharp DPR canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = 500 * dpr;
    canvas.height = 500 * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  const spawnFoodParticles = (x: number, y: number) => {
    const colors = ['#f43f5e', '#fb7185', '#fda4af', '#ffffff'];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const speed = 1.5 + Math.random() * 2;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: colors[i % colors.length]
      });
    }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();

    // Subtle screen shake
    if (shakeRef.current > 0) {
      const sx = (Math.random() - 0.5) * shakeRef.current;
      const sy = (Math.random() - 0.5) * shakeRef.current;
      ctx.translate(sx, sy);
      shakeRef.current = Math.max(0, shakeRef.current - 0.5);
    }

    const logicalSize = 500;
    ctx.clearRect(0, 0, logicalSize, logicalSize);
    const cellSize = logicalSize / GRID_SIZE;

    // Clean Subtle Background
    ctx.fillStyle = '#090b10';
    ctx.fillRect(0, 0, logicalSize, logicalSize);

    // Subtle Grid Points
    ctx.fillStyle = '#171c2b';
    for (let x = 0; x <= GRID_SIZE; x++) {
      for (let y = 0; y <= GRID_SIZE; y++) {
        ctx.fillRect(x * cellSize - 1, y * cellSize - 1, 2, 2);
      }
    }

    // Food (Apple)
    const cx = foodRef.current.x * cellSize + cellSize / 2;
    const cy = foodRef.current.y * cellSize + cellSize / 2;
    const radius = cellSize / 2.6;
    
    // Soft food halo
    const glowGrad = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.8);
    glowGrad.addColorStop(0, 'rgba(244, 63, 94, 0.4)');
    glowGrad.addColorStop(1, 'rgba(244, 63, 94, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Food body
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Food highlight
    ctx.fillStyle = '#ffe4e6';
    ctx.beginPath();
    ctx.arc(cx - radius * 0.25, cy - radius * 0.25, radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Draw Particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.04;
      if (p.life <= 0) {
        particlesRef.current.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5 * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Draw Snake
    snakeRef.current.forEach((segment, index) => {
      const isHead = index === 0;
      const x = segment.x * cellSize + 2;
      const y = segment.y * cellSize + 2;
      const w = cellSize - 4;
      const h = cellSize - 4;

      if (isHead) {
        ctx.fillStyle = '#10b981'; // emerald-500
      } else {
        const factor = Math.max(0.4, 1 - (index / snakeRef.current.length) * 0.6);
        ctx.fillStyle = `rgba(16, 185, 129, ${factor})`;
      }
      
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, isHead ? 6 : 4);
      ctx.fill();

      // Eyes for snake head
      if (isHead) {
        ctx.fillStyle = '#ffffff';
        let eye1X = x + 4, eye1Y = y + 4, eye2X = x + w - 7, eye2Y = y + 4;
        const dir = directionRef.current;
        
        if (dir.x === 1) { // Right
          eye1X = x + w - 6; eye1Y = y + 4;
          eye2X = x + w - 6; eye2Y = y + h - 7;
        } else if (dir.x === -1) { // Left
          eye1X = x + 3; eye1Y = y + 4;
          eye2X = x + 3; eye2Y = y + h - 7;
        } else if (dir.y === -1) { // Up
          eye1X = x + 4; eye1Y = y + 3;
          eye2X = x + w - 7; eye2Y = y + 3;
        } else { // Down
          eye1X = x + 4; eye1Y = y + h - 6;
          eye2X = x + w - 7; eye2Y = y + h - 6;
        }

        ctx.fillRect(eye1X, eye1Y, 3, 3);
        ctx.fillRect(eye2X, eye2Y, 3, 3);
      }
    });

    ctx.restore();
  }, []);

  const updateGameLogic = useCallback(() => {
    const head = snakeRef.current[0];
    directionRef.current = nextDirectionRef.current;
    const newHead = {
      x: head.x + directionRef.current.x,
      y: head.y + directionRef.current.y,
    };

    // Wall collision
    if (
      newHead.x < 0 ||
      newHead.x >= GRID_SIZE ||
      newHead.y < 0 ||
      newHead.y >= GRID_SIZE
    ) {
      shakeRef.current = 8;
      audio.playExplosion();
      triggerGameOver();
      return;
    }

    // Self collision
    if (snakeRef.current.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
      shakeRef.current = 8;
      audio.playExplosion();
      triggerGameOver();
      return;
    }

    const newSnake = [newHead, ...snakeRef.current];

    // Food collision
    if (newHead.x === foodRef.current.x && newHead.y === foodRef.current.y) {
      audio.playCoin();
      const cellSize = 500 / GRID_SIZE;
      spawnFoodParticles(foodRef.current.x * cellSize + cellSize / 2, foodRef.current.y * cellSize + cellSize / 2);
      foodRef.current = generateFood(newSnake);
      const newScore = scoreRef.current + 10;
      scoreRef.current = newScore;
      updateScore(newScore);
    } else {
      newSnake.pop();
    }

    snakeRef.current = newSnake;
  }, [generateFood, triggerGameOver, updateScore]);

  const gameStep = useCallback((timestamp: number, deltaTime: number) => {
    moveTimerRef.current += deltaTime;

    const currentSpeed = Math.max(65, BASE_SPEED - (scoreRef.current * 1.5));

    if (moveTimerRef.current >= currentSpeed) {
      moveTimerRef.current = 0;
      updateGameLogic();
    }

    draw();
  }, [draw, updateGameLogic]);

  const resetGame = useCallback(() => {
    snakeRef.current = [...INITIAL_SNAKE];
    directionRef.current = { ...INITIAL_DIRECTION };
    nextDirectionRef.current = { ...INITIAL_DIRECTION };
    foodRef.current = generateFood(snakeRef.current);
    particlesRef.current = [];
    scoreRef.current = 0;
    updateScore(0);
    draw();
  }, [draw, generateFood, updateScore]);

  const startGame = useCallback(() => {
    resetGame();
    startWithCountdown(() => {
      startLoop(gameStep);
    });
  }, [resetGame, startWithCountdown, startLoop, gameStep]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current !== 'playing') return;
      
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (directionRef.current.y !== 1) nextDirectionRef.current = { x: 0, y: -1 };
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (directionRef.current.y !== -1) nextDirectionRef.current = { x: 0, y: 1 };
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (directionRef.current.x !== 1) nextDirectionRef.current = { x: -1, y: 0 };
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (directionRef.current.x !== -1) nextDirectionRef.current = { x: 1, y: 0 };
          break;
        case 'Escape':
          if (gameStateRef.current === 'playing') setGameState('paused');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStateRef, setGameState]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleDirection = useCallback((dir: 'up' | 'down' | 'left' | 'right') => {
    switch (dir) {
      case 'up':
        if (directionRef.current.y !== 1) nextDirectionRef.current = { x: 0, y: -1 };
        break;
      case 'down':
        if (directionRef.current.y !== -1) nextDirectionRef.current = { x: 0, y: 1 };
        break;
      case 'left':
        if (directionRef.current.x !== 1) nextDirectionRef.current = { x: -1, y: 0 };
        break;
      case 'right':
        if (directionRef.current.x !== -1) nextDirectionRef.current = { x: 1, y: 0 };
        break;
    }
  }, []);

  return (
    <div className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-[#090b10]">
      {/* Clean In-game HUD */}
      <div className="w-full flex-none flex justify-between items-center mb-2 px-3 text-xs">
        <div className="text-zinc-400 font-medium">
          Panjang: <span className="text-emerald-400 font-semibold">{snakeRef.current.length}</span>
        </div>
        <div className="text-zinc-400 font-medium">
          Skor: <span className="text-white font-bold">{score}</span>
        </div>
      </div>

      {/* Canvas Wrapper */}
      <div className="relative flex-1 min-h-0 w-full flex items-center justify-center bg-[#090b10] rounded-2xl border border-white/[0.08] shadow-inner overflow-hidden">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', maxWidth: '500px', maxHeight: '500px' }}
          className="object-contain"
        />
        
        <GameOverlay
          gameState={gameState}
          score={score}
          highScore={highScore}
          onStart={startGame}
          onRestart={startGame}
          instructions="Arahkan ular untuk mengonsumsi titik merah. Hindari benturan dengan dinding batas atau badan sendiri!"
        />
      </div>

      {/* Mobile Controls outside canvas */}
      {gameState === 'playing' && (
        <div className="flex-none mt-2">
          <MobileControls onDirection={handleDirection} />
        </div>
      )}
    </div>
  );
}
