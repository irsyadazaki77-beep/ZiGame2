/**
 * High-Performance Zero-Allocation Particle Pool for ZiGame Canvas Games
 * Eliminates Array allocation and GC spikes during intense gameplay.
 */

export interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

import { performanceService } from '../services/performanceService';

export class ParticlePool {
  private pool: PooledParticle[];
  private maxSize: number;

  constructor(maxSize: number = 250) {
    this.maxSize = maxSize;
    this.pool = Array.from({ length: maxSize }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      alpha: 1,
      size: 2,
      color: '#ffffff',
      life: 0,
      maxLife: 30
    }));
  }

  public spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    color: string,
    size: number = 2,
    alpha: number = 1,
    maxLife: number = 30
  ): PooledParticle | null {
    // Adaptive particle throttling based on active performance tier
    const mult = performanceService.getFastSettings().particlesMultiplier ?? 1.0;
    if (mult < 1.0 && Math.random() > mult) {
      return null;
    }

    // Find first inactive slot
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = vx;
        p.vy = vy;
        p.color = color;
        p.size = size;
        p.alpha = alpha;
        p.life = 0;
        p.maxLife = maxLife;
        return p;
      }
    }
    return null;
  }

  public update(updateFn?: (p: PooledParticle) => void): void {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      if (updateFn) {
        updateFn(p);
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);
        if (p.life >= p.maxLife || p.alpha <= 0) {
          p.active = false;
        }
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D, customDraw?: (ctx: CanvasRenderingContext2D, p: PooledParticle) => void): void {
    const isLowTier = performanceService.getFastSettings().tier === 'low';

    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active || p.alpha <= 0) continue;

      if (customDraw) {
        customDraw(ctx, p);
      } else {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        // Fast rectangle rendering for small particles on low tier / battery saver
        if (isLowTier && p.size <= 4) {
          ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1.0;
  }

  public clear(): void {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
    }
  }

  public getActiveCount(): number {
    let count = 0;
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) count++;
    }
    return count;
  }
}
