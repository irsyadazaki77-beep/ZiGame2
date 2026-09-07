import React, { useRef, useEffect, useCallback } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';
import { audio } from '../../utils/audio';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Sparkles, Flame } from 'lucide-react';

interface GameProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
  highScore: number;
}

interface ObstacleCar {
  x: number;
  z: number; // 0 (horizon) to 1 (near camera)
  speed: number;
  lane: number;
  color: string;
  passed: boolean;
}

interface SparkParticle {
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

const CANVAS_WIDTH = 550;
const CANVAS_HEIGHT = 380;
const HORIZON_Y = 140;

export default function VaporwaveRacerGame({ onScoreUpdate, onGameOver, highScore }: GameProps) {
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
    gameId: 'vaporwave-racer',
    onGameOver,
    onScoreUpdate
  });

  // Game loop state refs
  const playerLaneRef = useRef(1); // 0 (left), 1 (center), 2 (right)
  const playerXRef = useRef(0); // smooth interpolated x
  const roadScrollRef = useRef(0);
  const baseSpeedRef = useRef(0.012);
  const isBoostingRef = useRef(false);
  const boostEnergyRef = useRef(100);
  const obstaclesRef = useRef<ObstacleCar[]>([]);
  const particlesRef = useRef<SparkParticle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const spawnTimerRef = useRef(0);
  const comboRef = useRef(0);
  const shakeRef = useRef(0);

  // Active steer keys
  const keysRef = useRef<{ left: boolean; right: boolean; boost: boolean }>({
    left: false,
    right: false,
    boost: false
  });

  // Handle steering inputs
  const steerLeft = useCallback(() => {
    if (gameState !== 'playing') return;
    if (playerLaneRef.current > 0) {
      playerLaneRef.current -= 1;
      audio.playLaser();
      inputManager.vibrateGamepad(30, 0.2);
    }
  }, [gameState]);

  const steerRight = useCallback(() => {
    if (gameState !== 'playing') return;
    if (playerLaneRef.current < 2) {
      playerLaneRef.current += 1;
      audio.playLaser();
      inputManager.vibrateGamepad(30, 0.2);
    }
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        steerLeft();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        steerRight();
      } else if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        keysRef.current.boost = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        keysRef.current.boost = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, steerLeft, steerRight]);

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

    // Sky Vaporwave Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    skyGrad.addColorStop(0, '#190a2e');
    skyGrad.addColorStop(0.7, '#4a0e4e');
    skyGrad.addColorStop(1, '#9b1b75');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HORIZON_Y);

    // Glowing Synthwave Sun
    const sunX = CANVAS_WIDTH / 2;
    const sunY = HORIZON_Y - 10;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 55);
    sunGrad.addColorStop(0, '#fef08a');
    sunGrad.addColorStop(0.5, '#f43f5e');
    sunGrad.addColorStop(1, 'rgba(217, 70, 239, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 55, 0, Math.PI * 2);
    ctx.fill();

    // Sun horizontal scan lines
    ctx.fillStyle = '#190a2e';
    for (let i = 0; i < 6; i++) {
      const lineY = sunY + i * 5;
      ctx.fillRect(sunX - 45, lineY, 90, 2);
    }

    // Road Ground Gradient
    const roadGrad = ctx.createLinearGradient(0, HORIZON_Y, 0, CANVAS_HEIGHT);
    roadGrad.addColorStop(0, '#090817');
    roadGrad.addColorStop(1, '#020205');
    ctx.fillStyle = roadGrad;
    ctx.fillRect(0, HORIZON_Y, CANVAS_WIDTH, CANVAS_HEIGHT - HORIZON_Y);

    // 3D Perspective Grid
    const numLines = 8;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(217, 70, 239, 0.4)';

    // Vanishing perspective rays
    for (let i = 0; i <= numLines; i++) {
      const bottomX = (CANVAS_WIDTH / numLines) * i;
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH / 2, HORIZON_Y);
      ctx.lineTo(bottomX, CANVAS_HEIGHT);
      ctx.stroke();
    }

    // Perspective moving horizontal stripes
    const speed = baseSpeedRef.current * (isBoostingRef.current ? 1.8 : 1.0);
    roadScrollRef.current = (roadScrollRef.current + speed) % 1;

    for (let i = 1; i <= 14; i++) {
      const z = Math.pow((i + roadScrollRef.current) / 14, 2.5);
      const y = HORIZON_Y + (CANVAS_HEIGHT - HORIZON_Y) * z;
      ctx.strokeStyle = `rgba(34, 211, 238, ${0.15 + z * 0.6})`;
      ctx.lineWidth = 1 + z * 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Helper: calculate screen coords for lane & z depth
    const getScreenPos = (lane: number, z: number) => {
      const horizonRoadWidth = 40;
      const nearRoadWidth = 420;
      const roadW = horizonRoadWidth + (nearRoadWidth - horizonRoadWidth) * z;
      const roadCenterX = CANVAS_WIDTH / 2;
      const laneOffset = (lane - 1) * (roadW / 3);
      const screenX = roadCenterX + laneOffset;
      const screenY = HORIZON_Y + (CANVAS_HEIGHT - HORIZON_Y) * z;
      const scale = 0.2 + z * 0.9;
      return { x: screenX, y: screenY, scale };
    };

    // Obstacle Vehicles
    for (const obs of obstaclesRef.current) {
      const { x, y, scale } = getScreenPos(obs.lane, obs.z);
      const carW = 44 * scale;
      const carH = 26 * scale;

      ctx.shadowBlur = 10 * scale;
      ctx.shadowColor = obs.color;
      ctx.fillStyle = obs.color;
      ctx.beginPath();
      ctx.roundRect(x - carW / 2, y - carH, carW, carH, 4 * scale);
      ctx.fill();

      // Taillights
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x - carW / 2 + 2, y - 6 * scale, 5 * scale, 4 * scale);
      ctx.fillRect(x + carW / 2 - 7 * scale, y - 6 * scale, 5 * scale, 4 * scale);
      ctx.shadowBlur = 0;
    }

    // Player Vehicle
    const targetLaneX = (playerLaneRef.current - 1);
    playerXRef.current += (targetLaneX - playerXRef.current) * 0.2; // Smooth lane interpolation

    const playerRoadW = 420;
    const playerScreenX = CANVAS_WIDTH / 2 + playerXRef.current * (playerRoadW / 3);
    const playerScreenY = CANVAS_HEIGHT - 35;
    const pW = 52;
    const pH = 28;

    // Boost Exhaust Fire
    if (isBoostingRef.current) {
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#38bdf8';
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(playerScreenX - 12, playerScreenY);
      ctx.lineTo(playerScreenX - 8, playerScreenY + 16 + Math.random() * 6);
      ctx.lineTo(playerScreenX - 4, playerScreenY);
      ctx.moveTo(playerScreenX + 4, playerScreenY);
      ctx.lineTo(playerScreenX + 8, playerScreenY + 16 + Math.random() * 6);
      ctx.lineTo(playerScreenX + 12, playerScreenY);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Player Car Chassis
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#d946ef';
    ctx.fillStyle = '#d946ef';
    ctx.beginPath();
    ctx.roundRect(playerScreenX - pW / 2, playerScreenY - pH, pW, pH, 6);
    ctx.fill();

    // Cabin
    ctx.fillStyle = '#181824';
    ctx.fillRect(playerScreenX - pW / 2 + 6, playerScreenY - pH + 5, pW - 12, 12);

    // Neon cyan highlights
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(playerScreenX - pW / 2 + 4, playerScreenY - 4, 8, 3);
    ctx.fillRect(playerScreenX + pW / 2 - 12, playerScreenY - 4, 8, 3);
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

  // Main Delta-Time Loop
  const gameStep = useCallback((timestamp: number, deltaTime: number) => {
    const dt = Math.min(deltaTime / 16.666, 3.0); // 60fps normalized

    // 1. Handle Turbo Boost
    if (keysRef.current.boost && boostEnergyRef.current > 0) {
      isBoostingRef.current = true;
      boostEnergyRef.current = Math.max(0, boostEnergyRef.current - 0.6 * dt);
    } else {
      isBoostingRef.current = false;
      boostEnergyRef.current = Math.min(100, boostEnergyRef.current + 0.2 * dt);
    }

    const currentSpeed = (baseSpeedRef.current * (isBoostingRef.current ? 1.8 : 1.0)) * dt;

    // 2. Spawn Oncoming Vehicles
    spawnTimerRef.current += dt;
    const spawnThreshold = Math.max(40, 85 - (score || 0) / 35);
    if (spawnTimerRef.current >= spawnThreshold) {
      spawnTimerRef.current = 0;
      const lane = Math.floor(Math.random() * 3);
      const colors = ['#f43f5e', '#38bdf8', '#fbbf24', '#a855f7'];
      const color = colors[Math.floor(Math.random() * colors.length)];

      obstaclesRef.current.push({
        x: 0,
        z: 0.05, // start from horizon
        speed: 0.008 + Math.random() * 0.005,
        lane,
        color,
        passed: false
      });
    }

    // 3. Move Obstacles & Check Collision
    for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
      const obs = obstaclesRef.current[i];
      obs.z += (obs.speed + currentSpeed) * 0.8;

      // Check collision at near camera (z >= 0.85)
      if (obs.z >= 0.84 && obs.z <= 0.98) {
        if (obs.lane === playerLaneRef.current) {
          audio.playExplosion();
          shakeRef.current = 22;
          inputManager.vibrateGamepad(300, 0.9);

          const playerRoadW = 420;
          const pScreenX = CANVAS_WIDTH / 2 + (playerLaneRef.current - 1) * (playerRoadW / 3);

          for (let j = 0; j < 25; j++) {
            particlesRef.current.push({
              x: pScreenX,
              y: CANVAS_HEIGHT - 40,
              vx: (Math.random() - 0.5) * 10,
              vy: (Math.random() - 0.5) * 10,
              size: Math.random() * 4 + 2,
              color: j % 2 === 0 ? '#d946ef' : '#f43f5e',
              alpha: 1.0,
              decay: 0.035
            });
          }

          draw();
          triggerGameOver();
          return;
        }
      }

      // Check Pass & Score
      if (!obs.passed && obs.z > 0.98) {
        obs.passed = true;
        comboRef.current += 1;
        const pts = (isBoostingRef.current ? 25 : 15) * Math.min(5, Math.floor(comboRef.current / 3) + 1);
        updateScore((score || 0) + pts);
        audio.playScore();

        floatingTextsRef.current.push({
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT - 60,
          text: `+${pts}`,
          color: '#22d3ee',
          alpha: 1.0,
          vy: -1.0
        });
      }

      // Remove passed vehicles
      if (obs.z > 1.2) {
        obstaclesRef.current.splice(i, 1);
      }
    }

    // Accelerate gradually
    baseSpeedRef.current = Math.min(0.024, 0.012 + (score || 0) / 4000);

    draw();
  }, [draw, score, triggerGameOver, updateScore]);

  // Lifecycle Start
  const startGame = useCallback(() => {
    playerLaneRef.current = 1;
    playerXRef.current = 0;
    obstaclesRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
    boostEnergyRef.current = 100;
    spawnTimerRef.current = 0;
    comboRef.current = 0;
    baseSpeedRef.current = 0.012;
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
    <div className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-[#0a0815]">
      {/* HUD */}
      <div className="w-full max-w-[550px] flex-none flex justify-between items-center mb-2 px-3 py-1 bg-[#140d24]/80 border border-white/[0.06] rounded-xl text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <Flame size={14} className={isBoostingRef.current ? 'text-sky-400 animate-pulse' : 'text-fuchsia-400'} />
          <span className="text-zinc-400">BOOST:</span>
          <div className="w-16 h-2 bg-zinc-800 rounded-full overflow-hidden border border-white/10">
            <div 
              className="h-full bg-gradient-to-r from-fuchsia-500 to-sky-400 transition-all duration-75"
              style={{ width: `${boostEnergyRef.current}%` }}
            />
          </div>
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
        className="relative flex-1 min-h-0 w-full max-w-[550px] max-h-[380px] flex items-center justify-center bg-[#0a0815] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden select-none"
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
          instructions="Kemudikan mobil synthwave di jalan raya 3D! Tekan Kiri/Kanan (A/D) untuk pindah jalur, dan tahan SPASI untuk Turbo Boost."
        />
      </div>

      {/* Mobile Steer Buttons */}
      {gameState === 'playing' && (
        <div className="flex-none mt-2 w-full max-w-[550px] flex gap-2 md:hidden">
          <button
            onTouchStart={(e) => { e.preventDefault(); steerLeft(); }}
            onClick={steerLeft}
            className="flex-1 py-3.5 bg-fuchsia-700 active:bg-fuchsia-600 rounded-xl text-white font-bold text-sm tracking-wider uppercase select-none min-h-[44px]"
          >
            ◀ JALUR KIRI
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); keysRef.current.boost = true; }}
            onTouchEnd={(e) => { e.preventDefault(); keysRef.current.boost = false; }}
            className="py-3.5 px-4 bg-sky-600 active:bg-sky-500 rounded-xl text-white font-bold text-xs tracking-wider uppercase select-none min-h-[44px]"
          >
            ⚡ BOOST
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); steerRight(); }}
            onClick={steerRight}
            className="flex-1 py-3.5 bg-fuchsia-700 active:bg-fuchsia-600 rounded-xl text-white font-bold text-sm tracking-wider uppercase select-none min-h-[44px]"
          >
            JALUR KANAN ▶
          </button>
        </div>
      )}
    </div>
  );
}
