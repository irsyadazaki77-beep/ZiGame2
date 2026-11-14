import * as THREE from 'three';
import { audioController } from '../../../sdk/audioController';
import {
  ThreeStageController,
  CameraPreset3D,
  QualityLevel3D
} from '../../../utils/threeStage';
import { disposeMaterial, disposeThreeScene } from '../../../utils/threeCleanup';
import { solveBrickCollisionStepSync } from '../../../sdk/physicsWorkerController';

export interface BrickEntity3D {
  index: number;
  mesh?: THREE.Mesh;
  x: number;
  z: number;
  alive: boolean;
  color: number;
  points: number;
}

export interface BrickBreakerPhysicsState {
  paddleX: number;
  paddleW: number;
  ballX: number;
  ballZ: number;
  vx: number;
  vz: number;
  lives: number;
  stage: number;
}

export interface BrickBreakerEngineCallbacks {
  // Primary decoupled UI listeners
  onScoreUpdate?: (score: number) => void;
  onLivesUpdate?: (lives: number) => void;
  onGameOver?: (won: boolean) => void;

  // Granular / legacy SDK listeners
  onScoreAdd?: (points: number) => void;
  onLivesChange?: (lives: number) => void;
  onStageChange?: (stage: number) => void;
  onTrajectoryPoint?: (x: number, z: number, action?: string) => void;
  isPlaying?: () => boolean;
}

export const BRICK_ARENA_W = 7.2;
export const BRICK_PADDLE_Z = 5.8;
const ROW_COLORS = [0xf43f5e, 0xf59e0b, 0xec4899, 0xa855f7, 0x06b6d4] as const;
const COLLISION_DISTANCE_THRESHOLD = 0.35; // Sub-stepping threshold for ball radius & brick thickness

/**
 * Decoupled 3D Game Engine for Brick Breaker.
 * Extracts physics calculations, anti-tunneling sub-stepping, and Three.js scene management
 * away from the React UI render cycle. UI listeners are triggered ONLY when values change.
 */
export class BrickBreakerEngine {
  private stage: ThreeStageController | null = null;
  private container: HTMLElement | null = null;
  private paddleGroup: THREE.Group | null = null;
  private ballMesh: THREE.Mesh | null = null;
  private sharedBrickGeo: THREE.BoxGeometry | null = null;
  private bricks: BrickEntity3D[] = [];
  private keys: Record<string, boolean> = {};
  private callbacks: BrickBreakerEngineCallbacks;
  private disposed = false;

  private score = 0;
  private combo = 0;
  private lastReportedScore = 0;
  private lastReportedLives = 3;

  private state: BrickBreakerPhysicsState = {
    paddleX: 0,
    paddleW: 2.5,
    ballX: 0,
    ballZ: 4.5,
    vx: 6.2,
    vz: -9.5,
    lives: 3,
    stage: 1
  };

  constructor(callbacks: BrickBreakerEngineCallbacks = {}) {
    this.callbacks = callbacks;
    this.initBrickDataOnly();
  }

  public updateCallbacks(callbacks: Partial<BrickBreakerEngineCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public getState(): Readonly<BrickBreakerPhysicsState> {
    return { ...this.state };
  }

  public getScore(): number {
    return this.score;
  }

  public getBricks(): ReadonlyArray<BrickEntity3D> {
    return this.bricks;
  }

  public setKey(key: string, isDown: boolean): void {
    this.keys[key.toLowerCase()] = isDown;
  }

  public setPaddleNormalizedX(nx: number): void {
    const maxOffset = BRICK_ARENA_W - 1.25;
    this.state.paddleX = THREE.MathUtils.clamp(nx * maxOffset, -maxOffset, maxOffset);
    if (this.paddleGroup) {
      this.paddleGroup.position.x = this.state.paddleX;
    }
  }

  private initBrickDataOnly(): void {
    this.bricks = [];
    let idx = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 8; c++) {
        const bx = -5.95 + c * 1.7;
        const bz = -5.8 + r * 0.88;
        const color = ROW_COLORS[r % ROW_COLORS.length];
        this.bricks.push({
          index: idx++,
          x: bx,
          z: bz,
          alive: true,
          color,
          points: (5 - r) * 10
        });
      }
    }
  }

  public resetGame(randomDirection = Math.random() > 0.5 ? 1 : -1): void {
    this.score = 0;
    this.combo = 0;
    this.lastReportedScore = 0;
    this.lastReportedLives = 3;

    this.state = {
      paddleX: 0,
      paddleW: 2.5,
      ballX: 0,
      ballZ: 4.5,
      vx: 6.2 * (randomDirection >= 0 ? 1 : -1),
      vz: -9.5,
      lives: 3,
      stage: 1
    };

    this.callbacks.onScoreUpdate?.(0);
    this.callbacks.onLivesUpdate?.(3);
    this.callbacks.onLivesChange?.(3);
    this.callbacks.onStageChange?.(1);
    this.rebuildBricks();
  }

  public rebuildBricks(): void {
    if (!this.stage) {
      this.initBrickDataOnly();
      return;
    }

    const scene = this.stage.scene;
    for (const b of this.bricks) {
      if (b.mesh) {
        scene.remove(b.mesh);
        disposeMaterial(b.mesh.material);
      }
    }
    this.bricks = [];

    if (!this.sharedBrickGeo) {
      this.sharedBrickGeo = new THREE.BoxGeometry(1.55, 0.48, 0.65);
    }

    let idx = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 8; c++) {
        const bx = -5.95 + c * 1.7;
        const bz = -5.8 + r * 0.88;
        const color = ROW_COLORS[r % ROW_COLORS.length];
        const mat = new THREE.MeshPhysicalMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.35,
          roughness: 0.2,
          metalness: 0.35,
          clearcoat: 0.85
        });
        const mesh = new THREE.Mesh(this.sharedBrickGeo, mat);
        mesh.position.set(bx, 0.24, bz);
        mesh.castShadow = true;
        scene.add(mesh);

        this.bricks.push({
          index: idx++,
          mesh,
          x: bx,
          z: bz,
          alive: true,
          color,
          points: (5 - r) * 10
        });
      }
    }
  }

  /**
   * Physics sub-step to prevent high-velocity tunneling (anti-clipping).
   * Subdivides delta-time into smaller chunks if speed * dt exceeds the collision distance threshold.
   */
  public stepPhysics(dt: number): void {
    if (this.disposed || dt <= 0) return;

    const st = this.state;
    const maxPaddleOffset = BRICK_ARENA_W - 1.25;

    // Paddle movement from keys
    if (this.keys['arrowleft'] || this.keys['a']) {
      st.paddleX -= 12.5 * dt;
    }
    if (this.keys['arrowright'] || this.keys['d']) {
      st.paddleX += 12.5 * dt;
    }
    st.paddleX = THREE.MathUtils.clamp(st.paddleX, -maxPaddleOffset, maxPaddleOffset);

    if (this.paddleGroup) {
      this.paddleGroup.position.x = st.paddleX;
    }
    this.stage?.setFollowTarget(st.paddleX, 0, 0, 0.25);

    // Calculate ball velocity magnitude
    const ballSpeed = Math.hypot(st.vx, st.vz);
    const stepDistance = ballSpeed * dt;

    // Sub-stepping: divide into 2 or 3 smaller steps if ball moves further than threshold in one frame
    const subSteps = stepDistance > COLLISION_DISTANCE_THRESHOLD
      ? (stepDistance > COLLISION_DISTANCE_THRESHOLD * 2 ? 3 : 2)
      : 1;
    const subDt = dt / subSteps;

    for (let i = 0; i < subSteps; i++) {
      this.runSinglePhysicsStep(subDt);
      if (st.lives <= 0) {
        break;
      }
    }

    if (this.ballMesh) {
      this.ballMesh.position.set(st.ballX, 0.32, st.ballZ);
    }
  }

  private runSinglePhysicsStep(subDt: number): void {
    const st = this.state;

    const stepResult = solveBrickCollisionStepSync({
      ballX: st.ballX,
      ballZ: st.ballZ,
      vx: st.vx,
      vz: st.vz,
      dt: subDt,
      paddleX: st.paddleX,
      paddleW: st.paddleW,
      paddleZ: BRICK_PADDLE_Z,
      arenaW: BRICK_ARENA_W,
      bricks: this.bricks
    });

    st.ballX = stepResult.ballX;
    st.ballZ = stepResult.ballZ;
    st.vx = stepResult.vx;
    st.vz = stepResult.vz;

    if (stepResult.wallBounced) {
      audioController.playClick();
    }

    if (stepResult.paddleBounced) {
      this.combo = 0;
      this.stage?.particles.burst(st.ballX, 0.35, BRICK_PADDLE_Z, 12, 0x38bdf8, 5);
      audioController.playReflect();
      this.callbacks.onTrajectoryPoint?.(st.paddleX, st.ballZ, 'paddle_hit');
    } else {
      this.callbacks.onTrajectoryPoint?.(st.paddleX, st.ballZ);
    }

    // Brick hit handling
    if (stepResult.hitBrickIndex >= 0) {
      const hitBrick = this.bricks[stepResult.hitBrickIndex];
      if (hitBrick && hitBrick.alive) {
        hitBrick.alive = false;
        if (hitBrick.mesh) {
          hitBrick.mesh.visible = false;
        }
        this.combo += 1;
        this.score += stepResult.scoreDelta;
        this.callbacks.onScoreAdd?.(stepResult.scoreDelta);

        // Notify UI listener only if score actually changed
        if (this.score !== this.lastReportedScore) {
          this.lastReportedScore = this.score;
          this.callbacks.onScoreUpdate?.(this.score);
        }

        this.stage?.particles.burst(hitBrick.x, 0.4, hitBrick.z, 20, hitBrick.color, 7.5);
        this.stage?.triggerTrauma(0.22);
        if (this.combo > 1) {
          audioController.playCombo(this.combo);
        } else {
          audioController.playScore();
        }
      }
    }

    // Stage cleared condition
    if (this.bricks.length > 0 && this.bricks.every((b) => !b.alive)) {
      st.stage += 1;
      this.callbacks.onStageChange?.(st.stage);
      this.score += 150;
      this.callbacks.onScoreAdd?.(150);

      if (this.score !== this.lastReportedScore) {
        this.lastReportedScore = this.score;
        this.callbacks.onScoreUpdate?.(this.score);
      }

      st.ballX = st.paddleX;
      st.ballZ = 4.2;
      st.vz = -(9.5 + st.stage * 0.8);
      this.stage?.kickFov(5);

      if (st.stage > 5) {
        // Player completed all 5 stages!
        audioController.playWin();
        this.callbacks.onGameOver?.(true);
        return;
      }

      audioController.playPowerup();
      this.rebuildBricks();
    }

    // Ball lost off bottom edge
    if (stepResult.ballLost) {
      this.combo = 0;
      st.lives -= 1;

      // Notify UI listener only if lives actually changed
      if (st.lives !== this.lastReportedLives) {
        this.lastReportedLives = st.lives;
        this.callbacks.onLivesUpdate?.(st.lives);
        this.callbacks.onLivesChange?.(st.lives);
      }

      this.stage?.particles.burst(st.ballX, 0.4, BRICK_PADDLE_Z, 30, 0xef4444, 9);
      this.stage?.triggerTrauma(0.65);

      if (st.lives <= 0) {
        audioController.playGameOver();
        this.callbacks.onGameOver?.(false);
        return;
      }

      audioController.playHit();
      st.ballX = st.paddleX;
      st.ballZ = 4.2;
      st.vx = 5.5 * (Math.random() > 0.5 ? 1 : -1);
      st.vz = -9.5;
    }
  }

  private handlePointerMove = (e: PointerEvent): void => {
    if (this.disposed || !this.container) return;
    if (this.callbacks.isPlaying && !this.callbacks.isPlaying()) return;
    const rect = this.container.getBoundingClientRect();
    if (rect.width <= 0) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.setPaddleNormalizedX(nx);
  };

  /**
   * Initializes the Three.js scene, composite 3D paddle/ball/arena meshes, and starts the render loop.
   */
  public mount(container: HTMLElement): QualityLevel3D {
    this.container = container;
    let stage: ThreeStageController;
    try {
      stage = new ThreeStageController({
        container,
        backgroundColor: 0x0d0614,
        fogColor: 0x0d0614,
        fogDensity: 0.016,
        initialPreset: 'chase',
        gridPrimaryColor: '#ec4899',
        gridSecondaryColor: '#14091e',
        cameraPresets: {
          chase: { position: [0, 8.8, 12.2], lookAt: [0, 0.3, -0.5], fov: 50 },
          isometric: { position: [9.5, 12.5, 9.5], lookAt: [0, 0.3, -0.5], fov: 46 },
          diorama: { position: [0, 16.8, 1.8], lookAt: [0, 0, -0.5], fov: 46 }
        }
      });
    } catch {
      return 'performance';
    }

    this.stage = stage;

    // 3D Arena Side & Top Bumper Walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xec4899,
      emissive: 0xdb2777,
      emissiveIntensity: 0.55,
      roughness: 0.25
    });
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.55, 14), wallMat);
    wallL.position.set(-BRICK_ARENA_W - 0.2, 0.275, -0.5);
    const wallR = wallL.clone();
    wallR.position.x = BRICK_ARENA_W + 0.2;
    const wallTop = new THREE.Mesh(
      new THREE.BoxGeometry(BRICK_ARENA_W * 2 + 0.6, 0.55, 0.25),
      wallMat
    );
    wallTop.position.set(0, 0.275, -7.4);
    stage.scene.add(wallL, wallR, wallTop);

    // Multi-part 3D Magnetic Paddle Group
    const paddleGroup = new THREE.Group();
    const paddleCore = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.42, 0.52),
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.55,
        metalness: 0.7,
        roughness: 0.2,
        clearcoat: 0.9
      })
    );
    paddleCore.position.y = 0.21;
    paddleCore.castShadow = true;

    const capMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.85,
      roughness: 0.45
    });
    const capGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.44, 12);
    const capL = new THREE.Mesh(capGeo, capMat);
    capL.position.set(-1.15, 0.22, 0);
    const capR = capL.clone();
    capR.position.x = 1.15;

    const stripMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.1, 0.56),
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x22d3ee,
        emissiveIntensity: 0.95,
        roughness: 0.1
      })
    );
    stripMesh.position.set(0, 0.24, 0);

    paddleGroup.add(paddleCore, capL, capR, stripMesh);
    paddleGroup.position.set(this.state.paddleX, 0, BRICK_PADDLE_Z);
    stage.scene.add(paddleGroup);
    this.paddleGroup = paddleGroup;

    // 3D Energy Ball
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xf43f5e,
        emissiveIntensity: 0.95,
        roughness: 0.1
      })
    );
    ballMesh.position.set(this.state.ballX, 0.32, this.state.ballZ);
    ballMesh.castShadow = true;
    stage.scene.add(ballMesh);
    this.ballMesh = ballMesh;

    this.rebuildBricks();

    container.addEventListener('pointermove', this.handlePointerMove);
    container.addEventListener('pointerdown', this.handlePointerMove);

    stage.startLoop((dt) => {
      if (this.callbacks.isPlaying && !this.callbacks.isPlaying()) return;
      this.stepPhysics(dt);
    });

    return stage.getQualityLevel();
  }

  public setCameraPreset(preset: CameraPreset3D): void {
    this.stage?.setCameraPreset(preset);
  }

  public setQualityLevel(level: QualityLevel3D): void {
    this.stage?.setQualityLevel(level);
  }

  public isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Strict lifecycle cleanup: stops animation loop, removes DOM listeners,
   * and disposes all Three.js geometries, materials, textures, and WebGL context.
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.container) {
      this.container.removeEventListener('pointermove', this.handlePointerMove);
      this.container.removeEventListener('pointerdown', this.handlePointerMove);
      this.container = null;
    }

    if (this.sharedBrickGeo) {
      try {
        this.sharedBrickGeo.dispose();
      } catch {}
      this.sharedBrickGeo = null;
    }

    for (const b of this.bricks) {
      if (b.mesh) {
        disposeMaterial(b.mesh.material);
      }
    }
    this.bricks = [];

    if (this.stage) {
      this.stage.dispose();
      this.stage = null;
    } else if (this.paddleGroup) {
      const tempScene = new THREE.Scene();
      tempScene.add(this.paddleGroup);
      if (this.ballMesh) tempScene.add(this.ballMesh);
      disposeThreeScene(tempScene);
    }

    this.paddleGroup = null;
    this.ballMesh = null;
    this.keys = {};
  }
}
