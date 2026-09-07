import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Zap, Shield, Sparkles, Trophy, Flame, Crosshair, Award, Orbit, Radio, Compass } from 'lucide-react';

interface VoidSurvivorGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 540;

interface UpgradeOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'weapon' | 'passive';
  tier: number;
}

const ALL_UPGRADES: UpgradeOption[] = [
  { id: 'plasma_cannon', name: 'Plasma Cannon', description: 'Tembakan plasma beruntun dengan penetrasi musuh.', icon: '⚡', type: 'weapon', tier: 1 },
  { id: 'orbital_drones', name: 'Orbital Drones', description: 'Drone laser berputar mengelilingi pemain melumat musuh.', icon: '🛸', type: 'weapon', tier: 1 },
  { id: 'void_lightning', name: 'Void Lightning', description: 'Petir kosmik menyambar target secara berantai.', icon: '🌩️', type: 'weapon', tier: 1 },
  { id: 'singularity_vortex', name: 'Singularity Vortex', description: 'Menciptakan lubang hitam yang menyedot dan meremukkan musuh.', icon: '🌀', type: 'weapon', tier: 1 },
  { id: 'cosmic_shield', name: 'Cosmic Shield', description: 'Perisai energi yang menyerap kerusakan dan melepaskan gelombang kejut.', icon: '🛡️', type: 'passive', tier: 1 },
  { id: 'hyper_thrusters', name: 'Hyper Thrusters', description: 'Meningkatkan kecepatan gerak dan akselerasi kapal +20%.', icon: '🚀', type: 'passive', tier: 1 },
  { id: 'magnetic_core', name: 'Magnetic Core', description: 'Meningkatkan radius magnet pengambil orb XP +50%.', icon: '🧲', type: 'passive', tier: 1 },
  { id: 'critical_matrix', name: 'Critical Resonance', description: 'Peluang serangan kritikal +15% dengan damage 2.5x.', icon: '🎯', type: 'passive', tier: 1 },
];

interface Enemy {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  type: 'crawler' | 'stalker' | 'brute' | 'wraith' | 'boss';
  color: string;
  shootCooldown?: number;
  isBoss?: boolean;
}

interface Projectile {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  pierce: number;
  color: string;
  lifetime: number;
  isCrit?: boolean;
  type: 'plasma' | 'drone' | 'lightning' | 'vortex' | 'enemy';
}

interface XpOrb {
  active: boolean;
  x: number;
  y: number;
  value: number;
  color: string;
  radius: number;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
  decay: number;
}

export default function VoidSurvivorGame({ onGameOver, onScoreUpdate, highScore }: VoidSurvivorGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [gameState, setGameState] = useState<'ready' | 'countdown' | 'playing' | 'paused' | 'gameover' | 'levelup'>('ready');
  const [countdown, setCountdown] = useState(3);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [xpNeeded, setXpNeeded] = useState(100);
  const [kills, setKills] = useState(0);
  const [survivalTime, setSurvivalTime] = useState(0);
  const [health, setHealth] = useState(100);
  const [maxHealth, setMaxHealth] = useState(100);
  const [activeUpgrades, setActiveUpgrades] = useState<{ [id: string]: number }>({ plasma_cannon: 1 });
  const [levelUpOptions, setLevelUpOptions] = useState<UpgradeOption[]>([]);
  const [totalScore, setTotalScore] = useState(0);

  const gameStateRef = useRef(gameState);
  const totalScoreRef = useRef(0);
  const lastTimeRef = useRef(0);
  const gameLoopRef = useRef<number | null>(null);
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // Player State in Ref for 60 FPS performance
  const playerRef = useRef({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    vx: 0,
    vy: 0,
    speed: 3.2,
    radius: 14,
    hp: 100,
    maxHp: 100,
    shield: 50,
    maxShield: 50,
    shieldRegenTimer: 0,
    xp: 0,
    level: 1,
    magnetRadius: 100,
    critChance: 0.1,
    critMultiplier: 2.0,
    plasmaCooldown: 0,
    lightningCooldown: 0,
    vortexCooldown: 0,
    droneAngle: 0,
    droneCount: 0,
  });

  // Entity Pools (Zero allocations during gameplay)
  const MAX_ENEMIES = 150;
  const enemiesPool = useRef<Enemy[]>([]);
  const MAX_PROJECTILES = 200;
  const projectilesPool = useRef<Projectile[]>([]);
  const MAX_ORBS = 180;
  const orbsPool = useRef<XpOrb[]>([]);
  const MAX_PARTICLES = 150;
  const particlesPool = useRef<Particle[]>([]);

  // Initialize pools once
  useEffect(() => {
    enemiesPool.current = Array.from({ length: MAX_ENEMIES }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      hp: 10,
      maxHp: 10,
      speed: 1,
      radius: 10,
      type: 'crawler',
      color: '#a855f7',
    }));

    projectilesPool.current = Array.from({ length: MAX_PROJECTILES }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      damage: 10,
      radius: 4,
      pierce: 1,
      color: '#06b6d4',
      lifetime: 60,
      type: 'plasma',
    }));

    orbsPool.current = Array.from({ length: MAX_ORBS }, () => ({
      active: false,
      x: 0,
      y: 0,
      value: 10,
      color: '#38bdf8',
      radius: 4,
    }));

    particlesPool.current = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      color: '#fff',
      alpha: 1,
      size: 2,
      decay: 0.02,
    }));
  }, []);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Tab visibility auto-pause
  useEffect(() => {
    const handleVis = () => {
      if (document.hidden && gameStateRef.current === 'playing') {
        setGameState('paused');
      }
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => document.removeEventListener('visibilitychange', handleVis);
  }, []);

  const spawnParticle = (x: number, y: number, color: string, speed = 2, size = 3) => {
    const p = particlesPool.current.find((item) => !item.active);
    if (!p) return;
    const angle = Math.random() * Math.PI * 2;
    const spd = Math.random() * speed + 0.5;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * spd;
    p.vy = Math.sin(angle) * spd;
    p.color = color;
    p.alpha = 1;
    p.size = Math.random() * size + 1;
    p.decay = Math.random() * 0.02 + 0.02;
  };

  const spawnXpOrb = (x: number, y: number, value: number) => {
    const orb = orbsPool.current.find((item) => !item.active);
    if (!orb) return;
    orb.active = true;
    orb.x = x;
    orb.y = y;
    orb.value = value;
    orb.color = value >= 50 ? '#f59e0b' : value >= 25 ? '#a855f7' : '#38bdf8';
    orb.radius = value >= 50 ? 6 : 4;
  };

  const spawnEnemy = (type: 'crawler' | 'stalker' | 'brute' | 'wraith' | 'boss', isBoss = false) => {
    const e = enemiesPool.current.find((item) => !item.active);
    if (!e) return;

    // Spawn on screen boundary
    const edge = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    if (edge === 0) { x = Math.random() * CANVAS_WIDTH; y = -20; }
    else if (edge === 1) { x = CANVAS_WIDTH + 20; y = Math.random() * CANVAS_HEIGHT; }
    else if (edge === 2) { x = Math.random() * CANVAS_WIDTH; y = CANVAS_HEIGHT + 20; }
    else { x = -20; y = Math.random() * CANVAS_HEIGHT; }

    e.active = true;
    e.x = x;
    e.y = y;
    e.type = type;
    e.isBoss = isBoss;

    const waveFactor = 1 + (survivalTime / 60) * 0.3;

    if (type === 'crawler') {
      e.hp = Math.round(15 * waveFactor);
      e.maxHp = e.hp;
      e.speed = 2.0;
      e.radius = 9;
      e.color = '#c084fc';
    } else if (type === 'stalker') {
      e.hp = Math.round(30 * waveFactor);
      e.maxHp = e.hp;
      e.speed = 1.4;
      e.radius = 12;
      e.color = '#38bdf8';
      e.shootCooldown = 120;
    } else if (type === 'brute') {
      e.hp = Math.round(120 * waveFactor);
      e.maxHp = e.hp;
      e.speed = 1.0;
      e.radius = 18;
      e.color = '#f43f5e';
    } else if (type === 'wraith') {
      e.hp = Math.round(45 * waveFactor);
      e.maxHp = e.hp;
      e.speed = 2.4;
      e.radius = 11;
      e.color = '#10b981';
    } else if (type === 'boss') {
      e.hp = Math.round(1500 * waveFactor);
      e.maxHp = e.hp;
      e.speed = 1.2;
      e.radius = 32;
      e.color = '#e11d48';
      e.shootCooldown = 80;
    }
  };

  const spawnProjectile = (
    x: number,
    y: number,
    vx: number,
    vy: number,
    damage: number,
    type: 'plasma' | 'drone' | 'lightning' | 'vortex' | 'enemy',
    pierce = 1,
    color = '#06b6d4',
    radius = 4
  ) => {
    const p = projectilesPool.current.find((item) => !item.active);
    if (!p) return;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.damage = damage;
    p.type = type;
    p.pierce = pierce;
    p.color = color;
    p.radius = radius;
    p.lifetime = 120;
  };

  const triggerLevelUp = () => {
    // Pick 3 random upgrades from pool
    const shuffled = [...ALL_UPGRADES].sort(() => 0.5 - Math.random());
    const options = shuffled.slice(0, 3).map((opt) => ({
      ...opt,
      tier: (activeUpgrades[opt.id] || 0) + 1,
    }));

    setLevelUpOptions(options);
    setGameState('levelup');
    audio.playLevelUp();
  };

  const selectUpgrade = (upgrade: UpgradeOption) => {
    const newTier = (activeUpgrades[upgrade.id] || 0) + 1;
    const updated = { ...activeUpgrades, [upgrade.id]: newTier };
    setActiveUpgrades(updated);

    const player = playerRef.current;
    if (upgrade.id === 'hyper_thrusters') {
      player.speed += 0.5;
    } else if (upgrade.id === 'magnetic_core') {
      player.magnetRadius += 40;
    } else if (upgrade.id === 'critical_matrix') {
      player.critChance += 0.1;
      player.critMultiplier += 0.4;
    } else if (upgrade.id === 'cosmic_shield') {
      player.maxShield += 30;
      player.shield = player.maxShield;
    } else if (upgrade.id === 'orbital_drones') {
      player.droneCount = Math.min(6, (player.droneCount || 0) + 1);
    }

    setGameState('playing');
    audio.playPowerup();
  };

  const startGame = useCallback(() => {
    // Reset player
    const p = playerRef.current;
    p.x = CANVAS_WIDTH / 2;
    p.y = CANVAS_HEIGHT / 2;
    p.hp = 100;
    p.maxHp = 100;
    p.shield = 50;
    p.maxShield = 50;
    p.speed = 3.2;
    p.xp = 0;
    p.level = 1;
    p.magnetRadius = 100;
    p.critChance = 0.1;
    p.critMultiplier = 2.0;
    p.plasmaCooldown = 0;
    p.lightningCooldown = 0;
    p.vortexCooldown = 0;
    p.droneCount = 1;

    // Clear pools
    enemiesPool.current.forEach((e) => (e.active = false));
    projectilesPool.current.forEach((pr) => (pr.active = false));
    orbsPool.current.forEach((o) => (o.active = false));
    particlesPool.current.forEach((pa) => (pa.active = false));

    totalScoreRef.current = 0;
    setTotalScore(0);
    setLevel(1);
    setXp(0);
    setXpNeeded(100);
    setKills(0);
    setSurvivalTime(0);
    setHealth(100);
    setMaxHealth(100);
    setActiveUpgrades({ plasma_cannon: 1, orbital_drones: 1 });

    setGameState('countdown');
    setCountdown(3);
    audio.playCountdown();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (gameState !== 'countdown') return;
    if (countdown > 1) {
      const t = setTimeout(() => {
        setCountdown((c) => c - 1);
        audio.playCountdown();
      }, 700);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setGameState('playing');
        audio.playCoin();
      }, 700);
      return () => clearTimeout(t);
    }
  }, [gameState, countdown]);

  // Unified input subscription
  useEffect(() => {
    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (gameStateRef.current === 'ready') {
          if (action === 'PRIMARY') startGame();
          return;
        }
        if (gameStateRef.current === 'gameover') {
          if (action === 'PRIMARY' || action === 'RESTART') startGame();
          return;
        }
        if (gameStateRef.current === 'playing') {
          if (action === 'PAUSE') setGameState('paused');
        } else if (gameStateRef.current === 'paused') {
          if (action === 'PAUSE' || action === 'PRIMARY') setGameState('playing');
        }
      },
      onRawKey: (key, isDown) => {
        keysRef.current[key.toLowerCase()] = isDown;
        keysRef.current[key] = isDown;
      },
    });
    return () => unsub();
  }, [startGame]);

  // Main 60 FPS requestAnimationFrame Loop
  useEffect(() => {
    let animId: number;
    let spawnTimer = 0;
    let secTimer = 0;

    const loop = (timestamp: number) => {
      animId = requestAnimationFrame(loop);
      gameLoopRef.current = animId;

      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const player = playerRef.current;

      // UPDATE PHASE
      if (gameStateRef.current === 'playing') {
        secTimer += dt;
        if (secTimer >= 1.0) {
          secTimer = 0;
          setSurvivalTime((t) => {
            const next = t + 1;
            totalScoreRef.current += 10;
            setTotalScore(totalScoreRef.current);
            onScoreUpdate(totalScoreRef.current);

            // Boss spawn every 120 seconds
            if (next % 120 === 0) {
              spawnEnemy('boss', true);
              audio.playExplosion();
            }
            return next;
          });
        }

        // Player Movement
        let dx = 0, dy = 0;
        const keys = keysRef.current;
        if (keys['w'] || keys['arrowup']) dy -= 1;
        if (keys['s'] || keys['arrowdown']) dy += 1;
        if (keys['a'] || keys['arrowleft']) dx -= 1;
        if (keys['d'] || keys['arrowright']) dx += 1;

        if (dx !== 0 && dy !== 0) {
          dx *= 0.7071;
          dy *= 0.7071;
        }

        player.x = Math.max(player.radius, Math.min(CANVAS_WIDTH - player.radius, player.x + dx * player.speed));
        player.y = Math.max(player.radius, Math.min(CANVAS_HEIGHT - player.radius, player.y + dy * player.speed));

        // Shield Regen
        player.shieldRegenTimer += dt;
        if (player.shieldRegenTimer > 4 && player.shield < player.maxShield) {
          player.shield = Math.min(player.maxShield, player.shield + dt * 10);
        }

        // Enemy Spawning
        spawnTimer += dt;
        const spawnInterval = Math.max(0.2, 1.2 - (survivalTime / 180) * 0.8);
        if (spawnTimer >= spawnInterval) {
          spawnTimer = 0;
          const roll = Math.random();
          if (roll < 0.6) spawnEnemy('crawler');
          else if (roll < 0.8) spawnEnemy('stalker');
          else if (roll < 0.92) spawnEnemy('wraith');
          else spawnEnemy('brute');
        }

        // WEAPONS AUTO-FIRE LOGIC
        // 1. Plasma Cannon
        const plasmaLvl = activeUpgrades['plasma_cannon'] || 1;
        player.plasmaCooldown -= dt;
        if (player.plasmaCooldown <= 0) {
          player.plasmaCooldown = Math.max(0.18, 0.45 - plasmaLvl * 0.05);

          // Find closest enemy
          let closestEnemy: Enemy | null = null;
          let closestDist = Infinity;
          enemiesPool.current.forEach((e) => {
            if (!e.active) return;
            const dist = Math.hypot(e.x - player.x, e.y - player.y);
            if (dist < closestDist) {
              closestDist = dist;
              closestEnemy = e;
            }
          });

          if (closestEnemy) {
            const angle = Math.atan2((closestEnemy as Enemy).y - player.y, (closestEnemy as Enemy).x - player.x);
            const spd = 9;
            const isCrit = Math.random() < player.critChance;
            const dmg = (18 + plasmaLvl * 6) * (isCrit ? player.critMultiplier : 1);

            spawnProjectile(
              player.x,
              player.y,
              Math.cos(angle) * spd,
              Math.sin(angle) * spd,
              dmg,
              'plasma',
              plasmaLvl >= 3 ? 2 : 1,
              isCrit ? '#f59e0b' : '#06b6d4',
              5
            );
            audio.playLaser();
          }
        }

        // 2. Void Lightning
        const lightningLvl = activeUpgrades['void_lightning'] || 0;
        if (lightningLvl > 0) {
          player.lightningCooldown -= dt;
          if (player.lightningCooldown <= 0) {
            player.lightningCooldown = Math.max(0.8, 2.0 - lightningLvl * 0.25);

            // Strike up to (2 + lightningLvl) random active enemies
            let hitCount = 0;
            enemiesPool.current.forEach((e) => {
              if (!e.active || hitCount >= 2 + lightningLvl) return;
              const dist = Math.hypot(e.x - player.x, e.y - player.y);
              if (dist < 320) {
                e.hp -= 35 + lightningLvl * 12;
                hitCount++;
                for (let i = 0; i < 4; i++) spawnParticle(e.x, e.y, '#a855f7', 3);
                if (e.hp <= 0) {
                  e.active = false;
                  spawnXpOrb(e.x, e.y, e.type === 'boss' ? 100 : 15);
                  setKills((k) => k + 1);
                }
              }
            });
            if (hitCount > 0) audio.playHit();
          }
        }

        // 3. Orbital Drones Rotation
        player.droneAngle += dt * 3;

        // 4. Singularity Vortex
        const vortexLvl = activeUpgrades['singularity_vortex'] || 0;
        if (vortexLvl > 0) {
          player.vortexCooldown -= dt;
          if (player.vortexCooldown <= 0) {
            player.vortexCooldown = 4.0;
            // Spawn vortex at random active enemy
            const activeEnemies = enemiesPool.current.filter((e) => e.active);
            if (activeEnemies.length > 0) {
              const target = activeEnemies[Math.floor(Math.random() * activeEnemies.length)];
              spawnProjectile(target.x, target.y, 0, 0, 15 * vortexLvl, 'vortex', 999, '#a855f7', 40);
            }
          }
        }

        // Update Projectiles
        projectilesPool.current.forEach((p) => {
          if (!p.active) return;
          p.x += p.vx;
          p.y += p.vy;
          p.lifetime--;

          if (
            p.x < -30 ||
            p.x > CANVAS_WIDTH + 30 ||
            p.y < -30 ||
            p.y > CANVAS_HEIGHT + 30 ||
            p.lifetime <= 0
          ) {
            p.active = false;
            return;
          }

          // Collision with enemies
          enemiesPool.current.forEach((e) => {
            if (!e.active || !p.active) return;
            const dist = Math.hypot(e.x - p.x, e.y - p.y);
            if (dist < e.radius + p.radius) {
              e.hp -= p.damage;
              p.pierce--;
              for (let i = 0; i < 3; i++) spawnParticle(p.x, p.y, p.color, 2);

              if (p.pierce <= 0 && p.type !== 'vortex') {
                p.active = false;
              }

              if (e.hp <= 0) {
                e.active = false;
                spawnXpOrb(e.x, e.y, e.type === 'boss' ? 200 : e.type === 'brute' ? 40 : 15);
                setKills((k) => k + 1);
                totalScoreRef.current += e.isBoss ? 500 : 25;
                setTotalScore(totalScoreRef.current);
                onScoreUpdate(totalScoreRef.current);
                audio.playExplosion();
              }
            }
          });
        });

        // Update Drones Collision
        if (player.droneCount > 0) {
          const droneDist = 55;
          for (let i = 0; i < player.droneCount; i++) {
            const angle = player.droneAngle + (i * Math.PI * 2) / player.droneCount;
            const dx = player.x + Math.cos(angle) * droneDist;
            const dy = player.y + Math.sin(angle) * droneDist;

            enemiesPool.current.forEach((e) => {
              if (!e.active) return;
              const dist = Math.hypot(e.x - dx, e.y - dy);
              if (dist < e.radius + 8) {
                e.hp -= 25 * dt;
                spawnParticle(dx, dy, '#06b6d4', 1.5);
                if (e.hp <= 0) {
                  e.active = false;
                  spawnXpOrb(e.x, e.y, 20);
                  setKills((k) => k + 1);
                }
              }
            });
          }
        }

        // Update Enemies
        enemiesPool.current.forEach((e) => {
          if (!e.active) return;
          const angle = Math.atan2(player.y - e.y, player.x - e.x);
          e.vx = Math.cos(angle) * e.speed;
          e.vy = Math.sin(angle) * e.speed;
          e.x += e.vx;
          e.y += e.vy;

          // Enemy shooting (stalker/boss)
          if (e.shootCooldown !== undefined) {
            e.shootCooldown--;
            if (e.shootCooldown <= 0) {
              e.shootCooldown = e.type === 'boss' ? 60 : 140;
              const bAngle = Math.atan2(player.y - e.y, player.x - e.x);
              spawnProjectile(e.x, e.y, Math.cos(bAngle) * 4, Math.sin(bAngle) * 4, 12, 'enemy', 1, '#f43f5e', 4);
            }
          }

          // Damage player on contact
          const dist = Math.hypot(e.x - player.x, e.y - player.y);
          if (dist < e.radius + player.radius) {
            const dmg = 25 * dt;
            player.shieldRegenTimer = 0;

            if (player.shield > 0) {
              player.shield -= dmg;
              if (player.shield < 0) {
                player.hp += player.shield;
                player.shield = 0;
              }
            } else {
              player.hp -= dmg;
            }

            setHealth(Math.max(0, Math.round(player.hp)));
            spawnParticle(player.x, player.y, '#ef4444', 2);

            if (player.hp <= 0) {
              audio.playGameOver();
              setGameState('gameover');
              onGameOver(totalScoreRef.current);
            }
          }
        });

        // Update XP Orbs (Attraction & Pickup)
        orbsPool.current.forEach((orb) => {
          if (!orb.active) return;
          const dist = Math.hypot(player.x - orb.x, player.y - orb.y);

          if (dist < player.magnetRadius) {
            const angle = Math.atan2(player.y - orb.y, player.x - orb.x);
            const pullSpeed = 8;
            orb.x += Math.cos(angle) * pullSpeed;
            orb.y += Math.sin(angle) * pullSpeed;
          }

          if (dist < player.radius + orb.radius + 5) {
            orb.active = false;
            audio.playCoin();

            player.xp += orb.value;
            setXp(player.xp);

            const needed = player.level * 120;
            setXpNeeded(needed);

            if (player.xp >= needed) {
              player.xp -= needed;
              player.level += 1;
              setLevel(player.level);
              triggerLevelUp();
            }
          }
        });

        // Update Particles
        particlesPool.current.forEach((p) => {
          if (!p.active) return;
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= p.decay;
          if (p.alpha <= 0) p.active = false;
        });
      }

      // RENDER PHASE
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Starfield / Cosmic background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 123 + (Date.now() / 80)) % CANVAS_WIDTH);
        const sy = ((i * 321) % CANVAS_HEIGHT);
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      // Singularity Vortex effects
      projectilesPool.current.forEach((p) => {
        if (!p.active || p.type !== 'vortex') return;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Date.now() / 200);

        const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, p.radius);
        grad.addColorStop(0, 'rgba(168, 85, 247, 0.8)');
        grad.addColorStop(0.5, 'rgba(99, 102, 241, 0.4)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // XP Orbs
      orbsPool.current.forEach((orb) => {
        if (!orb.active) return;
        ctx.fillStyle = orb.color;
        ctx.shadowColor = orb.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Enemies
      enemiesPool.current.forEach((e) => {
        if (!e.active) return;
        ctx.save();
        ctx.translate(e.x, e.y);

        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = e.isBoss ? 16 : 6;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Health bar for tanky enemies and bosses
        if (e.hp < e.maxHp || e.isBoss) {
          const barW = e.radius * 2;
          const hpPct = Math.max(0, e.hp / e.maxHp);
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(-barW / 2, -e.radius - 8, barW, 4);
          ctx.fillStyle = e.isBoss ? '#f43f5e' : '#22c55e';
          ctx.fillRect(-barW / 2, -e.radius - 8, barW * hpPct, 4);
        }

        ctx.restore();
      });

      // Projectiles
      projectilesPool.current.forEach((p) => {
        if (!p.active || p.type === 'vortex') return;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Orbital Drones
      if (player.droneCount > 0) {
        const droneDist = 55;
        for (let i = 0; i < player.droneCount; i++) {
          const angle = player.droneAngle + (i * Math.PI * 2) / player.droneCount;
          const dx = player.x + Math.cos(angle) * droneDist;
          const dy = player.y + Math.sin(angle) * droneDist;

          ctx.fillStyle = '#06b6d4';
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(dx, dy, 6, 0, Math.PI * 2);
          ctx.fill();

          // Connective laser beam
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(player.x, player.y);
          ctx.lineTo(dx, dy);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // Particles
      particlesPool.current.forEach((p) => {
        if (!p.active) return;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Player Ship
      ctx.save();
      ctx.translate(player.x, player.y);

      // Cosmic Shield Bubble
      if (player.shield > 0) {
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + (player.shield / player.maxShield) * 0.4})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, player.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Ship core
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner cockpit
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    animId = requestAnimationFrame(loop);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [gameState, onGameOver, onScoreUpdate, activeUpgrades, survivalTime]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center select-none bg-[#06070a] font-sans">
      {/* Top Roguelite HUD */}
      <div className="absolute top-2 left-3 right-3 flex flex-col gap-1.5 z-10 pointer-events-none">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
              <Compass size={13} className="text-cyan-400" />
              <span className="text-zinc-400">TIME:</span>
              <span className="text-cyan-400 font-bold">{formatTime(survivalTime)}</span>
            </div>

            <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
              <Crosshair size={13} className="text-rose-400" />
              <span className="text-zinc-400">KILLS:</span>
              <span className="text-white font-bold">{kills}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
              <Shield size={13} className="text-sky-400" />
              <span className="text-zinc-400">HP:</span>
              <span className="text-sky-400 font-bold">{health}/{maxHealth}</span>
            </div>

            <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
              <span className="text-zinc-400">LVL:</span>
              <span className="text-amber-400 font-bold">{level}</span>
            </div>

            <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
              <span className="text-zinc-400">SKOR:</span>
              <span className="text-yellow-400 font-bold">{totalScore}</span>
            </div>
          </div>
        </div>

        {/* Level XP Progress Bar */}
        <div className="w-full h-1.5 bg-zinc-900/80 rounded-full overflow-hidden border border-white/[0.06]">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-200"
            style={{ width: `${Math.min(100, (xp / xpNeeded) * 100)}%` }}
          />
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-full max-w-full max-h-full object-contain rounded-xl"
      />

      {/* Roguelite Level-Up Choice Modal */}
      {gameState === 'levelup' && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 z-30 animate-in zoom-in-95 duration-200">
          <div className="text-center mb-6">
            <span className="text-xs font-mono text-cyan-400 tracking-wider uppercase font-bold">POWER SURGE DETECTED</span>
            <h2 className="text-2xl font-black text-white font-display">PILIH MODIFIKASI LEVEL {level}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
            {levelUpOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => selectUpgrade(opt)}
                className="bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 hover:border-cyan-500/60 p-4 rounded-2xl flex flex-col items-center text-center transition-all cursor-pointer group active:scale-95 shadow-lg shadow-black/50"
              >
                <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-3xl mb-3 group-hover:scale-110 transition-transform">
                  {opt.icon}
                </div>
                <h4 className="text-sm font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">
                  {opt.name}
                </h4>
                <span className="text-[10px] font-mono text-amber-400 font-bold mb-2">
                  TIER {opt.tier}
                </span>
                <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                  {opt.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      <GameOverlay
        gameState={gameState}
        countdown={countdown}
        score={totalScore}
        highScore={highScore}
        onStart={startGame}
        onResume={() => setGameState('playing')}
        onRestart={startGame}
        instructions="WASD / Panah untuk bermanuver. Senjata menembak otomatis. Kumpulkan orbs XP kosmik untuk naik level dan memilih upgrade senjata & sinergi roguellite!"
      />
    </div>
  );
}
