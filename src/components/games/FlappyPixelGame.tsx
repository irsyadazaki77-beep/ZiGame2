import React, { useState, useEffect, useRef, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { motion } from 'motion/react';
import { GameOverlay } from '../gameplay/GameOverlay';
import { MobileControls } from '../gameplay/MobileControls';

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
}

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 500;
const GRAVITY = 0.5;
const JUMP_STRENGTH = -8;
const PIPE_SPEED = 3;
const PIPE_WIDTH = 60;
const PIPE_GAP = 150;
const BIRD_SIZE = 24;

export default function FlappyPixelGame({ onGameOver, onScoreUpdate, highScore }: FlappyPixelProps) {
  const [gameState, setGameState] = useState<GameState>('ready');
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [muted, setMuted] = useState(audio.getMuteState());

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef(gameState);
  const birdYRef = useRef(CANVAS_HEIGHT / 2);
  const birdVelocityRef = useRef(0);
  const pipesRef = useRef<Pipe[]>([]);
  
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

  const createPipe = (startX: number): Pipe => {
    const minHeight = 50;
    const maxHeight = CANVAS_HEIGHT - PIPE_GAP - minHeight;
    const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
    
    return {
      x: startX,
      topHeight,
      bottomY: topHeight + PIPE_GAP,
      passed: false
    };
  };

  const resetGame = () => {
    birdYRef.current = CANVAS_HEIGHT / 2;
    birdVelocityRef.current = 0;
    pipesRef.current = [
      createPipe(CANVAS_WIDTH),
      createPipe(CANVAS_WIDTH + 250)
    ];
    setScore(0);
    draw();
  };

  const startGame = () => {
    resetGame();
    setGameState('countdown');
    setCountdown(3);
    
    let count = 3;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(interval);
        setGameState('playing');
        lastTimeRef.current = performance.now();
        if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = requestAnimationFrame(gameStep);
      }
    }, 1000);
  };

  const resumeGame = () => {
    setGameState('countdown');
    setCountdown(3);
    
    let count = 3;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(interval);
        setGameState('playing');
        lastTimeRef.current = performance.now();
        if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = requestAnimationFrame(gameStep);
      }
    }, 1000);
  };

  const jump = useCallback(() => {
    if (gameStateRef.current === 'playing') {
      birdVelocityRef.current = JUMP_STRENGTH;
      audio.playLaser();
    }
  }, []);

  const gameStep = (timestamp: number) => {
    if (gameStateRef.current !== 'playing') return;

    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    // Fixed timestep update for physics consistency
    const safeDelta = Math.min(deltaTime, 100);
    frameTimerRef.current += safeDelta;

    const targetFrameTime = 1000 / 60; // 60fps
    while (frameTimerRef.current >= targetFrameTime) {
      updatePhysics();
      frameTimerRef.current -= targetFrameTime;
    }

    draw();
    gameLoopRef.current = requestAnimationFrame(gameStep);
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

    // Pipe logic
    const birdRect = {
      x: 50,
      y: birdYRef.current,
      width: BIRD_SIZE,
      height: BIRD_SIZE
    };

    let needsNewPipe = false;

    pipesRef.current.forEach(pipe => {
      pipe.x -= PIPE_SPEED;

      // Scoring
      if (!pipe.passed && pipe.x + PIPE_WIDTH < birdRect.x) {
        pipe.passed = true;
        const newScore = score + 1;
        setScore(newScore);
        onScoreUpdate(newScore);
        audio.playCoin();
      }

      // Collision
      if (
        birdRect.x < pipe.x + PIPE_WIDTH &&
        birdRect.x + birdRect.width > pipe.x &&
        (birdRect.y < pipe.topHeight || birdRect.y + birdRect.height > pipe.bottomY)
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
      pipesRef.current.push(createPipe(lastPipeX + 250));
    }
  };

  const handleGameOver = () => {
    setGameState('gameover');
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    audio.playExplosion();
    onGameOver(score);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#09090b'; // zinc-950
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid effect
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Pipes
    pipesRef.current.forEach(pipe => {
      ctx.fillStyle = '#10b981'; // emerald-500
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#10b981';
      
      // Top pipe
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
      
      // Bottom pipe
      ctx.fillRect(pipe.x, pipe.bottomY, PIPE_WIDTH, canvas.height - pipe.bottomY);
      
      // Pipe caps
      ctx.fillStyle = '#059669'; // emerald-600
      ctx.fillRect(pipe.x - 2, pipe.topHeight - 20, PIPE_WIDTH + 4, 20);
      ctx.fillRect(pipe.x - 2, pipe.bottomY, PIPE_WIDTH + 4, 20);
    });

    // Bird
    ctx.fillStyle = '#f59e0b'; // amber-500
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#f59e0b';
    
    ctx.save();
    ctx.translate(50 + BIRD_SIZE/2, birdYRef.current + BIRD_SIZE/2);
    // Rotation based on velocity
    const rotation = Math.min(Math.max(birdVelocityRef.current * 0.1, -0.5), 0.5);
    ctx.rotate(rotation);
    
    // Body
    ctx.fillRect(-BIRD_SIZE/2, -BIRD_SIZE/2, BIRD_SIZE, BIRD_SIZE);
    
    // Eye
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 0;
    ctx.fillRect(BIRD_SIZE/4, -BIRD_SIZE/4, 6, 6);
    
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
    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jump]);

  // Auto-pause on blur
  useEffect(() => {
    const handleBlur = () => {
      if (gameStateRef.current === 'playing') {
        setGameState('paused');
      }
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, []);

  useEffect(() => {
    draw();
  }, []);

  const toggleMute = () => {
    const newMute = !muted;
    setMuted(newMute);
    audio.toggleMute();
  };

  return (
    <div className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-zinc-950">
      {/* HUD Bar inside the flex layout to prevent overlap */}
      <div className="w-full flex-none flex justify-between items-center mb-2 px-2 font-mono text-xs">
        <div className="text-emerald-400 font-bold uppercase tracking-wider">
          STATUS: <span className="text-white">ONLINE</span>
        </div>
        <div className="text-yellow-400 font-bold uppercase tracking-wider">
          SKOR: <span className="text-white">{score}</span>
        </div>
      </div>

      {/* Canvas Wrapper */}
      <div 
        className="relative flex-1 min-h-0 w-full flex items-center justify-center bg-black rounded-xl border border-zinc-800 shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden cursor-pointer"
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
          className="max-w-full max-h-full object-contain"
        />
        
        <GameOverlay
          gameState={gameState}
          score={score}
          onStart={startGame}
          onRestart={startGame}
          onResume={resumeGame}
          countdown={countdown}
          instructions="Ketuk layar atau tekan SPASI untuk melompat melintasi rintangan gerbang neon."
        />
      </div>

      {/* Mobile Action Controls outside the canvas wrapper so it doesn't overlap */}
      {gameState === 'playing' && (
        <div className="flex-none mt-2 w-full">
          <MobileControls onAction={jump} actionLabel="LOMPAT" />
        </div>
      )}
    </div>
  );
}
