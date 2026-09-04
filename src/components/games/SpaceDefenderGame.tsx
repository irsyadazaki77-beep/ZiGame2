import React, { useEffect, useRef, useState } from 'react';
import { audio } from '../../utils/audio';
import { Particle } from '../../types';
import { GameOverlay } from '../gameplay/GameOverlay';
import { MobileControls } from '../gameplay/MobileControls';

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
}

interface Enemy {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  color: string;
  points: number;
  active: boolean;
  type: 'basic' | 'speedy' | 'tank';
  health: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  active: boolean;
  isEnemy: boolean;
}

export default function SpaceDefenderGame({ onGameOver, onScoreUpdate, highScore }: SpaceDefenderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Game state
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const gameLoopRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const [lives, setLives] = useState(3);
  const livesRef = useRef(3);
  const [wave, setWave] = useState(1);
  const waveRef = useRef(1);
  const [gameOver, setGameOver] = useState(false);
  const isPlayingRef = useRef(false);
  const gameOverRef = useRef(false);


  useEffect(() => {
    isPlayingRef.current = isPlaying;
    gameOverRef.current = gameOver;
    scoreRef.current = score;
    livesRef.current = lives;
    waveRef.current = wave;
  }, [isPlaying, gameOver, score, lives, wave]);
  const [muted, setMuted] = useState(audio.getMuteState());

  // Player state
  const playerRef = useRef<{ x: number; y: number; w: number; h: number; speed: number; lastShot: number; shield: boolean }>({
    x: 40,
    y: 180,
    w: 24,
    h: 20,
    speed: 5.5,
    lastShot: 0,
    shield: false,
  });

  const starsRef = useRef<Star[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const activeKeysRef = useRef<{ [key: string]: boolean }>({});
  const lastFrameTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const shakeRef = useRef<number>(0);
  const floatingTextsRef = useRef<{ x: number; y: number; text: string; color: string; alpha: number; vy: number }[]>([]);

  const WIDTH = 400;
  const HEIGHT = 400;

  useEffect(() => {
    // Generate initial starfield
    generateStars();
    drawStatic();
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, []);

  const generateStars = () => {
    const quality = localStorage.getItem('zigame-graphics') || 'high';
    const starCount = quality === 'low' ? 15 : quality === 'medium' ? 25 : 40;
    const stars: Star[] = [];
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        speed: Math.random() * 2 + 0.5,
        size: Math.random() * 2 + 0.5,
      });
    }
    starsRef.current = stars;
  };

  // Keyboard hooks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space'].includes(e.code)) {
        e.preventDefault();
        activeKeysRef.current[e.code] = true;
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

  // Main game thread
  const gameStep = (time: number) => {
    if (!isPlayingRef.current || gameOverRef.current ) return;

    // FPS Limiter implementation
    const fpsPref = localStorage.getItem('zigame-fps') || 'auto';
    if (fpsPref !== 'auto') {
      const targetFps = parseInt(fpsPref, 10);
      const interval = 1000 / targetFps;
      const elapsed = time - lastFrameTimeRef.current;
      
      // If elapsed time is less than target interval minus a 1ms safety buffer, skip
      if (elapsed < interval - 1) {
        gameLoopRef.current = requestAnimationFrame(gameStep);
        return;
      }
      
      // Keep intervals stable
      lastFrameTimeRef.current = time - (elapsed % interval);
    } else {
      lastFrameTimeRef.current = time;
    }

    updateStars();
    updatePlayer();
    updateBullets();
    updateEnemies();
    updateParticles();

    render();

    gameLoopRef.current = requestAnimationFrame(gameStep);
  };

  const updateStars = () => {
    starsRef.current.forEach(star => {
      star.x -= star.speed;
      if (star.x < 0) {
        star.x = WIDTH;
        star.y = Math.random() * HEIGHT;
      }
    });
  };

  const updatePlayer = () => {
    const player = playerRef.current;
    
    // Up movement
    if (activeKeysRef.current['ArrowUp'] || activeKeysRef.current['KeyW']) {
      player.y = Math.max(10, player.y - player.speed);
    }
    // Down movement
    if (activeKeysRef.current['ArrowDown'] || activeKeysRef.current['KeyS']) {
      player.y = Math.min(HEIGHT - player.h - 10, player.y + player.speed);
    }
    // Left movement
    if (activeKeysRef.current['ArrowLeft'] || activeKeysRef.current['KeyA']) {
      player.x = Math.max(10, player.x - player.speed);
    }
    // Right movement
    if (activeKeysRef.current['ArrowRight'] || activeKeysRef.current['KeyD']) {
      player.x = Math.min(WIDTH / 2, player.x + player.speed);
    }

    // Shoot Laser
    if (activeKeysRef.current['Space']) {
      triggerFireLaser();
    }
  };

  const triggerFireLaser = () => {
    const player = playerRef.current;
    const now = Date.now();
    
    // Throttle lasers: max 1 per 220ms
    if (now - player.lastShot > 220) {
      bulletsRef.current.push({
        x: player.x + player.w,
        y: player.y + player.h / 2,
        vx: 9, // Slightly faster laser
        vy: 0,
        radius: 3.5,
        color: '#6366f1', // glowing indigo laser
        active: true,
        isEnemy: false,
      });
      player.lastShot = now;
      audio.playLaser();
      shakeRef.current = 1.5; // Micro screen shake on shoot
    }
  };

  const movePlayerTouch = (dir: 'up' | 'down') => {
    const player = playerRef.current;
    if (dir === 'up') {
      player.y = Math.max(10, player.y - 20);
    } else {
      player.y = Math.min(HEIGHT - player.h - 10, player.y + 20);
    }
  };

  const updateBullets = () => {
    bulletsRef.current = bulletsRef.current
      .map(b => {
        b.x += b.vx;
        b.y += b.vy;
        // Check out of bounds
        if (b.x < 0 || b.x > WIDTH) b.active = false;
        return b;
      })
      .filter(b => b.active);
  };

  const spawnEnemy = () => {
    const types: Enemy['type'][] = ['basic', 'speedy', 'tank'];
    const r = Math.random();
    
    let type: Enemy['type'] = 'basic';
    let color = '#38bdf8'; // light cyan
    let speed = Math.random() * 1.5 + 1.2 + (waveRef.current * 0.15);
    let hp = 1;
    let points = 10;
    let w = 20, h = 20;

    if (r < 0.2) {
      type = 'speedy';
      color = '#f43f5e'; // pinkish red
      speed = Math.random() * 1.5 + 2.8 + (waveRef.current * 0.2);
      points = 20;
    } else if (r < 0.35) {
      type = 'tank';
      color = '#a855f7'; // violet purple
      speed = Math.random() * 0.8 + 0.8 + (waveRef.current * 0.05);
      hp = 3;
      points = 30;
      w = 26;
      h = 26;
    }

    enemiesRef.current.push({
      x: WIDTH + 20,
      y: Math.max(30, Math.random() * (HEIGHT - 40)),
      w,
      h,
      speed,
      color,
      points,
      active: true,
      type,
      health: hp,
    });
  };

  const updateEnemies = () => {
    const enemies = enemiesRef.current;
    const player = playerRef.current;
    const bullets = bulletsRef.current;

    // Enemy Spawning Rate: based on wave
    spawnTimerRef.current++;
    const spawnRate = Math.max(25, 75 - waveRef.current * 4);
    if (spawnTimerRef.current >= spawnRate) {
      spawnEnemy();
      spawnTimerRef.current = 0;
    }

    // Check wave transitions
    const enemiesKilled = scoreRef.current / 10;
    const nextWaveTarget = waveRef.current * 10;
    if (enemiesKilled >= nextWaveTarget && waveRef.current < 5) {
      const nextWave = waveRef.current + 1;
      setWave(nextWave);
      audio.playLevelUp();
      shakeRef.current = 14;
      floatingTextsRef.current.push({
        x: WIDTH / 2,
        y: HEIGHT / 2,
        text: `WAVE ${nextWave}!`,
        color: '#a855f7',
        alpha: 1.0,
        vy: -1.0
      });
      createWaveParticles();
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      enemy.x -= enemy.speed;

      // Clean up out of bounds enemies
      if (enemy.x + enemy.w < 0) {
        enemies.splice(i, 1);
        continue;
      }

      // Spaceship / Enemy Collision
      if (
        player.x + player.w >= enemy.x &&
        player.x <= enemy.x + enemy.w &&
        player.y + player.h >= enemy.y &&
        player.y <= enemy.y + enemy.h
      ) {
        // Explode enemy
        createExplosionParticles(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.color);
        enemies.splice(i, 1);
        handlePlayerHit();
        continue;
      }

      // Bullet / Enemy collision
      for (let j = bullets.length - 1; j >= 0; j--) {
        const bullet = bullets[j];
        if (
          !bullet.isEnemy &&
          bullet.x + bullet.radius >= enemy.x &&
          bullet.x - bullet.radius <= enemy.x + enemy.w &&
          bullet.y + bullet.radius >= enemy.y &&
          bullet.y - bullet.radius <= enemy.y + enemy.h
        ) {
          // Remove bullet
          bullet.active = false;
          bullets.splice(j, 1);

          // Damage enemy
          enemy.health--;
          if (enemy.health <= 0) {
            audio.playExplosion();
            shakeRef.current = 7;
            floatingTextsRef.current.push({
              x: enemy.x + enemy.w / 2,
              y: enemy.y,
              text: `+${enemy.points}`,
              color: enemy.color,
              alpha: 1.0,
              vy: -0.8
            });
            createExplosionParticles(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.color);
            setScore(prev => {
              const next = prev + enemy.points;
              onScoreUpdate(next);
              return next;
            });
            // Spawn shield chance
            if (Math.random() < 0.08 && !player.shield) {
              player.shield = true;
              audio.playLevelUp();
              floatingTextsRef.current.push({
                x: player.x,
                y: player.y - 12,
                text: "SHIELD UP!",
                color: '#3b82f6',
                alpha: 1.0,
                vy: -0.6
              });
            }
            enemies.splice(i, 1);
          } else {
            audio.playHit();
            shakeRef.current = 2;
            createExplosionParticles(bullet.x, bullet.y, '#ffffff'); // tiny spark
          }
          break;
        }
      }
    }
  };

  const handlePlayerHit = () => {
    const player = playerRef.current;
    audio.playExplosion();
    createExplosionParticles(player.x + player.w / 2, player.y + player.h / 2, '#ef4444');

    if (player.shield) {
      player.shield = false; // consume shield instead of life
      shakeRef.current = 10;
      floatingTextsRef.current.push({
        x: player.x,
        y: player.y - 12,
        text: "SHIELD DOWN!",
        color: '#ef4444',
        alpha: 1.0,
        vy: -0.6
      });
      return;
    }

    const nextLives = livesRef.current - 1;
    setLives(nextLives);
    shakeRef.current = 16;
    
    if (nextLives <= 0) {
      setIsPlaying(false);
      setGameOver(true);
      shakeRef.current = 25;
      audio.playGameOver();
      onGameOver(scoreRef.current);
    }
  };

  const createExplosionParticles = (x: number, y: number, color: string) => {
    const quality = localStorage.getItem('zigame-graphics') || 'high';
    const pCount = quality === 'low' ? 3 : quality === 'medium' ? 7 : 15;
    for (let i = 0; i < pCount; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        color,
        radius: Math.random() * 3 + 1,
        alpha: 1.0,
        decay: Math.random() * 0.04 + 0.02,
      });
    }
  };

  const createWaveParticles = () => {
    const quality = localStorage.getItem('zigame-graphics') || 'high';
    const pCount = quality === 'low' ? 6 : quality === 'medium' ? 15 : 30;
    for (let i = 0; i < pCount; i++) {
      particlesRef.current.push({
        x: WIDTH / 2,
        y: HEIGHT / 2,
        vx: Math.cos(i * (Math.PI * 2 / pCount)) * 5,
        vy: Math.sin(i * (Math.PI * 2 / pCount)) * 5,
        color: '#a855f7',
        radius: Math.random() * 4 + 1.5,
        alpha: 1.0,
        decay: 0.025,
      });
    }
  };

  const updateParticles = () => {
    particlesRef.current = particlesRef.current
      .map(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        return p;
      })
      .filter(p => p.alpha > 0);

    floatingTextsRef.current = floatingTextsRef.current
      .map(t => {
        t.y += t.vy;
        t.alpha -= 0.025;
        return t;
      })
      .filter(t => t.alpha > 0);
  };

  const startGame = () => {
    audio.playCoin();
    setScore(0);
    setLives(3);
    setWave(1);
    setGameOver(false);
    bulletsRef.current = [];
    enemiesRef.current = [];
    particlesRef.current = [];
    playerRef.current = {
      x: 40,
      y: 180,
      w: 24,
      h: 20,
      speed: 5.5,
      lastShot: 0,
      shield: false,
    };
    
    // Explicitly update refs to ensure synchronous start
    isPlayingRef.current = true;
    gameOverRef.current = false;
    setIsPlaying(true);

    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    gameLoopRef.current = requestAnimationFrame(gameStep);
  };

  const toggleSound = () => {
    audio.toggleMute();
    setMuted(audio.getMuteState());
  };

  // Canvas static
  const drawStatic = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = '#6366f1';
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#6366f1';
    ctx.fillText('TEKAN MULAI UNTUK MAIN', WIDTH / 2, HEIGHT / 2);
    ctx.shadowBlur = 0;
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const quality = localStorage.getItem('zigame-graphics') || 'high';
    const dpr = quality === 'low' ? 1.0 : quality === 'medium' ? 1.5 : Math.max(window.devicePixelRatio || 2, 2.5);

    const targetWidth = Math.round(WIDTH * dpr);
    const targetHeight = Math.round(HEIGHT * dpr);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.save();
    if (shakeRef.current > 0) {
      const dx = (Math.random() - 0.5) * shakeRef.current;
      const dy = (Math.random() - 0.5) * shakeRef.current;
      ctx.translate(dx, dy);
      shakeRef.current *= 0.85;
      if (shakeRef.current < 0.5) shakeRef.current = 0;
    }

    const enableShadows = quality !== 'low';
    const enableNebula = quality !== 'low';
    const shadowScale = quality === 'medium' ? 0.4 : 1.0;

    const setShadow = (blur: number, color: string) => {
      if (!enableShadows) {
        ctx.shadowBlur = 0;
        return;
      }
      ctx.shadowBlur = blur * shadowScale;
      ctx.shadowColor = color;
    };

    // Space Deep Dark Background with Glowing Cosmic Nebulas
    ctx.fillStyle = '#030208';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (enableNebula) {
      // Nebula cloud 1 (Deep Purple Glow)
      const nebGrad1 = ctx.createRadialGradient(WIDTH * 0.25, HEIGHT * 0.3, 20, WIDTH * 0.25, HEIGHT * 0.3, 160);
      nebGrad1.addColorStop(0, 'rgba(124, 58, 237, 0.13)'); // violet
      nebGrad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nebGrad1;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Nebula cloud 2 (Deep Cyan Glow)
      const nebGrad2 = ctx.createRadialGradient(WIDTH * 0.75, HEIGHT * 0.7, 10, WIDTH * 0.75, HEIGHT * 0.7, 140);
      nebGrad2.addColorStop(0, 'rgba(6, 182, 212, 0.12)'); // cyan
      nebGrad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nebGrad2;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // Starfield Draw (Desynchronized Twinkling Stars)
    starsRef.current.forEach((star, idx) => {
      const twinkle = 0.4 + 0.6 * Math.sin((Date.now() / 320) + idx * 7);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = (star.speed / 2.5) * twinkle;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0; // reset

    // Draw Space Ship (Player)
    const p = playerRef.current;
    ctx.save();
    ctx.translate(p.x, p.y);

    // Engine flame with high-fidelity gradient + heat distortion sparks
    const flameSize = 13 + Math.random() * 8;
    const flameGrad = ctx.createLinearGradient(0, p.h / 2, -flameSize, p.h / 2);
    flameGrad.addColorStop(0, '#a5f3fc'); // bright white-cyan core
    flameGrad.addColorStop(0.3, '#3b82f6'); // blue
    flameGrad.addColorStop(0.7, '#8b5cf6'); // violet
    flameGrad.addColorStop(1, 'rgba(139, 92, 246, 0)'); // fade out
    ctx.fillStyle = flameGrad;
    setShadow(18, '#3b82f6');
    ctx.beginPath();
    ctx.moveTo(-2, p.h / 2 - 4.5);
    ctx.lineTo(-flameSize, p.h / 2);
    ctx.lineTo(-2, p.h / 2 + 4.5);
    ctx.closePath();
    ctx.fill();

    // Ship Body (glowing futuristic fighter shape with dual tone styling)
    ctx.fillStyle = '#6366f1';
    setShadow(15, '#6366f1');
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(p.w - 3, p.h / 2);
    ctx.lineTo(0, p.h - 4);
    ctx.lineTo(4, p.h / 2);
    ctx.closePath();
    ctx.fill();

    // Side Wings (neon cyan accents)
    ctx.fillStyle = '#06b6d4';
    setShadow(10, '#06b6d4');
    ctx.fillRect(2, 0, 4, p.h);
    ctx.shadowBlur = 0;

    // Cockpit
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(10, p.h / 2 - 2, 4, 4);

    ctx.restore();

    // Glowing protective shield around ship
    if (p.shield) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      setShadow(15, '#38bdf8');
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y + p.h / 2, p.w * 0.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw Bullets (Indigo Lasers)
    bulletsRef.current.forEach(b => {
      ctx.fillStyle = b.color;
      setShadow(12, b.color);
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.radius * 1.8, b.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Aliens / Enemies
    enemiesRef.current.forEach(enemy => {
      ctx.fillStyle = enemy.color;
      setShadow(10, enemy.color);

      ctx.save();
      ctx.translate(enemy.x, enemy.y);

      // Draw custom pixel invaders shapes
      if (enemy.type === 'tank') {
        // heavy blocky alien ship
        ctx.fillRect(0, 4, enemy.w, enemy.h - 8);
        ctx.fillRect(4, 0, enemy.w - 8, enemy.h);
        ctx.fillStyle = '#f43f5e'; // glowing eye
        ctx.fillRect(4, enemy.h / 2 - 2, 4, 4);
      } else if (enemy.type === 'speedy') {
        // sleek agile dart alien
        ctx.beginPath();
        ctx.moveTo(enemy.w, enemy.h / 2);
        ctx.lineTo(0, 0);
        ctx.lineTo(4, enemy.h / 2);
        ctx.lineTo(0, enemy.h);
        ctx.closePath();
        ctx.fill();
      } else {
        // classic pixel invader crab
        ctx.fillRect(4, 0, enemy.w - 8, enemy.h);
        ctx.fillRect(0, 4, 4, enemy.h - 8);
        ctx.fillRect(enemy.w - 4, 4, 4, enemy.h - 8);
        // tentacles
        ctx.fillRect(2, enemy.h - 3, 2, 3);
        ctx.fillRect(enemy.w - 4, enemy.h - 3, 2, 3);
      }

      ctx.restore();
    });

    // Draw explosion and wave-up particles
    ctx.shadowBlur = 0;
    particlesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Draw floating texts
    floatingTextsRef.current.forEach(t => {
      ctx.fillStyle = t.color;
      ctx.globalAlpha = t.alpha;
      ctx.font = 'bold 9px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1.0;

    ctx.restore();
  };

  const getGameState = () => {
    if (!isPlaying && score === 0 && wave === 1) return 'ready';
    if (!isPlaying) return 'gameover';
    return 'playing';
  };

  const handleDirection = (dir: 'up' | 'down' | 'left' | 'right') => {
    // Only support up/down movement in MobileControls for this game (or we can use all directions)
    // The previous mobile controls used separate up/down/shoot buttons.
    // We'll update state variables directly since they are refs used in loop.
    activeKeysRef.current['ArrowUp'] = dir === 'up';
    activeKeysRef.current['ArrowDown'] = dir === 'down';
    activeKeysRef.current['ArrowLeft'] = dir === 'left';
    activeKeysRef.current['ArrowRight'] = dir === 'right';

    // Need to reset after a small delay because MobileControls sends a single event
    setTimeout(() => {
      activeKeysRef.current['ArrowUp'] = false;
      activeKeysRef.current['ArrowDown'] = false;
      activeKeysRef.current['ArrowLeft'] = false;
      activeKeysRef.current['ArrowRight'] = false;
    }, 100);
  };

  const handleAction = () => {
    triggerFireLaser();
  };

  return (
    <div className="relative flex flex-col h-full w-full min-h-0 items-center justify-center overflow-hidden p-2 bg-[#090b10]">
      {/* Clean HUD Bar */}
      <div className="w-full flex-none flex justify-between items-center mb-2 px-3 text-xs">
        <div className="text-zinc-400 font-medium">
          Gelombang: <span className="text-indigo-400 font-semibold">{wave}</span>
        </div>
        <div className="text-zinc-400 font-medium">
          Nyawa: <span className="text-rose-400 font-semibold">{'❤️'.repeat(Math.max(0, lives))}</span>
        </div>
        <div className="text-zinc-400 font-medium">
          Skor: <span className="text-white font-bold">{score}</span>
        </div>
      </div>

      {/* Canvas Wrapper */}
      <div 
        ref={containerRef}
        className="relative flex-1 min-h-0 w-full flex items-center justify-center bg-[#090b10] rounded-2xl border border-white/[0.08] shadow-inner overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="max-w-full max-h-full object-contain block bg-[#090b10]"
        />

        {/* Space wave transition banner */}
        {isPlaying && particlesRef.current.some(p => p.color === '#a855f7' && p.decay === 0.025) && (
          <div className="absolute inset-x-0 top-1/3 text-center pointer-events-none animate-in fade-in duration-200">
            <div className="text-indigo-300 font-bold text-lg tracking-tight">
              Gelombang {wave}
            </div>
            <p className="text-zinc-400 text-xs mt-0.5">Kecepatan alien bertambah!</p>
          </div>
        )}

        <GameOverlay
          gameState={getGameState()}
          score={score}
          highScore={highScore}
          onStart={startGame}
          onRestart={startGame}
          instructions="Kemudikan pesawat tempur dengan tombol panah/WASD dan tekan SPASI untuk menembak armada alien!"
        />
      </div>

      {/* Mobile Controls outside canvas */}
      {isPlaying && (
        <div className="flex-none mt-2 w-full">
          <MobileControls onDirection={handleDirection} onAction={handleAction} actionLabel="TEMBAK" />
        </div>
      )}
    </div>
  );
}
