// ============================================================================
// WORLDBOX 2.0 — CANVAS 2D RENDERER WITH OFFSCREEN CACHING & FRUSTUM CULLING
// ============================================================================

import { BIOME_COLORS, RACE_CONFIG, TILE_SIZE } from './constants';
import { CameraState } from './types';
import { WorldBoxEngine } from './worldEngine';

export interface FrustumBounds {
  minTileX: number;
  maxTileX: number;
  minTileY: number;
  maxTileY: number;
}

export interface WorldCoordinatePoint {
  worldPx: number;
  worldPy: number;
  tx: number;
  ty: number;
}

/**
 * Converts a pointer event's client coordinates (`clientX`, `clientY`) into
 * exact world pixel and tile coordinates (`tx`, `ty`), accounting for responsive
 * container size, DPR canvas buffer scaling, base fit-to-screen scale, and camera zoom/pan.
 */
export function screenToWorld(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  gridW: number,
  gridH: number,
  camera: CameraState
): WorldCoordinatePoint {
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(1, rect.width);
  const cssH = Math.max(1, rect.height);
  const fullW = gridW * TILE_SIZE;
  const fullH = gridH * TILE_SIZE;
  const canvasW = canvas.width > 0 ? canvas.width : fullW;
  const canvasH = canvas.height > 0 ? canvas.height : fullH;

  const dpr = canvasW / cssW;
  const cx = (clientX - rect.left) * dpr;
  const cy = (clientY - rect.top) * dpr;

  const baseScale = Math.min(canvasW / fullW, canvasH / fullH) || 1;
  const effectiveScale = baseScale * camera.zoom;

  const worldPx = (cx - canvasW / 2 - camera.panX * dpr) / effectiveScale + fullW / 2;
  const worldPy = (cy - canvasH / 2 - camera.panY * dpr) / effectiveScale + fullH / 2;

  return {
    worldPx,
    worldPy,
    tx: Math.floor(worldPx / TILE_SIZE),
    ty: Math.floor(worldPy / TILE_SIZE)
  };
}

export class WorldBoxRenderer {
  private terrainCacheCanvas: HTMLCanvasElement | null = null;
  private terrainCacheCtx: CanvasRenderingContext2D | null = null;

  constructor() {
    this.ensureTerrainCacheCanvas();
  }

  private ensureTerrainCacheCanvas(): void {
    if (!this.terrainCacheCanvas && typeof document !== 'undefined') {
      this.terrainCacheCanvas = document.createElement('canvas');
      this.terrainCacheCtx = this.terrainCacheCanvas.getContext('2d');
    }
  }

  /**
   * Computes visible tile bounds in world coordinates for Frustum Culling.
   */
  public getVisibleTileBounds(
    gridW: number,
    gridH: number,
    camera: CameraState,
    canvasW?: number,
    canvasH?: number
  ): FrustumBounds {
    const fullW = gridW * TILE_SIZE;
    const fullH = gridH * TILE_SIZE;
    const viewW = canvasW && canvasW > 0 ? canvasW : fullW;
    const viewH = canvasH && canvasH > 0 ? canvasH : fullH;
    const baseScale = Math.min(viewW / fullW, viewH / fullH) || 1;
    const effectiveScale = baseScale * camera.zoom;

    const worldLeft = (0 - viewW / 2 - camera.panX) / effectiveScale + fullW / 2;
    const worldRight = (viewW - viewW / 2 - camera.panX) / effectiveScale + fullW / 2;
    const worldTop = (0 - viewH / 2 - camera.panY) / effectiveScale + fullH / 2;
    const worldBottom = (viewH - viewH / 2 - camera.panY) / effectiveScale + fullH / 2;

    const margin = 2;
    const minTileX = Math.max(0, Math.floor(worldLeft / TILE_SIZE) - margin);
    const maxTileX = Math.min(gridW - 1, Math.ceil(worldRight / TILE_SIZE) + margin);
    const minTileY = Math.max(0, Math.floor(worldTop / TILE_SIZE) - margin);
    const maxTileY = Math.min(gridH - 1, Math.ceil(worldBottom / TILE_SIZE) + margin);

    return { minTileX, maxTileX, minTileY, maxTileY };
  }

  /**
   * Re-renders the offscreen static terrain canvas ONLY when `state.terrainDirty === true`
   * or when the offscreen canvas is first created/resized (`forceRedraw === true`).
   */
  public updateTerrainCacheIfNeeded(engine: WorldBoxEngine): void {
    const s = engine.state;
    this.ensureTerrainCacheCanvas();
    if (!this.terrainCacheCanvas || !this.terrainCacheCtx) return;

    const fullW = s.gridW * TILE_SIZE;
    const fullH = s.gridH * TILE_SIZE;
    let forceRedraw = false;

    if (this.terrainCacheCanvas.width !== fullW || this.terrainCacheCanvas.height !== fullH) {
      this.terrainCacheCanvas.width = fullW;
      this.terrainCacheCanvas.height = fullH;
      forceRedraw = true;
      s.terrainDirty = true;
    }

    if (!s.terrainDirty && !forceRedraw) return;

    const tCtx = this.terrainCacheCtx;
    tCtx.imageSmoothingEnabled = false;

    for (let y = 0; y < s.gridH; y++) {
      const rowOffset = y * s.gridW;
      const py = y * TILE_SIZE;
      for (let x = 0; x < s.gridW; x++) {
        const biome = s.biomes[rowOffset + x];
        const palette = BIOME_COLORS[biome] ?? ['#0f172a', '#1e293b'];
        tCtx.fillStyle = palette[(x + y) % 2];
        tCtx.fillRect(x * TILE_SIZE, py, TILE_SIZE, TILE_SIZE);
      }
    }

    s.terrainDirty = false;
  }

  public render(
    canvas: HTMLCanvasElement,
    engine: WorldBoxEngine,
    camera: CameraState,
    selectedUnitId: number | null
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = engine.state;
    const laws = engine.laws;
    const fullW = s.gridW * TILE_SIZE;
    const fullH = s.gridH * TILE_SIZE;

    // Only fallback to fullW x fullH if ResizeObserver hasn't initialized canvas dimensions yet
    if (canvas.width === 0 || canvas.height === 0) {
      canvas.width = fullW;
      canvas.height = fullH;
    }

    const canvasW = canvas.width;
    const canvasH = canvas.height;
    const cssW = canvas.clientWidth > 0 ? canvas.clientWidth : canvasW;
    const dpr = canvasW / Math.max(1, cssW);

    this.updateTerrainCacheIfNeeded(engine);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#071324';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Compute proportional fit-to-screen base scale + camera zoom/pan
    const baseScale = Math.min(canvasW / fullW, canvasH / fullH) || 1;
    const effectiveScale = baseScale * camera.zoom;

    ctx.translate(canvasW / 2 + camera.panX * dpr, canvasH / 2 + camera.panY * dpr);
    ctx.scale(effectiveScale, effectiveScale);
    ctx.translate(-fullW / 2, -fullH / 2);

    // 1. Blit cached static terrain in a single drawImage call
    if (this.terrainCacheCanvas) {
      ctx.drawImage(this.terrainCacheCanvas, 0, 0, fullW, fullH);
    }

    // Compute visible frustum bounds in world tiles
    const bounds = this.getVisibleTileBounds(s.gridW, s.gridH, camera, canvasW, canvasH);

    const kingdomColorLookup = new Map<number, string>();
    for (let i = 0; i < s.kingdoms.length; i++) {
      kingdomColorLookup.set(s.kingdoms[i].id, s.kingdoms[i].color);
    }

    // 2. Render visible dynamic tile overlays (Kingdom Territory & Resources)
    for (let y = bounds.minTileY; y <= bounds.maxTileY; y++) {
      const rowOffset = y * s.gridW;
      const py = y * TILE_SIZE;
      for (let x = bounds.minTileX; x <= bounds.maxTileX; x++) {
        const idx = rowOffset + x;
        const px = x * TILE_SIZE;

        if (laws.showKingdomBorders && s.territory[idx] !== -1) {
          const kColor = kingdomColorLookup.get(s.territory[idx]);
          if (kColor) {
            ctx.fillStyle = kColor + '28';
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

            const rightDiff = x < s.gridW - 1 && s.territory[idx + 1] !== s.territory[idx];
            const bottomDiff = y < s.gridH - 1 && s.territory[idx + s.gridW] !== s.territory[idx];
            if (rightDiff || bottomDiff) {
              ctx.fillStyle = kColor + 'aa';
              if (rightDiff) ctx.fillRect(px + TILE_SIZE - 1, py, 1, TILE_SIZE);
              if (bottomDiff) ctx.fillRect(px, py + TILE_SIZE - 1, TILE_SIZE, 1);
            }
          }
        }

        const res = s.resources[idx];
        if (res === 'none') continue;
        if (res === 'tree') {
          ctx.fillStyle = '#78350f';
          ctx.fillRect(px + 3, py + 5, 2, 3);
          ctx.fillStyle = '#15803d';
          ctx.fillRect(px + 1, py + 1, 6, 4);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(px + 2, py, 4, 2);
        } else if (res === 'berry') {
          ctx.fillStyle = '#166534';
          ctx.fillRect(px + 2, py + 2, 4, 4);
          ctx.fillStyle = '#f43f5e';
          ctx.fillRect(px + 2, py + 2, 2, 2);
          ctx.fillRect(px + 4, py + 4, 2, 2);
        } else if (res === 'stone') {
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(px + 1, py + 2, 5, 5);
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(px + 2, py + 2, 3, 2);
        } else if (res === 'gold') {
          ctx.fillStyle = '#ca8a04';
          ctx.fillRect(px + 1, py + 2, 6, 5);
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(px + 2, py + 3, 3, 2);
        } else if (res === 'fire') {
          ctx.fillStyle = s.tickCount % 4 < 2 ? '#f97316' : '#fde047';
          ctx.fillRect(px + 2, py + 1, 4, 6);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(px + 1, py + 4, 6, 3);
        }
      }
    }

    // 3. Render visible Buildings (Frustum Culled)
    for (let i = 0; i < s.buildings.length; i++) {
      const b = s.buildings[i];
      if (
        b.x < bounds.minTileX ||
        b.x > bounds.maxTileX ||
        b.y < bounds.minTileY ||
        b.y > bounds.maxTileY
      ) {
        continue;
      }
      const bx = b.x * TILE_SIZE;
      const by = b.y * TILE_SIZE;
      const raceColor = RACE_CONFIG[b.race].primaryColor;

      if (b.type === 'hall') {
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(bx - 2, by - 2, 12, 10);
        ctx.fillStyle = raceColor;
        ctx.fillRect(bx - 3, by - 5, 14, 4);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(bx + 2, by - 8, 4, 3);
      } else if (b.type === 'tower') {
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(bx + 1, by - 3, 6, 11);
        ctx.fillStyle = raceColor;
        ctx.fillRect(bx, by - 5, 8, 3);
      } else if (b.type === 'mine') {
        ctx.fillStyle = '#475569';
        ctx.fillRect(bx, by + 1, 8, 7);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(bx + 2, by + 3, 4, 4);
      } else {
        ctx.fillStyle = '#d6d3d1';
        ctx.fillRect(bx + 1, by + 2, 6, 6);
        ctx.fillStyle = raceColor;
        ctx.fillRect(bx, by, 8, 3);
      }
    }

    // 4. Render visible Units (Frustum Culled) + Selected Unit Highlight Ring
    for (let i = 0; i < s.units.length; i++) {
      const u = s.units[i];
      if (
        u.x < bounds.minTileX ||
        u.x > bounds.maxTileX + 1 ||
        u.y < bounds.minTileY ||
        u.y > bounds.maxTileY + 1
      ) {
        continue;
      }

      const ux = Math.round(u.x * TILE_SIZE);
      const uy = Math.round(u.y * TILE_SIZE);
      const cfg = RACE_CONFIG[u.race];
      const bob = Math.floor(u.animFrame / 8) % 2;

      if (u.race === 'dragon') {
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(ux - 8, uy - 4 + bob, 16, 8);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(ux - 4, uy - 7 + bob, 8, 12);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(ux - 2, uy - 6 + bob, 2, 2);
        ctx.fillRect(ux + 1, uy - 6 + bob, 2, 2);
      } else if (u.race === 'ufo') {
        ctx.fillStyle = '#64748b';
        ctx.fillRect(ux - 6, uy - 2, 12, 4);
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(ux - 3, uy - 5, 6, 3);
      } else if (u.race === 'tornado') {
        const spin = u.animFrame % 4;
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(ux - 5 + spin, uy - 8, 10, 3);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(ux - 4 - spin, uy - 5, 8, 4);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(ux - 2, uy - 1, 4, 4);
      } else {
        const scale = u.traits.includes('Giant') ? 1.5 : 1;
        const w = Math.round(4 * scale);
        const h = Math.round(5 * scale);

        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(ux - w / 2, uy + h / 2, w, 2);

        ctx.fillStyle = cfg.primaryColor;
        ctx.fillRect(ux - w / 2, uy - h / 2 - bob, w, h);

        ctx.fillStyle = u.race === 'orc' ? '#4ade80' : '#fed7aa';
        ctx.fillRect(ux - w / 2, uy - h / 2 - 2 - bob, w, 2);

        if (u.isKing) {
          ctx.fillStyle = '#facc15';
          ctx.fillRect(ux - 2, uy - h / 2 - 5 - bob, 5, 3);
        }

        if (u.traits.includes('Blessed')) {
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 1;
          ctx.strokeRect(ux - 4, uy - 6, 8, 10);
        }
      }

      if (selectedUnitId !== null && selectedUnitId === u.id) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ux, uy - 1, 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(ux - 6, uy - 8, 12, 14);
      }
    }

    // 5. Render Kingdom Name Banners
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < s.kingdoms.length; i++) {
      const k = s.kingdoms[i];
      if (
        k.capitalX < bounds.minTileX ||
        k.capitalX > bounds.maxTileX ||
        k.capitalY < bounds.minTileY ||
        k.capitalY > bounds.maxTileY
      ) {
        continue;
      }
      const kx = (k.capitalX + 0.5) * TILE_SIZE;
      const ky = k.capitalY * TILE_SIZE - 8;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
      const textW = ctx.measureText(k.name).width + 8;
      ctx.fillRect(kx - textW / 2, ky - 8, textW, 11);
      ctx.fillStyle = k.borderColor;
      ctx.fillText(k.name, kx, ky);
    }

    // 6. Render Active Particles from FixedParticlePool (Frustum Culled)
    const pool = engine.particlePool.pool;
    const cap = engine.particlePool.capacity;
    for (let i = 0; i < cap; i++) {
      const p = pool[i];
      if (!p.active) continue;
      if (
        p.x < bounds.minTileX ||
        p.x > bounds.maxTileX + 1 ||
        p.y < bounds.minTileY ||
        p.y > bounds.maxTileY + 1
      ) {
        continue;
      }
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x * TILE_SIZE, p.y * TILE_SIZE, p.size, p.size);
    }

    // 7. Render Shockwaves
    for (let i = 0; i < s.shockwaves.length; i++) {
      const sw = s.shockwaves[i];
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = sw.alpha;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sw.x * TILE_SIZE, sw.y * TILE_SIZE, sw.radius * TILE_SIZE, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  public dispose(): void {
    this.terrainCacheCanvas = null;
    this.terrainCacheCtx = null;
  }

  public destroy(): void {
    this.dispose();
  }
}
