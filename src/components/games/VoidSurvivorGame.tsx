import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useUnifiedInput } from '../../hooks/useUnifiedInput';
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
  active: boolean; x: number; y: number; vx: number; vy: number;
  hp: number; maxHp: number; speed: number; radius: number;
  type: 'crawler' | 'stalker' | 'brute' | 'wraith' | 'boss';
  color: string; shootCooldown?: number; isBoss?: boolean;
}

interface Projectile {
  active: boolean; x: number; y: number; vx: number; vy: number;
  damage: number; radius: number; pierce: number; color: string;
  lifetime: number; isCrit?: boolean;
  type: 'plasma' | 'drone' | 'lightning' | 'vortex' | 'enemy';
}

interface XpOrb {
  active: boolean; x: number; y: number; value: number; color: string; radius: number;
}

interface Particle {
  active: boolean; x: number; y: number; vx: number; vy: number;
  color: string; alpha: number; size: number; decay: number;
}

export default function VoidSurvivorGame({ onGameOver, onScoreUpdate, highScore }: VoidSurvivorGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    gameState,
    setGameState,
    gameStateRef,
    countdown,
    score,
    updateScore,
    addScore,
    triggerGameOver,
    startWithCountdown,
    startLoop,
    stopLoop,
    setupCanvasContext,
    perfSettings
  , gameLoopRef} = useGameEngine({
    onScoreUpdate,
    onGameOver
  });

  const [subState, setSubState] = useState<'levelup' | null>(null);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [xpNeeded, setXpNeeded] = useState(100);
  const [kills, setKills] = useState(0);
  const [survivalTime, setSurvivalTime] = useState(0);
  const [health, setHealth] = useState(100);
  const [maxHealth, setMaxHealth] = useState(100);
  const [activeUpgrades, setActiveUpgrades] = useState<{ [id: string]: number }>({ plasma_cannon: 1 });
  const activeUpgradesRef = useRef<{ [id: string]: number }>({ plasma_cannon: 1 });

  useEffect(() => {
    activeUpgradesRef.current = activeUpgrades;
  }, [activeUpgrades]);

  const [levelUpOptions, setLevelUpOptions] = useState<UpgradeOption[]>([]);

  const secTimerRef = useRef(0);
  const spawnTimerRef = useRef(0);

  const playerRef = useRef({
    x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, vx: 0, vy: 0,
    speed: 3.2, radius: 14, hp: 100, maxHp: 100, shield: 50, maxShield: 50, shieldRegenTimer: 0,
    xp: 0, level: 1, magnetRadius: 100, critChance: 0.1, critMultiplier: 2.0,
    plasmaCooldown: 0, lightningCooldown: 0, vortexCooldown: 0, droneAngle: 0, droneCount: 0,
  });

  const MAX_ENEMIES = perfSettings.tier === 'low' ? 75 : 150;
  const enemiesPool = useRef<Enemy[]>([]);
  const MAX_PROJECTILES = perfSettings.tier === 'low' ? 100 : 200;
  const projectilesPool = useRef<Projectile[]>([]);
  const MAX_ORBS = perfSettings.tier === 'low' ? 90 : 180;
  const orbsPool = useRef<XpOrb[]>([]);
  const MAX_PARTICLES = perfSettings.tier === 'low' ? 75 : 150;
  const particlesPool = useRef<Particle[]>([]);

  useEffect(() => {
    enemiesPool.current = Array.from({ length: MAX_ENEMIES }, () => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, hp: 10, maxHp: 10, speed: 1, radius: 10, type: 'crawler', color: '#a855f7',
    }));
    projectilesPool.current = Array.from({ length: MAX_PROJECTILES }, () => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, damage: 10, radius: 4, pierce: 1, color: '#06b6d4', lifetime: 60, type: 'plasma',
    }));
    orbsPool.current = Array.from({ length: MAX_ORBS }, () => ({
      active: false, x: 0, y: 0, value: 10, color: '#38bdf8', radius: 4,
    }));
    particlesPool.current = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, color: '#fff', alpha: 1, size: 2, decay: 0.02,
    }));
  }, [MAX_ENEMIES, MAX_PROJECTILES, MAX_ORBS, MAX_PARTICLES]);

  const spawnParticle = useCallback((x: number, y: number, color: string, speed = 2, size = 3) => {
    const p = particlesPool.current.find((item) => !item.active);
    if (!p) return;
    const angle = Math.random() * Math.PI * 2;
    const spd = Math.random() * speed + 0.5;
    p.active = true; p.x = x; p.y = y; p.vx = Math.cos(angle) * spd; p.vy = Math.sin(angle) * spd;
    p.color = color; p.alpha = 1; p.size = Math.random() * size + 1; p.decay = Math.random() * 0.02 + 0.02;
  }, []);

  const spawnXpOrb = useCallback((x: number, y: number, value: number) => {
    const orb = orbsPool.current.find((item) => !item.active);
    if (!orb) return;
    orb.active = true; orb.x = x; orb.y = y; orb.value = value;
    orb.color = value >= 50 ? '#f59e0b' : value >= 25 ? '#a855f7' : '#38bdf8';
    orb.radius = value >= 50 ? 6 : 4;
  }, []);

  const spawnEnemy = useCallback((type: 'crawler' | 'stalker' | 'brute' | 'wraith' | 'boss', isBoss = false, currentSurvivalTime: number) => {
    const e = enemiesPool.current.find((item) => !item.active);
    if (!e) return;

    const edge = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    if (edge === 0) { x = Math.random() * CANVAS_WIDTH; y = -20; }
    else if (edge === 1) { x = CANVAS_WIDTH + 20; y = Math.random() * CANVAS_HEIGHT; }
    else if (edge === 2) { x = Math.random() * CANVAS_WIDTH; y = CANVAS_HEIGHT + 20; }
    else { x = -20; y = Math.random() * CANVAS_HEIGHT; }

    e.active = true; e.x = x; e.y = y; e.type = type; e.isBoss = isBoss;
    const waveFactor = 1 + (currentSurvivalTime / 60) * 0.3;

    if (type === 'crawler') { e.hp = Math.round(15 * waveFactor); e.speed = 2.0; e.radius = 9; e.color = '#c084fc'; }
    else if (type === 'stalker') { e.hp = Math.round(30 * waveFactor); e.speed = 1.4; e.radius = 12; e.color = '#38bdf8'; e.shootCooldown = 120; }
    else if (type === 'brute') { e.hp = Math.round(120 * waveFactor); e.speed = 1.0; e.radius = 18; e.color = '#f43f5e'; }
    else if (type === 'wraith') { e.hp = Math.round(45 * waveFactor); e.speed = 2.4; e.radius = 11; e.color = '#10b981'; }
    else if (type === 'boss') { e.hp = Math.round(1500 * waveFactor); e.speed = 1.2; e.radius = 32; e.color = '#e11d48'; e.shootCooldown = 80; }
    e.maxHp = e.hp;
  }, []);

  const spawnProjectile = useCallback((x: number, y: number, vx: number, vy: number, damage: number, type: 'plasma' | 'drone' | 'lightning' | 'vortex' | 'enemy', pierce = 1, color = '#06b6d4', radius = 4) => {
    const p = projectilesPool.current.find((item) => !item.active);
    if (!p) return;
    p.active = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.damage = damage; p.type = type; p.pierce = pierce; p.color = color; p.radius = radius; p.lifetime = 120;
  }, []);

  const triggerLevelUp = useCallback(() => {
    if (gameLoopRef?.current) cancelAnimationFrame(gameLoopRef.current);
    setSubState('levelup');
    setGameState('paused');
    audio.playLevelUp();
    
    const shuffled = [...ALL_UPGRADES].sort(() => 0.5 - Math.random());
    const options = shuffled.slice(0, 3).map((opt) => ({
      ...opt,
      tier: (activeUpgrades[opt.id] || 0) + 1,
    }));
    setLevelUpOptions(options);
  }, [activeUpgrades, setGameState, stopLoop]);

  const selectUpgrade = useCallback((upgrade: UpgradeOption) => {
    setActiveUpgrades((prev) => ({ ...prev, [upgrade.id]: (prev[upgrade.id] || 0) + 1 }));

    const player = playerRef.current;
    if (upgrade.id === 'hyper_thrusters') player.speed += 0.5;
    else if (upgrade.id === 'magnetic_core') player.magnetRadius += 40;
    else if (upgrade.id === 'critical_matrix') { player.critChance += 0.1; player.critMultiplier += 0.4; }
    else if (upgrade.id === 'cosmic_shield') { player.maxShield += 30; player.shield = player.maxShield; }
    else if (upgrade.id === 'orbital_drones') player.droneCount = Math.min(6, (player.droneCount || 0) + 1);

    setSubState(null);
    setGameState('playing');
    audio.playPowerup();
  }, [setGameState]);

  const startGame = useCallback(() => {
    const p = playerRef.current;
    p.x = CANVAS_WIDTH / 2; p.y = CANVAS_HEIGHT / 2;
    p.hp = 100; p.maxHp = 100; p.shield = 50; p.maxShield = 50;
    p.speed = 3.2; p.xp = 0; p.level = 1;
    p.magnetRadius = 100; p.critChance = 0.1; p.critMultiplier = 2.0;
    p.plasmaCooldown = 0; p.lightningCooldown = 0; p.vortexCooldown = 0; p.droneCount = 1;

    enemiesPool.current.forEach((e) => { e.active = false; });
    projectilesPool.current.forEach((pr) => { pr.active = false; });
    orbsPool.current.forEach((o) => { o.active = false; });
    particlesPool.current.forEach((pa) => { pa.active = false; });

    secTimerRef.current = 0;
    spawnTimerRef.current = 0;
    survivalTimeRef.current = 0;
    setSurvivalTime(0);
    setLevel(1);
    setXp(0);
    setXpNeeded(100);
    setKills(0);
    setHealth(100);
    setMaxHealth(100);
    setActiveUpgrades({ plasma_cannon: 1, orbital_drones: 1 });
    activeUpgradesRef.current = { plasma_cannon: 1, orbital_drones: 1 };
    setSubState(null);
    updateScore(0);

    startWithCountdown();
  }, [startWithCountdown, updateScore]);

  useUnifiedInput({
    onActionDown: (action) => {
      if (gameStateRef.current === 'ready') {
        if (action === 'PRIMARY') startGame();
      } else if (gameStateRef.current === 'gameover') {
        if (action === 'PRIMARY' || action === 'RESTART') startGame();
      } else if (gameStateRef.current === 'playing') {
        if (action === 'PAUSE') setGameState('paused');
      } else if (gameStateRef.current === 'paused' && subState !== 'levelup') {
        if (action === 'PAUSE' || action === 'PRIMARY') setGameState('playing');
      }
    },
  });

  const survivalTimeRef = useRef(0);

  // Game Loop
  useEffect(() => {
    if (gameState === 'playing' && subState !== 'levelup') {
      startLoop((timestamp, dtMs) => {
        const dt = dtMs / 1000;
        const ctx = setupCanvasContext(canvasRef.current, CANVAS_WIDTH, CANVAS_HEIGHT);
        if (!ctx) return;

        const player = playerRef.current;

        secTimerRef.current += dt;
        if (secTimerRef.current >= 1.0) {
          secTimerRef.current -= 1.0;
          survivalTimeRef.current++;
          setSurvivalTime(survivalTimeRef.current);
          addScore(10);

          if (survivalTimeRef.current % 120 === 0) {
            spawnEnemy('boss', true, survivalTimeRef.current);
            audio.playExplosion();
          }
        }

        const currentSurvivalTime = survivalTimeRef.current;

        let dx = 0, dy = 0;
        if (inputManager.isActionActive('UP')) dy -= 1;
        if (inputManager.isActionActive('DOWN')) dy += 1;
        if (inputManager.isActionActive('LEFT')) dx -= 1;
        if (inputManager.isActionActive('RIGHT')) dx += 1;

        if (dx !== 0 && dy !== 0) {
          dx *= 0.7071; dy *= 0.7071;
        }

        player.x = Math.max(player.radius, Math.min(CANVAS_WIDTH - player.radius, player.x + dx * player.speed * (dt * 60)));
        player.y = Math.max(player.radius, Math.min(CANVAS_HEIGHT - player.radius, player.y + dy * player.speed * (dt * 60)));

        player.shieldRegenTimer += dt;
        if (player.shieldRegenTimer > 4 && player.shield < player.maxShield) {
          player.shield = Math.min(player.maxShield, player.shield + dt * 10);
        }

        spawnTimerRef.current += dt;
        const spawnInterval = Math.max(0.2, 1.2 - (currentSurvivalTime / 180) * 0.8);
        if (spawnTimerRef.current >= spawnInterval) {
          spawnTimerRef.current = 0;
          const roll = Math.random();
          if (roll < 0.6) spawnEnemy('crawler', false, currentSurvivalTime);
          else if (roll < 0.8) spawnEnemy('stalker', false, currentSurvivalTime);
          else if (roll < 0.92) spawnEnemy('wraith', false, currentSurvivalTime);
          else spawnEnemy('brute', false, currentSurvivalTime);
        }

        // Weapon firing
        const plasmaLvl = activeUpgradesRef.current['plasma_cannon'] || 1;
        player.plasmaCooldown -= dt;
        if (player.plasmaCooldown <= 0) {
          player.plasmaCooldown = Math.max(0.18, 0.45 - plasmaLvl * 0.05);
          let closestEnemy: Enemy | null = null;
          let closestDist = Infinity;
          enemiesPool.current.forEach((e) => {
            if (!e.active) return;
            const dist = Math.hypot(e.x - player.x, e.y - player.y);
            if (dist < closestDist) { closestDist = dist; closestEnemy = e; }
          });

          if (closestEnemy) {
            const angle = Math.atan2((closestEnemy as Enemy).y - player.y, (closestEnemy as Enemy).x - player.x);
            const spd = 9 * (dt * 60);
            const isCrit = Math.random() < player.critChance;
            const dmg = (18 + plasmaLvl * 6) * (isCrit ? player.critMultiplier : 1);
            spawnProjectile(player.x, player.y, Math.cos(angle) * spd, Math.sin(angle) * spd, dmg, 'plasma', plasmaLvl >= 3 ? 2 : 1, isCrit ? '#f59e0b' : '#06b6d4', 5);
            audio.playLaser();
          }
        }

        const lightningLvl = activeUpgradesRef.current['void_lightning'] || 0;
        if (lightningLvl > 0) {
          player.lightningCooldown -= dt;
          if (player.lightningCooldown <= 0) {
            player.lightningCooldown = Math.max(0.8, 2.0 - lightningLvl * 0.25);
            let hitCount = 0;
            enemiesPool.current.forEach((e) => {
              if (!e.active || hitCount >= 2 + lightningLvl) return;
              const dist = Math.hypot(e.x - player.x, e.y - player.y);
              if (dist < 320) {
                e.hp -= 35 + lightningLvl * 12; hitCount++;
                for (let i = 0; i < 4; i++) spawnParticle(e.x, e.y, '#a855f7', 3);
                if (e.hp <= 0) {
                  e.active = false; spawnXpOrb(e.x, e.y, e.type === 'boss' ? 100 : 15);
                  setKills((k) => k + 1);
                }
              }
            });
            if (hitCount > 0) audio.playHit();
          }
        }

        player.droneAngle += dt * 3;

        const vortexLvl = activeUpgradesRef.current['singularity_vortex'] || 0;
        if (vortexLvl > 0) {
          player.vortexCooldown -= dt;
          if (player.vortexCooldown <= 0) {
            player.vortexCooldown = 4.0;
            const activeEnemies = enemiesPool.current.filter((e) => e.active);
            if (activeEnemies.length > 0) {
              const target = activeEnemies[Math.floor(Math.random() * activeEnemies.length)];
              spawnProjectile(target.x, target.y, 0, 0, 15 * vortexLvl, 'vortex', 999, '#a855f7', 40);
            }
          }
        }

        // Projectiles Update
        projectilesPool.current.forEach((p) => {
          if (!p.active) return;
          p.x += p.vx; p.y += p.vy; p.lifetime -= dt * 60;
          if (p.x < -30 || p.x > CANVAS_WIDTH + 30 || p.y < -30 || p.y > CANVAS_HEIGHT + 30 || p.lifetime <= 0) {
            p.active = false; return;
          }

          enemiesPool.current.forEach((e) => {
            if (!e.active || !p.active) return;
            const dist = Math.hypot(e.x - p.x, e.y - p.y);
            if (dist < e.radius + p.radius) {
              e.hp -= p.damage; p.pierce--;
              for (let i = 0; i < 3; i++) spawnParticle(p.x, p.y, p.color, 2);
              if (p.pierce <= 0 && p.type !== 'vortex') p.active = false;
              if (e.hp <= 0) {
                e.active = false; spawnXpOrb(e.x, e.y, e.type === 'boss' ? 200 : e.type === 'brute' ? 40 : 15);
                setKills((k) => k + 1); addScore(e.isBoss ? 500 : 25); audio.playExplosion();
              }
            }
          });
        });

        // Drones Collision
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
                e.hp -= 25 * dt; spawnParticle(dx, dy, '#06b6d4', 1.5);
                if (e.hp <= 0) {
                  e.active = false; spawnXpOrb(e.x, e.y, 20); setKills((k) => k + 1);
                }
              }
            });
          }
        }

        // Enemies Update
        enemiesPool.current.forEach((e) => {
          if (!e.active) return;
          const angle = Math.atan2(player.y - e.y, player.x - e.x);
          e.vx = Math.cos(angle) * e.speed * (dt * 60);
          e.vy = Math.sin(angle) * e.speed * (dt * 60);
          e.x += e.vx; e.y += e.vy;

          if (e.shootCooldown !== undefined) {
            e.shootCooldown -= dt * 60;
            if (e.shootCooldown <= 0) {
              e.shootCooldown = e.type === 'boss' ? 60 : 140;
              const bAngle = Math.atan2(player.y - e.y, player.x - e.x);
              spawnProjectile(e.x, e.y, Math.cos(bAngle) * 4, Math.sin(bAngle) * 4, 12, 'enemy', 1, '#f43f5e', 4);
            }
          }

          const dist = Math.hypot(e.x - player.x, e.y - player.y);
          if (dist < e.radius + player.radius) {
            const dmg = 25 * dt;
            player.shieldRegenTimer = 0;
            if (player.shield > 0) {
              player.shield -= dmg;
              if (player.shield < 0) { player.hp += player.shield; player.shield = 0; }
            } else { player.hp -= dmg; }
            setHealth(Math.max(0, Math.round(player.hp)));
            spawnParticle(player.x, player.y, '#ef4444', 2);
            if (player.hp <= 0) { audio.playGameOver(); triggerGameOver(); }
          }
        });

        // XP Orbs
        orbsPool.current.forEach((orb) => {
          if (!orb.active) return;
          const dist = Math.hypot(player.x - orb.x, player.y - orb.y);
          if (dist < player.magnetRadius) {
            const angle = Math.atan2(player.y - orb.y, player.x - orb.x);
            const pullSpeed = 8 * (dt * 60);
            orb.x += Math.cos(angle) * pullSpeed; orb.y += Math.sin(angle) * pullSpeed;
          }
          if (dist < player.radius + orb.radius + 5) {
            orb.active = false; audio.playCoin();
            player.xp += orb.value; setXp(player.xp);
            const needed = player.level * 120; setXpNeeded(needed);
            if (player.xp >= needed) {
              player.xp -= needed; player.level += 1; setLevel(player.level);
              triggerLevelUp();
            }
          }
        });

        // Particles
        particlesPool.current.forEach((p) => {
          if (!p.active) return;
          p.x += p.vx * (dt * 60); p.y += p.vy * (dt * 60); p.alpha -= p.decay * (dt * 60);
          if (p.alpha <= 0) p.active = false;
        });

        // Render Phase
        ctx.fillStyle = '#06070a';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        for (let i = 0; i < 40; i++) {
          const sx = ((i * 123 + (Date.now() / 80)) % CANVAS_WIDTH);
          const sy = ((i * 321) % CANVAS_HEIGHT);
          ctx.fillRect(sx, sy, 1.5, 1.5);
        }

        projectilesPool.current.forEach((p) => {
          if (!p.active || p.type !== 'vortex') return;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Date.now() / 200);
          const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, p.radius);
          grad.addColorStop(0, 'rgba(168, 85, 247, 0.8)');
          grad.addColorStop(0.5, 'rgba(99, 102, 241, 0.4)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        });

        orbsPool.current.forEach((orb) => {
          if (!orb.active) return;
          ctx.fillStyle = orb.color; ctx.shadowColor = orb.color; ctx.shadowBlur = 6;
          ctx.beginPath(); ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        });

        enemiesPool.current.forEach((e) => {
          if (!e.active) return;
          ctx.save(); ctx.translate(e.x, e.y);
          ctx.fillStyle = e.color; ctx.shadowColor = e.color; ctx.shadowBlur = e.isBoss ? 16 : 6;
          ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

          if (e.hp < e.maxHp || e.isBoss) {
            const barW = e.radius * 2; const hpPct = Math.max(0, e.hp / e.maxHp);
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-barW / 2, -e.radius - 8, barW, 4);
            ctx.fillStyle = e.isBoss ? '#f43f5e' : '#22c55e'; ctx.fillRect(-barW / 2, -e.radius - 8, barW * hpPct, 4);
          }
          ctx.restore();
        });

        projectilesPool.current.forEach((p) => {
          if (!p.active || p.type === 'vortex') return;
          ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        });

        if (player.droneCount > 0) {
          const droneDist = 55;
          for (let i = 0; i < player.droneCount; i++) {
            const angle = player.droneAngle + (i * Math.PI * 2) / player.droneCount;
            const dx = player.x + Math.cos(angle) * droneDist;
            const dy = player.y + Math.sin(angle) * droneDist;
            ctx.fillStyle = '#06b6d4'; ctx.shadowColor = '#06b6d4'; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(dx, dy, 6, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(dx, dy); ctx.stroke(); ctx.shadowBlur = 0;
          }
        }

        particlesPool.current.forEach((p) => {
          if (!p.active) return;
          ctx.fillStyle = p.color; ctx.globalAlpha = p.alpha;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        });

        ctx.save(); ctx.translate(player.x, player.y);
        if (player.shield > 0) {
          ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + (player.shield / player.maxShield) * 0.4})`;
          ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, player.radius + 8, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = '#38bdf8'; ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(0, 0, player.radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();

      });
    }
  }, [gameState, subState, startLoop, setupCanvasContext, addScore, triggerLevelUp, triggerGameOver, spawnEnemy, spawnParticle, spawnProjectile, spawnXpOrb]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60); const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center select-none bg-[#06070a] font-sans">
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
              <span className="text-yellow-400 font-bold">{score}</span>
            </div>
          </div>
        </div>
        <div className="w-full h-1.5 bg-zinc-900/80 rounded-full overflow-hidden border border-white/[0.06]">
          <div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-200" style={{ width: `${Math.min(100, (xp / xpNeeded) * 100)}%` }} />
        </div>
      </div>

      <canvas ref={canvasRef} className="w-full h-full max-w-full max-h-full object-contain rounded-xl" style={{ backgroundColor: '#06070a' }} />

      {subState === 'levelup' && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 z-30 animate-in zoom-in-95 duration-200">
          <div className="text-center mb-6">
            <span className="text-xs font-mono text-cyan-400 tracking-wider uppercase font-bold">POWER SURGE DETECTED</span>
            <h2 className="text-2xl font-black text-white font-display">PILIH MODIFIKASI LEVEL {level}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
            {levelUpOptions.map((opt) => (
              <button key={opt.id} onClick={() => selectUpgrade(opt)} className="bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 hover:border-cyan-500/60 p-4 rounded-2xl flex flex-col items-center text-center transition-all cursor-pointer group active:scale-95 shadow-lg shadow-black/50 pointer-events-auto">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-3xl mb-3 group-hover:scale-110 transition-transform">
                  {opt.icon}
                </div>
                <h4 className="text-sm font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">{opt.name}</h4>
                <span className="text-[10px] font-mono text-amber-400 font-bold mb-2">TIER {opt.tier}</span>
                <p className="text-xs text-zinc-400 leading-relaxed font-sans">{opt.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {subState !== 'levelup' && (
        <GameOverlay
          gameState={gameState}
          countdown={countdown}
          score={score}
          highScore={highScore}
          onStart={startGame}
          onResume={() => setGameState('playing')}
          onRestart={startGame}
          instructions="WASD / Panah untuk bermanuver. Senjata menembak otomatis. Kumpulkan orbs XP kosmik untuk naik level dan memilih upgrade senjata & sinergi roguellite!"
        />
      )}
    </div>
  );
}
