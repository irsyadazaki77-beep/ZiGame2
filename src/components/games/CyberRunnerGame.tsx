import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { useGameEngine } from '../../hooks/useGameEngine';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Sparkles, Trophy, Zap } from 'lucide-react';

interface CyberRunnerGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface RunnerObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'spike' | 'drone' | 'laser_gate';
  speed: number;
  passed: boolean;
  nearMissed?: boolean;
}

interface RunnerCoin {
  x: number;
  y: number;
  radius: number;
  value: number;
  collected: boolean;
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
const CANVAS_HEIGHT = 320;
const GROUND_Y = 240;

export default function CyberRunnerGame({ onGameOver, onScoreUpdate, highScore }: CyberRunnerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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
    gameLoopRef
  } = useGameEngine({
    gameId: 'cyberrunner',
    onGameOver,
    onScoreUpdate,
  });

  const [combo, setCombo] = useState(0);
  const [distance, setDistance] = useState(0);

  const gameStateRef = useRef(gameState);
  const comboRef = useRef(0);
  const comboTimerRef = useRef(0);
  const hitStopRef = useRef<number>(0);
  const shakeRef = useRef<number>(0);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Player physics
  const playerRef = useRef({
    x: 60,
    y: GROUND_Y - 36,
    width: 22,
    height: 36,
    vy: 0,
    gravity: 0.58,
    jumpForce: -10.2,
    isGrounded: true,
    isDucking: false,
    duckHeight: 20,
    normalHeight: 36,
    doubleJumpAvailable: true,
    runFrame: 0,
  });

  const obstaclesRef = useRef<RunnerObstacle[]>([]);
  const coinsRef = useRef<RunnerCoin[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const buildingsRef = useRef<{ x: number; width: number; height: number; lights: boolean[] }[]>([]);
  const activeKeysRef = useRef<{ [key: string]: boolean }>({});
  const speedMultRef = useRef<number>(1);
  const spawnTimerRef = useRef<number>(0);
  const coinTimerRef = useRef<number>(0);

  // Background neon skyline
  const initSkyline = useCallback(() => {
    const buildings = [];
    let curX = 0;
    while (curX < CANVAS_WIDTH * 1.5) {
      const w = 40 + Math.random() * 50;
      const h = 70 + Math.random() * 110;
      const lights = Array.from({ length: 12 }, () => Math.random() > 0.4);
      buildings.push({ x: curX, width: w, height: h, lights });
      curX += w + 6;
    }
    buildingsRef.current = buildings;
  }, []);

  useEffect(() => {
    initSkyline();
    draw();
    return () => {
      if (gameLoopRef?.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [initSkyline]);

  // Auto-pause when tab hidden
  useEffect(() => {
    const handleVis = () => {
      if (document.hidden && gameStateRef.current === 'playing') {
        setGameState('paused');
      }
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => document.removeEventListener('visibilitychange', handleVis);
  }, []);

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

  const handleJump = useCallback(() => {
    const p = playerRef.current;
    if (gameStateRef.current !== 'playing') return;

    if (p.isGrounded) {
      p.vy = p.jumpForce;
      p.isGrounded = false;
      p.doubleJumpAvailable = true;
      audio.playLaser();
      inputManager.vibrateGamepad(30, 0.25);
      spawnParticles(p.x + p.width / 2, GROUND_Y, '#38bdf8', 6, 1.8);
    } else if (p.doubleJumpAvailable) {
      // Sonic Double Jump
      p.vy = p.jumpForce * 0.88;
      p.doubleJumpAvailable = false;
      audio.playPowerup();
      inputManager.vibrateGamepad(45, 0.4);
      spawnParticles(p.x + p.width / 2, p.y + p.height, '#a855f7', 10, 2.4);
      spawnFloatingText(p.x + p.width / 2, p.y - 12, 'DOUBLE JUMP!', '#c084fc');
    }
  }, []);

  const handleDuck = useCallback((duck: boolean) => {
    const p = playerRef.current;
    if (gameStateRef.current !== 'playing') return;
    p.isDucking = duck;
    if (duck && p.isGrounded) {
      // Slide sparks
      spawnParticles(p.x, GROUND_Y - 2, '#f59e0b', 3, 1.2);
    }
  }, []);

  const resetGame = useCallback(() => {
    updateScore(0);
    setDistance(0);
    comboRef.current = 0;
    setCombo(0);
    comboTimerRef.current = 0;
    speedMultRef.current = 1;

    playerRef.current = {
      x: 60,
      y: GROUND_Y - 36,
      width: 22,
      height: 36,
      vy: 0,
      gravity: 0.58,
      jumpForce: -10.2,
      isGrounded: true,
      isDucking: false,
      duckHeight: 20,
      normalHeight: 36,
      doubleJumpAvailable: true,
      runFrame: 0,
    };

    obstaclesRef.current = [];
    coinsRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
    spawnTimerRef.current = 0;
    coinTimerRef.current = 0;
    shakeRef.current = 0;
    hitStopRef.current = 0;

    initSkyline();
    draw();
  }, [initSkyline, updateScore]);

  const startGame = useCallback(() => {
    resetGame();
    startWithCountdown(() => {
      startLoop(gameStep);
    });
  }, [resetGame, startWithCountdown, startLoop]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        if (gameStateRef.current === 'playing') handleJump();
        else if (gameStateRef.current === 'ready' || gameStateRef.current === 'gameover') startGame();
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        handleDuck(true);
      } else if (e.key === 'Escape' && gameStateRef.current === 'playing') {
        setGameState('paused');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        handleDuck(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleDuck, handleJump, startGame]);

  const spawnObstacle = () => {
    const r = Math.random();
    let type: RunnerObstacle['type'] = 'spike';
    let width = 22;
    let height = 28;
    let y = GROUND_Y - height;

    if (r < 0.45) {
      // Flying Cyber Drone (requires ducking or jumping over)
      type = 'drone';
      width = 28;
      height = 18;
      y = GROUND_Y - 48; // Positioned right at head height when running upright!
    } else if (r < 0.7) {
      // Laser gate
      type = 'laser_gate';
      width = 16;
      height = 36;
      y = GROUND_Y - height;
    }

    obstaclesRef.current.push({
      x: CANVAS_WIDTH + 20,
      y,
      width,
      height,
      type,
      speed: 4.8 * speedMultRef.current,
      passed: false,
    });
  };

  const spawnCoins = () => {
    const count = 3 + Math.floor(Math.random() * 3);
    const startX = CANVAS_WIDTH + 20;
    const y = Math.random() > 0.5 ? GROUND_Y - 60 : GROUND_Y - 20;

    for (let i = 0; i < count; i++) {
      coinsRef.current.push({
        x: startX + i * 26,
        y,
        radius: 6,
        value: 5,
        collected: false,
      });
    }
  };

  const gameStep = useCallback((timestamp: number, dt: number) => {
    if (gameStateRef.current !== 'playing') return;

    if (hitStopRef.current > 0) {
      hitStopRef.current -= dt;
      draw();
      return;
    }

    updatePhysics(dt);
    draw();
  }, []);

  const updatePhysics = (dt: number) => {
    const p = playerRef.current;

    // Decay Combo
    if (comboTimerRef.current > 0) {
      comboTimerRef.current -= dt;
      if (comboTimerRef.current <= 0) {
        comboRef.current = 0;
        setCombo(0);
      }
    }

    // Distance progression & gradual speed increase
    setDistance(d => d + 1);
    speedMultRef.current = Math.min(1.75, 1 + score * 0.003);

    // Player Height based on ducking
    p.height = p.isDucking ? p.duckHeight : p.normalHeight;

    // Gravity & Jump Physics
    p.vy += p.gravity;
    p.y += p.vy;

    if (p.y + p.height >= GROUND_Y) {
      p.y = GROUND_Y - p.height;
      p.vy = 0;
      p.isGrounded = true;
      p.doubleJumpAvailable = true;
    } else {
      p.isGrounded = false;
    }

    p.runFrame += 0.25;

    // Move Skyline Parallax
    const bgSpeed = 0.8 * speedMultRef.current;
    buildingsRef.current.forEach(b => {
      b.x -= bgSpeed;
      if (b.x + b.width < 0) {
        b.x = CANVAS_WIDTH + Math.random() * 20;
      }
    });

    // Spawning logic
    spawnTimerRef.current += dt;
    const spawnInterval = Math.max(900, 1900 - score * 8);
    if (spawnTimerRef.current >= spawnInterval) {
      spawnObstacle();
      spawnTimerRef.current = 0;
    }

    coinTimerRef.current += dt;
    if (coinTimerRef.current >= 2400) {
      spawnCoins();
      coinTimerRef.current = 0;
    }

    // Update Obstacles
    const playerBox = {
      x: p.x + 3,
      y: p.y + 3,
      w: p.width - 6,
      h: p.height - 4,
    };

    for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
      const obs = obstaclesRef.current[i];
      obs.x -= obs.speed;

      // Clean out of bounds
      if (obs.x + obs.width < 0) {
        obstaclesRef.current.splice(i, 1);
        continue;
      }

      // Near-miss detection for drones
      if (!obs.nearMissed && obs.type === 'drone' && p.isDucking && p.isGrounded) {
        if (p.x > obs.x - 10 && p.x < obs.x + obs.width + 10) {
          obs.nearMissed = true;
          audio.playNearMiss();
          const bonus = 10;
          addScore(bonus);
          spawnFloatingText(p.x + 20, p.y - 12, 'SLIDE BONUS! +10', '#38bdf8');
          shakeRef.current = 2;
        }
      }

      // AABB Collision
      if (
        playerBox.x < obs.x + obs.width &&
        playerBox.x + playerBox.w > obs.x &&
        playerBox.y < obs.y + obs.height &&
        playerBox.y + playerBox.h > obs.y
      ) {
        handleCrash();
        return;
      }

      // Passing score reward
      if (!obs.passed && obs.x + obs.width < p.x) {
        obs.passed = true;
        const passBonus = 5;
        addScore(passBonus);
      }
    }

    // Update Coins
    for (let i = coinsRef.current.length - 1; i >= 0; i--) {
      const c = coinsRef.current[i];
      c.x -= 4.8 * speedMultRef.current;

      if (c.x < -10) {
        coinsRef.current.splice(i, 1);
        continue;
      }

      // Collect coin
      const dist = Math.hypot(c.x - (p.x + p.width / 2), c.y - (p.y + p.height / 2));
      if (dist < c.radius + p.width / 2) {
        const newCombo = Math.min(5, comboRef.current + 1);
        comboRef.current = newCombo;
        comboTimerRef.current = 3000;
        setCombo(newCombo);

        const earned = c.value * newCombo;
        addScore(earned);

        audio.playCombo(newCombo);
        inputManager.vibrateGamepad(40, 0.3);
        spawnParticles(c.x, c.y, '#f59e0b', 8, 1.6);
        spawnFloatingText(c.x, c.y - 10, `+${earned} ${newCombo > 1 ? `(${newCombo}x)` : ''}`, '#f59e0b');

        coinsRef.current.splice(i, 1);
      }
    }

    // Particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const pt = particlesRef.current[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.alpha -= pt.decay;
      if (pt.alpha <= 0) particlesRef.current.splice(i, 1);
    }

    // Floating Texts
    for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
      const ft = floatingTextsRef.current[i];
      ft.y += ft.vy;
      ft.alpha -= 0.025;
      if (ft.alpha <= 0) floatingTextsRef.current.splice(i, 1);
    }
  };

  const handleCrash = () => {
    audio.playExplosion();
    shakeRef.current = 12;
    hitStopRef.current = 70;
    inputManager.vibrateGamepad(200, 0.8);

    const p = playerRef.current;
    spawnParticles(p.x + p.width / 2, p.y + p.height / 2, '#f43f5e', 24, 3.5);

    triggerGameOver();
  };

  const draw = () => {
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

    // Night Sky
    ctx.fillStyle = '#07090e';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Parallax City Skyline
    buildingsRef.current.forEach(b => {
      ctx.fillStyle = '#0f1422';
      ctx.fillRect(b.x, GROUND_Y - b.height, b.width, b.height);

      // Building lights
      ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
          if (b.lights[(row * 3 + col) % b.lights.length]) {
            ctx.fillRect(b.x + 6 + col * 10, GROUND_Y - b.height + 12 + row * 16, 5, 8);
          }
        }
      }
    });

    // Neon Floor Grid
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y);
      ctx.lineTo(x - 30, CANVAS_HEIGHT);
      ctx.stroke();
    }

    // Neon Floor Border
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();

    // Coins
    coinsRef.current.forEach(c => {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctx.fill();

      // Coin Sparkle Ring
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Obstacles
    obstaclesRef.current.forEach(obs => {
      if (obs.type === 'spike') {
        // Red Plasma Spikes
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.moveTo(obs.x, GROUND_Y);
        ctx.lineTo(obs.x + obs.width / 2, obs.y);
        ctx.lineTo(obs.x + obs.width, GROUND_Y);
        ctx.closePath();
        ctx.fill();
      } else if (obs.type === 'drone') {
        // Flying Drone
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 4);
        ctx.fill();

        // Drone Red Scanner Eye
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(obs.x + 4, obs.y + 4, 6, 6);

        // Drone laser pointer downward
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.width / 2, obs.y + obs.height);
        ctx.lineTo(obs.x + obs.width / 2, GROUND_Y);
        ctx.stroke();
      } else {
        // Laser Gate
        ctx.fillStyle = '#e11d48';
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      }
    });

    // Player (Cyber Ninja)
    const p = playerRef.current;
    ctx.fillStyle = p.isDucking ? '#38bdf8' : '#6366f1';
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, p.height, 4);
    ctx.fill();

    // Visor
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(p.x + p.width - 7, p.y + 4, 5, 5);

    // Running dust / footstep spark
    if (p.isGrounded && !p.isDucking) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(p.x - 4, GROUND_Y - 2, 4, 2);
    }

    // Particles
    particlesRef.current.forEach(pt => {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = pt.alpha;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Floating Texts
    floatingTextsRef.current.forEach(ft => {
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = ft.alpha;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    });
    ctx.globalAlpha = 1;

    ctx.restore();
  };

  return (
    <div 
      ref={containerRef}
      className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-[#090b10]"
    >
      {/* Dynamic Runner HUD */}
      <div className="w-full max-w-[600px] flex-none flex justify-between items-center mb-2 px-3 py-1 bg-[#121622]/80 border border-white/[0.06] rounded-xl text-xs font-mono">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <Trophy size={12} className="text-amber-400" />
          <span>BEST: <strong className="text-white">{highScore}</strong></span>
        </div>

        {combo > 1 && (
          <div className="flex items-center gap-1 text-amber-400 font-bold animate-pulse">
            <Sparkles size={12} />
            <span>{combo}x COMBO</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-sky-400">
          <Zap size={12} />
          <span>SPEED: {(speedMultRef.current).toFixed(1)}x</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400">SKOR:</span>
          <span className="text-yellow-400 font-bold">{score}</span>
        </div>
      </div>

      {/* Canvas Stage */}
      <div 
        className="relative flex-1 min-h-0 w-full max-w-[600px] max-h-[320px] flex items-center justify-center bg-[#07090e] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden touch-none select-none"
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full object-contain block"
        />

        {/* Ergonomic on-canvas mobile touch buttons */}
        {gameState === 'playing' && (
          <div className="absolute inset-x-3 bottom-3 flex justify-between pointer-events-auto">
            <button
              onTouchStart={(e) => { e.preventDefault(); handleDuck(true); }}
              onTouchEnd={(e) => { e.preventDefault(); handleDuck(false); }}
              onMouseDown={() => handleDuck(true)}
              onMouseUp={() => handleDuck(false)}
              className="px-5 py-3 bg-white/10 active:bg-white/20 backdrop-blur-md border border-white/20 rounded-xl text-white font-mono text-xs font-bold shadow-lg"
            >
              TUNDUK
            </button>
            <button
              onTouchStart={(e) => { e.preventDefault(); handleJump(); }}
              onMouseDown={handleJump}
              className="px-6 py-3 bg-sky-500/20 active:bg-sky-500/30 backdrop-blur-md border border-sky-400/30 rounded-xl text-sky-300 font-mono text-xs font-bold shadow-lg"
            >
              LOMPAT
            </button>
          </div>
        )}

        <GameOverlay
          gameState={gameState}
          score={score}
          highScore={highScore}
          countdown={countdown}
          onStart={startGame}
          onRestart={startGame}
          instructions="Hindari paku plasma & drone laser! Tekan LOMPAT (SPASI/W) atau TUNDUK (S). Ketuk tombol LOMPAT dua kali untuk Double Jump!"
        />
      </div>
    </div>
  );
}
