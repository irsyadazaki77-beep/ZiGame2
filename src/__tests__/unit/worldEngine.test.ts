import { describe, it, expect } from 'vitest';
import {
  FixedParticlePool,
  SpatialHashGrid,
  swapAndPop
} from '../../components/games/world-box/spatialGrid';
import { WorldBoxEngine } from '../../components/games/world-box/worldEngine';
import {
  WorldBoxRenderer,
  screenToWorld
} from '../../components/games/world-box/worldRenderer';

describe('WorldBox 2.0 — SpatialHashGrid, Swap-and-Pop & Engine Unit Tests', () => {
  describe('swapAndPop (In-Place Zero-GC Removal)', () => {
    it('removes middle element in O(1) by swapping with last element', () => {
      const items = ['a', 'b', 'c', 'd'];
      swapAndPop(items, 1);
      expect(items.length).toBe(3);
      expect(items).toEqual(['a', 'd', 'c']);
    });

    it('removes last element cleanly and ignores out-of-bounds indices', () => {
      const items = [10, 20, 30];
      swapAndPop(items, 2);
      expect(items).toEqual([10, 20]);

      swapAndPop(items, -1);
      swapAndPop(items, 99);
      expect(items).toEqual([10, 20]);
    });
  });

  describe('SpatialHashGrid O(N) Neighborhood Queries', () => {
    it('indexes entities into spatial cells and queries radius accurately', () => {
      const grid = new SpatialHashGrid<{ id: number; x: number; y: number }>(100, 60, 6);
      const entities = [
        { id: 1, x: 10, y: 10 },
        { id: 2, x: 12, y: 11 },
        { id: 3, x: 85, y: 50 }
      ];
      grid.rebuild(entities);

      const buffer: Array<{ id: number; x: number; y: number }> = [];
      const nearOrigin = grid.queryRadius(10, 10, 5, buffer);
      expect(nearOrigin.map((e) => e.id).sort()).toEqual([1, 2]);

      const nearFarCorner = grid.queryNeighborhood3x3(85, 50, buffer);
      expect(nearFarCorner.map((e) => e.id)).toEqual([3]);
    });
  });

  describe('FixedParticlePool Zero-GC Ring Buffer', () => {
    it('reuses pre-allocated particle slots and updates active counts', () => {
      const pool = new FixedParticlePool(5);
      for (let i = 0; i < 8; i++) {
        pool.spawn(i, i, 0.5, 0.5, '#fde047', 2, 2);
      }
      expect(pool.activeCount).toBe(5);

      pool.updateAll();
      expect(pool.activeCount).toBe(5);

      pool.updateAll();
      expect(pool.activeCount).toBe(0);
    });
  });

  describe('WorldBoxEngine Simulation, Safe Inspector & Disasters', () => {
    it('tracks live units and transitions to Deceased record upon death', () => {
      const engine = new WorldBoxEngine({}, 48, 36);
      engine.generateWorld('pangaea', 42);

      // Ensure tile (24, 18) is land
      engine.state.biomes[18 * 48 + 24] = 'grass';
      const unit = engine.spawnUnitAt('human', 24, 18, ['Strong']);
      expect(unit).not.toBeNull();
      const uid = unit!.id;

      const liveCheck = engine.getInspectedUnitStatus(uid);
      expect(liveCheck?.status).toBe('alive');

      // Smite the unit and verify safe Deceased transition
      engine.smiteUnitById(uid);
      const deadCheck = engine.getInspectedUnitStatus(uid);
      expect(deadCheck?.status).toBe('deceased');
      if (deadCheck?.status === 'deceased') {
        expect(deadCheck.record.id).toBe(uid);
        expect(deadCheck.record.cause).toBe('Petir Dewa');
      }
    });

    it('marks terrainDirty on earthquake/biome tools and serializes/restores snapshots', () => {
      const engine = new WorldBoxEngine({}, 48, 36);
      engine.generateWorld('archipelago', 7);
      engine.state.terrainDirty = false;

      engine.applyToolAtTile('disaster_earthquake', 20, 15, 3, false);
      expect(engine.state.terrainDirty).toBe(true);

      const snapshot = engine.serializeSnapshot();
      const restoredEngine = new WorldBoxEngine({}, 48, 36);
      const ok = restoredEngine.loadSnapshot(snapshot);
      expect(ok).toBe(true);
      expect(restoredEngine.state.biomes).toEqual(engine.state.biomes);
    });

    it('computes frustum tile bounds, screenToWorld DPR mapping, and resetWorld terrainDirty in WorldBoxRenderer', () => {
      const engine = new WorldBoxEngine({}, 108, 66);
      engine.state.terrainDirty = false;
      engine.resetWorld('volcanic', 99);
      expect(engine.state.terrainDirty).toBe(true);

      const renderer = new WorldBoxRenderer();
      const bounds = renderer.getVisibleTileBounds(108, 66, { zoom: 2, panX: 0, panY: 0 }, 1728, 1056);
      expect(bounds.minTileX).toBeGreaterThan(20);
      expect(bounds.maxTileX).toBeLessThan(88);

      const mockCanvas = {
        width: 1728,
        height: 1056,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 864, height: 528 })
      } as unknown as HTMLCanvasElement;

      const centerPoint = screenToWorld(432, 264, mockCanvas, 108, 66, { zoom: 1, panX: 0, panY: 0 });
      expect(centerPoint.tx).toBe(54);
      expect(centerPoint.ty).toBe(33);

      renderer.dispose();
      engine.destroy();
    });
  });
});
