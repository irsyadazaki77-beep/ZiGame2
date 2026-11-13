/**
 * Standard Stage Controller for Canvas 2D games (2D counterpart to ThreeStageController).
 * Manages DPR-aware ResizeObserver sizing, camera transforms, and accurate screen-to-world math.
 */

export interface Canvas2DCamera {
  zoom: number;
  panX: number;
  panY: number;
}

export interface Canvas2DWorldPoint {
  worldX: number;
  worldY: number;
}

export interface Canvas2DStageOptions {
  canvas: HTMLCanvasElement;
  container?: HTMLElement | null;
  logicalWidth?: number;
  logicalHeight?: number;
  maxDpr?: number;
  onResize?: (cssWidth: number, cssHeight: number, dpr: number) => void;
}

const DEFAULT_CAMERA: Canvas2DCamera = { zoom: 1, panX: 0, panY: 0 };

export class Canvas2DStageController {
  private canvas: HTMLCanvasElement | null;
  private container: HTMLElement | null;
  private logicalWidth?: number;
  private logicalHeight?: number;
  private readonly maxDpr: number;
  private onResize?: (cssWidth: number, cssHeight: number, dpr: number) => void;
  private resizeObserver: ResizeObserver | null = null;
  private resizeListenerAttached = false;
  private disposed = false;

  constructor(options: Canvas2DStageOptions) {
    this.canvas = options.canvas;
    this.container = options.container ?? options.canvas.parentElement;
    this.logicalWidth = options.logicalWidth;
    this.logicalHeight = options.logicalHeight;
    this.maxDpr = options.maxDpr ?? 2;
    this.onResize = options.onResize;

    this.syncSize();
    this.attachResizeObserver();
  }

  public getDpr(): number {
    const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return Math.min(Math.max(1, rawDpr), this.maxDpr);
  }

  public getContext(): CanvasRenderingContext2D | null {
    if (this.disposed || !this.canvas) return null;
    return this.canvas.getContext('2d');
  }

  public setLogicalSize(width: number, height: number): void {
    this.logicalWidth = width;
    this.logicalHeight = height;
  }

  public syncSize = (): { width: number; height: number; dpr: number } => {
    if (this.disposed || !this.canvas) {
      return { width: 0, height: 0, dpr: 1 };
    }

    const dpr = this.getDpr();
    const targetEl = this.container ?? this.canvas;
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(
      1,
      targetEl.clientWidth || rect.width || this.logicalWidth || this.canvas.width || 800
    );
    const cssHeight = Math.max(
      1,
      targetEl.clientHeight || rect.height || this.logicalHeight || this.canvas.height || 600
    );

    const targetW = Math.floor(cssWidth * dpr);
    const targetH = Math.floor(cssHeight * dpr);

    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    this.onResize?.(cssWidth, cssHeight, dpr);
    return { width: cssWidth, height: cssHeight, dpr };
  };

  private attachResizeObserver(): void {
    const observeTarget = this.container ?? this.canvas;
    if (!observeTarget) return;

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.syncSize();
      });
      this.resizeObserver.observe(observeTarget);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.handleWindowResize);
      this.resizeListenerAttached = true;
    }
  }

  private handleWindowResize = (): void => {
    this.syncSize();
  };

  private resolveMetrics(camera: Canvas2DCamera = DEFAULT_CAMERA) {
    const canvas = this.canvas;
    if (!canvas) {
      return {
        rectLeft: 0,
        rectTop: 0,
        cssW: 1,
        cssH: 1,
        canvasW: 1,
        canvasH: 1,
        dpr: 1,
        worldW: 1,
        worldH: 1,
        effectiveScale: 1,
        panX: 0,
        panY: 0
      };
    }

    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, rect.width || canvas.clientWidth || this.logicalWidth || canvas.width || 1);
    const cssH = Math.max(1, rect.height || canvas.clientHeight || this.logicalHeight || canvas.height || 1);
    const canvasW = canvas.width > 0 ? canvas.width : cssW * this.getDpr();
    const canvasH = canvas.height > 0 ? canvas.height : cssH * this.getDpr();
    const dpr = rect.width > 0 ? canvasW / rect.width : this.getDpr();

    const worldW = this.logicalWidth ?? cssW;
    const worldH = this.logicalHeight ?? cssH;
    const baseScale = Math.min(canvasW / worldW, canvasH / worldH) || 1;
    const zoom = camera.zoom > 0 ? camera.zoom : 1;
    const effectiveScale = baseScale * zoom;

    return {
      rectLeft: rect.left,
      rectTop: rect.top,
      cssW,
      cssH,
      canvasW,
      canvasH,
      dpr,
      worldW,
      worldH,
      effectiveScale,
      panX: camera.panX || 0,
      panY: camera.panY || 0
    };
  }

  /**
   * Applies DPR, fit-to-screen base scale, camera zoom, and camera pan transform onto `ctx`.
   */
  public setTransform(ctx: CanvasRenderingContext2D, camera: Canvas2DCamera = DEFAULT_CAMERA): void {
    if (this.disposed || !this.canvas) return;
    const m = this.resolveMetrics(camera);
    const tx = m.canvasW / 2 + m.panX * m.dpr - (m.worldW / 2) * m.effectiveScale;
    const ty = m.canvasH / 2 + m.panY * m.dpr - (m.worldH / 2) * m.effectiveScale;
    ctx.setTransform(m.effectiveScale, 0, 0, m.effectiveScale, tx, ty);
  }

  /**
   * Converts viewport client coordinates (e.g. PointerEvent clientX/clientY) into world coordinates,
   * accurately accounting for getBoundingClientRect(), DPR, zoom, and pan.
   */
  public screenToWorld(
    clientX: number,
    clientY: number,
    camera: Canvas2DCamera = DEFAULT_CAMERA
  ): Canvas2DWorldPoint {
    if (!this.canvas) {
      return { worldX: 0, worldY: 0 };
    }
    const m = this.resolveMetrics(camera);
    const cx = (clientX - m.rectLeft) * m.dpr;
    const cy = (clientY - m.rectTop) * m.dpr;

    const worldX = (cx - m.canvasW / 2 - m.panX * m.dpr) / m.effectiveScale + m.worldW / 2;
    const worldY = (cy - m.canvasH / 2 - m.panY * m.dpr) / m.effectiveScale + m.worldH / 2;

    return { worldX, worldY };
  }

  public isDisposed(): boolean {
    return this.disposed;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.resizeListenerAttached && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleWindowResize);
      this.resizeListenerAttached = false;
    }

    this.onResize = undefined;
    this.container = null;
    this.canvas = null;
  }
}
