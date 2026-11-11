import { GhostDeltaPoint, GhostPoint, GhostRunData } from '../types';

const PREFIX = 'zigame_ghost_';
const MAX_BUFFER_CAP = 2500;
const DOWNSAMPLE_TARGET = 1800;
const MIN_IDLE_INTERVAL_MS = 100; // 10 FPS for linear idle motion
const DIRECTION_CHANGE_RAD_THRESHOLD = 0.25; // Significant angle change (~14.3 degrees)
const VELOCITY_RATIO_CHANGE_THRESHOLD = 0.35; // 35% speed change threshold

/**
 * Fast 32-bit FNV-1a checksum hash function for verifying replay payload integrity.
 */
export function computeGhostChecksum(data: Omit<GhostRunData, 'checksum'>): string {
  const serialized = `${data.gameId}:${data.score}:${data.durationMs}:${data.recordedAt}:${data.gameVersion}:${
    data.points?.length || 0
  }:${data.deltaPoints?.length || 0}:${
    data.deltaPoints
      ? data.deltaPoints.map(d => `${d.dt},${d.dx ?? ''},${d.dy ?? ''},${d.a ?? ''},${d.s ?? ''}`).join(';')
      : data.points.map(p => `${p.t},${p.x ?? ''},${p.y ?? ''},${p.a ?? ''},${p.s ?? ''}`).join(';')
  }`;

  let hash = 0x811c9dc5;
  for (let i = 0; i < serialized.length; i++) {
    hash ^= serialized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Validates a loaded GhostRunData against its checksum.
 */
export function verifyGhostChecksum(data: GhostRunData): boolean {
  if (!data || !data.checksum) return false;
  const { checksum, ...rest } = data;
  return computeGhostChecksum(rest) === checksum;
}

/**
 * Downsamples linear intermediate points in the middle of long replays
 * while preserving keyframe boundaries and player actions.
 */
export function downsampleLinearPoints(points: GhostPoint[], targetCount = DOWNSAMPLE_TARGET): GhostPoint[] {
  if (points.length <= targetCount) return points;

  const result: GhostPoint[] = [];
  const keepIndices = new Set<number>();

  // Always keep first and last points
  keepIndices.add(0);
  keepIndices.add(points.length - 1);

  // Always keep any points with actions or score changes
  for (let i = 0; i < points.length; i++) {
    if (points[i].a !== undefined || points[i].s !== undefined) {
      keepIndices.add(i);
    }
  }

  // Calculate curvature/significance score for remaining points
  const candidates: { index: number; score: number }[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    if (keepIndices.has(i)) continue;

    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    if (curr.x !== undefined && curr.y !== undefined && prev.x !== undefined && prev.y !== undefined && next.x !== undefined && next.y !== undefined) {
      // Perpendicular distance from curr to line(prev -> next)
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const lineLen = Math.hypot(dx, dy);
      const dev = lineLen > 0 ? Math.abs((curr.x - prev.x) * dy - (curr.y - prev.y) * dx) / lineLen : 0;
      candidates.push({ index: i, score: dev });
    } else {
      candidates.push({ index: i, score: 0 });
    }
  }

  // Sort candidates by deviation descending, pick highest importance
  candidates.sort((a, b) => b.score - a.score);
  const slotsRemaining = Math.max(0, targetCount - keepIndices.size);
  for (let i = 0; i < Math.min(slotsRemaining, candidates.length); i++) {
    keepIndices.add(candidates[i].index);
  }

  for (let i = 0; i < points.length; i++) {
    if (keepIndices.has(i)) {
      result.push(points[i]);
    }
  }

  return result;
}

export function encodeDeltaTrajectory(points: GhostPoint[]): GhostDeltaPoint[] {
  if (points.length === 0) return [];
  const deltas: GhostDeltaPoint[] = [];
  let prevT = 0;
  let prevX = 0;
  let prevY = 0;
  let prevS = 0;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const dt = Math.max(0, Math.round(pt.t - prevT));
    prevT = pt.t;

    const deltaPoint: GhostDeltaPoint = { dt };

    if (pt.x !== undefined) {
      const qx = Math.round(pt.x * 10) / 10;
      deltaPoint.dx = Math.round((qx - prevX) * 10) / 10;
      prevX = qx;
    }

    if (pt.y !== undefined) {
      const qy = Math.round(pt.y * 10) / 10;
      deltaPoint.dy = Math.round((qy - prevY) * 10) / 10;
      prevY = qy;
    }

    if (pt.a !== undefined) {
      deltaPoint.a = pt.a;
    }

    if (pt.s !== undefined) {
      const ds = pt.s - prevS;
      if (ds !== 0 || i === 0) {
        deltaPoint.s = ds;
      }
      prevS = pt.s;
    }

    deltas.push(deltaPoint);
  }

  return deltas;
}

export function decodeDeltaTrajectory(deltas: GhostDeltaPoint[]): GhostPoint[] {
  if (deltas.length === 0) return [];
  const points: GhostPoint[] = [];
  let curT = 0;
  let curX = 0;
  let curY = 0;
  let curS = 0;
  let hasX = false;
  let hasY = false;
  let hasS = false;

  for (const d of deltas) {
    curT += d.dt;
    if (d.dx !== undefined) {
      curX = Math.round((curX + d.dx) * 10) / 10;
      hasX = true;
    }
    if (d.dy !== undefined) {
      curY = Math.round((curY + d.dy) * 10) / 10;
      hasY = true;
    }
    if (d.s !== undefined) {
      curS += d.s;
      hasS = true;
    }

    const pt: GhostPoint = { t: curT };
    if (hasX && d.dx !== undefined) pt.x = curX;
    if (hasY && d.dy !== undefined) pt.y = curY;
    if (d.a !== undefined) pt.a = d.a;
    if (hasS && d.s !== undefined) pt.s = curS;
    points.push(pt);
  }

  return points;
}

class ReplayService {
  private activeRecording: {
    gameId: string;
    startTime: number;
    lastRecordedAtMs: number;
    lastX?: number;
    lastY?: number;
    lastVx?: number;
    lastVy?: number;
    points: GhostPoint[];
  } | null = null;

  public startRecording(gameId: string): void {
    this.activeRecording = {
      gameId,
      startTime: performance.now(),
      lastRecordedAtMs: -Infinity,
      points: []
    };
  }

  /**
   * Adaptive / Keyframe trajectory recording:
   * Only records when:
   * a) Player triggers an action (action defined)
   * b) Direction of movement or velocity changes significantly (turn, jump, bounce)
   * c) Minimum idle interval has elapsed (~100ms / 10 FPS for linear idle motion)
   */
  public recordPoint(x?: number, y?: number, action?: string, score?: number): void {
    if (!this.activeRecording) return;

    // Auto-downsample middle linear points if reaching buffer capacity threshold
    if (this.activeRecording.points.length >= MAX_BUFFER_CAP) {
      this.activeRecording.points = downsampleLinearPoints(this.activeRecording.points, DOWNSAMPLE_TARGET);
    }

    const t = Math.round(performance.now() - this.activeRecording.startTime);
    const qx = x !== undefined ? Math.round(x * 10) / 10 : undefined;
    const qy = y !== undefined ? Math.round(y * 10) / 10 : undefined;

    const isFirstPoint = this.activeRecording.points.length === 0;
    const isActionTriggered = action !== undefined && action.trim().length > 0;
    const isScoreChanged = score !== undefined;

    let shouldRecord = isFirstPoint || isActionTriggered || isScoreChanged;

    const dtFromLast = t - this.activeRecording.lastRecordedAtMs;

    if (!shouldRecord && qx !== undefined && qy !== undefined && this.activeRecording.lastX !== undefined && this.activeRecording.lastY !== undefined && dtFromLast > 0) {
      const curVx = (qx - this.activeRecording.lastX) / dtFromLast;
      const curVy = (qy - this.activeRecording.lastY) / dtFromLast;

      if (this.activeRecording.lastVx !== undefined && this.activeRecording.lastVy !== undefined) {
        const lastSpeed = Math.hypot(this.activeRecording.lastVx, this.activeRecording.lastVy);
        const curSpeed = Math.hypot(curVx, curVy);

        // a) Significant speed change check
        if (Math.abs(curSpeed - lastSpeed) > VELOCITY_RATIO_CHANGE_THRESHOLD * Math.max(lastSpeed, 0.1)) {
          shouldRecord = true;
        } else if (lastSpeed > 0.01 && curSpeed > 0.01) {
          // b) Direction angle change check (dot product / angle delta)
          const dot = (this.activeRecording.lastVx * curVx + this.activeRecording.lastVy * curVy) / (lastSpeed * curSpeed);
          const clampedDot = Math.max(-1, Math.min(1, dot));
          const angleDelta = Math.acos(clampedDot);
          if (angleDelta >= DIRECTION_CHANGE_RAD_THRESHOLD) {
            shouldRecord = true;
          }
        }
      } else {
        shouldRecord = true;
      }

      // c) Minimum idle interval fallback
      if (!shouldRecord && dtFromLast >= MIN_IDLE_INTERVAL_MS) {
        shouldRecord = true;
      }

      if (shouldRecord) {
        this.activeRecording.lastVx = curVx;
        this.activeRecording.lastVy = curVy;
      }
    } else if (dtFromLast >= MIN_IDLE_INTERVAL_MS) {
      shouldRecord = true;
    }

    if (!shouldRecord) return;

    this.activeRecording.lastRecordedAtMs = t;
    if (qx !== undefined) this.activeRecording.lastX = qx;
    if (qy !== undefined) this.activeRecording.lastY = qy;

    this.activeRecording.points.push({
      t,
      x: qx,
      y: qy,
      a: action,
      s: score
    });
  }

  public finishRecording(finalScore: number, gameVersion: string = '1.0.0'): GhostRunData | null {
    if (!this.activeRecording || this.activeRecording.points.length === 0) {
      this.activeRecording = null;
      return null;
    }

    const durationMs = Math.round(performance.now() - this.activeRecording.startTime);
    const deltaPoints = encodeDeltaTrajectory(this.activeRecording.points);

    const unsignedGhostData: Omit<GhostRunData, 'checksum'> = {
      gameId: this.activeRecording.gameId,
      score: finalScore,
      durationMs,
      recordedAt: Date.now(),
      points: this.activeRecording.points,
      deltaPoints,
      encoding: 'delta',
      sampleIntervalMs: MIN_IDLE_INTERVAL_MS,
      gameVersion
    };

    const checksum = computeGhostChecksum(unsignedGhostData);
    const ghostData: GhostRunData = {
      ...unsignedGhostData,
      checksum
    };

    // Check if this run is higher score than existing ghost
    const existingGhost = this.getGhostRun(this.activeRecording.gameId);
    if (!existingGhost || finalScore > existingGhost.score) {
      this.saveGhostRun(ghostData);
    }

    this.activeRecording = null;
    return ghostData;
  }

  public discardRecording(): void {
    this.activeRecording = null;
  }

  public getGhostRun(gameId: string): GhostRunData | null {
    try {
      const raw = localStorage.getItem(`${PREFIX}${gameId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as GhostRunData;

      // Validate integrity checksum
      if (!verifyGhostChecksum(parsed)) {
        return null;
      }

      // Rehydrate points from deltaPoints if needed
      if ((!parsed.points || parsed.points.length === 0) && Array.isArray(parsed.deltaPoints)) {
        parsed.points = decodeDeltaTrajectory(parsed.deltaPoints);
      }
      return parsed;
    } catch {
      return null;
    }
  }

  public saveGhostRun(data: GhostRunData): void {
    try {
      const deltaPoints = data.deltaPoints ?? encodeDeltaTrajectory(data.points);
      const unsignedRecord: Omit<GhostRunData, 'checksum'> = {
        ...data,
        deltaPoints,
        encoding: 'delta'
      };
      const checksum = computeGhostChecksum(unsignedRecord);
      const signedRecord: GhostRunData = {
        ...unsignedRecord,
        checksum
      };
      localStorage.setItem(`${PREFIX}${data.gameId}`, JSON.stringify(signedRecord));
    } catch {}
  }
}

export const replayService = new ReplayService();
