import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameComponentProps } from '../../types';
import { audioController } from '../../sdk/audioController';
import { ObjectPool } from '../../sdk/objectPool';
import { useGameEngine } from '../../hooks/useGameEngine';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { ThreeDockOverlay } from '../gameplay/ThreeDockOverlay';
import {
  ThreeStageController,
  CameraPreset3D,
  QualityLevel3D,
  buildStarfighter3D,
  buildEnemyShip3D
} from '../../utils/threeStage';
import { Shield, Zap, Flame, Crosshair } from 'lucide-react';

interface EnemyEntity3D {
  mesh: THREE.Group;
  x: number;
  z: number;
  speed: number;
  type: 'scout' | 'interceptor' | 'tank' | 'commander';
  hp: number;
  maxHp: number;
  points: number;
  shootCooldown: number;
  radius: number;
}

interface BulletEntity3D {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  vx: number;
  vz: number;
  isEnemy: boolean;
  color: number;
}

interface PowerUpEntity3D {
  mesh: THREE.Group;
  x: number;
  z: number;
  type: 'spread' | 'shield' | 'bomb' | 'rapid' | 'dual';
}

const ARENA_HALF_W = 8.5;
const ARENA_TOP_Z = -13.5;
const ARENA_BOT_Z = 7.5;

export default function SpaceDefenderGame({
  onGameOver,
  onScoreUpdate,
  highScore
}: GameComponentProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<ThreeStageController | null>(null);

  const {
    gameState,
    score,
    addScore,
    startWithCountdown,
    countdown,
    triggerGameOver,
    scoreRef
  } = useGameEngine({
    gameId: 'space-defender',
    onGameOver,
    onScoreUpdate
  });

  const [wave, setWave] = useState(1);
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(0);
  const [weaponType, setWeaponType] = useState<'single' | 'dual' | 'spread' | 'rapid'>('single');
  const [hasShield, setHasShield] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('chase');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const playerStateRef = useRef({
    x: 0,
    z: 5.5,
    vx: 0,
    vz: 0,
    weapon: 'single' as 'single' | 'dual' | 'spread' | 'rapid',
    weaponTimer: 0,
    shield: false,
    invincibleTimer: 0,
    shootCooldown: 0,
    lives: 3,
    wave: 1,
    killsInWave: 0,
    combo: 0,
    comboTimer: 0,
    spawnTimer: 0
  });

  const keysRef = useRef<Record<string, boolean>>({});
  const enemyPoolsRef = useRef<Record<EnemyEntity3D['type'], ObjectPool<EnemyEntity3D>> | null>(null);
  const bulletPoolRef = useRef<ObjectPool<BulletEntity3D> | null>(null);
  const powerUpPoolRef = useRef<ObjectPool<PowerUpEntity3D> | null>(null);
  const shipPartsRef = useRef<ReturnType<typeof buildStarfighter3D> | null>(null);

  const clearEntities = useCallback(() => {
    if (enemyPoolsRef.current) {
      enemyPoolsRef.current.scout.releaseAll();
      enemyPoolsRef.current.interceptor.releaseAll();
      enemyPoolsRef.current.tank.releaseAll();
      enemyPoolsRef.current.commander.releaseAll();
    }
    bulletPoolRef.current?.releaseAll();
    powerUpPoolRef.current?.releaseAll();
  }, []);

  const handleStartGame = useCallback(() => {
    clearEntities();
    playerStateRef.current = {
      x: 0,
      z: 5.5,
      vx: 0,
      vz: 0,
      weapon: 'single',
      weaponTimer: 0,
      shield: false,
      invincibleTimer: 0,
      shootCooldown: 0,
      lives: 3,
      wave: 1,
      killsInWave: 0,
      combo: 0,
      comboTimer: 0,
      spawnTimer: 0.4
    };
    setLives(3);
    setWave(1);
    setCombo(0);
    setWeaponType('single');
    setHasShield(false);
    if (shipPartsRef.current) {
      shipPartsRef.current.group.position.set(0, 0.65, 5.5);
      shipPartsRef.current.group.rotation.set(0, 0, 0);
      shipPartsRef.current.shieldMesh.visible = false;
    }
    startWithCountdown();
  }, [clearEntities, startWithCountdown]);

  const handleSelectPreset = useCallback((preset: CameraPreset3D) => {
    setCameraPreset(preset);
    stageRef.current?.setCameraPreset(preset);
  }, []);

  const handleCycleQuality = useCallback(() => {
    setQuality((prev) => {
      const next: QualityLevel3D =
        prev === 'ultra' ? 'balanced' : prev === 'balanced' ? 'performance' : 'ultra';
      stageRef.current?.setQualityLevel(next);
      return next;
    });
  }, []);

  // Input listeners (Keyboard + Unified Input Service)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
      keysRef.current[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
      keysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'LEFT') keysRef.current['arrowleft'] = true;
        if (action === 'RIGHT') keysRef.current['arrowright'] = true;
        if (action === 'UP') keysRef.current['arrowup'] = true;
        if (action === 'DOWN') keysRef.current['arrowdown'] = true;
        if (action === 'PRIMARY' || action === 'ACTION_PRIMARY') keysRef.current['Space'] = true;
      },
      onActionUp: (action) => {
        if (action === 'LEFT') keysRef.current['arrowleft'] = false;
        if (action === 'RIGHT') keysRef.current['arrowright'] = false;
        if (action === 'UP') keysRef.current['arrowup'] = false;
        if (action === 'DOWN') keysRef.current['arrowdown'] = false;
        if (action === 'PRIMARY' || action === 'ACTION_PRIMARY') keysRef.current['Space'] = false;
      }
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      unsub();
    };
  }, []);

  // Initialize Three.js 3D Stage & Game Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let stage: ThreeStageController;
    try {
      stage = new ThreeStageController({
        container,
        backgroundColor: 0x050814,
        fogColor: 0x050814,
        fogDensity: 0.015,
        initialPreset: 'chase',
        gridPrimaryColor: '#6366f1',
        gridSecondaryColor: '#070b18',
        cameraPresets: {
          chase: { position: [0, 8.2, 13.8], lookAt: [0, 0.4, -2.5], fov: 56 },
          isometric: { position: [11.5, 14.5, 11.5], lookAt: [0, 0, -1.5], fov: 46 },
          diorama: { position: [0, 21.5, 2.5], lookAt: [0, 0, -2.0], fov: 48 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    // Build 12-part 3D Starfighter
    const ship = buildStarfighter3D(0x6366f1, 0x22d3ee, stage.isSoftwareGl);
    ship.group.position.set(0, 0.65, 5.5);
    stage.scene.add(ship.group);
    shipPartsRef.current = ship;

    // Build Instanced 3D Starfield Pillars & Space Dust
    const starGeo = new THREE.OctahedronGeometry(0.08, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    const starCount = 120;
    const starInstanced = new THREE.InstancedMesh(starGeo, starMat, starCount);
    starInstanced.frustumCulled = false;
    const starPositions = Array.from({ length: starCount }, () => ({
      x: (Math.random() - 0.5) * 36,
      y: 0.2 + Math.random() * 5,
      z: (Math.random() - 0.5) * 36,
      speed: 3 + Math.random() * 6
    }));
    const dummyMat = new THREE.Matrix4();
    stage.scene.add(starInstanced);

    const bulletGeo = new THREE.CapsuleGeometry(0.09, 0.42, 4, 8);
    bulletGeo.rotateX(Math.PI / 2);

    const bulletPool = new ObjectPool<BulletEntity3D>(
      () => {
        const mat = new THREE.MeshStandardMaterial({
          color: 0x22d3ee,
          emissive: 0x22d3ee,
          emissiveIntensity: 0.95,
          roughness: 0.15
        });
        const mesh = new THREE.Mesh(bulletGeo, mat);
        mesh.visible = false;
        stage.scene.add(mesh);
        return { mesh, x: 0, z: 0, vx: 0, vz: 0, isEnemy: false, color: 0x22d3ee };
      },
      (b) => {
        b.mesh.visible = false;
      },
      36
    );
    bulletPoolRef.current = bulletPool;

    const powerUpGeo = new THREE.OctahedronGeometry(0.42, 0);
    const powerUpRingGeo = new THREE.TorusGeometry(0.58, 0.04, 8, 20);
    const powerUpRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const powerUpPool = new ObjectPool<PowerUpEntity3D>(
      () => {
        const g = new THREE.Group();
        const core = new THREE.Mesh(
          powerUpGeo,
          new THREE.MeshStandardMaterial({
            color: 0x10b981,
            emissive: 0x10b981,
            emissiveIntensity: 0.85,
            roughness: 0.2
          })
        );
        const ring = new THREE.Mesh(powerUpRingGeo, powerUpRingMat);
        g.add(core, ring);
        g.visible = false;
        stage.scene.add(g);
        return { mesh: g, x: 0, z: 0, type: 'shield' };
      },
      (p) => {
        p.mesh.visible = false;
      },
      6
    );
    powerUpPoolRef.current = powerUpPool;

    const createEnemyPool = (type: EnemyEntity3D['type'], prewarm: number) =>
      new ObjectPool<EnemyEntity3D>(
        () => {
          const mesh = buildEnemyShip3D(type);
          mesh.visible = false;
          stage.scene.add(mesh);
          return {
            mesh,
            x: 0,
            z: 0,
            speed: 4.2,
            type,
            hp: 1,
            maxHp: 1,
            points: 15,
            shootCooldown: 1.5,
            radius: 0.7
          };
        },
        (e) => {
          e.mesh.visible = false;
        },
        prewarm
      );

    const enemyPools: Record<EnemyEntity3D['type'], ObjectPool<EnemyEntity3D>> = {
      scout: createEnemyPool('scout', 10),
      interceptor: createEnemyPool('interceptor', 8),
      tank: createEnemyPool('tank', 6),
      commander: createEnemyPool('commander', 4)
    };
    enemyPoolsRef.current = enemyPools;
    const enemyTypes: EnemyEntity3D['type'][] = ['scout', 'interceptor', 'tank', 'commander'];

    const spawnBullet = (x: number, z: number, vx: number, vz: number, isEnemy: boolean, color: number) => {
      const b = bulletPool.acquire();
      b.x = x;
      b.z = z;
      b.vx = vx;
      b.vz = vz;
      b.isEnemy = isEnemy;
      b.color = color;
      const mat = b.mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(color);
      mat.emissive.setHex(color);
      b.mesh.position.set(x, 0.65, z);
      b.mesh.visible = true;
    };

    const spawnPowerUp = (x: number, z: number) => {
      const types: PowerUpEntity3D['type'][] = ['spread', 'dual', 'rapid', 'shield', 'bomb'];
      const type = types[Math.floor(Math.random() * types.length)];
      const colorMap: Record<PowerUpEntity3D['type'], number> = {
        spread: 0xf59e0b,
        dual: 0x38bdf8,
        rapid: 0xa855f7,
        shield: 0x10b981,
        bomb: 0xef4444
      };
      const p = powerUpPool.acquire();
      p.x = x;
      p.z = z;
      p.type = type;
      const coreMesh = p.mesh.children[0] as THREE.Mesh;
      const mat = coreMesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(colorMap[type]);
      mat.emissive.setHex(colorMap[type]);
      p.mesh.position.set(x, 0.65, z);
      p.mesh.visible = true;
    };

    const spawnEnemy = (waveNum: number) => {
      const r = Math.random();
      let type: EnemyEntity3D['type'] = 'scout';
      if (waveNum >= 3 && r < 0.14) type = 'commander';
      else if (waveNum >= 2 && r < 0.34) type = 'tank';
      else if (r < 0.62) type = 'interceptor';

      const hpMap = { scout: 1, interceptor: 2, tank: 4 + Math.floor(waveNum / 2), commander: 7 + waveNum };
      const spdMap = { scout: 4.2, interceptor: 5.6, tank: 2.6, commander: 2.1 };
      const ptsMap = { scout: 15, interceptor: 25, tank: 50, commander: 100 };
      const radMap = { scout: 0.68, interceptor: 0.72, tank: 0.95, commander: 1.15 };

      const e = enemyPools[type].acquire();
      const x = (Math.random() - 0.5) * (ARENA_HALF_W * 1.75);
      const z = ARENA_TOP_Z;
      e.x = x;
      e.z = z;
      e.speed = spdMap[type] + Math.min(2.5, waveNum * 0.18);
      e.hp = hpMap[type];
      e.maxHp = hpMap[type];
      e.points = ptsMap[type];
      e.shootCooldown = 1.2 + Math.random() * 1.5;
      e.radius = radMap[type];
      e.mesh.position.set(x, 0.65, z);
      e.mesh.visible = true;
    };

    stage.startLoop((dt, elapsed) => {
      // Animate starfield
      for (let i = 0; i < starCount; i++) {
        const st = starPositions[i];
        st.z += st.speed * dt * (gameStateRef.current === 'playing' ? 2.2 : 0.6);
        if (st.z > 16) st.z = -20;
        dummyMat.makeTranslation(st.x, st.y, st.z);
        starInstanced.setMatrixAt(i, dummyMat);
      }
      starInstanced.instanceMatrix.needsUpdate = true;

      // Pulse player thrusters
      const pulse = 0.85 + Math.sin(elapsed * 28) * 0.25;
      ship.thrusterL.scale.set(1, pulse, 1);
      ship.thrusterR.scale.set(1, pulse, 1);

      if (gameStateRef.current !== 'playing') return;

      const ps = playerStateRef.current;
      const keys = keysRef.current;

      // Movement
      let moveX = 0;
      let moveZ = 0;
      if (keys['arrowleft'] || keys['a']) moveX -= 1;
      if (keys['arrowright'] || keys['d']) moveX += 1;
      if (keys['arrowup'] || keys['w']) moveZ -= 1;
      if (keys['arrowdown'] || keys['s']) moveZ += 1;

      const speed = 10.5;
      ps.x = THREE.MathUtils.clamp(ps.x + moveX * speed * dt, -ARENA_HALF_W, ARENA_HALF_W);
      ps.z = THREE.MathUtils.clamp(ps.z + moveZ * speed * dt, -2.5, ARENA_BOT_Z);

      ship.group.position.set(ps.x, 0.65, ps.z);
      ship.group.rotation.z = THREE.MathUtils.damp(ship.group.rotation.z, -moveX * 0.42, 10, dt);
      ship.group.rotation.x = THREE.MathUtils.damp(ship.group.rotation.x, -moveZ * 0.16, 10, dt);
      ship.shieldMesh.visible = ps.shield || ps.invincibleTimer > 0;
      ship.shieldMesh.rotation.y += dt * 2.5;

      stage.setFollowTarget(ps.x, 0, (ps.z - 5.5) * 0.5, 0.32);

      // Timers
      if (ps.invincibleTimer > 0) ps.invincibleTimer -= dt;
      if (ps.weaponTimer > 0) {
        ps.weaponTimer -= dt;
        if (ps.weaponTimer <= 0 && ps.weapon !== 'single') {
          ps.weapon = 'single';
          setWeaponType('single');
        }
      }
      if (ps.comboTimer > 0) {
        ps.comboTimer -= dt;
        if (ps.comboTimer <= 0 && ps.combo !== 0) {
          ps.combo = 0;
          setCombo(0);
        }
      }

      // Auto-fire + rapid fire on Space/Primary
      ps.shootCooldown -= dt;
      const fireHeld = keys[' '] || keys['Space'] || keys['z'];
      if (ps.shootCooldown <= 0) {
        const rate = ps.weapon === 'rapid' ? 0.11 : fireHeld ? 0.16 : 0.21;
        ps.shootCooldown = rate;
        audioController.playLaser();
        if (ps.weapon === 'single' || ps.weapon === 'rapid') {
          spawnBullet(ps.x, ps.z - 1.1, 0, -24, false, 0x22d3ee);
        } else if (ps.weapon === 'dual') {
          spawnBullet(ps.x - 0.55, ps.z - 0.9, 0, -24, false, 0x38bdf8);
          spawnBullet(ps.x + 0.55, ps.z - 0.9, 0, -24, false, 0x38bdf8);
        } else if (ps.weapon === 'spread') {
          spawnBullet(ps.x, ps.z - 1.1, 0, -24, false, 0xf59e0b);
          spawnBullet(ps.x - 0.35, ps.z - 1.0, -4.8, -23, false, 0xf59e0b);
          spawnBullet(ps.x + 0.35, ps.z - 1.0, 4.8, -23, false, 0xf59e0b);
        }
      }

      // Enemy Spawning
      ps.spawnTimer -= dt;
      if (ps.spawnTimer <= 0) {
        spawnEnemy(ps.wave);
        ps.spawnTimer = Math.max(0.45, 1.35 - ps.wave * 0.08);
      }

      // Update Bullets
      const activeBullets = bulletPool.getActiveItems();
      for (let i = activeBullets.length - 1; i >= 0; i--) {
        const b = activeBullets[i];
        b.x += b.vx * dt;
        b.z += b.vz * dt;
        b.mesh.position.set(b.x, 0.65, b.z);

        if (b.z < ARENA_TOP_Z - 3 || b.z > ARENA_BOT_Z + 3 || Math.abs(b.x) > ARENA_HALF_W + 3) {
          bulletPool.release(i);
          continue;
        }

        if (b.isEnemy) {
          const dist = Math.hypot(b.x - ps.x, b.z - ps.z);
          if (dist < 0.78) {
            bulletPool.release(i);
            if (ps.invincibleTimer <= 0) {
              if (ps.shield) {
                ps.shield = false;
                setHasShield(false);
                ps.invincibleTimer = 1.2;
                stage.particles.burst(ps.x, 0.65, ps.z, 22, 0x22d3ee, 8);
                stage.triggerTrauma(0.35);
                audioController.playShield();
              } else {
                ps.lives -= 1;
                setLives(ps.lives);
                ps.invincibleTimer = 1.8;
                stage.particles.burst(ps.x, 0.65, ps.z, 32, 0xef4444, 10);
                stage.triggerTrauma(0.65);
                if (ps.lives <= 0) {
                  audioController.playGameOver();
                  triggerGameOver(scoreRef.current);
                  return;
                }
                audioController.playHit();
              }
            }
          }
        }
      }

      // Update Enemies
      for (const eType of enemyTypes) {
        const pool = enemyPools[eType];
        const activeEnemies = pool.getActiveItems();
        for (let i = activeEnemies.length - 1; i >= 0; i--) {
          const e = activeEnemies[i];
          e.z += e.speed * dt;
          if (e.type === 'interceptor') {
            e.x += Math.sin(elapsed * 3.5 + i) * 2.5 * dt;
          }
          e.mesh.position.set(e.x, 0.65, e.z);
          e.mesh.rotation.z = Math.sin(elapsed * 4 + i) * 0.15;

          // Enemy shooting
          e.shootCooldown -= dt;
          if (e.shootCooldown <= 0 && e.z < ps.z - 2.5) {
            e.shootCooldown = e.type === 'commander' ? 1.1 : 2.1;
            spawnBullet(e.x, e.z + 0.8, 0, 11.5, true, 0xf43f5e);
          }

          // Check bullet collisions with enemy
          let destroyed = false;
          for (let j = activeBullets.length - 1; j >= 0; j--) {
            const b = activeBullets[j];
            if (b.isEnemy) continue;
            if (Math.hypot(b.x - e.x, b.z - e.z) < e.radius + 0.25) {
              bulletPool.release(j);
              e.hp -= 1;
              stage.particles.burst(e.x, 0.65, e.z, 8, 0x38bdf8, 5);
              if (e.hp <= 0) {
                destroyed = true;
                break;
              }
            }
          }

          if (destroyed) {
            const ex = e.x;
            const ez = e.z;
            const pts = e.points;
            const isCmd = e.type === 'commander';
            pool.release(i);
            ps.combo += 1;
            ps.comboTimer = 3.2;
            setCombo(ps.combo);
            const mult = Math.min(4, 1 + Math.floor(ps.combo / 5));
            addScore(pts * mult);

            stage.particles.burst(
              ex,
              0.65,
              ez,
              isCmd ? 42 : 20,
              isCmd ? 0xf59e0b : 0xf43f5e,
              8.5
            );
            stage.triggerTrauma(isCmd ? 0.55 : 0.22);
            if (isCmd) {
              stage.triggerSlowMo(0.38, 0.25);
              stage.kickFov(4.5);
            }
            if (ps.combo > 1) {
              audioController.playCombo(ps.combo);
            } else {
              audioController.playExplosion();
            }

            if (Math.random() < 0.16) {
              spawnPowerUp(ex, ez);
            }

            ps.killsInWave += 1;
            if (ps.killsInWave >= 10 + ps.wave * 4) {
              ps.killsInWave = 0;
              ps.wave += 1;
              setWave(ps.wave);
              stage.kickFov(6);
              audioController.playPowerup();
            }
            continue;
          }

          // Player body collision or enemy passed bottom
          if (Math.hypot(e.x - ps.x, e.z - ps.z) < e.radius + 0.65) {
            pool.release(i);
            if (ps.invincibleTimer <= 0) {
              if (ps.shield) {
                ps.shield = false;
                setHasShield(false);
                ps.invincibleTimer = 1.2;
                stage.particles.burst(ps.x, 0.65, ps.z, 25, 0x22d3ee, 8);
                audioController.playShield();
              } else {
                ps.lives -= 1;
                setLives(ps.lives);
                ps.invincibleTimer = 1.8;
                stage.particles.burst(ps.x, 0.65, ps.z, 35, 0xef4444, 10);
                stage.triggerTrauma(0.7);
                if (ps.lives <= 0) {
                  audioController.playGameOver();
                  triggerGameOver(scoreRef.current);
                  return;
                }
                audioController.playHit();
              }
            }
            continue;
          }

          if (e.z > ARENA_BOT_Z + 2.5) {
            pool.release(i);
          }
        }
      }

      // Update PowerUps
      const activePowerUps = powerUpPool.getActiveItems();
      for (let i = activePowerUps.length - 1; i >= 0; i--) {
        const p = activePowerUps[i];
        p.z += 3.2 * dt;
        p.mesh.position.set(p.x, 0.65, p.z);
        p.mesh.rotation.y += dt * 3;
        p.mesh.rotation.x += dt * 2;

        if (Math.hypot(p.x - ps.x, p.z - ps.z) < 1.1) {
          const pType = p.type;
          powerUpPool.release(i);
          audioController.playPowerup();
          stage.particles.burst(ps.x, 0.65, ps.z, 24, 0x10b981, 7);
          stage.kickFov(-3.5);

          if (pType === 'shield') {
            ps.shield = true;
            setHasShield(true);
          } else if (pType === 'bomb') {
            for (const eType of enemyTypes) {
              const ePool = enemyPools[eType];
              for (const en of ePool.getActiveItems()) {
                stage.particles.burst(en.x, 0.65, en.z, 18, 0xf59e0b, 9);
                addScore(en.points);
              }
              ePool.releaseAll();
            }
            stage.triggerTrauma(0.8);
            stage.triggerSlowMo(0.35, 0.3);
          } else {
            ps.weapon = pType;
            ps.weaponTimer = 10;
            setWeaponType(pType);
          }
          continue;
        }

        if (p.z > ARENA_BOT_Z + 2) {
          powerUpPool.release(i);
        }
      }
    });

    return () => {
      enemyPools.scout.releaseAll();
      enemyPools.interceptor.releaseAll();
      enemyPools.tank.releaseAll();
      enemyPools.commander.releaseAll();
      bulletPool.releaseAll();
      powerUpPool.releaseAll();
      enemyPoolsRef.current = null;
      bulletPoolRef.current = null;
      powerUpPoolRef.current = null;
      stage.dispose();
      stageRef.current = null;
    };
  }, [addScore, scoreRef, triggerGameOver]);

  return (
    <div className="relative w-full h-full min-h-[260px] sm:min-h-[380px] lg:min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-indigo-500/20">
      {/* Dedicated Empty WebGL Mount Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Top Tactical HUD Bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="font-semibold text-indigo-400">WAVE {wave}</span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
          {combo > 1 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400 font-semibold">{combo}x COMBO</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 text-cyan-400 font-medium">
            <Crosshair className="w-3.5 h-3.5" />
            {weaponType.toUpperCase()}
          </span>
          {hasShield && (
            <>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <Shield className="w-3.5 h-3.5" /> SHIELD
              </span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1 text-rose-400 font-semibold">
            <Flame className="w-3.5 h-3.5" /> HP: {lives}
          </span>
        </div>
      </div>

      {/* Collapsible 3D Camera & Quality Bottom Dock */}
      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        presetLabels={{
          chase: 'Chase 3D',
          isometric: 'Tactical Iso',
          diorama: 'Overhead 3D'
        }}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-indigo-400" /> WASD / Panah: Manuver 3D · Auto-Plasma Aktif
          </span>
        }
      />

      {/* Game State Overlay (Ready, Countdown, Paused, GameOver) */}
      <GameOverlay
        gameState={gameState}
        score={score}
        highScore={highScore}
        countdown={countdown}
        onStart={handleStartGame}
        onRestart={handleStartGame}
        title="Space Defender 3D"
        description="Kemudikan pesawat tempur Delta-Wing 3D, kumpulkan senjata plasma multi-laras, dan hancurkan armada alien di ruang angkasa 3D!"
        themeColor="indigo"
      />
    </div>
  );
}
