// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ObjectPool } from '../sdk/objectPool';
import { Canvas2DStageController } from '../sdk/canvas2dStageController';

interface TestParticle {
  id: number;
  x: number;
  y: number;
  active: boolean;
}

describe('ZiGame SDK Core Primitives — ObjectPool & Canvas2DStageController', () => {
  describe('ObjectPool<T> (Zero-GC Swap-and-Pop)', () => {
    it('pre-allocates initialSize items and reuses pooled instances on acquire()', () => {
      let nextId = 1;
      const factory = vi.fn((): TestParticle => ({
        id: nextId++,
        x: 0,
        y: 0,
        active: false
      }));
      const reset = vi.fn((p: TestParticle) => {
        p.x = 0;
        p.y = 0;
        p.active = false;
      });

      const pool = new ObjectPool<TestParticle>(factory, reset, 3);
      expect(factory).toHaveBeenCalledTimes(3);
      expect(pool.freeCount).toBe(3);
      expect(pool.activeCount).toBe(0);

      const p1 = pool.acquire();
      const p2 = pool.acquire();
      const p3 = pool.acquire();
      expect(factory).toHaveBeenCalledTimes(3); // Zero extra allocations
      expect(pool.activeCount).toBe(3);
      expect(pool.freeCount).toBe(0);

      // Exceeding initial capacity allocates a 4th item cleanly
      const p4 = pool.acquire();
      expect(factory).toHaveBeenCalledTimes(4);
      expect(pool.activeCount).toBe(4);
      expect(new Set([p1.id, p2.id, p3.id, p4.id]).size).toBe(4);
    });

    it('removes items in-place via swap-and-pop without duplicates, leaks, or array reallocation', () => {
      let nextId = 1;
      const pool = new ObjectPool<TestParticle>(
        () => ({ id: nextId++, x: 0, y: 0, active: false }),
        (p) => {
          p.x = 0;
          p.y = 0;
          p.active = false;
        },
        4
      );

      const activeRef = pool.getActiveItems();
      const a = pool.acquire();
      a.active = true;
      const b = pool.acquire();
      b.active = true;
      const c = pool.acquire();
      c.active = true;
      const d = pool.acquire();
      d.active = true;

      // Release index 1 ('b') -> 'd' should swap into index 1
      pool.release(1);
      expect(pool.getActiveItems()).toBe(activeRef); // Same array instance (Zero-GC)
      expect(pool.activeCount).toBe(3);
      expect(pool.freeCount).toBe(1);
      expect(b.active).toBe(false); // reset() invoked
      expect(pool.getActiveItems().map((item) => item.id)).toEqual([a.id, d.id, c.id]);

      // Out-of-bounds release is safely ignored
      pool.release(-1);
      pool.release(99);
      expect(pool.activeCount).toBe(3);

      // Re-acquiring should reuse the exact released object reference (`b`)
      const reused = pool.acquire();
      expect(reused).toBe(b);
      expect(pool.activeCount).toBe(4);
      expect(new Set(pool.getActiveItems()).size).toBe(4);
    });

    it('releaseAll() returns all active items to pool, resets them, and prevents leaks', () => {
      let nextId = 1;
      const pool = new ObjectPool<TestParticle>(
        () => ({ id: nextId++, x: 10, y: 20, active: true }),
        (p) => {
          p.x = 0;
          p.y = 0;
          p.active = false;
        },
        2
      );

      const items = [pool.acquire(), pool.acquire(), pool.acquire()];
      items.forEach((p) => {
        p.x = 55;
        p.y = 77;
        p.active = true;
      });

      expect(pool.activeCount).toBe(3);
      pool.releaseAll();

      expect(pool.activeCount).toBe(0);
      expect(pool.freeCount).toBe(3);
      expect(pool.getActiveItems()).toHaveLength(0);
      items.forEach((p) => {
        expect(p.active).toBe(false);
        expect(p.x).toBe(0);
        expect(p.y).toBe(0);
      });

      // Next 3 acquires reuse existing pool without growing totalAllocated
      const reacquired = [pool.acquire(), pool.acquire(), pool.acquire()];
      expect(pool.totalAllocated).toBe(3);
      expect(new Set(reacquired).size).toBe(3);
    });
  });

  describe('Canvas2DStageController (ResizeObserver, DPR, Camera Transform & screenToWorld)', () => {
    const originalDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    const originalResizeObserver = globalThis.ResizeObserver;

    beforeEach(() => {
      Object.defineProperty(window, 'devicePixelRatio', {
        configurable: true,
        writable: true,
        value: 1
      });
    });

    afterEach(() => {
      if (originalDpr) {
        Object.defineProperty(window, 'devicePixelRatio', originalDpr);
      }
      globalThis.ResizeObserver = originalResizeObserver;
    });

    function createMockStage(options: {
      cssW: number;
      cssH: number;
      rectLeft?: number;
      rectTop?: number;
      dpr?: number;
      logicalWidth?: number;
      logicalHeight?: number;
    }) {
      Object.defineProperty(window, 'devicePixelRatio', {
        configurable: true,
        writable: true,
        value: options.dpr ?? 1
      });

      const rectLeft = options.rectLeft ?? 0;
      const rectTop = options.rectTop ?? 0;

      const parent = {
        clientWidth: options.cssW,
        clientHeight: options.cssH
      } as unknown as HTMLElement;

      const setTransformSpy = vi.fn();
      const mockCtx = {
        setTransform: setTransformSpy
      } as unknown as CanvasRenderingContext2D;

      const canvas = {
        width: 0,
        height: 0,
        clientWidth: options.cssW,
        clientHeight: options.cssH,
        parentElement: parent,
        getContext: vi.fn(() => mockCtx),
        getBoundingClientRect: () => ({
          left: rectLeft,
          top: rectTop,
          width: options.cssW,
          height: options.cssH,
          right: rectLeft + options.cssW,
          bottom: rectTop + options.cssH,
          x: rectLeft,
          y: rectTop,
          toJSON: () => ({})
        })
      } as unknown as HTMLCanvasElement;

      const controller = new Canvas2DStageController({
        canvas,
        container: parent,
        logicalWidth: options.logicalWidth,
        logicalHeight: options.logicalHeight
      });

      return { controller, canvas, parent, mockCtx, setTransformSpy };
    }

    it('clamps DPR to max 2 and sizes canvas buffer via ResizeObserver', () => {
      const disconnectSpy = vi.fn();
      const observeSpy = vi.fn();
      let observerCallback: ResizeObserverCallback | null = null;

      class MockResizeObserver {
        constructor(cb: ResizeObserverCallback) {
          observerCallback = cb;
        }
        observe = observeSpy;
        unobserve = vi.fn();
        disconnect = disconnectSpy;
      }

      globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

      const { controller, canvas, parent } = createMockStage({
        cssW: 400,
        cssH: 300,
        dpr: 3 // Should clamp to 2
      });

      expect(observeSpy).toHaveBeenCalledWith(parent);
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);

      // Simulate container resize
      Object.defineProperty(parent, 'clientWidth', { value: 500, configurable: true });
      Object.defineProperty(parent, 'clientHeight', { value: 350, configurable: true });
      observerCallback?.([], {} as ResizeObserver);

      expect(canvas.width).toBe(1000);
      expect(canvas.height).toBe(700);

      controller.dispose();
      expect(disconnectSpy).toHaveBeenCalledTimes(1);
      expect(controller.isDisposed()).toBe(true);
    });

    it('computes accurate screenToWorld() across DPR=1 and DPR=2 with zoom=1 and pan=0', () => {
      const stage1x = createMockStage({ cssW: 800, cssH: 600, dpr: 1 });
      const center1x = stage1x.controller.screenToWorld(400, 300, { zoom: 1, panX: 0, panY: 0 });
      expect(center1x.worldX).toBeCloseTo(400, 5);
      expect(center1x.worldY).toBeCloseTo(300, 5);

      const topLeft1x = stage1x.controller.screenToWorld(0, 0, { zoom: 1, panX: 0, panY: 0 });
      expect(topLeft1x.worldX).toBeCloseTo(0, 5);
      expect(topLeft1x.worldY).toBeCloseTo(0, 5);
      stage1x.controller.dispose();

      // DPR = 2 with bounding rect offset and logical world size
      const stage2x = createMockStage({
        cssW: 864,
        cssH: 528,
        rectLeft: 100,
        rectTop: 50,
        dpr: 2,
        logicalWidth: 864,
        logicalHeight: 528
      });

      const center2x = stage2x.controller.screenToWorld(100 + 432, 50 + 264, {
        zoom: 1,
        panX: 0,
        panY: 0
      });
      expect(center2x.worldX).toBeCloseTo(432, 5);
      expect(center2x.worldY).toBeCloseTo(264, 5);

      const corner2x = stage2x.controller.screenToWorld(100, 50, { zoom: 1, panX: 0, panY: 0 });
      expect(corner2x.worldX).toBeCloseTo(0, 5);
      expect(corner2x.worldY).toBeCloseTo(0, 5);
      stage2x.controller.dispose();
    });

    it('inverts setTransform(ctx, camera) accurately in screenToWorld() under arbitrary zoom, pan, and DPR', () => {
      const { controller, mockCtx, setTransformSpy } = createMockStage({
        cssW: 800,
        cssH: 600,
        rectLeft: 40,
        rectTop: 20,
        dpr: 2,
        logicalWidth: 400,
        logicalHeight: 300
      });

      const camera = { zoom: 2.5, panX: 60, panY: -30 };
      controller.setTransform(mockCtx, camera);

      expect(setTransformSpy).toHaveBeenCalledTimes(1);
      const [a, , , d, tx, ty] = setTransformSpy.mock.calls[0] as number[];

      // Test client pointer point (rectLeft + 520, rectTop + 210)
      const clientX = 40 + 520;
      const clientY = 20 + 210;
      const { worldX, worldY } = controller.screenToWorld(clientX, clientY, camera);

      // Forward-project world coordinates using the exact matrix passed to ctx.setTransform
      const projectedCanvasX = a * worldX + tx;
      const projectedCanvasY = d * worldY + ty;

      // Should land precisely on (clientX - rectLeft) * dpr and (clientY - rectTop) * dpr
      expect(projectedCanvasX).toBeCloseTo(520 * 2, 5);
      expect(projectedCanvasY).toBeCloseTo(210 * 2, 5);

      // Center with pan=(60, -30) means clicking at (center + pan) maps to world center (200, 150)
      const pannedCenter = controller.screenToWorld(40 + 400 + 60, 20 + 300 - 30, camera);
      expect(pannedCenter.worldX).toBeCloseTo(200, 5);
      expect(pannedCenter.worldY).toBeCloseTo(150, 5);

      controller.dispose();
    });
  });
});
