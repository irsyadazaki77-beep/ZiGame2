import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { useGameEngine } from '../../hooks/useGameEngine';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Sparkles, Shield, Zap } from 'lucide-react';

interface BrickBreakerProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  points: number;
  hits: number;
  maxHits: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;
}

interface PowerUp {
  x: number;
  y: number;
  type: 'expand' | 'multiball' | 'slow' | 'shield';
  w: number;
  h: number;
  color: string;
  label: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
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

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

const WIDTH = 400;
const HEIGHT = 400;

export default function BrickBreakerGame({ onGameOver, onScoreUpdate, highScore }: BrickBreakerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // States
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
  } = useGameEngine({
    gameId: 'brickbreaker',
    onGameOver,
    onScoreUpdate,
  });

  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(0);
  const [activeBuffs, setActiveBuffs] = useState<string[]>([]);

  // Mutable Game Loop State
  const gameStateRef = useRef(gameState);
  const levelRef = useRef(1);
  const livesRef = useRef(3);
  const comboRef = useRef(0);
  const hitStopRef = useRef<number>(0);
  const shakeRef = useRef<number>(0);

  // Synchronize refs
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Entities
  const paddleRef = useRef({
    x: 160,
    y: 375,
    w: 80,
    h: 12,
    speed: 7.5,
    targetX: 160,
  });

  const ballsRef = useRef<Ball[]>([
    { x: 200, y: 300, vx: 3, vy: -3.5, radius: 6, active: true },
  ]);

  const bricksRef = useRef<Brick[]>([]);
  const powerupsRef = useRef<PowerUp[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const trailsRef = useRef<{ x: number; y: number; color: string }[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const shieldActiveRef = useRef(false);
  const shieldTimerRef = useRef(0);
  const expandTimerRef = useRef(0);
  const activeKeysRef = useRef<{ [key: string]: boolean }>({});

  const buildLevel = useCallback((lvl: number) => {
    const columns = 8;
    const rows = lvl === 1 ? 4 : lvl === 2 ? 5 : 6;
    const brickWidth = 44;
    const brickHeight = 15;
    const padding = 5;
    const offsetTop = 45;
    const offsetLeft = 7;

    const colors = ['#f43f5e', '#ec4899', '#a855f7', '#6366f1', '#3b82f6', '#06b6d4'];
    const tempBricks: Brick[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const x = c * (brickWidth + padding) + offsetLeft;
        const y = r * (brickHeight + padding) + offsetTop;
        const colorIdx = (r + lvl) % colors.length;
        const maxHits = lvl > 1 && r === 0 ? 2 : 1;

        tempBricks.push({
          x,
          y,
          w: brickWidth,
          h: brickHeight,
          color: colors[colorIdx],
          points: maxHits * 10,
          hits: 0,
          maxHits,
        });
      }
    }
    bricksRef.current = tempBricks;
  }, []);

  const spawnParticles = (x: number, y: number, color: string, count = 12) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
      const speed = 1.5 + Math.random() * 3;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 2,
        color,
        alpha: 1,
        decay: 0.03 + Math.random() * 0.02,
      });
    }
  };

  const spawnFloatingText = (x: number, y: number, text: string, color = '#fbbf24') => {
    floatingTextsRef.current.push({
      x,
      y,
      text,
      color,
      alpha: 1,
      vy: -1.2,
    });
  };

  const spawnShockwave = (x: number, y: number, color: string) => {
    shockwavesRef.current.push({
      x,
      y,
      radius: 5,
      maxRadius: 35,
      color,
      alpha: 0.7,
    });
  };

  const resetBallAndPaddle = () => {
    paddleRef.current.x = 160;
    paddleRef.current.targetX = 160;
    paddleRef.current.w = 80;
    ballsRef.current = [
      { x: 200, y: 320, vx: (Math.random() > 0.5 ? 3 : -3), vy: -3.8, radius: 6, active: true },
    ];
    comboRef.current = 0;
    setCombo(0);
  };

  const resetGame = useCallback(() => {
    levelRef.current = 1;
    setLevel(1);
    livesRef.current = 3;
    setLives(3);
    updateScore(0);
    comboRef.current = 0;
    setCombo(0);
    shieldActiveRef.current = false;
    shieldTimerRef.current = 0;
    expandTimerRef.current = 0;
    setActiveBuffs([]);
    particlesRef.current = [];
    powerupsRef.current = [];
    floatingTextsRef.current = [];
    shockwavesRef.current = [];
    trailsRef.current = [];

    buildLevel(1);
    resetBallAndPaddle();
    draw();
  }, [buildLevel, updateScore]);

  const startGame = useCallback(() => {
    resetGame();
    startWithCountdown(() => {
      startLoop(gameStep);
    });
  }, [resetGame, startWithCountdown, startLoop]);

  // Tab auto-pause
  useEffect(() => {
    const handleVis = () => {
      if (document.hidden && gameStateRef.current === 'playing') {
        setGameState('paused');
      }
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => document.removeEventListener('visibilitychange', handleVis);
  }, []);

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        activeKeysRef.current[e.code] = true;
      }
      if (e.key === 'Escape' && gameStateRef.current === 'playing') {
        setGameState('paused');
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        activeKeysRef.current[e.code] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setGameState]);

  // Update Game Loop
  const gameStep = useCallback((timestamp: number, dt: number) => {
    if (gameStateRef.current !== 'playing') return;

    // Hit stop micro freeze
    if (hitStopRef.current > 0) {
      hitStopRef.current -= dt;
      draw();
      return;
    }

    updatePhysics(dt);
    draw();
  }, []);

  const updatePhysics = (dt: number) => {
    const paddle = paddleRef.current;

    // Paddle Keyboard controls
    if (activeKeysRef.current['ArrowLeft'] || activeKeysRef.current['KeyA']) {
      paddle.x -= paddle.speed;
    }
    if (activeKeysRef.current['ArrowRight'] || activeKeysRef.current['KeyD']) {
      paddle.x += paddle.speed;
    }

    // Clamp paddle within bounds
    paddle.x = Math.max(0, Math.min(WIDTH - paddle.w, paddle.x));

    // Shield Timer
    if (shieldActiveRef.current) {
      shieldTimerRef.current -= dt;
      if (shieldTimerRef.current <= 0) {
        shieldActiveRef.current = false;
        setActiveBuffs(prev => prev.filter(b => b !== 'SHIELD'));
      }
    }

    // Expand Timer
    if (expandTimerRef.current > 0) {
      expandTimerRef.current -= dt;
      if (expandTimerRef.current <= 0) {
        paddle.w = 80;
        setActiveBuffs(prev => prev.filter(b => b !== 'EXPAND'));
      }
    }

    // Update Balls
    const activeBalls = ballsRef.current.filter(b => b.active);
    if (activeBalls.length === 0) {
      handleLifeLoss();
      return;
    }

    activeBalls.forEach(ball => {
      ball.x += ball.vx;
      ball.y += ball.vy;

      // Ball Trails
      if (Math.random() < 0.4) {
        trailsRef.current.push({ x: ball.x, y: ball.y, color: '#38bdf8' });
      }

      // Wall Bounce (Left & Right)
      if (ball.x - ball.radius <= 0) {
        ball.x = ball.radius;
        ball.vx = Math.abs(ball.vx);
        audio.playReflect();
        spawnParticles(ball.x, ball.y, '#38bdf8', 4);
      } else if (ball.x + ball.radius >= WIDTH) {
        ball.x = WIDTH - ball.radius;
        ball.vx = -Math.abs(ball.vx);
        audio.playReflect();
        spawnParticles(ball.x, ball.y, '#38bdf8', 4);
      }

      // Ceiling Bounce
      if (ball.y - ball.radius <= 0) {
        ball.y = ball.radius;
        ball.vy = Math.abs(ball.vy);
        audio.playReflect();
        spawnParticles(ball.x, ball.y, '#38bdf8', 4);
      }

      // Paddle Collision
      if (
        ball.y + ball.radius >= paddle.y &&
        ball.y - ball.radius <= paddle.y + paddle.h &&
        ball.x + ball.radius >= paddle.x &&
        ball.x - ball.radius <= paddle.x + paddle.w &&
        ball.vy > 0
      ) {
        // Dynamic Reflection Angle based on hit location
        const hitOffset = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
        const speed = Math.hypot(ball.vx, ball.vy);
        ball.vx = hitOffset * 5.2;
        ball.vy = -Math.sqrt(Math.max(4, speed * speed - ball.vx * ball.vx));
        ball.y = paddle.y - ball.radius;

        audio.playReflect();
        inputManager.vibrateGamepad(50, 0.3);
        spawnParticles(ball.x, paddle.y, '#10b981', 8);

        // Reset rally combo when ball touches paddle
        comboRef.current = 0;
        setCombo(0);
      }

      // Shield Bounce
      if (shieldActiveRef.current && ball.y + ball.radius >= HEIGHT - 8) {
        ball.vy = -Math.abs(ball.vy);
        ball.y = HEIGHT - 8 - ball.radius;
        audio.playShield();
        spawnShockwave(ball.x, HEIGHT - 8, '#06b6d4');
        shakeRef.current = 4;
      } else if (ball.y - ball.radius > HEIGHT) {
        ball.active = false;
      }

      // Brick Collisions
      checkBrickCollisions(ball);
    });

    // Update Powerups
    updatePowerups();

    // Update visual effects
    updateEffects();

    // Check Level Complete
    if (bricksRef.current.length === 0) {
      handleLevelComplete();
    }
  };

  const checkBrickCollisions = (ball: Ball) => {
    const bricks = bricksRef.current;

    for (let i = bricks.length - 1; i >= 0; i--) {
      const b = bricks[i];

      // Axis-aligned bounding box collision
      if (
        ball.x + ball.radius >= b.x &&
        ball.x - ball.radius <= b.x + b.w &&
        ball.y + ball.radius >= b.y &&
        ball.y - ball.radius <= b.y + b.h
      ) {
        // Determine collision side
        const prevX = ball.x - ball.vx;
        const prevY = ball.y - ball.vy;

        if (prevX + ball.radius <= b.x || prevX - ball.radius >= b.x + b.w) {
          ball.vx = -ball.vx;
        } else {
          ball.vy = -ball.vy;
        }

        b.hits++;

        // Increase Combo
        const newCombo = comboRef.current + 1;
        comboRef.current = newCombo;
        setCombo(newCombo);

        if (b.hits >= b.maxHits) {
          // Brick Shattered
          bricks.splice(i, 1);
          const pointsEarned = b.points * (newCombo > 1 ? newCombo : 1);
          addScore(pointsEarned);

          audio.playCombo(newCombo);
          inputManager.vibrateGamepad(80, 0.45);
          spawnParticles(b.x + b.w / 2, b.y + b.h / 2, b.color, 14);
          spawnShockwave(b.x + b.w / 2, b.y + b.h / 2, b.color);
          spawnFloatingText(b.x + b.w / 2, b.y, `+${pointsEarned} ${newCombo > 1 ? `(${newCombo}x)` : ''}`, b.color);

          shakeRef.current = 3;
          hitStopRef.current = 40; // Satisfying micro hit-stop!

          // Powerup drop chance (15%)
          if (Math.random() < 0.16) {
            spawnPowerup(b.x + b.w / 2, b.y + b.h / 2);
          }
        } else {
          // Brick Damaged
          audio.playHit();
          spawnParticles(ball.x, ball.y, b.color, 6);
          b.color = '#ffffff'; // Flash white
        }

        break; // Process one brick per frame
      }
    }
  };

  const spawnPowerup = (x: number, y: number) => {
    const types: PowerUp['type'][] = ['expand', 'multiball', 'slow', 'shield'];
    const type = types[Math.floor(Math.random() * types.length)];
    const colorMap: Record<PowerUp['type'], { color: string; label: string }> = {
      expand: { color: '#10b981', label: 'LEBAR' },
      multiball: { color: '#f59e0b', label: 'MULTI' },
      slow: { color: '#8b5cf6', label: 'SLOW' },
      shield: { color: '#06b6d4', label: 'SHIELD' },
    };

    powerupsRef.current.push({
      x: x - 12,
      y,
      type,
      w: 24,
      h: 12,
      color: colorMap[type].color,
      label: colorMap[type].label,
    });
  };

  const updatePowerups = () => {
    const paddle = paddleRef.current;
    const powerups = powerupsRef.current;

    for (let i = powerups.length - 1; i >= 0; i--) {
      const pu = powerups[i];
      pu.y += 2.2;

      // Paddle Catch
      if (
        pu.y + pu.h >= paddle.y &&
        pu.y <= paddle.y + paddle.h &&
        pu.x + pu.w >= paddle.x &&
        pu.x <= paddle.x + paddle.w
      ) {
        audio.playPowerup();
        applyPowerup(pu.type);
        spawnParticles(pu.x, pu.y, pu.color, 12);
        spawnFloatingText(paddle.x + paddle.w / 2, paddle.y - 10, `${pu.label}!`, pu.color);
        powerups.splice(i, 1);
        continue;
      }

      if (pu.y > HEIGHT) {
        powerups.splice(i, 1);
      }
    }
  };

  const applyPowerup = (type: PowerUp['type']) => {
    const paddle = paddleRef.current;

    if (type === 'expand') {
      paddle.w = 120;
      expandTimerRef.current = 10000;
      setActiveBuffs(prev => Array.from(new Set([...prev, 'EXPAND'])));
    } else if (type === 'multiball') {
      const active = ballsRef.current.filter(b => b.active)[0] || { x: 200, y: 300, vx: 3, vy: -3.5, radius: 6, active: true };
      ballsRef.current.push(
        { x: active.x, y: active.y, vx: active.vx + 1.2, vy: -Math.abs(active.vy), radius: 6, active: true },
        { x: active.x, y: active.y, vx: active.vx - 1.2, vy: -Math.abs(active.vy), radius: 6, active: true }
      );
    } else if (type === 'slow') {
      ballsRef.current.forEach(b => {
        b.vx *= 0.7;
        b.vy *= 0.7;
      });
      setTimeout(() => {
        ballsRef.current.forEach(b => {
          b.vx /= 0.7;
          b.vy /= 0.7;
        });
      }, 7000);
      setActiveBuffs(prev => Array.from(new Set([...prev, 'SLOW'])));
    } else if (type === 'shield') {
      shieldActiveRef.current = true;
      shieldTimerRef.current = 12000;
      setActiveBuffs(prev => Array.from(new Set([...prev, 'SHIELD'])));
    }
  };

  const updateEffects = () => {
    // Particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) particlesRef.current.splice(i, 1);
    }

    // Floating Texts
    for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
      const t = floatingTextsRef.current[i];
      t.y += t.vy;
      t.alpha -= 0.025;
      if (t.alpha <= 0) floatingTextsRef.current.splice(i, 1);
    }

    // Shockwaves
    for (let i = shockwavesRef.current.length - 1; i >= 0; i--) {
      const s = shockwavesRef.current[i];
      s.radius += 1.8;
      s.alpha -= 0.035;
      if (s.alpha <= 0 || s.radius >= s.maxRadius) shockwavesRef.current.splice(i, 1);
    }

    // Trails decay
    if (trailsRef.current.length > 20) {
      trailsRef.current.shift();
    }
  };

  const handleLifeLoss = () => {
    audio.playHit();
    shakeRef.current = 8;
    hitStopRef.current = 60;
    inputManager.vibrateGamepad(180, 0.6);

    const nextLives = livesRef.current - 1;
    livesRef.current = nextLives;
    setLives(nextLives);

    if (nextLives <= 0) {
      audio.playExplosion();
      triggerGameOver();
    } else {
      resetBallAndPaddle();
    }
  };

  const handleLevelComplete = () => {
    audio.playLevelUp();
    shakeRef.current = 6;
    if (levelRef.current < 3) {
      const nextLevel = levelRef.current + 1;
      levelRef.current = nextLevel;
      setLevel(nextLevel);
      buildLevel(nextLevel);
      resetBallAndPaddle();
      spawnFloatingText(WIDTH / 2, HEIGHT / 2, `LEVEL ${nextLevel}!`, '#10b981');
    } else {
      // Completed all levels!
      addScore(200);
      triggerGameOver();
    }
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

    // Dark Arcade Arena Background
    ctx.fillStyle = '#080a0f';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Arena border
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, WIDTH - 2, HEIGHT - 2);

    // Ball Trails
    trailsRef.current.forEach((t, i) => {
      ctx.fillStyle = t.color;
      ctx.globalAlpha = (i / trailsRef.current.length) * 0.3;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Bricks
    bricksRef.current.forEach(b => {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 3);
      ctx.fill();

      // Top Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(b.x, b.y, b.w, 3);

      // Cracked indicator for multi-hit bricks
      if (b.maxHits > 1 && b.hits > 0) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.x + 6, b.y + 2);
        ctx.lineTo(b.x + b.w - 6, b.y + b.h - 2);
        ctx.stroke();
      }
    });

    // Paddle
    const paddle = paddleRef.current;
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 6);
    ctx.fill();

    // Paddle center jewel indicator
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(paddle.x + paddle.w / 2, paddle.y + paddle.h / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Shield Laser Barrier at bottom
    if (shieldActiveRef.current) {
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, HEIGHT - 4);
      ctx.lineTo(WIDTH, HEIGHT - 4);
      ctx.stroke();
    }

    // Powerups
    powerupsRef.current.forEach(pu => {
      ctx.fillStyle = pu.color;
      ctx.beginPath();
      ctx.roundRect(pu.x, pu.y, pu.w, pu.h, 3);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(pu.label[0], pu.x + pu.w / 2, pu.y + 9);
    });

    // Balls
    ballsRef.current.forEach(ball => {
      if (!ball.active) return;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // Soft glow
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Particles
    particlesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Shockwaves
    shockwavesRef.current.forEach(s => {
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = s.alpha;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
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

  // Direct Pointer / Touch Paddle Navigation
  const handlePointerMove = (e: React.PointerEvent) => {
    if (gameStateRef.current !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const scaleX = WIDTH / rect.width;
    const targetX = clientX * scaleX - paddleRef.current.w / 2;

    paddleRef.current.x = Math.max(0, Math.min(WIDTH - paddleRef.current.w, targetX));
  };

  useEffect(() => {
    buildLevel(1);
    draw();
  }, [buildLevel]);

  return (
    <div 
      ref={containerRef}
      className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-[#090b10]"
    >
      {/* Clean In-Game HUD */}
      <div className="w-full max-w-[400px] flex-none flex justify-between items-center mb-2 px-3 py-1 bg-[#121622]/80 border border-white/[0.06] rounded-xl text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400">LVL:</span>
          <span className="text-indigo-400 font-bold">{level}</span>
        </div>

        <div className="flex items-center gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i} className={`text-xs ${i < lives ? 'text-rose-500' : 'text-zinc-700'}`}>
              ❤️
            </span>
          ))}
        </div>

        {combo > 1 && (
          <div className="flex items-center gap-1 text-amber-400 font-bold animate-pulse">
            <Sparkles size={12} />
            <span>{combo}x</span>
          </div>
        )}

        {activeBuffs.map(buff => (
          <span key={buff} className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] rounded font-bold">
            {buff}
          </span>
        ))}

        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400">SKOR:</span>
          <span className="text-white font-bold">{score}</span>
        </div>
      </div>

      {/* Canvas Wrapper */}
      <div 
        className="relative flex-1 min-h-0 w-full max-w-[400px] max-h-[400px] flex items-center justify-center bg-[#090b10] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden touch-none"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerMove}
      >
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="w-full h-full object-contain block cursor-ew-resize select-none"
        />

        <GameOverlay
          gameState={gameState}
          countdown={countdown}
          score={score}
          highScore={highScore}
          onStart={startGame}
          onRestart={startGame}
          instructions="Geser pointer atau gunakan tombol panah untuk memantulkan bola dan hancurkan balok neon!"
        />
      </div>
    </div>
  );
}
