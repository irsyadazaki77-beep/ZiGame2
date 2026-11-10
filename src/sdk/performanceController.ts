import { IPerformanceController } from '../types/gameSdk';
import { PerformanceSettings } from '../types';
import { performanceService } from '../services/performanceService';

export class PerformanceController implements IPerformanceController {
  public getSettings(): PerformanceSettings {
    return performanceService.getSettings();
  }

  public getAdaptiveDPR(maxDpr?: number): number {
    const settings = performanceService.getSettings();
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const targetCap = maxDpr !== undefined ? maxDpr : (settings.dprCap || 1.0);
    return Math.min(dpr, targetCap);
  }

  public getParticleMultiplier(): number {
    return performanceService.getSettings().particlesMultiplier || 1.0;
  }

  public recordFramePerformance(fps: number): void {
    performanceService.recordFramePerformance(fps);
  }

  public recordFrameTime(durationMs: number): void {
    performanceService.recordFrameTime(durationMs);
  }

  public subscribe(listener: (settings: PerformanceSettings) => void): () => void {
    return performanceService.subscribe(listener);
  }
}
