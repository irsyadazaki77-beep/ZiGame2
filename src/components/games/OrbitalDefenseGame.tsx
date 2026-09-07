import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audio } from '../../utils/audio';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Shield, Zap, Crosshair, Play, FastForward, Award, Trash2, ArrowUpCircle } from 'lucide-react';

interface OrbitalDefenseGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

const CANVAS_WIDTH = 880;
const CANVAS_HEIGHT = 500;

export type TowerType = 'laser' | 'missile' | 'tesla' | 'cryo' | 'railgun';

interface TowerDef {
  type: TowerType;
  name: string;
  cost: number;
  range: number;
  damage: number;
  fireRate: number; // shots per sec
  color: string;
  icon: string;
  description: string;
}

const TOWER_TYPES: Record<TowerType, TowerDef> = {
  laser: {
    type: 'laser',
    name: 'Pulse Laser',
    cost: 100,
    range: 130,
    damage: 18,
    fireRate: 3.0,
    color: '#06b6d4',
    icon: '⚡',
    description: 'Tembakan laser beruntun cepat pada target tunggal.',
  },
  missile: {
    type: 'missile',
    name: 'Photon Missile',
    cost: 175,
    range: 180,
    damage: 65,
    fireRate: 0.8,
    color: '#f97316',
    icon: '🚀',
    description: 'Rudal jarak jauh dengan ledakan area (AoE).',
  },
  tesla: {
    type: 'tesla',
    name: 'Tesla Disruptor',
    cost: 225,
    range: 140,
    damage: 32,
    fireRate: 1.5,
    color: '#a855f7',
    icon: '🌩️',
    description: 'Petir tegangan tinggi yang merambat ke musuh di dekatnya.',
  },
  cryo: {
    type: 'cryo',
    name: 'Cryo Field',
    cost: 150,
    range: 110,
    damage: 8,
    fireRate: 2.0,
    color: '#38bdf8',
    icon: '❄️',
    description: 'Pancaran es yang memperlambat laju musuh hingga 50%.',
  },
  railgun: {
    type: 'railgun',
    name: 'Heavy Railgun',
    cost: 300,
    range: 220,
    damage: 140,
    fireRate: 0.5,
    color: '#e11d48',
    icon: '💥',
    description: 'Sinar kinetik berdaya tembus tinggi yang menembus garis musuh.',
  },
};

interface PlacedTower {
  id: number;
  x: number;
  y: number;
  type: TowerType;
  level: number;
  cooldown: number;
  angle: number;
  targetEnemy: Enemy | null;
}

interface Enemy {
  id: number;
  x: number;
  y: number;
  pathIndex: number;
  distanceTraveled: number;
  hp: number;
  maxHp: number;
  speed: number;
  baseSpeed: number;
  slowTimer: number;
  radius: number;
  color: string;
  type: 'scout' | 'frigate' | 'swarm' | 'stealth' | 'dreadnought';
  reward: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  target: Enemy | null;
  targetX: number;
  targetY: number;
  damage: number;
  type: TowerType;
  color: string;
  radius: number;
  lifetime: number;
  splashRadius?: number;
}

interface WaveConfig {
  waveNumber: number;
  enemyCount: number;
  spawnInterval: number;
  types: ('scout' | 'frigate' | 'swarm' | 'stealth' | 'dreadnought')[];
}

const PATH_WAYPOINTS = [
  { x: -20, y: 140 },
  { x: 220, y: 140 },
  { x: 220, y: 360 },
  { x: 460, y: 360 },
  { x: 460, y: 120 },
  { x: 700, y: 120 },
  { x: 700, y: 260 },
  { x: 880, y: 260 },
];

export default function OrbitalDefenseGame({ onGameOver, onScoreUpdate, highScore }: OrbitalDefenseGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [gameState, setGameState] = useState<'ready' | 'countdown' | 'playing' | 'paused' | 'gameover'>('ready');
  const [countdown, setCountdown] = useState(3);
  const [wave, setWave] = useState(1);
  const [maxWaves] = useState(10);
  const [energy, setEnergy] = useState(350);
  const [coreHp, setCoreHp] = useState(100);
  const [maxCoreHp] = useState(100);
  const [gameSpeed, setGameSpeed] = useState<1 | 2>(1);
  const [selectedTowerType, setSelectedTowerType] = useState<TowerType | null>('laser');
  const [selectedPlacedTower, setSelectedPlacedTower] = useState<PlacedTower | null>(null);
  const [isWaveActive, setIsWaveActive] = useState(false);
  const [totalScore, setTotalScore] = useState(0);

  const gameStateRef = useRef(gameState);
  const totalScoreRef = useRef(0);
  const energyRef = useRef(350);
  const coreHpRef = useRef(100);
  const gameSpeedRef = useRef<1 | 2>(1);
  const selectedTowerTypeRef = useRef<TowerType | null>('laser');
  const selectedPlacedTowerRef = useRef<PlacedTower | null>(null);
  const isWaveActiveRef = useRef(false);

  const towersRef = useRef<PlacedTower[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; color: string; alpha: number; size: number }[]>([]);
  const mousePosRef = useRef<{ x: number; y: number; isValid: boolean }>({ x: 0, y: 0, isValid: false });

  const waveQueueRef = useRef<Enemy[]>([]);
  const spawnTimerRef = useRef(0);
  const lastTimeRef = useRef(0);
  const gameLoopRef = useRef<number | null>(null);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { gameSpeedRef.current = gameSpeed; }, [gameSpeed]);
  useEffect(() => { selectedTowerTypeRef.current = selectedTowerType; }, [selectedTowerType]);
  useEffect(() => { selectedPlacedTowerRef.current = selectedPlacedTower; }, [selectedPlacedTower]);

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

  const spawnParticles = (x: number, y: number, color: string, count = 8) => {
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

  const isPositionValidForPlacement = (x: number, y: number): boolean => {
    if (x < 30 || x > CANVAS_WIDTH - 30 || y < 30 || y > CANVAS_HEIGHT - 30) return false;

    // Check distance from path segments
    for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
      const p1 = PATH_WAYPOINTS[i];
      const p2 = PATH_WAYPOINTS[i + 1];

      const A = x - p1.x;
      const B = y - p1.y;
      const C = p2.x - p1.x;
      const D = p2.y - p1.y;
      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = -1;
      if (lenSq !== 0) param = dot / lenSq;

      let xx, yy;
      if (param < 0) { xx = p1.x; yy = p1.y; }
      else if (param > 1) { xx = p2.x; yy = p2.y; }
      else { xx = p1.x + param * C; yy = p1.y + param * D; }

      const dist = Math.hypot(x - xx, y - yy);
      if (dist < 42) return false; // Path clearance
    }

    // Check distance from other towers
    for (const t of towersRef.current) {
      if (Math.hypot(x - t.x, y - t.y) < 38) return false;
    }

    return true;
  };

  const startNextWave = useCallback(() => {
    if (isWaveActiveRef.current || gameStateRef.current !== 'playing') return;

    const currentW = wave;
    const enemyTypes: ('scout' | 'frigate' | 'swarm' | 'stealth' | 'dreadnought')[] = [];
    const count = 10 + currentW * 4;

    for (let i = 0; i < count; i++) {
      if (currentW >= 8 && i === count - 1) {
        enemyTypes.push('dreadnought');
      } else if (currentW >= 5 && Math.random() < 0.25) {
        enemyTypes.push('stealth');
      } else if (currentW >= 3 && Math.random() < 0.3) {
        enemyTypes.push('frigate');
      } else if (Math.random() < 0.4) {
        enemyTypes.push('swarm');
      } else {
        enemyTypes.push('scout');
      }
    }

    const queue: Enemy[] = enemyTypes.map((type, idx) => {
      let hp = 30 + currentW * 15;
      let speed = 1.6;
      let radius = 10;
      let color = '#38bdf8';
      let reward = 15;

      if (type === 'swarm') {
        hp = Math.round(hp * 0.4);
        speed = 2.4;
        radius = 7;
        color = '#a855f7';
        reward = 8;
      } else if (type === 'frigate') {
        hp = Math.round(hp * 2.5);
        speed = 1.0;
        radius = 16;
        color = '#f97316';
        reward = 35;
      } else if (type === 'stealth') {
        hp = Math.round(hp * 1.2);
        speed = 2.0;
        radius = 11;
        color = '#10b981';
        reward = 25;
      } else if (type === 'dreadnought') {
        hp = Math.round(hp * 10);
        speed = 0.7;
        radius = 26;
        color = '#e11d48';
        reward = 150;
      }

      return {
        id: Date.now() + idx,
        x: PATH_WAYPOINTS[0].x,
        y: PATH_WAYPOINTS[0].y,
        pathIndex: 0,
        distanceTraveled: 0,
        hp,
        maxHp: hp,
        speed,
        baseSpeed: speed,
        slowTimer: 0,
        radius,
        color,
        type,
        reward,
      };
    });

    waveQueueRef.current = queue;
    setIsWaveActive(true);
    isWaveActiveRef.current = true;
    audio.playPowerup();
  }, [wave]);

  const startGame = useCallback(() => {
    towersRef.current = [];
    enemiesRef.current = [];
    projectilesRef.current = [];
    particlesRef.current = [];
    waveQueueRef.current = [];

    energyRef.current = 350;
    setEnergy(350);
    coreHpRef.current = 100;
    setCoreHp(100);
    setWave(1);
    setIsWaveActive(false);
    isWaveActiveRef.current = false;
    setSelectedPlacedTower(null);
    totalScoreRef.current = 0;
    setTotalScore(0);

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
          if (action === 'PRIMARY') startNextWave();
        } else if (gameStateRef.current === 'paused') {
          if (action === 'PAUSE' || action === 'PRIMARY') setGameState('playing');
        }
      },
    });
    return () => unsub();
  }, [startGame, startNextWave]);

  // Handle canvas click for placement & selection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Check if clicked an existing tower
    const clickedTower = towersRef.current.find(
      (t) => Math.hypot(t.x - clickX, t.y - clickY) < 22
    );

    if (clickedTower) {
      setSelectedPlacedTower(clickedTower);
      setSelectedTowerType(null);
      audio.playClick();
      return;
    }

    // Attempt to place selected tower type
    if (selectedTowerTypeRef.current) {
      const def = TOWER_TYPES[selectedTowerTypeRef.current];
      if (energyRef.current >= def.cost && isPositionValidForPlacement(clickX, clickY)) {
        energyRef.current -= def.cost;
        setEnergy(energyRef.current);

        towersRef.current.push({
          id: Date.now(),
          x: clickX,
          y: clickY,
          type: def.type,
          level: 1,
          cooldown: 0,
          angle: 0,
          targetEnemy: null,
        });

        spawnParticles(clickX, clickY, def.color, 12);
        audio.playPowerup();
      } else {
        audio.playHit();
      }
    } else {
      setSelectedPlacedTower(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    mousePosRef.current = { x, y, isValid: isPositionValidForPlacement(x, y) };
  };

  const handleUpgradeTower = () => {
    const t = selectedPlacedTowerRef.current;
    if (!t) return;
    const cost = Math.round(TOWER_TYPES[t.type].cost * 0.8 * t.level);
    if (energyRef.current >= cost) {
      energyRef.current -= cost;
      setEnergy(energyRef.current);
      t.level += 1;
      setSelectedPlacedTower({ ...t });
      spawnParticles(t.x, t.y, '#f59e0b', 15);
      audio.playLevelUp();
    }
  };

  const handleSellTower = () => {
    const t = selectedPlacedTowerRef.current;
    if (!t) return;
    const refund = Math.round(TOWER_TYPES[t.type].cost * 0.7 * t.level);
    energyRef.current += refund;
    setEnergy(energyRef.current);
    towersRef.current = towersRef.current.filter((item) => item.id !== t.id);
    setSelectedPlacedTower(null);
    spawnParticles(t.x, t.y, '#94a3b8', 10);
    audio.playCoin();
  };

  // Main 60 FPS requestAnimationFrame loop
  useEffect(() => {
    let animId: number;

    const loop = (timestamp: number) => {
      animId = requestAnimationFrame(loop);
      gameLoopRef.current = animId;

      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const rawDt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      const dt = rawDt * gameSpeedRef.current;
      lastTimeRef.current = timestamp;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // UPDATE PHASE
      if (gameStateRef.current === 'playing') {
        // Wave Spawning
        if (waveQueueRef.current.length > 0) {
          spawnTimerRef.current += dt;
          if (spawnTimerRef.current >= 0.8) {
            spawnTimerRef.current = 0;
            const enemy = waveQueueRef.current.shift();
            if (enemy) enemiesRef.current.push(enemy);
          }
        } else if (isWaveActiveRef.current && enemiesRef.current.length === 0) {
          // Wave Cleared!
          setIsWaveActive(false);
          isWaveActiveRef.current = false;
          const waveReward = 100 + wave * 25;
          energyRef.current += waveReward;
          setEnergy(energyRef.current);

          totalScoreRef.current += wave * 300;
          setTotalScore(totalScoreRef.current);
          onScoreUpdate(totalScoreRef.current);

          if (wave < maxWaves) {
            setWave((w) => w + 1);
            audio.playLevelUp();
          } else {
            // All 10 waves beaten!
            audio.playLevelUp();
            setGameState('gameover');
            onGameOver(totalScoreRef.current);
          }
        }

        // Update Enemies
        enemiesRef.current.forEach((e) => {
          if (e.slowTimer > 0) {
            e.slowTimer -= dt;
            e.speed = e.baseSpeed * 0.5;
          } else {
            e.speed = e.baseSpeed;
          }

          const targetWp = PATH_WAYPOINTS[e.pathIndex + 1];
          if (!targetWp) {
            // Reached Orbital Core!
            coreHpRef.current = Math.max(0, coreHpRef.current - (e.type === 'dreadnought' ? 35 : 10));
            setCoreHp(coreHpRef.current);
            e.hp = 0;
            spawnParticles(e.x, e.y, '#ef4444', 12);
            audio.playHit();

            if (coreHpRef.current <= 0) {
              audio.playGameOver();
              setGameState('gameover');
              onGameOver(totalScoreRef.current);
            }
            return;
          }

          const distToWp = Math.hypot(targetWp.x - e.x, targetWp.y - e.y);
          if (distToWp < e.speed * 60 * dt) {
            e.x = targetWp.x;
            e.y = targetWp.y;
            e.pathIndex++;
          } else {
            const angle = Math.atan2(targetWp.y - e.y, targetWp.x - e.x);
            e.x += Math.cos(angle) * e.speed * 60 * dt;
            e.y += Math.sin(angle) * e.speed * 60 * dt;
            e.distanceTraveled += e.speed * 60 * dt;
          }
        });

        enemiesRef.current = enemiesRef.current.filter((e) => e.hp > 0);

        // Update Towers
        towersRef.current.forEach((tower) => {
          const def = TOWER_TYPES[tower.type];
          const range = def.range * (1 + (tower.level - 1) * 0.15);
          const damage = def.damage * (1 + (tower.level - 1) * 0.35);

          // Find first enemy in range (highest distance traveled)
          let target: Enemy | null = null;
          let maxDist = -1;

          enemiesRef.current.forEach((e) => {
            const d = Math.hypot(e.x - tower.x, e.y - tower.y);
            if (d <= range && e.distanceTraveled > maxDist) {
              maxDist = e.distanceTraveled;
              target = e;
            }
          });

          tower.targetEnemy = target;

          if (target) {
            tower.angle = Math.atan2((target as Enemy).y - tower.y, (target as Enemy).x - tower.x);
            tower.cooldown -= dt;

            if (tower.cooldown <= 0) {
              tower.cooldown = 1 / def.fireRate;

              if (tower.type === 'laser') {
                (target as Enemy).hp -= damage;
                spawnParticles((target as Enemy).x, (target as Enemy).y, def.color, 3);
                audio.playLaser();
              } else if (tower.type === 'missile') {
                projectilesRef.current.push({
                  x: tower.x,
                  y: tower.y,
                  vx: 0,
                  vy: 0,
                  target,
                  targetX: (target as Enemy).x,
                  targetY: (target as Enemy).y,
                  damage,
                  type: 'missile',
                  color: def.color,
                  radius: 5,
                  lifetime: 120,
                  splashRadius: 65,
                });
                audio.playLaser();
              } else if (tower.type === 'tesla') {
                // Arc to target + 2 nearby enemies
                (target as Enemy).hp -= damage;
                spawnParticles((target as Enemy).x, (target as Enemy).y, def.color, 4);

                let chained = 0;
                enemiesRef.current.forEach((ne) => {
                  if (ne !== target && chained < 2 && Math.hypot(ne.x - (target as Enemy).x, ne.y - (target as Enemy).y) < 100) {
                    ne.hp -= damage * 0.7;
                    spawnParticles(ne.x, ne.y, def.color, 3);
                    chained++;
                  }
                });
                audio.playHit();
              } else if (tower.type === 'cryo') {
                // AoE Slow pulse
                enemiesRef.current.forEach((e) => {
                  if (Math.hypot(e.x - tower.x, e.y - tower.y) <= range) {
                    e.hp -= damage;
                    e.slowTimer = 2.0;
                    spawnParticles(e.x, e.y, def.color, 2);
                  }
                });
                audio.playHit();
              } else if (tower.type === 'railgun') {
                // Linear piercing beam
                const angle = tower.angle;
                const endX = tower.x + Math.cos(angle) * range;
                const endY = tower.y + Math.sin(angle) * range;

                enemiesRef.current.forEach((e) => {
                  // Distance to ray segment
                  const A = e.x - tower.x;
                  const B = e.y - tower.y;
                  const C = endX - tower.x;
                  const D = endY - tower.y;
                  const dot = A * C + B * D;
                  const lenSq = C * C + D * D;
                  const param = lenSq !== 0 ? Math.max(0, Math.min(1, dot / lenSq)) : 0;
                  const xx = tower.x + param * C;
                  const yy = tower.y + param * D;

                  if (Math.hypot(e.x - xx, e.y - yy) < e.radius + 10) {
                    e.hp -= damage;
                    spawnParticles(e.x, e.y, def.color, 5);
                  }
                });
                audio.playExplosion();
              }

              // Check kills
              if ((target as Enemy).hp <= 0) {
                energyRef.current += (target as Enemy).reward;
                setEnergy(energyRef.current);
                totalScoreRef.current += (target as Enemy).reward * 5;
                setTotalScore(totalScoreRef.current);
                onScoreUpdate(totalScoreRef.current);
                spawnParticles((target as Enemy).x, (target as Enemy).y, (target as Enemy).color, 10);
              }
            }
          }
        });

        // Update Projectiles
        projectilesRef.current.forEach((p) => {
          if (p.target && p.target.hp > 0) {
            p.targetX = p.target.x;
            p.targetY = p.target.y;
          }

          const angle = Math.atan2(p.targetY - p.y, p.targetX - p.x);
          const spd = 7;
          p.x += Math.cos(angle) * spd;
          p.y += Math.sin(angle) * spd;
          p.lifetime--;

          if (Math.hypot(p.x - p.targetX, p.y - p.targetY) < 10 || p.lifetime <= 0) {
            p.lifetime = 0; // Trigger explosion

            if (p.splashRadius) {
              enemiesRef.current.forEach((e) => {
                const dist = Math.hypot(e.x - p.x, e.y - p.y);
                if (dist <= p.splashRadius!) {
                  e.hp -= p.damage * (1 - dist / p.splashRadius!);
                  if (e.hp <= 0) {
                    energyRef.current += e.reward;
                    setEnergy(energyRef.current);
                    totalScoreRef.current += e.reward * 5;
                    setTotalScore(totalScoreRef.current);
                    onScoreUpdate(totalScoreRef.current);
                  }
                }
              });
              spawnParticles(p.x, p.y, p.color, 16);
              audio.playExplosion();
            }
          }
        });

        projectilesRef.current = projectilesRef.current.filter((p) => p.lifetime > 0);

        // Update Particles
        particlesRef.current = particlesRef.current.filter((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.025;
          return p.alpha > 0;
        });
      }

      // RENDER PHASE
      ctx.fillStyle = '#07090e';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Orbital Grid Background
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

      // Path Track
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.18)';
      ctx.lineWidth = 32;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      PATH_WAYPOINTS.forEach((wp, idx) => {
        if (idx === 0) ctx.moveTo(wp.x, wp.y);
        else ctx.lineTo(wp.x, wp.y);
      });
      ctx.stroke();

      ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      PATH_WAYPOINTS.forEach((wp, idx) => {
        if (idx === 0) ctx.moveTo(wp.x, wp.y);
        else ctx.lineTo(wp.x, wp.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // Orbital Core Station (End of path)
      const coreEnd = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(coreEnd.x - 20, coreEnd.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Core Health Bar
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(coreEnd.x - 45, coreEnd.y - 35, 50, 6);
      ctx.fillStyle = coreHpRef.current > 30 ? '#22c55e' : '#ef4444';
      ctx.fillRect(coreEnd.x - 45, coreEnd.y - 35, (coreHpRef.current / maxCoreHp) * 50, 6);

      // Selected Tower Range Circle (if placed tower is selected)
      if (selectedPlacedTowerRef.current) {
        const t = selectedPlacedTowerRef.current;
        const def = TOWER_TYPES[t.type];
        const range = def.range * (1 + (t.level - 1) * 0.15);

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(t.x, t.y, range, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Tower Placement Preview Ghost (on mouse hover)
      if (selectedTowerTypeRef.current && mousePosRef.current.x > 0) {
        const { x, y, isValid } = mousePosRef.current;
        const def = TOWER_TYPES[selectedTowerTypeRef.current];

        ctx.strokeStyle = isValid ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)';
        ctx.fillStyle = isValid ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, def.range, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isValid ? def.color : '#ef4444';
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      // Placed Towers
      towersRef.current.forEach((t) => {
        const def = TOWER_TYPES[t.type];
        ctx.save();
        ctx.translate(t.x, t.y);

        // Tower Base
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Tower Turret Barrel
        ctx.rotate(t.angle);
        ctx.fillStyle = def.color;
        ctx.fillRect(0, -3, 14, 6);

        // Level indicator
        ctx.rotate(-t.angle);
        if (t.level > 1) {
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`L${t.level}`, 0, 4);
        }

        ctx.restore();

        // Instant Laser Beam Render
        if (t.type === 'laser' && t.targetEnemy && t.cooldown > 0.2) {
          ctx.strokeStyle = def.color;
          ctx.shadowColor = def.color;
          ctx.shadowBlur = 8;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(t.x, t.y);
          ctx.lineTo(t.targetEnemy.x, t.targetEnemy.y);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });

      // Enemies
      enemiesRef.current.forEach((e) => {
        ctx.save();
        ctx.translate(e.x, e.y);

        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = e.type === 'dreadnought' ? 14 : 6;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Health bar
        const barW = e.radius * 2;
        const hpPct = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(-barW / 2, -e.radius - 6, barW, 3);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(-barW / 2, -e.radius - 6, barW * hpPct, 3);

        ctx.restore();
      });

      // Projectiles
      projectilesRef.current.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Particles
      particlesRef.current.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    };

    animId = requestAnimationFrame(loop);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [gameState, onGameOver, onScoreUpdate, wave, maxWaves]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between select-none bg-[#07090e] font-sans">
      {/* Top Tactical HUD */}
      <div className="w-full flex items-center justify-between px-3 py-2 z-10 text-xs font-mono bg-zinc-950/80 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
            <Shield size={13} className="text-emerald-400" />
            <span className="text-zinc-400">CORE HP:</span>
            <span className="text-emerald-400 font-bold">{coreHp}%</span>
          </div>

          <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
            <Zap size={13} className="text-yellow-400" />
            <span className="text-zinc-400">ENERGY:</span>
            <span className="text-yellow-400 font-bold">{energy}</span>
          </div>

          <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
            <span className="text-zinc-400">GELOMBANG:</span>
            <span className="text-cyan-400 font-bold">{wave}/{maxWaves}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Speed Toggle */}
          <button
            onClick={() => setGameSpeed((s) => (s === 1 ? 2 : 1))}
            className={`px-3 py-1 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer border ${
              gameSpeed === 2 ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-zinc-900 border-white/10 text-zinc-400'
            }`}
          >
            <FastForward size={13} /> {gameSpeed}x
          </button>

          {/* Wave Trigger Button */}
          {!isWaveActive && (
            <button
              onClick={startNextWave}
              className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-600/30 active:scale-95"
            >
              <Play size={13} fill="currentColor" /> Mulai Wave
            </button>
          )}

          <div className="px-3 py-1 bg-zinc-900/90 border border-white/10 rounded-xl flex items-center gap-2">
            <span className="text-zinc-400">SKOR:</span>
            <span className="text-yellow-400 font-bold">{totalScore}</span>
          </div>
        </div>
      </div>

      {/* Main Tactical Canvas */}
      <div className="flex-1 w-full relative min-h-0 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          className="w-full h-full max-w-full max-h-full object-contain cursor-pointer rounded-xl"
        />
      </div>

      {/* Bottom Tower Dock & Upgrade Controls */}
      <div className="w-full p-2 bg-zinc-950/90 border-t border-white/[0.06] flex items-center justify-between gap-3 z-10">
        {selectedPlacedTower ? (
          <div className="flex items-center gap-3 w-full justify-between px-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-lg">
                {TOWER_TYPES[selectedPlacedTower.type].icon}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">
                  {TOWER_TYPES[selectedPlacedTower.type].name} (Level {selectedPlacedTower.level})
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  Range: {TOWER_TYPES[selectedPlacedTower.type].range * (1 + (selectedPlacedTower.level - 1) * 0.15)}px
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleUpgradeTower}
                disabled={energy < Math.round(TOWER_TYPES[selectedPlacedTower.type].cost * 0.8 * selectedPlacedTower.level)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 transition cursor-pointer"
              >
                <ArrowUpCircle size={14} /> Upgrade ({Math.round(TOWER_TYPES[selectedPlacedTower.type].cost * 0.8 * selectedPlacedTower.level)}⚡)
              </button>

              <button
                onClick={handleSellTower}
                className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 size={14} /> Jual (+{Math.round(TOWER_TYPES[selectedPlacedTower.type].cost * 0.7 * selectedPlacedTower.level)}⚡)
              </button>

              <button
                onClick={() => setSelectedPlacedTower(null)}
                className="px-2.5 py-1.5 bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs transition cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto py-1 w-full justify-center">
            {Object.values(TOWER_TYPES).map((def) => {
              const isSelected = selectedTowerType === def.type;
              const canAfford = energy >= def.cost;

              return (
                <button
                  key={def.type}
                  onClick={() => {
                    setSelectedTowerType(def.type);
                    setSelectedPlacedTower(null);
                  }}
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600/30 border-cyan-400 text-white shadow-md shadow-cyan-500/20'
                      : canAfford
                      ? 'bg-zinc-900/80 border-white/10 hover:border-white/20 text-zinc-300'
                      : 'bg-zinc-900/40 border-white/5 text-zinc-600 opacity-60'
                  }`}
                >
                  <span className="text-base">{def.icon}</span>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold leading-tight">{def.name}</span>
                    <span className="text-[10px] font-mono text-yellow-400 font-bold">{def.cost}⚡</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <GameOverlay
        gameState={gameState}
        countdown={countdown}
        score={totalScore}
        highScore={highScore}
        onStart={startGame}
        onResume={() => setGameState('playing')}
        onRestart={startGame}
        instructions="Pilih menara pertahanan dan klik pada area orbit untuk menempatkannya. Tekan Mulai Wave untuk meluncurkan serangan musuh. Pertahankan Stasiun Inti dari 10 gelombang armada musuh!"
      />
    </div>
  );
}
