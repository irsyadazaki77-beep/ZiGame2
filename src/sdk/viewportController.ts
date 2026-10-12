import { IViewportController } from '../types/gameSdk';
import { performanceService } from '../services/performanceService';

export class ViewportController implements IViewportController {
  public setupCanvas(
    canvas: HTMLCanvasElement | null,
    logicalWidth: number,
    logicalHeight: number,
    maxDpr?: number
  ): CanvasRenderingContext2D | null {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const settings = performanceService.getSettings();
    const rawDpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const targetCap = maxDpr !== undefined ? maxDpr : (settings.dprCap || 1.0);
    const dpr = Math.min(rawDpr, targetCap);

    canvas.width = Math.floor(logicalWidth * dpr);
    canvas.height = Math.floor(logicalHeight * dpr);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    return ctx;
  }

  public toLogicalCoords(
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number,
    logicalWidth: number,
    logicalHeight: number
  ): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return { x: 0, y: 0 };
    }

    const scaleX = logicalWidth / rect.width;
    const scaleY = logicalHeight / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return {
      x: Math.max(0, Math.min(logicalWidth, x)),
      y: Math.max(0, Math.min(logicalHeight, y))
    };
  }

  public attachResizeObserver(
    element: HTMLElement,
    onResize: (width: number, height: number) => void
  ): () => void {
    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => {
        onResize(element.clientWidth, element.clientHeight);
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          onResize(width, height);
        }
      }
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }
}
