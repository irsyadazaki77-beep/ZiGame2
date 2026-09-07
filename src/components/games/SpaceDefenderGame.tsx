import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Shield, Zap, Sparkles } from 'lucide-react';

interface SpaceDefenderProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
  brightness: number;
}

interface Enemy {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  color: string;
  points: number;
  type: 'scout' | 'interceptor' | 'tank' | 'commander';
  health: number;
  maxHealth: number;
  shootCooldown: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  isEnemy: boolean;
}

interface PowerUp {
  x: number;
  y: number;
  type: 'spread' | 'shield' | 'bomb' | 'rapid';
  label: string;
  color: string;
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

const WIDTH = 450;
const HEIGHT = 400;

export default function SpaceDefenderGame({ onGameOver, onScoreUpdate, highScore }: SpaceDefenderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // States
  const [gameState, setGameState] = useState<'ready' | 'countdown' | 'playing' | 'paused' | 'gameover'>('ready');
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(0);
  const [weaponType, setWeaponType] = useState<'single' | 'dual' | 'spread'>('single');
  const [hasShield, setHasShield] = useState(false);

  // Loop & Sync Refs
  const gameStateRef = useRef(gameState);
  const scoreRef = useRef(0);
  const waveRef = useRef(1);
  const livesRef = useRef(3);
  const comboRef = useRef(0);
  const comboTimerRef = useRef(0);
  const hitStopRef = useRef(0);
  const shakeRef = useRef(0);
  const warpSpeedRef = useRef(1);
  const gameLoopRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Player State
  const playerRef = useRef({
    x: 40,
    y: 180,
    w: 26,
    h: 22,
    speed: 5.5,
    lastShot: 0,
    weapon: 'single' as 'single' | 'dual' | 'spread',
    weaponTimer: 0,
    shield: false,
    invincibleTimer: 0,
  });

  const starsRef = useRef<Star[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const powerupsRef = useRef<PowerUp[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const activeKeysRef = useRef<{ [key: string]: boolean }>({});
  const spawnTimerRef = useRef<number>(0);

  // Starfield initialization
  const generateStars = useCallback(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 45; i++) {
      stars.push({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        speed: Math.random() * 2 + 0.5,
        size: Math.random() * 1.8 + 0.6,
        brightness: Math.random() * 0.7 + 0.3,
      });
    }
    starsRef.current = stars;
  }, []);

  useEffect(() => {
    generateStars();
    drawStatic();
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [generateStars]);

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

  // Keyboard input listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space'].includes(e.code)) {
        e.preventDefault();
        activeKeysRef.current[e.code] = true;
      }
      if (e.key === 'Escape' && gameStateRef.current === 'playing') {
        setGameState('paused');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space'].includes(e.code)) {
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
  }, []);

  const spawnParticles = (x: number, y: number, color: string, count = 10, speed = 2.5) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
      const spd = (Math.random() * 0.8 + 0.4) * speed;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: Math.random() * 2.5 + 1.5,
        color,
        alpha: 1.0,
        decay: 0.035 + Math.random() * 0.02,
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
    scoreRef.current = 0;
    setScore(0);
    onScoreUpdate(0);
    waveRef.current = 1;
    setWave(1);
    livesRef.current = 3;
    setLives(3);
    comboRef.current = 0;
    setCombo(0);
    comboTimerRef.current = 0;

    playerRef.current = {
      x: 40,
      y: HEIGHT / 2 - 11,
      w: 26,
      h: 22,
      speed: 5.5,
      lastShot: 0,
      weapon: 'single',
      weaponTimer: 0,
      shield: false,
      invincibleTimer: 0,
    };
    setWeaponType('single');
    setHasShield(false);

    enemiesRef.current = [];
    bulletsRef.current = [];
    powerupsRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
    spawnTimerRef.current = 0;
    warpSpeedRef.current = 1;

    generateStars();
    drawStatic();
  }, [generateStars, onScoreUpdate]);

  const startGame = useCallback(() => {
    resetGame();
    setGameState('countdown');
    setCountdown(3);
    audio.playCountdownTick();

    let count = 3;
    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
        audio.playCountdownTick();
      } else {
        clearInterval(timer);
        audio.playCountdownGo();
        setGameState('playing');
        lastTimeRef.current = performance.now();
        if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = requestAnimationFrame(gameLoop);
      }
    }, 800);
  }, [resetGame]);

  const triggerLaser = (now: number) => {
    const player = playerRef.current;
    const cooldown = player.weapon === 'rapid' ? 120 : 180;
    if (now - player.lastShot < cooldown) return;

    player.lastShot = now;
    audio.playLaser();
    shakeRef.current = 1.5;

    const px = player.x + player.w;
    const py = player.y + player.h / 2;

    if (player.weapon === 'spread') {
      // 3-way Spread Laser
      bulletsRef.current.push(
        { x: px, y: py, vx: 10, vy: 0, radius: 3.5, color: '#a855f7', isEnemy: false },
        { x: px, y: py - 4, vx: 9.5, vy: -2, radius: 3.5, color: '#a855f7', isEnemy: false },
        { x: px, y: py + 4, vx: 9.5, vy: 2, radius: 3.5, color: '#a855f7', isEnemy: false }
      );
    } else if (player.weapon === 'dual') {
      // Twin Lasers
      bulletsRef.current.push(
        { x: px, y: py - 6, vx: 10, vy: 0, radius: 3.5, color: '#38bdf8', isEnemy: false },
        { x: px, y: py + 6, vx: 10, vy: 0, radius: 3.5, color: '#38bdf8', isEnemy: false }
      );
    } else {
      // Standard Plasma Beam
      bulletsRef.current.push({
        x: px,
        y: py,
        vx: 10,
        vy: 0,
        radius: 3.5,
        color: '#6366f1',
        isEnemy: false,
      });
    }

    // Engine exhaust spark
    spawnParticles(player.x - 2, py, '#f97316', 3, 1.2);
  };

  const spawnEnemy = () => {
    const r = Math.random();
    const currentWave = waveRef.current;

    let type: Enemy['type'] = 'scout';
    let color = '#38bdf8';
    let speed = Math.random() * 1.2 + 1.6 + currentWave * 0.2;
    let hp = 1;
    let points = 10;
    let w = 22, h = 20;
    let shootCd = 0;

    if (r < 0.22) {
      type = 'interceptor';
      color = '#f43f5e';
      speed = Math.random() * 1.5 + 3.0 + currentWave * 0.25;
      points = 20;
      w = 24; h = 18;
    } else if (r < 0.4) {
      type = 'tank';
      color = '#a855f7';
      speed = Math.random() * 0.6 + 1.0 + currentWave * 0.1;
      hp = 3;
      points = 35;
      w = 28; h = 28;
    } else if (r < 0.5 && currentWave >= 2) {
      type = 'commander';
      color = '#fbbf24';
      speed = 0.9;
      hp = 5;
      points = 60;
      w = 32; h = 32;
      shootCd = 60;
    }

    enemiesRef.current.push({
      x: WIDTH + 20,
      y: Math.max(30, Math.random() * (HEIGHT - 50)),
      w,
      h,
      speed,
      color,
      points,
      type,
      health: hp,
      maxHealth: hp,
      shootCooldown: shootCd,
    });
  };

  const gameLoop = (timestamp: number) => {
    if (gameStateRef.current !== 'playing') return;

    const dt = Math.min(timestamp - lastTimeRef.current, 100);
    lastTimeRef.current = timestamp;

    if (hitStopRef.current > 0) {
      hitStopRef.current -= dt;
      draw();
      gameLoopRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    updatePhysics(dt, timestamp);
    draw();

    if (gameStateRef.current === 'playing') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
  };

  const updatePhysics = (dt: number, now: number) => {
    const player = playerRef.current;

    // Decay Combo
    if (comboTimerRef.current > 0) {
      comboTimerRef.current -= dt;
      if (comboTimerRef.current <= 0) {
        comboRef.current = 0;
        setCombo(0);
      }
    }

    // Decay Weapon Timer
    if (player.weaponTimer > 0) {
      player.weaponTimer -= dt;
      if (player.weaponTimer <= 0) {
        player.weapon = 'single';
        setWeaponType('single');
      }
    }

    // Decay Invincible Timer
    if (player.invincibleTimer > 0) {
      player.invincibleTimer -= dt;
    }

    // Decay Warp speed
    if (warpSpeedRef.current > 1) {
      warpSpeedRef.current = Math.max(1, warpSpeedRef.current - 0.05);
    }

    // Player Movement via Keys
    const keys = activeKeysRef.current;
    if (keys['ArrowUp'] || keys['KeyW']) player.y = Math.max(15, player.y - player.speed);
    if (keys['ArrowDown'] || keys['KeyS']) player.y = Math.min(HEIGHT - player.h - 15, player.y + player.speed);
    if (keys['ArrowLeft'] || keys['KeyA']) player.x = Math.max(15, player.x - player.speed);
    if (keys['ArrowRight'] || keys['KeyD']) player.x = Math.min(WIDTH / 2, player.x + player.speed);

    // Auto-fire or hold Space
    if (keys['Space']) {
      triggerLaser(now);
    }

    // Update Starfield
    starsRef.current.forEach(star => {
      star.x -= star.speed * warpSpeedRef.current;
      if (star.x < 0) {
        star.x = WIDTH;
        star.y = Math.random() * HEIGHT;
      }
    });

    // Update Bullets
    for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
      const b = bulletsRef.current[i];
      b.x += b.vx;
      b.y += b.vy;

      // Clean out of bounds
      if (b.x < 0 || b.x > WIDTH || b.y < 0 || b.y > HEIGHT) {
        bulletsRef.current.splice(i, 1);
        continue;
      }

      // Enemy Bullet hitting player
      if (b.isEnemy) {
        if (
          player.invincibleTimer <= 0 &&
          b.x >= player.x &&
          b.x <= player.x + player.w &&
          b.y >= player.y &&
          b.y <= player.y + player.h
        ) {
          bulletsRef.current.splice(i, 1);
          handlePlayerDamage();
          continue;
        }
      }
    }

    // Spawn Enemies
    spawnTimerRef.current += dt;
    const spawnInterval = Math.max(500, 1500 - waveRef.current * 180);
    if (spawnTimerRef.current >= spawnInterval) {
      spawnEnemy();
      spawnTimerRef.current = 0;
    }

    // Update Enemies
    for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
      const enemy = enemiesRef.current[i];
      enemy.x -= enemy.speed;

      // Commander shoots return lasers
      if (enemy.type === 'commander') {
        enemy.shootCooldown--;
        if (enemy.shootCooldown <= 0) {
          bulletsRef.current.push({
            x: enemy.x,
            y: enemy.y + enemy.h / 2,
            vx: -5,
            vy: 0,
            radius: 3,
            color: '#ef4444',
            isEnemy: true,
          });
          enemy.shootCooldown = 90;
        }
      }

      // Out of bounds
      if (enemy.x + enemy.w < 0) {
        enemiesRef.current.splice(i, 1);
        continue;
      }

      // Ship-Enemy Collision
      if (
        player.invincibleTimer <= 0 &&
        player.x + player.w >= enemy.x &&
        player.x <= enemy.x + enemy.w &&
        player.y + player.h >= enemy.y &&
        player.y <= enemy.y + enemy.h
      ) {
        spawnParticles(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.color, 16);
        enemiesRef.current.splice(i, 1);
        handlePlayerDamage();
        continue;
      }

      // Bullet-Enemy Collisions
      for (let j = bulletsRef.current.length - 1; j >= 0; j--) {
        const b = bulletsRef.current[j];
        if (b.isEnemy) continue;

        if (
          b.x + b.radius >= enemy.x &&
          b.x - b.radius <= enemy.x + enemy.w &&
          b.y + b.radius >= enemy.y &&
          b.y - b.radius <= enemy.y + enemy.h
        ) {
          bulletsRef.current.splice(j, 1);
          enemy.health--;

          if (enemy.health <= 0) {
            // Enemy Destroyed!
            const newCombo = Math.min(5, comboRef.current + 1);
            comboRef.current = newCombo;
            comboTimerRef.current = 2800;
            setCombo(newCombo);

            const pointsEarned = enemy.points * newCombo;
            const nextScore = scoreRef.current + pointsEarned;
            scoreRef.current = nextScore;
            setScore(nextScore);
            onScoreUpdate(nextScore);

            audio.playCombo(newCombo);
            inputManager.vibrateGamepad(100, 0.4);
            shakeRef.current = enemy.type === 'tank' || enemy.type === 'commander' ? 8 : 4;
            hitStopRef.current = enemy.type === 'commander' ? 60 : 35; // Crisp hit-stop

            spawnParticles(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.color, 18);
            spawnFloatingText(enemy.x + enemy.w / 2, enemy.y, `+${pointsEarned} ${newCombo > 1 ? `(${newCombo}x)` : ''}`, enemy.color);

            // Power-up drops
            if (Math.random() < 0.18) {
              spawnPowerup(enemy.x, enemy.y);
            }

            enemiesRef.current.splice(i, 1);

            // Check Wave Transition
            checkWaveProgress();
            break;
          } else {
            // Damage spark
            audio.playHit();
            spawnParticles(b.x, b.y, enemy.color, 4);
          }
        }
      }
    }

    // Update Powerups
    for (let i = powerupsRef.current.length - 1; i >= 0; i--) {
      const pu = powerupsRef.current[i];
      pu.x -= 1.8;

      // Catch
      if (
        player.x + player.w >= pu.x &&
        player.x <= pu.x + 20 &&
        player.y + player.h >= pu.y &&
        player.y <= pu.y + 20
      ) {
        applyPowerup(pu.type);
        powerupsRef.current.splice(i, 1);
        continue;
      }

      if (pu.x < -20) {
        powerupsRef.current.splice(i, 1);
      }
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

  const spawnPowerup = (x: number, y: number) => {
    const types: PowerUp['type'][] = ['spread', 'dual', 'shield', 'bomb'] as any;
    const type = types[Math.floor(Math.random() * types.length)];
    const meta: Record<string, { label: string; color: string }> = {
      spread: { label: 'SPREAD', color: '#a855f7' },
      dual: { label: 'DUAL', color: '#38bdf8' },
      shield: { label: 'SHIELD', color: '#06b6d4' },
      bomb: { label: 'BOMB', color: '#ef4444' },
    };

    powerupsRef.current.push({
      x,
      y,
      type,
      label: meta[type].label,
      color: meta[type].color,
    });
  };

  const applyPowerup = (type: PowerUp['type']) => {
    const player = playerRef.current;
    audio.playPowerup();
    shakeRef.current = 3;

    if (type === 'spread') {
      player.weapon = 'spread';
      player.weaponTimer = 10000;
      setWeaponType('spread');
      spawnFloatingText(player.x, player.y - 12, 'SPREAD CANNON!', '#a855f7');
    } else if (type === 'shield') {
      player.shield = true;
      setHasShield(true);
      audio.playShield();
      spawnFloatingText(player.x, player.y - 12, 'SHIELD AKTIF!', '#06b6d4');
    } else if (type === 'bomb') {
      // Clear all enemies on screen
      audio.playExplosion();
      shakeRef.current = 14;
      hitStopRef.current = 70;
      enemiesRef.current.forEach(e => {
        spawnParticles(e.x + e.w / 2, e.y + e.h / 2, e.color, 12);
        scoreRef.current += e.points;
      });
      enemiesRef.current = [];
      setScore(scoreRef.current);
      onScoreUpdate(scoreRef.current);
      spawnFloatingText(WIDTH / 2, HEIGHT / 2, 'EMP BOMB DETONATED!', '#ef4444');
    } else {
      player.weapon = 'dual';
      player.weaponTimer = 10000;
      setWeaponType('dual');
      spawnFloatingText(player.x, player.y - 12, 'DUAL LASERS!', '#38bdf8');
    }
  };

  const handlePlayerDamage = () => {
    const player = playerRef.current;

    if (player.shield) {
      player.shield = false;
      setHasShield(false);
      player.invincibleTimer = 1200;
      audio.playShield();
      shakeRef.current = 6;
      spawnFloatingText(player.x, player.y - 10, 'SHIELD ABSORBED!', '#06b6d4');
      return;
    }

    audio.playHit();
    shakeRef.current = 12;
    hitStopRef.current = 60;
    inputManager.vibrateGamepad(180, 0.7);

    const nextLives = livesRef.current - 1;
    livesRef.current = nextLives;
    setLives(nextLives);
    player.invincibleTimer = 1800; // 1.8s invincibility flash

    if (nextLives <= 0) {
      setGameState('gameover');
      audio.playExplosion();
      onGameOver(scoreRef.current);
    }
  };

  const checkWaveProgress = () => {
    const nextWaveThreshold = waveRef.current * 180;
    if (scoreRef.current >= nextWaveThreshold && waveRef.current < 8) {
      const nextWave = waveRef.current + 1;
      waveRef.current = nextWave;
      setWave(nextWave);
      warpSpeedRef.current = 4.5; // Warp speed hyperdrive effect!
      audio.playLevelUp();
      shakeRef.current = 8;
      spawnFloatingText(WIDTH / 2, HEIGHT / 2, `GELOMBANG ${nextWave}!`, '#a855f7');
    }
  };

  const drawStatic = () => {
    draw();
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

    // Deep Space Background
    ctx.fillStyle = '#06080d';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Starfield
    starsRef.current.forEach(s => {
      ctx.fillStyle = `rgba(255, 255, 255, ${s.brightness})`;
      if (warpSpeedRef.current > 1.2) {
        // Warp streak line
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = s.size;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.speed * warpSpeedRef.current * 3, s.y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Bullets
    bulletsRef.current.forEach(b => {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Laser tail
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.radius * 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - (b.isEnemy ? -8 : 10), b.y);
      ctx.stroke();
    });

    // Enemies
    enemiesRef.current.forEach(e => {
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y + e.h / 2);
      ctx.lineTo(e.x + e.w, e.y);
      ctx.lineTo(e.x + e.w * 0.7, e.y + e.h / 2);
      ctx.lineTo(e.x + e.w, e.y + e.h);
      ctx.closePath();
      ctx.fill();

      // Cockpit glow
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(e.x + 4, e.y + e.h / 2 - 2, 4, 4);

      // HP Bar for tank/commander
      if (e.maxHealth > 1) {
        const hpPct = e.health / e.maxHealth;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(e.x, e.y - 6, e.w, 3);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(e.x, e.y - 6, e.w * hpPct, 3);
      }
    });

    // Powerups
    powerupsRef.current.forEach(pu => {
      ctx.fillStyle = pu.color;
      ctx.beginPath();
      ctx.roundRect(pu.x, pu.y, 20, 16, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(pu.label[0], pu.x + 10, pu.y + 11);
    });

    // Player Ship (with Invincibility flashing)
    const player = playerRef.current;
    const isFlashing = player.invincibleTimer > 0 && Math.floor(player.invincibleTimer / 100) % 2 === 0;

    if (!isFlashing) {
      // Ship Hull
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.moveTo(player.x + player.w, player.y + player.h / 2);
      ctx.lineTo(player.x, player.y);
      ctx.lineTo(player.x + 5, player.y + player.h / 2);
      ctx.lineTo(player.x, player.y + player.h);
      ctx.closePath();
      ctx.fill();

      // Cockpit
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(player.x + player.w * 0.6, player.y + player.h / 2, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Shield Aura
      if (player.shield) {
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(player.x + player.w / 2, player.y + player.h / 2, player.w * 0.85, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

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

  // Direct Touch / Pointer control for mobile
  const handlePointerMove = (e: React.PointerEvent) => {
    if (gameStateRef.current !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;

    const targetX = clientX * scaleX - playerRef.current.w / 2;
    const targetY = clientY * scaleY - playerRef.current.h / 2;

    playerRef.current.x = Math.max(10, Math.min(WIDTH / 2, targetX));
    playerRef.current.y = Math.max(10, Math.min(HEIGHT - playerRef.current.h - 10, targetY));

    // Touch auto-fire
    triggerLaser(performance.now());
  };

  return (
    <div 
      ref={containerRef}
      className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-[#090b10]"
    >
      {/* Dynamic Flight HUD */}
      <div className="w-full max-w-[450px] flex-none flex justify-between items-center mb-2 px-3 py-1 bg-[#121622]/80 border border-white/[0.06] rounded-xl text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400">WAVE:</span>
          <span className="text-indigo-400 font-bold">{wave}</span>
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

        {hasShield && (
          <div className="flex items-center gap-1 text-cyan-400 font-bold">
            <Shield size={12} />
            <span>SHIELD</span>
          </div>
        )}

        {weaponType !== 'single' && (
          <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] rounded font-bold uppercase">
            {weaponType}
          </span>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400">SKOR:</span>
          <span className="text-white font-bold">{score}</span>
        </div>
      </div>

      {/* Canvas Stage */}
      <div 
        className="relative flex-1 min-h-0 w-full max-w-[450px] max-h-[400px] flex items-center justify-center bg-[#06080d] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden touch-none"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerMove}
      >
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="w-full h-full object-contain block cursor-crosshair select-none"
        />

        <GameOverlay
          gameState={gameState}
          countdown={countdown}
          score={score}
          highScore={highScore}
          onStart={startGame}
          onRestart={startGame}
          instructions="Kemudikan pesawat tempur dengan WASD / tombol panah dan tahan SPASI untuk menembak armada alien!"
        />
      </div>
    </div>
  );
}
