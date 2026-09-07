import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Compass, Clock, Award, RotateCcw, Zap, Sparkles, Flag } from 'lucide-react';

interface GravityShiftGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

const CANVAS_WIDTH = 850;
const CANVAS_HEIGHT = 480;

interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'solid' | 'crumble' | 'moving' | 'boost';
  vx?: number;
  minX?: number;
  maxX?: number;
  crumbleTimer?: number;
  crumbled?: boolean;
}

interface Hazard {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'spike_up' | 'spike_down' | 'laser';
  laserActive?: boolean;
  cycleTimer?: number;
}

interface Collectible {
  id: number;
  x: number;
  y: number;
  collected: boolean;
}

interface InversionOrb {
  x: number;
  y: number;
  radius: number;
  cooldown: number;
}

interface Checkpoint {
  x: number;
  y: number;
  activated: boolean;
}

interface LevelDef {
  level: number;
  name: string;
  playerStart: { x: number; y: number };
  goal: { x: number; y: number; w: number; h: number };
  platforms: Platform[];
  hazards: Hazard[];
  collectibles: Collectible[];
  orbs: InversionOrb[];
  checkpoints: Checkpoint[];
}

const generateLevels = (): LevelDef[] => [
  {
    level: 1,
    name: 'SEKTOR 1: ZERO-G PROTOCOL',
    playerStart: { x: 50, y: 380 },
    goal: { x: 780, y: 360, w: 40, h: 60 },
    platforms: [
      { x: 0, y: 420, w: 850, h: 60, type: 'solid' }, // Floor
      { x: 0, y: 0, w: 850, h: 40, type: 'solid' }, // Ceiling
      { x: 180, y: 300, w: 100, h: 20, type: 'solid' },
      { x: 340, y: 160, w: 120, h: 20, type: 'solid' },
      { x: 520, y: 300, w: 100, h: 20, type: 'solid' },
      { x: 670, y: 220, w: 80, h: 20, type: 'solid' },
    ],
    hazards: [
      { x: 260, y: 400, w: 60, h: 20, type: 'spike_up' },
      { x: 420, y: 40, w: 80, h: 20, type: 'spike_down' },
      { x: 590, y: 400, w: 60, h: 20, type: 'spike_up' },
    ],
    collectibles: [
      { id: 1, x: 230, y: 260, collected: false },
      { id: 2, x: 400, y: 120, collected: false },
      { id: 3, x: 570, y: 260, collected: false },
    ],
    orbs: [
      { x: 300, y: 250, radius: 14, cooldown: 0 },
    ],
    checkpoints: [
      { x: 480, y: 380, activated: false },
    ],
  },
  {
    level: 2,
    name: 'SEKTOR 2: LASER CORRIDORS',
    playerStart: { x: 50, y: 380 },
    goal: { x: 780, y: 80, w: 40, h: 60 },
    platforms: [
      { x: 0, y: 420, w: 850, h: 60, type: 'solid' },
      { x: 0, y: 0, w: 850, h: 40, type: 'solid' },
      { x: 140, y: 280, w: 80, h: 18, type: 'solid' },
      { x: 280, y: 180, w: 90, h: 18, type: 'moving', vx: 1.2, minX: 260, maxX: 380 },
      { x: 440, y: 300, w: 80, h: 18, type: 'crumble', crumbleTimer: 0, crumbled: false },
      { x: 580, y: 160, w: 100, h: 18, type: 'solid' },
      { x: 720, y: 140, w: 100, h: 20, type: 'solid' },
    ],
    hazards: [
      { x: 200, y: 400, w: 90, h: 20, type: 'spike_up' },
      { x: 350, y: 40, w: 80, h: 20, type: 'spike_down' },
      { x: 500, y: 400, w: 100, h: 20, type: 'spike_up' },
      { x: 380, y: 40, w: 12, h: 380, type: 'laser', laserActive: true, cycleTimer: 0 },
      { x: 660, y: 40, w: 12, h: 380, type: 'laser', laserActive: true, cycleTimer: 1200 },
    ],
    collectibles: [
      { id: 1, x: 180, y: 240, collected: false },
      { id: 2, x: 480, y: 260, collected: false },
      { id: 3, x: 630, y: 120, collected: false },
    ],
    orbs: [
      { x: 220, y: 200, radius: 14, cooldown: 0 },
      { x: 540, y: 220, radius: 14, cooldown: 0 },
    ],
    checkpoints: [
      { x: 420, y: 380, activated: false },
    ],
  },
  {
    level: 3,
    name: 'SEKTOR 3: QUANTUM MATRIX',
    playerStart: { x: 50, y: 380 },
    goal: { x: 780, y: 360, w: 40, h: 60 },
    platforms: [
      { x: 0, y: 420, w: 850, h: 60, type: 'solid' },
      { x: 0, y: 0, w: 850, h: 40, type: 'solid' },
      { x: 120, y: 320, w: 60, h: 18, type: 'crumble', crumbleTimer: 0, crumbled: false },
      { x: 220, y: 200, w: 80, h: 18, type: 'moving', vx: 1.5, minX: 200, maxX: 340 },
      { x: 380, y: 140, w: 70, h: 18, type: 'boost' },
      { x: 500, y: 260, w: 80, h: 18, type: 'solid' },
      { x: 620, y: 180, w: 70, h: 18, type: 'moving', vx: -1.5, minX: 600, maxX: 720 },
      { x: 740, y: 320, w: 80, h: 20, type: 'solid' },
    ],
    hazards: [
      { x: 160, y: 400, w: 120, h: 20, type: 'spike_up' },
      { x: 320, y: 40, w: 100, h: 20, type: 'spike_down' },
      { x: 460, y: 400, w: 140, h: 20, type: 'spike_up' },
      { x: 600, y: 40, w: 100, h: 20, type: 'spike_down' },
      { x: 290, y: 40, w: 12, h: 380, type: 'laser', laserActive: true, cycleTimer: 600 },
      { x: 560, y: 40, w: 12, h: 380, type: 'laser', laserActive: true, cycleTimer: 1800 },
    ],
    collectibles: [
      { id: 1, x: 150, y: 280, collected: false },
      { id: 2, x: 415, y: 100, collected: false },
      { id: 3, x: 655, y: 140, collected: false },
    ],
    orbs: [
      { x: 340, y: 220, radius: 14, cooldown: 0 },
      { x: 480, y: 180, radius: 14, cooldown: 0 },
      { x: 680, y: 240, radius: 14, cooldown: 0 },
    ],
    checkpoints: [
      { x: 360, y: 100, activated: false },
      { x: 600, y: 380, activated: false },
    ],
  },
];

export default function GravityShiftGame({ onGameOver, onScoreUpdate, highScore }: GravityShiftGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [gameState, setGameState] = useState<'ready' | 'countdown' | 'playing' | 'paused' | 'gameover'>('ready');
  const [countdown, setCountdown] = useState(3);
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [shardsCollected, setShardsCollected] = useState(0);
  const [totalShards, setTotalShards] = useState(3);
  const [deathCount, setDeathCount] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [gravityDir, setGravityDir] = useState<1 | -1>(1); // 1: Down, -1: Up
  const [totalScore, setTotalScore] = useState(0);

  const gameStateRef = useRef(gameState);
  const totalScoreRef = useRef(0);
  const gravityDirRef = useRef<1 | -1>(1);
  const lastTimeRef = useRef(0);
  const gameLoopRef = useRef<number | null>(null);
  const keysRef = useRef<{ [key: string]: boolean }>({});

  const levelsRef = useRef<LevelDef[]>(generateLevels());
  const currentLevelRef = useRef<LevelDef>(levelsRef.current[0]);
  const lastCheckpointRef = useRef<{ x: number; y: number; gravity: 1 | -1 }>({ x: 50, y: 380, gravity: 1 });

  // Player physics ref
  const playerRef = useRef({
    x: 50,
    y: 380,
    vx: 0,
    vy: 0,
    w: 20,
    h: 28,
    speed: 4.0,
    jumpForce: 7.5,
    isGrounded: false,
    color: '#06b6d4',
  });

  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; color: string; alpha: number; size: number }[]>([]);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { gravityDirRef.current = gravityDir; }, [gravityDir]);

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

  const spawnParticles = (x: number, y: number, color: string, count = 10) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 3 + 1;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color,
        alpha: 1,
        size: Math.random() * 3 + 1,
      });
    }
  };

  const flipGravity = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    const player = playerRef.current;
    if (!player.isGrounded) return; // Only flip when on a surface

    const nextG: 1 | -1 = gravityDirRef.current === 1 ? -1 : 1;
    gravityDirRef.current = nextG;
    setGravityDir(nextG);
    player.vy = nextG * 3; // impulse
    player.isGrounded = false;
    spawnParticles(player.x + player.w / 2, player.y + (nextG === 1 ? 0 : player.h), '#06b6d4', 12);
    audio.playLaser();
  }, []);

  const respawnAtCheckpoint = () => {
    const cp = lastCheckpointRef.current;
    const p = playerRef.current;
    p.x = cp.x;
    p.y = cp.y;
    p.vx = 0;
    p.vy = 0;
    gravityDirRef.current = cp.gravity;
    setGravityDir(cp.gravity);
    setDeathCount((d) => d + 1);
    spawnParticles(p.x, p.y, '#ef4444', 20);
    audio.playExplosion();
  };

  const initLevel = useCallback((lvlIndex: number) => {
    const lvl = JSON.parse(JSON.stringify(levelsRef.current[lvlIndex % levelsRef.current.length])) as LevelDef;
    currentLevelRef.current = lvl;
    setCurrentLevelIndex(lvlIndex);

    const p = playerRef.current;
    p.x = lvl.playerStart.x;
    p.y = lvl.playerStart.y;
    p.vx = 0;
    p.vy = 0;
    gravityDirRef.current = 1;
    setGravityDir(1);
    lastCheckpointRef.current = { x: lvl.playerStart.x, y: lvl.playerStart.y, gravity: 1 };

    setShardsCollected(0);
    setTotalShards(lvl.collectibles.length);
  }, []);

  const startGame = useCallback(() => {
    levelsRef.current = generateLevels();
    initLevel(0);
    setDeathCount(0);
    setElapsedMs(0);
    totalScoreRef.current = 0;
    setTotalScore(0);

    setGameState('countdown');
    setCountdown(3);
    audio.playCountdown();
  }, [initLevel]);

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
          if (action === 'PRIMARY' || action === 'UP') flipGravity();
        } else if (gameStateRef.current === 'paused') {
          if (action === 'PAUSE' || action === 'PRIMARY') setGameState('playing');
        }
      },
      onRawKey: (key, isDown) => {
        keysRef.current[key.toLowerCase()] = isDown;
        keysRef.current[key] = isDown;
        if (isDown && (key === ' ' || key === 'Space' || key === 'ArrowUp' || key === 'w' || key === 'W')) {
          flipGravity();
        }
      },
    });
    return () => unsub();
  }, [startGame, flipGravity]);

  // Main 60 FPS requestAnimationFrame loop
  useEffect(() => {
    let animId: number;

    const loop = (timestamp: number) => {
      animId = requestAnimationFrame(loop);
      gameLoopRef.current = animId;

      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const lvl = currentLevelRef.current;
      const player = playerRef.current;
      const gDir = gravityDirRef.current;

      // UPDATE PHASE
      if (gameStateRef.current === 'playing') {
        setElapsedMs((ms) => ms + dt * 1000);

        // Horizontal Movement
        let moveDir = 0;
        const keys = keysRef.current;
        if (keys['a'] || keys['arrowleft']) moveDir -= 1;
        if (keys['d'] || keys['arrowright']) moveDir += 1;

        player.vx = moveDir * player.speed;

        // Apply Gravity Acceleration
        const gravityAccel = 18.0 * gDir;
        player.vy += gravityAccel * dt;

        // Cap terminal velocity
        if (Math.abs(player.vy) > 14) {
          player.vy = Math.sign(player.vy) * 14;
        }

        const newX = player.x + player.vx;
        let newY = player.y + player.vy;

        // Platform collision checks
        player.isGrounded = false;

        lvl.platforms.forEach((plat) => {
          if (plat.crumbled) return;

          // Update moving platform
          if (plat.type === 'moving' && plat.vx && plat.minX !== undefined && plat.maxX !== undefined) {
            plat.x += plat.vx;
            if (plat.x > plat.maxX || plat.x < plat.minX) plat.vx *= -1;
          }

          // Check AABB overlap
          if (
            newX + player.w > plat.x &&
            newX < plat.x + plat.w &&
            newY + player.h > plat.y &&
            newY < plat.y + plat.h
          ) {
            if (gDir === 1) {
              // Normal gravity: land on top of platform
              if (player.y + player.h <= plat.y + 12 && player.vy >= 0) {
                newY = plat.y - player.h;
                player.vy = 0;
                player.isGrounded = true;

                if (plat.type === 'crumble') {
                  plat.crumbleTimer = (plat.crumbleTimer || 0) + dt;
                  if (plat.crumbleTimer > 0.6) {
                    plat.crumbled = true;
                    spawnParticles(plat.x + plat.w / 2, plat.y, '#eab308', 12);
                    audio.playHit();
                  }
                } else if (plat.type === 'boost') {
                  player.vy = -18;
                  spawnParticles(player.x + player.w / 2, player.y + player.h, '#06b6d4', 16);
                  audio.playPowerup();
                }
              }
            } else {
              // Inverted gravity: land on bottom of platform
              if (player.y >= plat.y + plat.h - 12 && player.vy <= 0) {
                newY = plat.y + plat.h;
                player.vy = 0;
                player.isGrounded = true;

                if (plat.type === 'crumble') {
                  plat.crumbleTimer = (plat.crumbleTimer || 0) + dt;
                  if (plat.crumbleTimer > 0.6) {
                    plat.crumbled = true;
                    spawnParticles(plat.x + plat.w / 2, plat.y + plat.h, '#eab308', 12);
                    audio.playHit();
                  }
                } else if (plat.type === 'boost') {
                  player.vy = 18;
                  spawnParticles(player.x + player.w / 2, player.y, '#06b6d4', 16);
                  audio.playPowerup();
                }
              }
            }
          }
        });

        player.x = Math.max(0, Math.min(CANVAS_WIDTH - player.w, newX));
        player.y = newY;

        // Fall out of bounds
        if (player.y < -50 || player.y > CANVAS_HEIGHT + 50) {
          respawnAtCheckpoint();
        }

        // Hazards Collision (Spikes & Lasers)
        lvl.hazards.forEach((h) => {
          if (h.type === 'laser') {
            h.cycleTimer = ((h.cycleTimer || 0) + dt * 1000) % 2400;
            h.laserActive = h.cycleTimer < 1400;
            if (!h.laserActive) return;
          }

          if (
            player.x + player.w > h.x &&
            player.x < h.x + h.w &&
            player.y + player.h > h.y &&
            player.y < h.y + h.h
          ) {
            respawnAtCheckpoint();
          }
        });

        // Inversion Orbs Collision (Trigger mid-air flip)
        lvl.orbs.forEach((orb) => {
          if (orb.cooldown > 0) {
            orb.cooldown -= dt;
            return;
          }

          const centerX = player.x + player.w / 2;
          const centerY = player.y + player.h / 2;
          const dist = Math.hypot(centerX - orb.x, centerY - orb.y);

          if (dist < orb.radius + 12) {
            const nextG: 1 | -1 = gravityDirRef.current === 1 ? -1 : 1;
            gravityDirRef.current = nextG;
            setGravityDir(nextG);
            player.vy = nextG * 6;
            orb.cooldown = 1.0;
            spawnParticles(orb.x, orb.y, '#a855f7', 15);
            audio.playPowerup();
          }
        });

        // Collectibles Collision
        lvl.collectibles.forEach((col) => {
          if (col.collected) return;
          const centerX = player.x + player.w / 2;
          const centerY = player.y + player.h / 2;
          if (Math.hypot(centerX - col.x, centerY - col.y) < 20) {
            col.collected = true;
            setShardsCollected((s) => s + 1);
            totalScoreRef.current += 200;
            setTotalScore(totalScoreRef.current);
            onScoreUpdate(totalScoreRef.current);
            spawnParticles(col.x, col.y, '#f59e0b', 12);
            audio.playCoin();
          }
        });

        // Checkpoint Collision
        lvl.checkpoints.forEach((cp) => {
          if (
            player.x + player.w > cp.x - 20 &&
            player.x < cp.x + 20 &&
            player.y + player.h > cp.y - 20 &&
            player.y < cp.y + 20
          ) {
            if (!cp.activated) {
              cp.activated = true;
              lastCheckpointRef.current = { x: cp.x, y: cp.y, gravity: gDir };
              spawnParticles(cp.x, cp.y, '#10b981', 15);
              audio.playPowerup();
            }
          }
        });

        // Goal reached
        const goal = lvl.goal;
        if (
          player.x + player.w > goal.x &&
          player.x < goal.x + goal.w &&
          player.y + player.h > goal.y &&
          player.y < goal.y + goal.h
        ) {
          audio.playLevelUp();
          const levelClearScore = 1000 + Math.max(0, 500 - deathCount * 50);
          totalScoreRef.current += levelClearScore;
          setTotalScore(totalScoreRef.current);
          onScoreUpdate(totalScoreRef.current);

          if (currentLevelIndex + 1 < levelsRef.current.length) {
            initLevel(currentLevelIndex + 1);
          } else {
            // Game Beat!
            setGameState('gameover');
            onGameOver(totalScoreRef.current);
          }
        }

        // Update Particles
        particlesRef.current = particlesRef.current.filter((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.025;
          return p.alpha > 0;
        });
      }

      // RENDER PHASE
      ctx.fillStyle = '#090b11';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Neon Grid Background
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < CANVAS_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // Platforms
      lvl.platforms.forEach((plat) => {
        if (plat.crumbled) return;

        if (plat.type === 'solid') {
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        } else if (plat.type === 'moving') {
          ctx.fillStyle = '#1e1b4b';
          ctx.strokeStyle = '#818cf8';
          ctx.lineWidth = 2;
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        } else if (plat.type === 'crumble') {
          ctx.fillStyle = plat.crumbleTimer ? '#78350f' : '#451a03';
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        } else if (plat.type === 'boost') {
          ctx.fillStyle = '#064e3b';
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 2;
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        }
      });

      // Hazards
      lvl.hazards.forEach((h) => {
        if (h.type === 'spike_up') {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          const spikes = Math.floor(h.w / 14);
          for (let i = 0; i < spikes; i++) {
            const sx = h.x + i * 14;
            ctx.moveTo(sx, h.y + h.h);
            ctx.lineTo(sx + 7, h.y);
            ctx.lineTo(sx + 14, h.y + h.h);
          }
          ctx.fill();
        } else if (h.type === 'spike_down') {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          const spikes = Math.floor(h.w / 14);
          for (let i = 0; i < spikes; i++) {
            const sx = h.x + i * 14;
            ctx.moveTo(sx, h.y);
            ctx.lineTo(sx + 7, h.y + h.h);
            ctx.lineTo(sx + 14, h.y);
          }
          ctx.fill();
        } else if (h.type === 'laser' && h.laserActive) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 12;
          ctx.fillRect(h.x, h.y, h.w, h.h);
          ctx.shadowBlur = 0;
        }
      });

      // Inversion Orbs
      lvl.orbs.forEach((orb) => {
        ctx.fillStyle = orb.cooldown > 0 ? '#475569' : '#a855f7';
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = orb.cooldown > 0 ? 0 : 12;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Rotating ring
        if (orb.cooldown <= 0) {
          ctx.strokeStyle = '#e9d5ff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(orb.x, orb.y, orb.radius + 5 + Math.sin(Date.now() / 150) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      // Collectibles (Shards)
      lvl.collectibles.forEach((col) => {
        if (col.collected) return;
        ctx.save();
        ctx.translate(col.x, col.y);
        ctx.rotate(Date.now() / 300);

        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 8;
        ctx.fillRect(-6, -6, 12, 12);
        ctx.shadowBlur = 0;

        ctx.restore();
      });

      // Checkpoints
      lvl.checkpoints.forEach((cp) => {
        ctx.fillStyle = cp.activated ? '#10b981' : '#64748b';
        ctx.shadowColor = cp.activated ? '#10b981' : 'transparent';
        ctx.shadowBlur = cp.activated ? 10 : 0;
        ctx.fillRect(cp.x - 4, cp.y - 20, 8, 40);
        ctx.shadowBlur = 0;
      });

      // Goal Portal
      const goal = lvl.goal;
      ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
      ctx.strokeRect(goal.x, goal.y, goal.w, goal.h);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PORTAL', goal.x + goal.w / 2, goal.y + goal.h / 2 + 3);

      // Particles
      particlesRef.current.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Player Runner
      ctx.save();
      ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
      ctx.scale(1, gDir); // Flip rendering when gravity is inverted

      ctx.fillStyle = '#06b6d4';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 10;
      ctx.fillRect(-player.w / 2, -player.h / 2, player.w, player.h);
      ctx.shadowBlur = 0;

      // Runner Visor
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(player.vx >= 0 ? 2 : -8, -player.h / 2 + 4, 6, 6);

      ctx.restore();
    };

    animId = requestAnimationFrame(loop);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [gameState, onGameOver, onScoreUpdate, currentLevelIndex, deathCount, initLevel]);

  const formatTimer = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const mill = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${mill.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center select-none bg-[#090b11] font-sans">
      {/* Top Precision Speedrun HUD */}
      <div className="absolute top-2 left-3 right-3 flex items-center justify-between z-10 pointer-events-none text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
            <span className="text-zinc-400">STAGE:</span>
            <span className="text-cyan-400 font-bold">{currentLevelRef.current.name}</span>
          </div>

          <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
            <Clock size={13} className="text-emerald-400" />
            <span className="text-white font-bold">{formatTimer(elapsedMs)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
            <Sparkles size={13} className="text-amber-400" />
            <span className="text-zinc-400">SHARDS:</span>
            <span className="text-amber-400 font-bold">{shardsCollected}/{totalShards}</span>
          </div>

          <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
            <span className="text-zinc-400">GRAVITY:</span>
            <span className={`font-bold ${gravityDir === 1 ? 'text-sky-400' : 'text-purple-400'}`}>
              {gravityDir === 1 ? 'DOWN ↓' : 'UP ↑'}
            </span>
          </div>

          <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
            <span className="text-zinc-400">DEATHS:</span>
            <span className="text-rose-400 font-bold">{deathCount}</span>
          </div>

          <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
            <span className="text-zinc-400">SKOR:</span>
            <span className="text-yellow-400 font-bold">{totalScore}</span>
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-full max-w-full max-h-full object-contain rounded-xl cursor-default"
      />

      <GameOverlay
        gameState={gameState}
        countdown={countdown}
        score={totalScore}
        highScore={highScore}
        onStart={startGame}
        onResume={() => setGameState('playing')}
        onRestart={startGame}
        instructions="A / D atau Panah Kiri/Kanan untuk berlari. Tekan SPASI / Panah Atas saat berpijak untuk membalikkan gravitasi ke atas/bawah! Hindari duri dan laser!"
      />
    </div>
  );
}
