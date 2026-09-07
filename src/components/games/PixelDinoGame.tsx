import React, { useRef, useEffect, useCallback } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';
import { audio } from '../../utils/audio';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Zap } from 'lucide-react';

interface GameProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
  highScore: number;
}

interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'cactus' | 'drone';
  speed: number;
  passed: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 280;
const GROUND_Y = 220;
const DINO_X = 70;
const DINO_STAND_HEIGHT = 44;
const DINO_DUCK_HEIGHT = 24;
const DINO_WIDTH = 34;
const GRAVITY = 0.54;
const JUMP_FORCE = -10.0;

export default function PixelDinoGame({ onScoreUpdate, onGameOver, highScore }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    gameState,
    score,
    updateScore,
    startLoop,
    triggerGameOver,
    startWithCountdown,
    countdown,
    setupCanvasContext
  } = useGameEngine({
    gameId: 'pixel-dino',
    onGameOver,
    onScoreUpdate
  });

  // Game Loop Refs
  const dinoYRef = useRef(GROUND_Y - DINO_STAND_HEIGHT);
  const dinoVyRef = useRef(0);
  const isGroundedRef = useRef(true);
  const isDuckingRef = useRef(false);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const speedRef = useRef(5.2);
  const spawnTimerRef = useRef(0);
  const scoreAccumulatorRef = useRef(0);
  const runAnimFrameRef = useRef(0);
  const groundOffsetRef = useRef(0);
  const shakeRef = useRef(0);

  // Jump action
  const jump = useCallback(() => {
    if (gameState !== 'playing') return;
    if (isGroundedRef.current && !isDuckingRef.current) {
      dinoVyRef.current = JUMP_FORCE;
      isGroundedRef.current = false;
      audio.playJump();
      inputManager.vibrateGamepad(40, 0.25);

      for (let i = 0; i < 5; i++) {
        particlesRef.current.push({
          x: DINO_X + (Math.random() - 0.5) * DINO_WIDTH,
          y: GROUND_Y,
          vx: (Math.random() - 0.5) * 3,
          vy: -Math.random() * 2,
          size: Math.random() * 3 + 1,
          color: '#22c55e',
          alpha: 0.8,
          decay: 0.05
        });
      }
    }
  }, [gameState]);

  // Duck action
  const setDucking = useCallback((ducking: boolean) => {
    if (gameState !== 'playing') return;
    isDuckingRef.current = ducking;
    if (ducking && !isGroundedRef.current) {
      // Fast drop
      dinoVyRef.current += 6.0;
    }
  }, [gameState]);

  // Unified keyboard and touch
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        jump();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setDucking(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        setDucking(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, jump, setDucking]);

  // Render Frame
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();

    // Screen Shake
    if (shakeRef.current > 0) {
      const sx = (Math.random() - 0.5) * shakeRef.current;
      const sy = (Math.random() - 0.5) * shakeRef.current;
      ctx.translate(sx, sy);
      shakeRef.current = Math.max(0, shakeRef.current - 0.5);
    }

    // Sky Background
    ctx.fillStyle = '#0a0d18';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Subtle Stars / Grid
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }

    // Moving Ground Line
    groundOffsetRef.current = (groundOffsetRef.current + speedRef.current) % 30;
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

    ctx.shadowBlur = 8;
    ctx.shadowColor = '#22c55e';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Ground texture dashes
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 18]);
    ctx.lineDashOffset = -groundOffsetRef.current;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 6);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y + 6);
    ctx.stroke();
    ctx.setLineDash([]);

    // Obstacles
    for (const obs of obstaclesRef.current) {
      if (obs.type === 'cactus') {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ef4444';
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 4);
        ctx.fill();

        // Cactus side arms
        ctx.fillRect(obs.x - 4, obs.y + 8, 4, 10);
        ctx.fillRect(obs.x + obs.width, obs.y + 12, 4, 10);
        ctx.shadowBlur = 0;
      } else {
        // Drone Obstacle
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#f59e0b';
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 5);
        ctx.fill();

        // Propeller flash
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(obs.x + 2, obs.y - 3, obs.width - 4, 2);
        ctx.shadowBlur = 0;
      }
    }

    // Particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        particlesRef.current.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Dino Player
    const currentHeight = isDuckingRef.current ? DINO_DUCK_HEIGHT : DINO_STAND_HEIGHT;
    const dy = isDuckingRef.current ? GROUND_Y - DINO_DUCK_HEIGHT : dinoYRef.current;
    const dx = DINO_X;

    ctx.shadowBlur = 14;
    ctx.shadowColor = '#22c55e';
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.roundRect(dx, dy, DINO_WIDTH, currentHeight, 6);
    ctx.fill();

    // Dino Eye
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(dx + DINO_WIDTH - 9, dy + 6, 4, 4);

    // Running legs animation
    if (isGroundedRef.current) {
      runAnimFrameRef.current += 0.2;
      const legOffset = Math.sin(runAnimFrameRef.current) * 4;
      ctx.fillStyle = '#15803d';
      ctx.fillRect(dx + 6, dy + currentHeight, 5, 4 + legOffset);
      ctx.fillRect(dx + DINO_WIDTH - 12, dy + currentHeight, 5, 4 - legOffset);
    }
    ctx.shadowBlur = 0;

    // Floating Texts
    for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
      const ft = floatingTextsRef.current[i];
      ft.y += ft.vy;
      ft.alpha -= 0.02;
      if (ft.alpha <= 0) {
        floatingTextsRef.current.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore();
  }, []);

  // Main Loop Game Step
  const gameStep = useCallback((timestamp: number, deltaTime: number) => {
    const dt = Math.min(deltaTime / 16.666, 3.0); // normalized to 60fps unit

    // 1. Update Dino Physics
    if (!isGroundedRef.current) {
      dinoVyRef.current += GRAVITY * dt;
      dinoYRef.current += dinoVyRef.current * dt;

      if (dinoYRef.current >= GROUND_Y - DINO_STAND_HEIGHT) {
        dinoYRef.current = GROUND_Y - DINO_STAND_HEIGHT;
        dinoVyRef.current = 0;
        isGroundedRef.current = true;
      }
    }

    // 2. Accumulate Score smoothly by delta-time seconds (not frame count)
    scoreAccumulatorRef.current += (deltaTime / 1000) * 12 * (speedRef.current / 5.0);
    const calculatedScore = Math.floor(scoreAccumulatorRef.current);
    if (calculatedScore !== (score || 0)) {
      updateScore(calculatedScore);
    }

    // 3. Accelerate gently
    speedRef.current = Math.min(10.5, 5.2 + (calculatedScore / 250));

    // 4. Spawn Obstacles based on distance timer
    spawnTimerRef.current += dt;
    const spawnThreshold = Math.max(45, 90 - calculatedScore / 30);
    if (spawnTimerRef.current >= spawnThreshold) {
      spawnTimerRef.current = 0;
      const isDrone = calculatedScore > 30 && Math.random() < 0.35;

      if (isDrone) {
        obstaclesRef.current.push({
          x: CANVAS_WIDTH + 20,
          y: GROUND_Y - DINO_STAND_HEIGHT - 6, // Head height, must duck!
          width: 30,
          height: 20,
          type: 'drone',
          speed: speedRef.current * 1.08,
          passed: false
        });
      } else {
        const height = Math.random() < 0.5 ? 36 : 46;
        obstaclesRef.current.push({
          x: CANVAS_WIDTH + 20,
          y: GROUND_Y - height,
          width: 22,
          height: height,
          type: 'cactus',
          speed: speedRef.current,
          passed: false
        });
      }
    }

    // 5. Move Obstacles & Collision Check
    const currentHeight = isDuckingRef.current ? DINO_DUCK_HEIGHT : DINO_STAND_HEIGHT;
    const dy = isDuckingRef.current ? GROUND_Y - DINO_DUCK_HEIGHT : dinoYRef.current;
    const dx = DINO_X;

    for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
      const obs = obstaclesRef.current[i];
      obs.x -= obs.speed * dt;

      // AABB Box Collision with inset margin for forgiveness
      const dinoLeft = dx + 4;
      const dinoRight = dx + DINO_WIDTH - 4;
      const dinoTop = dy + 4;
      const dinoBottom = dy + currentHeight;

      const obsLeft = obs.x + 3;
      const obsRight = obs.x + obs.width - 3;
      const obsTop = obs.y + 3;
      const obsBottom = obs.y + obs.height;

      const isColliding = (
        dinoRight > obsLeft &&
        dinoLeft < obsRight &&
        dinoBottom > obsTop &&
        dinoTop < obsBottom
      );

      if (isColliding) {
        audio.playExplosion();
        shakeRef.current = 16;
        inputManager.vibrateGamepad(200, 0.8);

        for (let j = 0; j < 20; j++) {
          particlesRef.current.push({
            x: dx + DINO_WIDTH / 2,
            y: dy + currentHeight / 2,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            size: Math.random() * 3 + 2,
            color: j % 2 === 0 ? '#ef4444' : '#22c55e',
            alpha: 1.0,
            decay: 0.04
          });
        }

        draw();
        triggerGameOver();
        return;
      }

      // Check pass
      if (!obs.passed && obs.x + obs.width < dx) {
        obs.passed = true;
      }

      // Remove offscreen
      if (obs.x < -60) {
        obstaclesRef.current.splice(i, 1);
      }
    }

    draw();
  }, [draw, score, triggerGameOver, updateScore]);

  // Lifecycle Start
  const startGame = useCallback(() => {
    dinoYRef.current = GROUND_Y - DINO_STAND_HEIGHT;
    dinoVyRef.current = 0;
    isGroundedRef.current = true;
    isDuckingRef.current = false;
    obstaclesRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
    speedRef.current = 5.2;
    spawnTimerRef.current = 0;
    scoreAccumulatorRef.current = 0;
    updateScore(0);

    startWithCountdown(() => {
      startLoop(gameStep);
    });
  }, [startWithCountdown, startLoop, gameStep, updateScore]);

  // DPR Setup
  useEffect(() => {
    setupCanvasContext(canvasRef.current, CANVAS_WIDTH, CANVAS_HEIGHT);
    draw();
  }, [setupCanvasContext, draw]);

  return (
    <div className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-[#0a0d18]">
      {/* HUD */}
      <div className="w-full max-w-[600px] flex-none flex justify-between items-center mb-2 px-3 py-1 bg-[#121622]/80 border border-white/[0.06] rounded-xl text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <Zap size={14} className="text-emerald-400" />
          <span className="text-zinc-400">KECEPATAN:</span>
          <span className="text-emerald-400 font-bold">{speedRef.current.toFixed(1)}x</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-zinc-400">SKOR:</span>
          <span className="text-white font-bold">{score}</span>
        </div>
      </div>

      {/* Canvas container */}
      <div 
        className="relative flex-1 min-h-0 w-full max-w-[600px] max-h-[280px] flex items-center justify-center bg-[#0a0d18] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden cursor-pointer select-none"
        onClick={jump}
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
          instructions="Lompati kaktus laser dan merunduk di bawah drone siber! Tekan SPASI/Atas untuk melompat, Bawah untuk merunduk."
        />
      </div>

      {/* Mobile Controls */}
      {gameState === 'playing' && (
        <div className="flex-none mt-2 w-full max-w-[600px] flex gap-2 md:hidden">
          <button
            onTouchStart={(e) => { e.preventDefault(); setDucking(true); }}
            onTouchEnd={(e) => { e.preventDefault(); setDucking(false); }}
            onMouseDown={() => setDucking(true)}
            onMouseUp={() => setDucking(false)}
            className="flex-1 py-3.5 bg-zinc-800 active:bg-zinc-700 rounded-xl text-zinc-200 font-bold text-sm tracking-wider uppercase select-none min-h-[44px]"
          >
            ⬇ MERUNDUK
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); jump(); }}
            onClick={jump}
            className="flex-2 py-3.5 bg-emerald-600 active:bg-emerald-500 rounded-xl text-white font-bold text-sm tracking-wider uppercase select-none min-h-[44px]"
          >
            ⬆ LOMPAT
          </button>
        </div>
      )}
    </div>
  );
}
