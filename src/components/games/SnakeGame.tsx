import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';
import { audio } from '../../utils/audio';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Zap, Sparkles } from 'lucide-react';

interface SnakeProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface Point {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

const GRID_SIZE = 22;
const BASE_SPEED = 130; // ms per step for comfortable onboarding
const MIN_SPEED = 65;   // ms per step ceiling
const INITIAL_SNAKE: Point[] = [
  { x: 10, y: 11 },
  { x: 9, y: 11 },
  { x: 8, y: 11 },
];
const INITIAL_DIRECTION: Point = { x: 1, y: 0 };

export default function SnakeGame({ onGameOver, onScoreUpdate, highScore }: SnakeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Engine Hook
  const {
    gameState,
    score,
    setGameState,
    updateScore,
    addScore,
    startLoop,
    stopLoop,
    triggerGameOver,
    startWithCountdown,
    countdown,
  } = useGameEngine({
    gameId: 'snake',
    onGameOver,
    onScoreUpdate,
  });

  // Mutable Game Loop State Refs
  const snakeRef = useRef<Point[]>([...INITIAL_SNAKE]);
  const directionRef = useRef<Point>({ ...INITIAL_DIRECTION });
  const inputQueueRef = useRef<Point[]>([]);
  const foodRef = useRef<Point>({ x: 16, y: 11 });
  const isGoldenAppleRef = useRef<boolean>(false);
  const goldenTimerRef = useRef<number>(0);
  const appleCountRef = useRef<number>(0);
  
  // Polish State
  const comboRef = useRef<number>(0);
  const comboTimerRef = useRef<number>(0);
  const isBoostingRef = useRef<boolean>(false);
  const hitStopTimerRef = useRef<number>(0);
  const shakeRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const moveTimerRef = useRef<number>(0);
  const pulseAnimRef = useRef<number>(0);
  const tongueTimerRef = useRef<number>(0);

  // React UI mirror states for HUD
  const [combo, setCombo] = useState(0);
  const [isBoosting, setIsBoosting] = useState(false);
  const [snakeLength, setSnakeLength] = useState(3);

  // Sound generator helper for food placement
  const generateFood = useCallback((currentSnake: Point[]): { point: Point; isGolden: boolean } => {
    let newFood: Point;
    let isOccupied = true;
    let attempts = 0;
    
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      isOccupied = currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
      attempts++;
    } while (isOccupied && attempts < 200);

    // 25% chance of golden apple or every 5th apple
    appleCountRef.current++;
    const isGolden = appleCountRef.current % 5 === 0 || Math.random() < 0.2;

    return { point: newFood, isGolden };
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

  const spawnParticles = (x: number, y: number, colorScheme: string[], count = 10, speedMult = 1) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
      const speed = (1.5 + Math.random() * 2.5) * speedMult;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: colorScheme[i % colorScheme.length],
        size: 2.5 + Math.random() * 2,
      });
    }
  };

  const spawnFloatingText = (x: number, y: number, text: string, color = '#fbbf24') => {
    floatingTextsRef.current.push({
      x,
      y,
      text,
      color,
      alpha: 1.0,
      vy: -1.2,
    });
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();

    // Decaying Screen Shake
    if (shakeRef.current > 0) {
      const sx = (Math.random() - 0.5) * shakeRef.current;
      const sy = (Math.random() - 0.5) * shakeRef.current;
      ctx.translate(sx, sy);
      shakeRef.current = Math.max(0, shakeRef.current - 0.4);
    }

    const logicalSize = 500;
    ctx.clearRect(0, 0, logicalSize, logicalSize);
    const cellSize = logicalSize / GRID_SIZE;

    // Atmospheric Dark Matrix Floor
    ctx.fillStyle = '#080a0f';
    ctx.fillRect(0, 0, logicalSize, logicalSize);

    // Subtle Neon Arena Border & Grid Dots
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, logicalSize - 2, logicalSize - 2);

    ctx.fillStyle = '#131824';
    for (let x = 1; x < GRID_SIZE; x++) {
      for (let y = 1; y < GRID_SIZE; y++) {
        ctx.fillRect(x * cellSize - 0.75, y * cellSize - 0.75, 1.5, 1.5);
      }
    }

    // Food Rendering with Breathing Halo
    pulseAnimRef.current += 0.05;
    const cx = foodRef.current.x * cellSize + cellSize / 2;
    const cy = foodRef.current.y * cellSize + cellSize / 2;
    const isGold = isGoldenAppleRef.current;
    const pulseScale = 1 + Math.sin(pulseAnimRef.current) * 0.12;
    const radius = (cellSize / 2.5) * pulseScale;

    // Outer Radial Aura
    const glowGrad = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 2.2);
    if (isGold) {
      glowGrad.addColorStop(0, 'rgba(251, 191, 36, 0.5)');
      glowGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
    } else {
      glowGrad.addColorStop(0, 'rgba(244, 63, 94, 0.4)');
      glowGrad.addColorStop(1, 'rgba(244, 63, 94, 0)');
    }
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Food Body
    ctx.fillStyle = isGold ? '#fbbf24' : '#f43f5e';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Food Stem & Highlight
    ctx.fillStyle = isGold ? '#fef08a' : '#ffe4e6';
    ctx.beginPath();
    ctx.arc(cx - radius * 0.28, cy - radius * 0.28, radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Golden Apple timer ring
    if (isGold && goldenTimerRef.current > 0) {
      const remainingPct = Math.max(0, goldenTimerRef.current / 8000);
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remainingPct);
      ctx.stroke();
    }

    // Particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.035;
      if (p.life <= 0) {
        particlesRef.current.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Draw Snake
    const snake = snakeRef.current;
    const snakeLen = snake.length;

    snake.forEach((segment, index) => {
      const isHead = index === 0;
      const x = segment.x * cellSize + 2;
      const y = segment.y * cellSize + 2;
      const w = cellSize - 4;
      const h = cellSize - 4;

      if (isHead) {
        // Vibrant Head with Turbo Boost Glow
        ctx.fillStyle = isBoostingRef.current ? '#38bdf8' : '#10b981';
      } else {
        // Gradient Emerald Tail
        const factor = Math.max(0.3, 1 - (index / snakeLen) * 0.65);
        if (isBoostingRef.current) {
          ctx.fillStyle = `rgba(56, 189, 248, ${factor})`;
        } else {
          ctx.fillStyle = `rgba(16, 185, 129, ${factor})`;
        }
      }

      ctx.beginPath();
      ctx.roundRect(x, y, w, h, isHead ? 6 : 4);
      ctx.fill();

      // Head Eyes & Tongue Details
      if (isHead) {
        const dir = directionRef.current;
        let eye1X = x + 4, eye1Y = y + 4, eye2X = x + w - 7, eye2Y = y + 4;
        let tongueX = x + w / 2, tongueY = y + h / 2;

        if (dir.x === 1) { // Right
          eye1X = x + w - 5; eye1Y = y + 4;
          eye2X = x + w - 5; eye2Y = y + h - 7;
          tongueX = x + w + 2;
        } else if (dir.x === -1) { // Left
          eye1X = x + 3; eye1Y = y + 4;
          eye2X = x + 3; eye2Y = y + h - 7;
          tongueX = x - 4;
        } else if (dir.y === -1) { // Up
          eye1X = x + 4; eye1Y = y + 3;
          eye2X = x + w - 7; eye2Y = y + 3;
          tongueY = y - 4;
        } else { // Down
          eye1X = x + 4; eye1Y = y + h - 5;
          eye2X = x + w - 7; eye2Y = y + h - 5;
          tongueY = y + h + 2;
        }

        // Eyes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(eye1X, eye1Y, 3, 3);
        ctx.fillRect(eye2X, eye2Y, 3, 3);

        // Tongue Flick animation every ~2 seconds
        tongueTimerRef.current += 0.05;
        if (Math.sin(tongueTimerRef.current) > 0.85) {
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x + w / 2, y + h / 2);
          ctx.lineTo(tongueX, tongueY);
          ctx.stroke();
        }
      }
    });

    // Floating Score Texts
    for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
      const ft = floatingTextsRef.current[i];
      ft.y += ft.vy;
      ft.alpha -= 0.025;
      if (ft.alpha <= 0) {
        floatingTextsRef.current.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore();
  }, []);

  const updateGameLogic = useCallback(() => {
    // Pop next direction from the input queue if available
    if (inputQueueRef.current.length > 0) {
      directionRef.current = inputQueueRef.current.shift()!;
    }

    const head = snakeRef.current[0];
    const newHead: Point = {
      x: head.x + directionRef.current.x,
      y: head.y + directionRef.current.y,
    };

    // Wall Collision
    if (
      newHead.x < 0 ||
      newHead.x >= GRID_SIZE ||
      newHead.y < 0 ||
      newHead.y >= GRID_SIZE
    ) {
      shakeRef.current = 10;
      hitStopTimerRef.current = 80;
      audio.playExplosion();
      inputManager.vibrateGamepad(180, 0.7);
      const cellSize = 500 / GRID_SIZE;
      spawnParticles(head.x * cellSize + cellSize / 2, head.y * cellSize + cellSize / 2, ['#ef4444', '#f87171', '#ffffff'], 20, 2);
      triggerGameOver();
      return;
    }

    // Self Collision
    if (snakeRef.current.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
      shakeRef.current = 10;
      hitStopTimerRef.current = 80;
      audio.playExplosion();
      inputManager.vibrateGamepad(180, 0.7);
      const cellSize = 500 / GRID_SIZE;
      spawnParticles(newHead.x * cellSize + cellSize / 2, newHead.y * cellSize + cellSize / 2, ['#ef4444', '#f87171', '#ffffff'], 20, 2);
      triggerGameOver();
      return;
    }

    const newSnake = [newHead, ...snakeRef.current];
    const cellSize = 500 / GRID_SIZE;

    // Food Collision
    if (newHead.x === foodRef.current.x && newHead.y === foodRef.current.y) {
      const isGold = isGoldenAppleRef.current;
      const basePoints = isGold ? 35 : 10;
      
      // Calculate Combo
      const newCombo = Math.min(5, comboRef.current + 1);
      comboRef.current = newCombo;
      comboTimerRef.current = 4500; // 4.5s window
      setCombo(newCombo);

      const earned = basePoints * newCombo;
      addScore(earned);

      // Sound & Juice
      if (isGold) {
        audio.playPowerup();
        spawnParticles(cx(foodRef.current), cy(foodRef.current), ['#fbbf24', '#fef08a', '#ffffff'], 22, 1.8);
        spawnFloatingText(cx(foodRef.current), cy(foodRef.current), `+${earned} EMAS! (${newCombo}x)`, '#fbbf24');
      } else {
        audio.playCombo(newCombo);
        spawnParticles(cx(foodRef.current), cy(foodRef.current), ['#10b981', '#34d399', '#ffffff'], 12, 1.2);
        spawnFloatingText(cx(foodRef.current), cy(foodRef.current), `+${earned} ${newCombo > 1 ? `(${newCombo}x)` : ''}`, '#34d399');
      }

      shakeRef.current = isGold ? 4 : 2;
      inputManager.vibrateGamepad(80, isGold ? 0.6 : 0.35);

      // Generate New Food
      const nextFoodData = generateFood(newSnake);
      foodRef.current = nextFoodData.point;
      isGoldenAppleRef.current = nextFoodData.isGolden;
      goldenTimerRef.current = nextFoodData.isGolden ? 8000 : 0;
    } else {
      newSnake.pop();
    }

    snakeRef.current = newSnake;
    setSnakeLength(newSnake.length);

    function cx(p: Point) { return p.x * cellSize + cellSize / 2; }
    function cy(p: Point) { return p.y * cellSize + cellSize / 2; }
  }, [generateFood, triggerGameOver, addScore]);

  // Main Engine Step
  const gameStep = useCallback((timestamp: number, deltaTime: number) => {
    // Hit-stop microfreeze
    if (hitStopTimerRef.current > 0) {
      hitStopTimerRef.current -= deltaTime;
      draw();
      return;
    }

    // Decay Combo timer
    if (comboTimerRef.current > 0) {
      comboTimerRef.current -= deltaTime;
      if (comboTimerRef.current <= 0) {
        comboRef.current = 0;
        setCombo(0);
      }
    }

    // Decay Golden Apple timer
    if (isGoldenAppleRef.current && goldenTimerRef.current > 0) {
      goldenTimerRef.current -= deltaTime;
      if (goldenTimerRef.current <= 0) {
        isGoldenAppleRef.current = false;
      }
    }

    moveTimerRef.current += deltaTime;

    // Smooth Difficulty Progression based on snake length
    const speedRatio = Math.min(1, (snakeRef.current.length - 3) / 40);
    let currentSpeed = BASE_SPEED - speedRatio * (BASE_SPEED - MIN_SPEED);
    
    // Turbo Boost halves move timer
    if (isBoostingRef.current) {
      currentSpeed *= 0.55;
    }

    if (moveTimerRef.current >= currentSpeed) {
      moveTimerRef.current = 0;
      updateGameLogic();
    }

    draw();
  }, [draw, updateGameLogic]);

  const resetGame = useCallback(() => {
    snakeRef.current = [...INITIAL_SNAKE];
    directionRef.current = { ...INITIAL_DIRECTION };
    inputQueueRef.current = [];
    isBoostingRef.current = false;
    setIsBoosting(false);
    comboRef.current = 0;
    setCombo(0);
    comboTimerRef.current = 0;
    particlesRef.current = [];
    floatingTextsRef.current = [];
    appleCountRef.current = 0;
    setSnakeLength(INITIAL_SNAKE.length);

    const initialFood = generateFood(snakeRef.current);
    foodRef.current = initialFood.point;
    isGoldenAppleRef.current = false;
    goldenTimerRef.current = 0;

    updateScore(0);
    draw();
  }, [draw, generateFood, updateScore]);

  const startGame = useCallback(() => {
    resetGame();
    startWithCountdown(() => {
      startLoop(gameStep);
    });
  }, [resetGame, startWithCountdown, startLoop, gameStep]);

  // Queue Direction Input helper to prevent accidental 180 self-kill
  const queueDirection = useCallback((dir: Point) => {
    const lastDir = inputQueueRef.current.length > 0
      ? inputQueueRef.current[inputQueueRef.current.length - 1]
      : directionRef.current;

    // Prevent direct reversal
    if (dir.x !== 0 && dir.x === -lastDir.x) return;
    if (dir.y !== 0 && dir.y === -lastDir.y) return;

    // Allow queuing max 2 moves
    if (inputQueueRef.current.length < 2) {
      inputQueueRef.current.push(dir);
    }
  }, []);

  // Keyboard controls with Turbo Boost (Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;

      if (e.code === 'Space') {
        e.preventDefault();
        isBoostingRef.current = true;
        setIsBoosting(true);
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          queueDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          queueDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          queueDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          queueDirection({ x: 1, y: 0 });
          break;
        case 'Escape':
          setGameState('paused');
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isBoostingRef.current = false;
        setIsBoosting(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, queueDirection, setGameState]);

  // Touch Swipe on Canvas for native mobile feel
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
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

    if (dist > 20) {
      if (Math.abs(dx) > Math.abs(dy)) {
        queueDirection(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
      } else {
        queueDirection(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
      }
    }
    touchStartPos.current = null;
  };

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div 
      ref={containerRef}
      className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-[#090b10]"
    >
      {/* Clean Dynamic HUD */}
      <div className="w-full max-w-[500px] flex-none flex justify-between items-center mb-2 px-3 py-1 bg-[#121622]/80 border border-white/[0.06] rounded-xl text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">PANJANG:</span>
          <span className="text-emerald-400 font-bold">{snakeLength}</span>
        </div>

        {combo > 1 && (
          <div className="flex items-center gap-1 text-amber-400 font-bold animate-pulse">
            <Sparkles size={12} />
            <span>COMBO {combo}x</span>
          </div>
        )}

        {isBoosting && (
          <div className="flex items-center gap-1 text-sky-400 font-bold animate-pulse">
            <Zap size={12} />
            <span>TURBO!</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-zinc-400">SKOR:</span>
          <span className="text-white font-bold">{score}</span>
        </div>
      </div>

      {/* Canvas Stage */}
      <div 
        className="relative flex-1 min-h-0 w-full max-w-[500px] max-h-[500px] flex items-center justify-center bg-[#090b10] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%' }}
          className="object-contain block touch-none"
        />

        <GameOverlay
          gameState={gameState}
          score={score}
          highScore={highScore}
          countdown={countdown}
          onStart={startGame}
          onRestart={startGame}
          instructions="Arahkan ular neon untuk mengonsumsi buah merah dan emas. Hindari dinding atau badan sendiri! Tahan SPASI untuk Turbo Boost."
        />
      </div>
    </div>
  );
}
