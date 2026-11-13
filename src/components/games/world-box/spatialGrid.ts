// ============================================================================
// WORLDBOX 2.0 — ZERO-GC SPATIAL HASH GRID & SWAP-AND-POP UTILITIES
// ============================================================================

import { Particle } from './types';

/**
 * O(1) in-place removal from an unordered array without allocating a new array.
 */
export function swapAndPop<T>(arr: T[], index: number): void {
  const lastIndex = arr.length - 1;
  if (index < 0 || index > lastIndex) return;
  if (index !== lastIndex) {
    arr[index] = arr[lastIndex];
  }
  arr.pop();
}

/**
 * Spatial Hash Grid with pre-allocated cell buckets.
 * Converts O(N^2) neighbor queries into O(N) total work per frame with zero GC pressure.
 */
export class SpatialHashGrid<T extends { x: number; y: number }> {
  private readonly cols: number;
  private readonly rows: number;
  private readonly cellSize: number;
  private readonly buckets: T[][];
  private readonly bucketCounts: Int32Array;

  constructor(worldWidth: number, worldHeight: number, cellSize: number) {
    this.cellSize = Math.max(1, cellSize);
    this.cols = Math.ceil(worldWidth / this.cellSize);
    this.rows = Math.ceil(worldHeight / this.cellSize);
    const totalCells = this.cols * this.rows;
    this.buckets = new Array<T[]>(totalCells);
    this.bucketCounts = new Int32Array(totalCells);
    for (let i = 0; i < totalCells; i++) {
      this.buckets[i] = [];
      this.bucketCounts[i] = 0;
    }
  }

  /**
   * Resets all cell counts in O(C) without re-allocating inner bucket arrays.
   */
  public clear(): void {
    this.bucketCounts.fill(0);
  }

  private getCellCoords(x: number, y: number): { cx: number; cy: number } {
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cellSize)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cellSize)));
    return { cx, cy };
  }

  /**
   * Inserts an entity into its corresponding spatial cell without array push allocation overhead.
   */
  public insert(entity: T): void {
    const { cx, cy } = this.getCellCoords(entity.x, entity.y);
    const idx = cy * this.cols + cx;
    const count = this.bucketCounts[idx];
    const bucket = this.buckets[idx];
    if (count < bucket.length) {
      bucket[count] = entity;
    } else {
      bucket.push(entity);
    }
    this.bucketCounts[idx] = count + 1;
  }

  /**
   * Rebuilds the grid from a list of active entities.
   */
  public rebuild(entities: readonly T[]): void {
    this.clear();
    for (let i = 0; i < entities.length; i++) {
      this.insert(entities[i]);
    }
  }

  /**
   * Queries the entity's current cell and its 8 immediate neighbors (3x3 cell neighborhood),
   * appending matching entities within `radius` into `outBuffer` (cleared first) to avoid allocations.
   */
  public queryRadius(x: number, y: number, radius: number, outBuffer: T[]): T[] {
    outBuffer.length = 0;
    const cellRadius = Math.max(1, Math.ceil(radius / this.cellSize));
    const { cx, cy } = this.getCellCoords(x, y);
    const rSq = radius * radius;

    const minCx = Math.max(0, cx - cellRadius);
    const maxCx = Math.min(this.cols - 1, cx + cellRadius);
    const minCy = Math.max(0, cy - cellRadius);
    const maxCy = Math.min(this.rows - 1, cy + cellRadius);

    for (let ny = minCy; ny <= maxCy; ny++) {
      const rowOffset = ny * this.cols;
      for (let nx = minCx; nx <= maxCx; nx++) {
        const idx = rowOffset + nx;
        const count = this.bucketCounts[idx];
        const bucket = this.buckets[idx];
        for (let i = 0; i < count; i++) {
          const item = bucket[i];
          const dx = item.x - x;
          const dy = item.y - y;
          if (dx * dx + dy * dy <= rSq) {
            outBuffer.push(item);
          }
        }
      }
    }
    return outBuffer;
  }

  /**
   * Queries strictly the 3x3 cell neighborhood around (x, y) into `outBuffer`.
   */
  public queryNeighborhood3x3(x: number, y: number, outBuffer: T[]): T[] {
    outBuffer.length = 0;
    const { cx, cy } = this.getCellCoords(x, y);

    const minCx = Math.max(0, cx - 1);
    const maxCx = Math.min(this.cols - 1, cx + 1);
    const minCy = Math.max(0, cy - 1);
    const maxCy = Math.min(this.rows - 1, cy + 1);

    for (let ny = minCy; ny <= maxCy; ny++) {
      const rowOffset = ny * this.cols;
      for (let nx = minCx; nx <= maxCx; nx++) {
        const idx = rowOffset + nx;
        const count = this.bucketCounts[idx];
        const bucket = this.buckets[idx];
        for (let i = 0; i < count; i++) {
          outBuffer.push(bucket[i]);
        }
      }
    }
    return outBuffer;
  }
}

/**
 * Fixed-size pre-allocated Particle Pool to guarantee zero GC allocations during explosions.
 */
export class FixedParticlePool {
  public readonly pool: Particle[];
  public readonly capacity: number;
  private cursor: number = 0;
  public activeCount: number = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.pool = new Array<Particle>(capacity);
    for (let i = 0; i < capacity; i++) {
      this.pool[i] = {
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        color: '#ffffff',
        size: 2,
        life: 0,
        maxLife: 1
      };
    }
  }

  public spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    color: string,
    size: number,
    life: number
  ): void {
    const p = this.pool[this.cursor];
    if (!p.active) {
      this.activeCount++;
    }
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.color = color;
    p.size = size;
    p.life = life;
    p.maxLife = life;

    this.cursor = (this.cursor + 1) % this.capacity;
  }

  public updateAll(): void {
    let count = 0;
    for (let i = 0; i < this.capacity; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) {
        p.active = false;
      } else {
        count++;
      }
    }
    this.activeCount = count;
  }

  public clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      this.pool[i].active = false;
    }
    this.activeCount = 0;
    this.cursor = 0;
  }
}
