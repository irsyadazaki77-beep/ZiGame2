import { GhostDeltaPoint } from '../types';

export interface ReplayVerificationInput {
  deltaPoints: GhostDeltaPoint[];
  maxSpeedUnitsPerSec: number;
  declaredDurationMs: number;
  declaredScore: number;
  maxScorePerSec: number;
}

export interface ReplayVerificationResult {
  valid: boolean;
  totalDurationMs: number;
  maxObservedSpeed: number;
  anomalyCount: number;
  reason?: string;
}

export interface BrickCollisionStepInput {
  ballX: number;
  ballZ: number;
  vx: number;
  vz: number;
  dt: number;
  paddleX: number;
  paddleW: number;
  paddleZ: number;
  arenaW: number;
  bricks: Array<{
    index: number;
    x: number;
    z: number;
    alive: boolean;
    points: number;
  }>;
}

export interface BrickCollisionStepOutput {
  ballX: number;
  ballZ: number;
  vx: number;
  vz: number;
  wallBounced: boolean;
  paddleBounced: boolean;
  hitBrickIndex: number;
  scoreDelta: number;
  ballLost: boolean;
}

/**
 * Pure deterministic ghost replay verifier (runs identically inside Web Worker or inline fallback).
 */
export function verifyGhostTrajectorySync(input: ReplayVerificationInput): ReplayVerificationResult {
  const { deltaPoints, maxSpeedUnitsPerSec, declaredDurationMs, declaredScore, maxScorePerSec } = input;

  if (!Array.isArray(deltaPoints)) {
    return {
      valid: false,
      totalDurationMs: 0,
      maxObservedSpeed: 0,
      anomalyCount: 1,
      reason: 'INVALID_DELTA_POINTS_ARRAY'
    };
  }

  let totalDurationMs = 0;
  let maxObservedSpeed = 0;
  let anomalyCount = 0;
  let reason: string | undefined;

  for (let i = 0; i < deltaPoints.length; i++) {
    const pt = deltaPoints[i];
    if (pt.dt < 0 || !Number.isFinite(pt.dt)) {
      anomalyCount++;
      reason = 'NEGATIVE_DELTA_TIME';
      break;
    }
    totalDurationMs += pt.dt;

    if (pt.dt > 0 && (pt.dx !== undefined || pt.dy !== undefined)) {
      const dist = Math.hypot(pt.dx ?? 0, pt.dy ?? 0);
      const speedPerSec = (dist / pt.dt) * 1000;
      if (speedPerSec > maxObservedSpeed) {
        maxObservedSpeed = speedPerSec;
      }
      if (speedPerSec > maxSpeedUnitsPerSec * 1.5) {
        anomalyCount++;
        reason = `TELEPORT_SPEED_ANOMALY_${speedPerSec.toFixed(1)}`;
      }
    }
  }

  const effectiveDurationSec = Math.max(declaredDurationMs, totalDurationMs, 500) / 1000;
  const scoreVelocity = declaredScore / effectiveDurationSec;
  if (declaredScore > 0 && scoreVelocity > maxScorePerSec) {
    anomalyCount++;
    reason = `SCORE_VELOCITY_EXCEEDED_${scoreVelocity.toFixed(1)}`;
  }

  return {
    valid: anomalyCount === 0,
    totalDurationMs,
    maxObservedSpeed: Math.round(maxObservedSpeed * 100) / 100,
    anomalyCount,
    reason
  };
}

/**
 * Pure deterministic physics & collision solver for Brick Breaker.
 */
export function solveBrickCollisionStepSync(input: BrickCollisionStepInput): BrickCollisionStepOutput {
  let { ballX, ballZ, vx, vz } = input;
  const { dt, paddleX, paddleW, paddleZ, arenaW, bricks } = input;

  ballX += vx * dt;
  ballZ += vz * dt;

  let wallBounced = false;
  let paddleBounced = false;
  let hitBrickIndex = -1;
  let scoreDelta = 0;
  let ballLost = false;

  // Side & top wall bounce
  if (ballX < -arenaW + 0.3) {
    ballX = -arenaW + 0.3;
    vx = Math.abs(vx);
    wallBounced = true;
  } else if (ballX > arenaW - 0.3) {
    ballX = arenaW - 0.3;
    vx = -Math.abs(vx);
    wallBounced = true;
  }

  if (ballZ < -7.0) {
    ballZ = -7.0;
    vz = Math.abs(vz);
    wallBounced = true;
  }

  // Paddle deflection bounce
  if (
    vz > 0 &&
    Math.abs(ballZ - paddleZ) < 0.48 &&
    Math.abs(ballX - paddleX) < paddleW * 0.55 + 0.3
  ) {
    const hitOffset = (ballX - paddleX) / (paddleW * 0.5);
    vz = -Math.abs(vz);
    vx = hitOffset * 9.5;
    paddleBounced = true;
  }

  // Brick AABB collision
  for (let i = 0; i < bricks.length; i++) {
    const b = bricks[i];
    if (!b.alive) continue;
    if (Math.abs(ballX - b.x) < 0.95 && Math.abs(ballZ - b.z) < 0.52) {
      hitBrickIndex = b.index;
      vz = -vz;
      scoreDelta = b.points;
      break;
    }
  }

  if (ballZ > paddleZ + 1.5) {
    ballLost = true;
  }

  return {
    ballX,
    ballZ,
    vx,
    vz,
    wallBounced,
    paddleBounced,
    hitBrickIndex,
    scoreDelta,
    ballLost
  };
}

const WORKER_SCRIPT = `
self.onmessage = function(e) {
  const { id, type, payload } = e.data;
  try {
    if (type === 'VERIFY_GHOST') {
      const { deltaPoints, maxSpeedUnitsPerSec, declaredDurationMs, declaredScore, maxScorePerSec } = payload;
      let totalDurationMs = 0;
      let maxObservedSpeed = 0;
      let anomalyCount = 0;
      let reason = undefined;
      for (let i = 0; i < deltaPoints.length; i++) {
        const pt = deltaPoints[i];
        if (pt.dt < 0 || !Number.isFinite(pt.dt)) {
          anomalyCount++;
          reason = 'NEGATIVE_DELTA_TIME';
          break;
        }
        totalDurationMs += pt.dt;
        if (pt.dt > 0 && (pt.dx !== undefined || pt.dy !== undefined)) {
          const dist = Math.hypot(pt.dx || 0, pt.dy || 0);
          const speedPerSec = (dist / pt.dt) * 1000;
          if (speedPerSec > maxObservedSpeed) maxObservedSpeed = speedPerSec;
          if (speedPerSec > maxSpeedUnitsPerSec * 1.5) {
            anomalyCount++;
            reason = 'TELEPORT_SPEED_ANOMALY_' + speedPerSec.toFixed(1);
          }
        }
      }
      const effectiveDurationSec = Math.max(declaredDurationMs, totalDurationMs, 500) / 1000;
      const scoreVelocity = declaredScore / effectiveDurationSec;
      if (declaredScore > 0 && scoreVelocity > maxScorePerSec) {
        anomalyCount++;
        reason = 'SCORE_VELOCITY_EXCEEDED_' + scoreVelocity.toFixed(1);
      }
      self.postMessage({
        id,
        result: {
          valid: anomalyCount === 0,
          totalDurationMs,
          maxObservedSpeed: Math.round(maxObservedSpeed * 100) / 100,
          anomalyCount,
          reason
        }
      });
    } else if (type === 'SOLVE_BRICK_STEP') {
      let { ballX, ballZ, vx, vz, dt, paddleX, paddleW, paddleZ, arenaW, bricks } = payload;
      ballX += vx * dt;
      ballZ += vz * dt;
      let wallBounced = false;
      let paddleBounced = false;
      let hitBrickIndex = -1;
      let scoreDelta = 0;
      let ballLost = false;
      if (ballX < -arenaW + 0.3) { ballX = -arenaW + 0.3; vx = Math.abs(vx); wallBounced = true; }
      else if (ballX > arenaW - 0.3) { ballX = arenaW - 0.3; vx = -Math.abs(vx); wallBounced = true; }
      if (ballZ < -7.0) { ballZ = -7.0; vz = Math.abs(vz); wallBounced = true; }
      if (vz > 0 && Math.abs(ballZ - paddleZ) < 0.48 && Math.abs(ballX - paddleX) < paddleW * 0.55 + 0.3) {
        const hitOffset = (ballX - paddleX) / (paddleW * 0.5);
        vz = -Math.abs(vz);
        vx = hitOffset * 9.5;
        paddleBounced = true;
      }
      for (let i = 0; i < bricks.length; i++) {
        const b = bricks[i];
        if (!b.alive) continue;
        if (Math.abs(ballX - b.x) < 0.95 && Math.abs(ballZ - b.z) < 0.52) {
          hitBrickIndex = b.index;
          vz = -vz;
          scoreDelta = b.points;
          break;
        }
      }
      if (ballZ > paddleZ + 1.5) ballLost = true;
      self.postMessage({
        id,
        result: { ballX, ballZ, vx, vz, wallBounced, paddleBounced, hitBrickIndex, scoreDelta, ballLost }
      });
    }
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
`;

/**
 * Offloads heavy physics calculations and ghost replay verification to a background Web Worker
 * to preserve main-thread 60 FPS responsiveness, with graceful fallback in non-Worker environments.
 */
export class PhysicsWorkerController {
  private worker: Worker | null = null;
  private workerUrl: string | null = null;
  private nextRequestId = 1;
  private pending = new Map<
    number,
    { resolve: (val: unknown) => void; reject: (err: Error) => void }
  >();
  private disposed = false;

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof window === 'undefined' || typeof Worker === 'undefined' || typeof Blob === 'undefined') {
      return;
    }
    try {
      const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        this.workerUrl = URL.createObjectURL(blob);
        this.worker = new Worker(this.workerUrl);
        this.worker.onmessage = (e: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
          const { id, result, error } = e.data;
          const entry = this.pending.get(id);
          if (!entry) return;
          this.pending.delete(id);
          if (error) {
            entry.reject(new Error(error));
          } else {
            entry.resolve(result);
          }
        };
        this.worker.onerror = () => {
          // Graceful degradation to inline execution if Worker fails at runtime
          this.terminateWorker();
        };
      }
    } catch {
      this.worker = null;
    }
  }

  public isWorkerActive(): boolean {
    return this.worker !== null && !this.disposed;
  }

  public async verifyGhostTrajectory(
    input: ReplayVerificationInput
  ): Promise<ReplayVerificationResult> {
    if (!this.worker || this.disposed) {
      return verifyGhostTrajectorySync(input);
    }

    const id = this.nextRequestId++;
    return new Promise<ReplayVerificationResult>((resolve) => {
      const timeoutId = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          resolve(verifyGhostTrajectorySync(input));
        }
      }, 250);

      this.pending.set(id, {
        resolve: (res) => {
          clearTimeout(timeoutId);
          resolve(res as ReplayVerificationResult);
        },
        reject: () => {
          clearTimeout(timeoutId);
          resolve(verifyGhostTrajectorySync(input));
        }
      });

      this.worker!.postMessage({ id, type: 'VERIFY_GHOST', payload: input });
    });
  }

  public async solveBrickStep(
    input: BrickCollisionStepInput
  ): Promise<BrickCollisionStepOutput> {
    if (!this.worker || this.disposed) {
      return solveBrickCollisionStepSync(input);
    }

    const id = this.nextRequestId++;
    return new Promise<BrickCollisionStepOutput>((resolve) => {
      const timeoutId = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          resolve(solveBrickCollisionStepSync(input));
        }
      }, 50);

      this.pending.set(id, {
        resolve: (res) => {
          clearTimeout(timeoutId);
          resolve(res as BrickCollisionStepOutput);
        },
        reject: () => {
          clearTimeout(timeoutId);
          resolve(solveBrickCollisionStepSync(input));
        }
      });

      this.worker!.postMessage({ id, type: 'SOLVE_BRICK_STEP', payload: input });
    });
  }

  private terminateWorker(): void {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {}
      this.worker = null;
    }
    if (this.workerUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      try {
        URL.revokeObjectURL(this.workerUrl);
      } catch {}
      this.workerUrl = null;
    }
    this.pending.clear();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.terminateWorker();
  }
}
