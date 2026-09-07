import React, { useRef, useEffect, useCallback } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';
import { audio } from '../../utils/audio';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Sparkles, Zap } from 'lucide-react';

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
  speed: number;
  color: string;
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

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 500;
const ROAD_LEFT = 40;
const ROAD_RIGHT = 360;
const ROAD_WIDTH = ROAD_RIGHT - ROAD_LEFT;
const CAR_WIDTH = 34;
const CAR_HEIGHT = 54;
const CAR_Y = CANVAS_HEIGHT - 90;

export default function NeonDriftGame({ onScoreUpdate, onGameOver, highScore }: GameProps) {
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
    gameId: 'neon-drift',
    onGameOver,
    onScoreUpdate
  });

  // Game loop state refs (high-frequency mutable)
  const playerXRef = useRef(CANVAS_WIDTH / 2);
  const playerVxRef = useRef(0);
  const driftAngleRef = useRef(0);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const roadOffsetRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const comboRef = useRef(0);
  const shakeRef = useRef(0);
  const baseSpeedRef = useRef(5.0);

  // Active key state for smooth continuous steer
  const keysRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });

  // Input listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        keysRef.current.left = true;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        keysRef.current.right = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysRef.current.left = false;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysRef.current.right = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // Touch steer handler for canvas
  const handleTouchMove = (e: React.TouchEvent) => {
    if (gameState !== 'playing' || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    const canvasScaleX = CANVAS_WIDTH / rect.width;
    const targetX = touchX * canvasScaleX;
    playerXRef.current = Math.max(ROAD_LEFT + CAR_WIDTH / 2, Math.min(ROAD_RIGHT - CAR_WIDTH / 2, targetX));
  };

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
      shakeRef.current = Math.max(0, shakeRef.current - 0.5);
    }

    // Background Cyber Grid
    ctx.fillStyle = '#070913';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Side Neon Glow Borders
    ctx.fillStyle = '#0e1322';
    ctx.fillRect(0, 0, ROAD_LEFT, CANVAS_HEIGHT);
    ctx.fillRect(ROAD_RIGHT, 0, CANVAS_WIDTH - ROAD_RIGHT, CANVAS_HEIGHT);

    // Asphalt Road
    ctx.fillStyle = '#0b0e1b';
    ctx.fillRect(ROAD_LEFT, 0, ROAD_WIDTH, CANVAS_HEIGHT);

    // Road side boundary lasers
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#22d3ee';
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ROAD_LEFT, 0);
    ctx.lineTo(ROAD_LEFT, CANVAS_HEIGHT);
    ctx.moveTo(ROAD_RIGHT, 0);
    ctx.lineTo(ROAD_RIGHT, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Moving Lane Markings
    roadOffsetRef.current = (roadOffsetRef.current + baseSpeedRef.current) % 40;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 20]);
    ctx.lineDashOffset = -roadOffsetRef.current;

    const lane1 = ROAD_LEFT + ROAD_WIDTH / 3;
    const lane2 = ROAD_LEFT + (ROAD_WIDTH * 2) / 3;

    ctx.beginPath();
    ctx.moveTo(lane1, 0);
    ctx.lineTo(lane1, CANVAS_HEIGHT);
    ctx.moveTo(lane2, 0);
    ctx.lineTo(lane2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Obstacles (Rival Cyber Vehicles / Neon Blocks)
    for (const obs of obstaclesRef.current) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = obs.color;
      ctx.fillStyle = obs.color;
      ctx.beginPath();
      ctx.roundRect(obs.x - obs.width / 2, obs.y - obs.height / 2, obs.width, obs.height, 5);
      ctx.fill();

      // Vehicle tail lights
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(obs.x - obs.width / 2 + 4, obs.y + obs.height / 2 - 4, 6, 3);
      ctx.fillRect(obs.x + obs.width / 2 - 10, obs.y + obs.height / 2 - 4, 6, 3);
      ctx.shadowBlur = 0;
    }

    // Drift Tire Sparks / Smoke Particles
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

    // Player Neon Drift Car
    const px = playerXRef.current;
    const py = CAR_Y;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(driftAngleRef.current);

    // Car Body Glow
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#06b6d4';
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.roundRect(-CAR_WIDTH / 2, -CAR_HEIGHT / 2, CAR_WIDTH, CAR_HEIGHT, 6);
    ctx.fill();

    // Windshield & Roof
    ctx.fillStyle = '#090d16';
    ctx.fillRect(-CAR_WIDTH / 2 + 4, -CAR_HEIGHT / 2 + 8, CAR_WIDTH - 8, 16);

    // Neon Headlights
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.fillRect(-CAR_WIDTH / 2 + 3, -CAR_HEIGHT / 2, 6, 4);
    ctx.fillRect(CAR_WIDTH / 2 - 9, -CAR_HEIGHT / 2, 6, 4);

    // Tail Brake Lights
    ctx.fillStyle = '#f43f5e';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 8;
    ctx.fillRect(-CAR_WIDTH / 2 + 3, CAR_HEIGHT / 2 - 4, 7, 4);
    ctx.fillRect(CAR_WIDTH / 2 - 10, CAR_HEIGHT / 2 - 4, 7, 4);

    ctx.restore();

    // Floating Score Texts
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
    const dt = Math.min(deltaTime / 16.666, 3.0); // normalized 60fps unit

    // 1. Update Player Drift Steer
    const steerSpeed = 6.2;
    if (keysRef.current.left) {
      playerVxRef.current = -steerSpeed;
      driftAngleRef.current = Math.max(-0.25, driftAngleRef.current - 0.04 * dt);
    } else if (keysRef.current.right) {
      playerVxRef.current = steerSpeed;
      driftAngleRef.current = Math.min(0.25, driftAngleRef.current + 0.04 * dt);
    } else {
      playerVxRef.current *= 0.82; // gentle friction
      driftAngleRef.current *= 0.85; // straighten out
    }

    playerXRef.current += playerVxRef.current * dt;

    // Road Clamp
    const minX = ROAD_LEFT + CAR_WIDTH / 2;
    const maxX = ROAD_RIGHT - CAR_WIDTH / 2;
    if (playerXRef.current < minX) {
      playerXRef.current = minX;
      playerVxRef.current = 0;
    }
    if (playerXRef.current > maxX) {
      playerXRef.current = maxX;
      playerVxRef.current = 0;
    }

    // Drift particles behind tires when turning
    if (Math.abs(playerVxRef.current) > 2) {
      for (let i = 0; i < 2; i++) {
        particlesRef.current.push({
          x: playerXRef.current + (Math.random() - 0.5) * CAR_WIDTH,
          y: CAR_Y + CAR_HEIGHT / 2,
          vx: -playerVxRef.current * 0.2 + (Math.random() - 0.5),
          vy: 2 + Math.random() * 2,
          size: Math.random() * 3 + 1,
          color: '#22d3ee',
          alpha: 0.7,
          decay: 0.06
        });
      }
    }

    // 2. Spawn Obstacles
    spawnTimerRef.current += dt;
    if (spawnTimerRef.current >= Math.max(35, 75 - (score || 0) / 40)) {
      spawnTimerRef.current = 0;
      const laneWidth = ROAD_WIDTH / 3;
      const laneIndex = Math.floor(Math.random() * 3);
      const laneX = ROAD_LEFT + laneWidth * laneIndex + laneWidth / 2;

      const colors = ['#f43f5e', '#ec4899', '#a855f7', '#f59e0b'];
      const chosenColor = colors[Math.floor(Math.random() * colors.length)];

      obstaclesRef.current.push({
        x: laneX,
        y: -60,
        width: CAR_WIDTH - 2,
        height: CAR_HEIGHT - 6,
        speed: baseSpeedRef.current + (Math.random() - 0.5) * 1.5,
        color: chosenColor,
        passed: false
      });
    }

    // 3. Move Obstacles & Collision Check
    const px = playerXRef.current;
    const py = CAR_Y;

    for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
      const obs = obstaclesRef.current[i];
      obs.y += obs.speed * dt;

      // Check collision
      const xDist = Math.abs(px - obs.x);
      const yDist = Math.abs(py - obs.y);

      if (xDist < (CAR_WIDTH + obs.width) * 0.42 && yDist < (CAR_HEIGHT + obs.height) * 0.42) {
        audio.playExplosion();
        shakeRef.current = 18;
        inputManager.vibrateGamepad(250, 0.85);

        // Crash explosion
        for (let j = 0; j < 24; j++) {
          particlesRef.current.push({
            x: px,
            y: py,
            vx: (Math.random() - 0.5) * 9,
            vy: (Math.random() - 0.5) * 9,
            size: Math.random() * 4 + 2,
            color: j % 2 === 0 ? '#f43f5e' : '#22d3ee',
            alpha: 1.0,
            decay: 0.035
          });
        }

        draw();
        triggerGameOver();
        return;
      }

      // Check pass & score
      if (!obs.passed && obs.y > py) {
        obs.passed = true;
        comboRef.current += 1;
        const pts = 10 * Math.min(5, Math.floor(comboRef.current / 3) + 1);
        updateScore((score || 0) + pts);
        audio.playScore();

        // Near-miss extra points
        if (xDist < CAR_WIDTH * 1.2) {
          floatingTextsRef.current.push({
            x: px,
            y: py - 20,
            text: `DRIFT! +${pts}`,
            color: '#22d3ee',
            alpha: 1.0,
            vy: -1.2
          });
        }
      }

      // Remove off-screen obstacles
      if (obs.y > CANVAS_HEIGHT + 80) {
        obstaclesRef.current.splice(i, 1);
      }
    }

    // Accelerate game gently over time
    baseSpeedRef.current = Math.min(9.5, 5.0 + ((score || 0) / 300));

    draw();
  }, [draw, score, triggerGameOver, updateScore]);

  // Start lifecycle
  const startGame = useCallback(() => {
    playerXRef.current = CANVAS_WIDTH / 2;
    playerVxRef.current = 0;
    driftAngleRef.current = 0;
    obstaclesRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
    spawnTimerRef.current = 0;
    comboRef.current = 0;
    baseSpeedRef.current = 5.0;
    keysRef.current = { left: false, right: false };
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
    <div className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-[#070913]">
      {/* HUD */}
      <div className="w-full max-w-[400px] flex-none flex justify-between items-center mb-2 px-3 py-1 bg-[#121622]/80 border border-white/[0.06] rounded-xl text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <Zap size={14} className="text-cyan-400" />
          <span className="text-zinc-400">KECEPATAN:</span>
          <span className="text-cyan-400 font-bold">{Math.round(baseSpeedRef.current * 18)} KM/H</span>
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
        className="relative flex-1 min-h-0 w-full max-w-[400px] max-h-[500px] flex items-center justify-center bg-[#070913] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden touch-none"
        onTouchMove={handleTouchMove}
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
          instructions="Kemudikan mobil neon di jalur cyber! Hindari kendaraan lain dengan tombol Panah Kiri/Kanan, A/D, atau sentuh dan geser layar."
        />
      </div>

      {/* Touch D-Pad for Mobile */}
      {gameState === 'playing' && (
        <div className="flex-none mt-2 w-full max-w-[400px] flex gap-2 md:hidden">
          <button
            onTouchStart={(e) => { e.preventDefault(); keysRef.current.left = true; }}
            onTouchEnd={(e) => { e.preventDefault(); keysRef.current.left = false; }}
            onMouseDown={() => { keysRef.current.left = true; }}
            onMouseUp={() => { keysRef.current.left = false; }}
            className="flex-1 py-3.5 bg-cyan-600/80 active:bg-cyan-500 rounded-xl text-white font-bold text-sm tracking-wider uppercase select-none min-h-[44px]"
          >
            ◀ KIRI
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); keysRef.current.right = true; }}
            onTouchEnd={(e) => { e.preventDefault(); keysRef.current.right = false; }}
            onMouseDown={() => { keysRef.current.right = true; }}
            onMouseUp={() => { keysRef.current.right = false; }}
            className="flex-1 py-3.5 bg-cyan-600/80 active:bg-cyan-500 rounded-xl text-white font-bold text-sm tracking-wider uppercase select-none min-h-[44px]"
          >
            KANAN ▶
          </button>
        </div>
      )}
    </div>
  );
}
