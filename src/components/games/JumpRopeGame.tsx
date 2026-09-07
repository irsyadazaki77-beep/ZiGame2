import React, { useRef, useEffect, useCallback } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';
import { audio } from '../../utils/audio';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Sparkles } from 'lucide-react';

interface GameProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
  highScore: number;
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

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 280;
const GROUND_Y = 210;
const PLAYER_X = 250;
const PLAYER_WIDTH = 26;
const PLAYER_HEIGHT = 38;
const GRAVITY = 0.52;
const JUMP_FORCE = -9.2;

export default function JumpRopeGame({ onScoreUpdate, onGameOver, highScore }: GameProps) {
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
    gameId: 'jump-rope',
    onGameOver,
    onScoreUpdate
  });

  // Game state refs (60-144Hz delta-time physics)
  const playerYRef = useRef(GROUND_Y - PLAYER_HEIGHT);
  const playerVyRef = useRef(0);
  const isGroundedRef = useRef(true);
  const ropePosRef = useRef(CANVAS_WIDTH + 50); // X position of obstacle
  const ropeSpeedRef = useRef(4.0);
  const jumpsMadeRef = useRef(0);
  const comboRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const shakeRef = useRef(0);

  // Jump trigger
  const jump = useCallback(() => {
    if (gameState !== 'playing') return;
    if (isGroundedRef.current) {
      playerVyRef.current = JUMP_FORCE;
      isGroundedRef.current = false;
      audio.playJump();
      inputManager.vibrateGamepad(50, 0.3);

      // Jump dust particles
      for (let i = 0; i < 6; i++) {
        particlesRef.current.push({
          x: PLAYER_X + (Math.random() - 0.5) * PLAYER_WIDTH,
          y: GROUND_Y,
          vx: (Math.random() - 0.5) * 3,
          vy: -Math.random() * 2,
          size: Math.random() * 3 + 1,
          color: '#818cf8',
          alpha: 0.8,
          decay: 0.05
        });
      }
    }
  }, [gameState]);

  // Unified input listener
  useEffect(() => {
    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'UP' || action === 'PRIMARY') {
          jump();
        }
      }
    });

    const handleKey = (e: KeyboardEvent) => {
      if (gameState === 'playing' && (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        jump();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      unsub();
      window.removeEventListener('keydown', handleKey);
    };
  }, [gameState, jump]);

  // Draw frame
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
      shakeRef.current = Math.max(0, shakeRef.current - 0.4);
    }

    // Background
    ctx.fillStyle = '#090a10';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Neon grid lines
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }

    // Ground platform
    ctx.fillStyle = '#111526';
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();

    // Ground glow line
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#6366f1';
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Moving Laser / Rope Obstacle
    const ropeX = ropePosRef.current;
    const ropeWidth = 14;
    const ropeHeight = 28;
    const ropeY = GROUND_Y - ropeHeight;

    ctx.shadowBlur = 12;
    ctx.shadowColor = '#f43f5e';
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.roundRect(ropeX - ropeWidth / 2, ropeY, ropeWidth, ropeHeight, 3);
    ctx.fill();

    // Laser core light
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ropeX - 2, ropeY + 2, 4, ropeHeight - 4);
    ctx.shadowBlur = 0;

    // Player Neon Robot / Runner
    const pX = PLAYER_X - PLAYER_WIDTH / 2;
    const pY = playerYRef.current;

    ctx.shadowBlur = 14;
    ctx.shadowColor = '#818cf8';
    ctx.fillStyle = '#818cf8';
    ctx.beginPath();
    ctx.roundRect(pX, pY, PLAYER_WIDTH, PLAYER_HEIGHT, 6);
    ctx.fill();

    // Player Visor
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(pX + 4, pY + 6, PLAYER_WIDTH - 8, 8);

    // Player Thruster spark when in air
    if (!isGroundedRef.current) {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(pX + 6, pY + PLAYER_HEIGHT, PLAYER_WIDTH - 12, 6);
    }
    ctx.shadowBlur = 0;

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

    // Floating texts
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

  // Main game step
  const gameStep = useCallback((timestamp: number, deltaTime: number) => {
    const dt = Math.min(deltaTime / 16.666, 3.0); // normalized to 60fps units

    // 1. Update Player Physics
    if (!isGroundedRef.current) {
      playerVyRef.current += GRAVITY * dt;
      playerYRef.current += playerVyRef.current * dt;

      if (playerYRef.current >= GROUND_Y - PLAYER_HEIGHT) {
        playerYRef.current = GROUND_Y - PLAYER_HEIGHT;
        playerVyRef.current = 0;
        isGroundedRef.current = true;
      }
    }

    // 2. Move Obstacle with delta-time
    ropePosRef.current -= ropeSpeedRef.current * dt;

    // 3. Collision Check
    const ropeX = ropePosRef.current;
    const ropeWidth = 14;
    const ropeHeight = 28;
    const ropeY = GROUND_Y - ropeHeight;

    const pX = PLAYER_X - PLAYER_WIDTH / 2;
    const pY = playerYRef.current;

    const isColliding = (
      ropeX + ropeWidth / 2 > pX &&
      ropeX - ropeWidth / 2 < pX + PLAYER_WIDTH &&
      ropeY < pY + PLAYER_HEIGHT &&
      ropeY + ropeHeight > pY
    );

    if (isColliding) {
      audio.playExplosion();
      shakeRef.current = 16;
      inputManager.vibrateGamepad(200, 0.8);

      // Spawn crash explosion
      for (let i = 0; i < 20; i++) {
        particlesRef.current.push({
          x: PLAYER_X,
          y: pY + PLAYER_HEIGHT / 2,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          size: Math.random() * 3 + 2,
          color: i % 2 === 0 ? '#f43f5e' : '#fbbf24',
          alpha: 1.0,
          decay: 0.04
        });
      }

      draw();
      triggerGameOver();
      return;
    }

    // 4. Obstacle Reset & Score Point
    if (ropePosRef.current < -30) {
      jumpsMadeRef.current += 1;
      comboRef.current += 1;
      const pts = 10 * Math.min(5, Math.floor(comboRef.current / 3) + 1);
      
      updateScore((score || 0) + pts);
      audio.playScore();

      floatingTextsRef.current.push({
        x: PLAYER_X,
        y: playerYRef.current - 10,
        text: `+${pts}`,
        color: '#34d399',
        alpha: 1.0,
        vy: -1.0
      });

      // Reset rope to right side with dynamic acceleration
      ropePosRef.current = CANVAS_WIDTH + 30;
      ropeSpeedRef.current = Math.min(8.5, 4.0 + (jumpsMadeRef.current * 0.15));
    }

    draw();
  }, [draw, score, triggerGameOver, updateScore]);

  // Start game lifecycle
  const startGame = useCallback(() => {
    playerYRef.current = GROUND_Y - PLAYER_HEIGHT;
    playerVyRef.current = 0;
    isGroundedRef.current = true;
    ropePosRef.current = CANVAS_WIDTH + 50;
    ropeSpeedRef.current = 4.0;
    jumpsMadeRef.current = 0;
    comboRef.current = 0;
    particlesRef.current = [];
    floatingTextsRef.current = [];
    updateScore(0);

    startWithCountdown(() => {
      startLoop(gameStep);
    });
  }, [startWithCountdown, startLoop, gameStep, updateScore]);

  // DPR setup
  useEffect(() => {
    setupCanvasContext(canvasRef.current, CANVAS_WIDTH, CANVAS_HEIGHT);
    draw();
  }, [setupCanvasContext, draw]);

  return (
    <div className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-[#090b10]">
      {/* HUD */}
      <div className="w-full max-w-[500px] flex-none flex justify-between items-center mb-2 px-3 py-1 bg-[#121622]/80 border border-white/[0.06] rounded-xl text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">LOMPATAN:</span>
          <span className="text-indigo-400 font-bold">{jumpsMadeRef.current}</span>
        </div>

        {comboRef.current > 3 && (
          <div className="flex items-center gap-1 text-amber-400 font-bold animate-pulse">
            <Sparkles size={12} />
            <span>KOMBO {comboRef.current}x</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-zinc-400">SKOR:</span>
          <span className="text-white font-bold">{score}</span>
        </div>
      </div>

      {/* Canvas container */}
      <div 
        className="relative flex-1 min-h-0 w-full max-w-[500px] max-h-[280px] flex items-center justify-center bg-[#090b10] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden cursor-pointer select-none"
        onClick={jump}
        onTouchStart={(e) => { e.preventDefault(); jump(); }}
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
          instructions="Lompati laser neon yang meluncur cepat! Tekan SPASI, panah ATAS, atau ketuk layar."
        />
      </div>

      {/* Mobile action button */}
      {gameState === 'playing' && (
        <div className="flex-none mt-2 w-full max-w-[500px] md:hidden">
          <button
            onTouchStart={(e) => { e.preventDefault(); jump(); }}
            onClick={jump}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-400 rounded-xl text-white font-bold text-sm tracking-wider uppercase shadow-lg shadow-indigo-600/30 select-none touch-none min-h-[44px]"
          >
            ⬆️ LOMPAT (KETUK / SPASI)
          </button>
        </div>
      )}
    </div>
  );
}
