import React, { useState, useEffect, useRef, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Sparkles, Trophy } from 'lucide-react';

interface FlappyPixelProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

type GameState = 'ready' | 'countdown' | 'playing' | 'paused' | 'gameover';

interface Pipe {
  x: number;
  topHeight: number;
  bottomY: number;
  passed: boolean;
  nearMissAwarded?: boolean;
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

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 500;
const GRAVITY = 0.46;
const JUMP_STRENGTH = -7.6;
const BASE_PIPE_SPEED = 2.8;
const PIPE_WIDTH = 58;
const BIRD_SIZE = 22;

export default function FlappyPixelGame({ onGameOver, onScoreUpdate, highScore }: FlappyPixelProps) {
  const [gameState, setGameState] = useState<GameState>('ready');
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gameStateRef = useRef(gameState);
  const scoreRef = useRef(0);
  const birdYRef = useRef(CANVAS_HEIGHT / 2);
  const birdVelocityRef = useRef(0);
  const pipesRef = useRef<Pipe[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const shakeRef = useRef(0);
  const hitStopRef = useRef(0);

  const gameLoopRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const frameTimerRef = useRef<number>(0);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Auto-pause when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && gameStateRef.current === 'playing') {
        setGameState('paused');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const getDynamicGap = (currentScore: number) => {
    // Easy onboarding: 160px gap for score 0-4, scaling down to 125px minimum
    return Math.max(125, 160 - Math.floor(currentScore / 4) * 5);
  };

  const createPipe = (startX: number, currentScore: number): Pipe => {
    const gap = getDynamicGap(currentScore);
    const minHeight = 60;
    const maxHeight = CANVAS_HEIGHT - gap - minHeight;
    const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;

    return {
      x: startX,
      topHeight,
      bottomY: topHeight + gap,
      passed: false,
    };
  };

  const spawnParticles = (x: number, y: number, color: string, count = 8, speed = 2) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
      const spd = Math.random() * speed + 0.8;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: Math.random() * 2.5 + 1.5,
        color,
        alpha: 1.0,
        decay: 0.04 + Math.random() * 0.02,
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
      vy: -1.0,
    });
  };

  const resetGame = useCallback(() => {
    birdYRef.current = CANVAS_HEIGHT / 2 - 30;
    birdVelocityRef.current = 0;
    scoreRef.current = 0;
    setScore(0);
    onScoreUpdate(0);
    particlesRef.current = [];
    floatingTextsRef.current = [];
    shakeRef.current = 0;
    hitStopRef.current = 0;

    pipesRef.current = [
      createPipe(CANVAS_WIDTH + 50, 0),
      createPipe(CANVAS_WIDTH + 310, 0),
    ];
    draw();
  }, [onScoreUpdate]);

  const jump = useCallback(() => {
    if (gameStateRef.current === 'playing') {
      birdVelocityRef.current = JUMP_STRENGTH;
      audio.playLaser();
      inputManager.vibrateGamepad(35, 0.2);

      // Flap exhaust sparks
      spawnParticles(50 + BIRD_SIZE / 2, birdYRef.current + BIRD_SIZE, '#f59e0b', 5, 1.5);
    }
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    setGameState('countdown');
    setCountdown(3);
    audio.playCountdownTick();

    let count = 3;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
        audio.playCountdownTick();
      } else {
        clearInterval(interval);
        audio.playCountdownGo();
        setGameState('playing');
        lastTimeRef.current = performance.now();
        if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = requestAnimationFrame(gameStep);
      }
    }, 800);
  }, [resetGame]);

  const resumeGame = useCallback(() => {
    setGameState('countdown');
    setCountdown(3);
    audio.playCountdownTick();

    let count = 3;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
        audio.playCountdownTick();
      } else {
        clearInterval(interval);
        audio.playCountdownGo();
        setGameState('playing');
        lastTimeRef.current = performance.now();
        if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = requestAnimationFrame(gameStep);
      }
    }, 800);
  }, []);

  const gameStep = (timestamp: number) => {
    if (gameStateRef.current !== 'playing') return;

    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    if (hitStopRef.current > 0) {
      hitStopRef.current -= deltaTime;
      draw();
      gameLoopRef.current = requestAnimationFrame(gameStep);
      return;
    }

    const safeDelta = Math.min(deltaTime, 100);
    frameTimerRef.current += safeDelta;

    const targetFrameTime = 1000 / 60;
    while (frameTimerRef.current >= targetFrameTime) {
      updatePhysics();
      frameTimerRef.current -= targetFrameTime;
    }

    draw();
    if (gameStateRef.current === 'playing') {
      gameLoopRef.current = requestAnimationFrame(gameStep);
    }
  };

  const updatePhysics = () => {
    // Bird physics
    birdVelocityRef.current += GRAVITY;
    birdYRef.current += birdVelocityRef.current;

    // Floor / Ceiling collision
    if (birdYRef.current > CANVAS_HEIGHT - BIRD_SIZE || birdYRef.current < 0) {
      handleGameOver();
      return;
    }

    const birdRect = {
      x: 50,
      y: birdYRef.current,
      width: BIRD_SIZE,
      height: BIRD_SIZE,
    };

    let needsNewPipe = false;
    const currentScore = scoreRef.current;
    const pipeSpeed = BASE_PIPE_SPEED + Math.min(1.2, currentScore * 0.04);

    pipesRef.current.forEach(pipe => {
      pipe.x -= pipeSpeed;

      // Scoring
      if (!pipe.passed && pipe.x + PIPE_WIDTH < birdRect.x) {
        pipe.passed = true;
        const newScore = scoreRef.current + 1;
        scoreRef.current = newScore;
        setScore(newScore);
        onScoreUpdate(newScore);
        audio.playCoin();
        spawnFloatingText(birdRect.x + 20, birdRect.y - 15, `+1`, '#10b981');
      }

      // Near-miss detection (bonus points if grazed closely without dying!)
      if (!pipe.nearMissAwarded && pipe.x < birdRect.x + birdRect.width && pipe.x + PIPE_WIDTH > birdRect.x) {
        const distToTop = Math.abs(birdRect.y - pipe.topHeight);
        const distToBottom = Math.abs(birdRect.y + birdRect.height - pipe.bottomY);
        if (distToTop < 10 || distToBottom < 10) {
          pipe.nearMissAwarded = true;
          audio.playNearMiss();
          const bonusScore = scoreRef.current + 1;
          scoreRef.current = bonusScore;
          setScore(bonusScore);
          onScoreUpdate(bonusScore);
          spawnFloatingText(birdRect.x + 25, birdRect.y - 25, 'NEAR MISS! +1', '#38bdf8');
          shakeRef.current = 2;
        }
      }

      // Strict hit-box collision
      const margin = 3; // Forgiving pixel margin
      if (
        birdRect.x + birdRect.width - margin > pipe.x &&
        birdRect.x + margin < pipe.x + PIPE_WIDTH &&
        (birdRect.y + margin < pipe.topHeight || birdRect.y + birdRect.height - margin > pipe.bottomY)
      ) {
        handleGameOver();
      }

      if (pipe.x + PIPE_WIDTH < 0) {
        needsNewPipe = true;
      }
    });

    if (needsNewPipe) {
      pipesRef.current.shift();
      const lastPipeX = pipesRef.current.length > 0 ? pipesRef.current[pipesRef.current.length - 1].x : CANVAS_WIDTH;
      pipesRef.current.push(createPipe(lastPipeX + 250, scoreRef.current));
    }

    // Update Particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) particlesRef.current.splice(i, 1);
    }

    // Update Floating Texts
    for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
      const t = floatingTextsRef.current[i];
      t.y += t.vy;
      t.alpha -= 0.025;
      if (t.alpha <= 0) floatingTextsRef.current.splice(i, 1);
    }
  };

  const handleGameOver = () => {
    audio.playExplosion();
    shakeRef.current = 10;
    hitStopRef.current = 70;
    inputManager.vibrateGamepad(180, 0.7);

    spawnParticles(50 + BIRD_SIZE / 2, birdYRef.current + BIRD_SIZE / 2, '#f43f5e', 22, 3);
    setGameState('gameover');
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    onGameOver(scoreRef.current);
  };

  const draw = () => {
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

    // Atmospheric Dark Matrix Canvas
    ctx.fillStyle = '#080a0f';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Subtle Neon Cyber Grid
    ctx.strokeStyle = '#121622';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Neon Pillars / Pipes
    pipesRef.current.forEach(pipe => {
      // Pipe Glow
      ctx.fillStyle = '#10b981';
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
      ctx.fillRect(pipe.x, pipe.bottomY, PIPE_WIDTH, CANVAS_HEIGHT - pipe.bottomY);

      // Pipe Highlights & Caps
      ctx.fillStyle = '#34d399';
      ctx.fillRect(pipe.x - 2, pipe.topHeight - 18, PIPE_WIDTH + 4, 18);
      ctx.fillRect(pipe.x - 2, pipe.bottomY, PIPE_WIDTH + 4, 18);

      // Energy Ring inside the gap
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(pipe.x + 4, pipe.topHeight + 4, PIPE_WIDTH - 8, pipe.bottomY - pipe.topHeight - 8);
    });

    // Bird
    ctx.save();
    const bx = 50 + BIRD_SIZE / 2;
    const by = birdYRef.current + BIRD_SIZE / 2;
    ctx.translate(bx, by);

    const rotation = Math.min(Math.max(birdVelocityRef.current * 0.08, -0.4), 0.5);
    ctx.rotate(rotation);

    // Cyber Bird Body
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(-BIRD_SIZE / 2, -BIRD_SIZE / 2, BIRD_SIZE, BIRD_SIZE, 5);
    ctx.fill();

    // Wing
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.roundRect(-BIRD_SIZE / 2 + 2, 0, BIRD_SIZE / 2, BIRD_SIZE / 3, 2);
    ctx.fill();

    // Visor Eye
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(BIRD_SIZE / 4, -BIRD_SIZE / 4, 6, 5);

    ctx.restore();

    // Particles
    particlesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Floating Texts
    floatingTextsRef.current.forEach(t => {
      ctx.fillStyle = t.color;
      ctx.globalAlpha = t.alpha;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1;

    ctx.restore();
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w') {
        if (gameStateRef.current === 'playing') {
          e.preventDefault();
          jump();
        } else if (gameStateRef.current === 'ready' || gameStateRef.current === 'gameover') {
          e.preventDefault();
          startGame();
        }
      } else if (e.key === 'Escape' && gameStateRef.current === 'playing') {
        setGameState('paused');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jump, startGame]);

  useEffect(() => {
    draw();
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-[#090b10]"
    >
      {/* Clean HUD Bar */}
      <div className="w-full max-w-[400px] flex-none flex justify-between items-center mb-2 px-3 py-1 bg-[#121622]/80 border border-white/[0.06] rounded-xl text-xs font-mono">
        <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
          <Sparkles size={12} />
          <span>CYBER FLAP</span>
        </div>

        <div className="flex items-center gap-1.5 text-zinc-400">
          <Trophy size={12} className="text-amber-400" />
          <span>BEST: <strong className="text-white">{highScore}</strong></span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400">SKOR:</span>
          <span className="text-yellow-400 font-bold">{score}</span>
        </div>
      </div>

      {/* Canvas Wrapper */}
      <div 
        className="relative flex-1 min-h-0 w-full max-w-[400px] max-h-[500px] flex items-center justify-center bg-[#090b10] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden cursor-pointer touch-none select-none"
        onPointerDown={(e) => {
          e.preventDefault();
          if (gameState === 'playing') jump();
          else if (gameState === 'ready' || gameState === 'gameover') startGame();
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full object-contain block"
        />

        <GameOverlay
          gameState={gameState}
          score={score}
          highScore={highScore}
          onStart={startGame}
          onRestart={startGame}
          onResume={resumeGame}
          countdown={countdown}
          instructions="Ketuk di mana saja pada layar atau tekan SPASI untuk melompat melintasi gerbang neon!"
        />
      </div>
    </div>
  );
}
