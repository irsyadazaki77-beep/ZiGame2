import { PerformanceSettings, PerformanceTier } from '../types';

const STORAGE_KEY = 'zigame_performance_settings_v1';

export interface PerformanceSnapshot {
  gameId: string;
  fps: number;
  frameTimeAvg: number;
  frameTimeP50: number;
  frameTimeP95: number;
  frameTimeP99: number;
  droppedFrames: number;
  jankCount: number;
  devicePixelRatio: number;
  performanceTier: PerformanceTier;
  timestamp: number;
}

const TIER_PRESETS: Record<PerformanceTier, Omit<PerformanceSettings, 'tier' | 'autoDetect'>> = {
  low: {
    targetFps: 30,
    particlesMultiplier: 0.25,
    enableGlow: false,
    enableBlur: false,
    enableShadows: false,
    dprCap: 1.0,
    batterySaver: true
  },
  medium: {
    targetFps: 60,
    particlesMultiplier: 0.65,
    enableGlow: true,
    enableBlur: true,
    enableShadows: false,
    dprCap: 1.25,
    batterySaver: false
  },
  high: {
    targetFps: 60,
    particlesMultiplier: 1.0,
    enableGlow: true,
    enableBlur: true,
    enableShadows: true,
    dprCap: 1.75,
    batterySaver: false
  }
};

class PerformanceService {
  private settings: PerformanceSettings;
  private listeners: Array<(settings: PerformanceSettings) => void> = [];
  
  // Adaptive tier metrics & hysteresis
  private lowFpsStreak = 0;
  private highFpsStreak = 0;
  private lastTierChangeTime = 0;
  private activeRafCount = 0;
  private currentFps = 60;
  private activeEntityCount = 0;

  // Zero-allocation Circular Frame-Time Profiling Buffer (last 180 frames ≈ 3s at 60fps)
  private readonly maxFrameBufferSize = 180;
  private frameTimesBuffer: Float32Array = new Float32Array(180);
  private frameBufferIndex = 0;
  private frameBufferCount = 0;
  private droppedFramesCounter = 0;
  private jankFramesCounter = 0;
  private isTabVisible = true;

  constructor() {
    this.settings = this.loadOrDetect();
    this.applyToDOM();
    this.setupVisibilityListener();
  }

  public getAdaptiveDPR(maxDpr?: number): number {
    if (typeof window === 'undefined') return 1;
    const rawDpr = window.devicePixelRatio || 1;
    const cap = maxDpr !== undefined ? maxDpr : (this.settings.dprCap || 1.0);
    return Math.min(rawDpr, cap);
  }

  public getFastSettings(): Readonly<PerformanceSettings> {
    return this.settings;
  }

  /**
   * Records a single frame duration for sub-millisecond frame-time profiling without array reallocations
   */
  public recordFrameTime(durationMs: number): void {
    if (!this.isTabVisible) return;

    this.frameTimesBuffer[this.frameBufferIndex] = durationMs;
    this.frameBufferIndex = (this.frameBufferIndex + 1) % this.maxFrameBufferSize;
    if (this.frameBufferCount < this.maxFrameBufferSize) {
      this.frameBufferCount++;
    }

    // Jank threshold: frame taking longer than 25ms (> 1.5x of 16.67ms)
    if (durationMs > 25) {
      this.jankFramesCounter++;
    }
    // Dropped frame threshold: frame taking longer than 33.3ms (< 30 FPS)
    if (durationMs > 33.33) {
      this.droppedFramesCounter++;
    }
  }

  /**
   * Evaluates FPS and adjusts quality with hysteresis (prevents rapid toggling)
   */
  public recordFramePerformance(fps: number): void {
    this.currentFps = Math.round(fps);
    if (!this.settings.autoDetect || !this.isTabVisible) return;

    const now = Date.now();
    // Cooldown 10s between tier downgrades, 18s between upgrades
    const elapsedSinceLastChange = now - this.lastTierChangeTime;

    if (fps < 38) {
      this.lowFpsStreak++;
      this.highFpsStreak = 0;
      // Sustained low FPS for ~3 consecutive cycles
      if (this.lowFpsStreak >= 3 && elapsedSinceLastChange >= 10000) {
        if (this.settings.tier === 'high') {
          this.setTier('medium', true);
        } else if (this.settings.tier === 'medium') {
          this.setTier('low', true);
        }
        this.lowFpsStreak = 0;
        this.lastTierChangeTime = now;
      }
    } else if (fps >= 57) {
      this.highFpsStreak++;
      this.lowFpsStreak = 0;
      // Sustained healthy FPS for ~7 consecutive cycles before cautious recovery
      if (this.highFpsStreak >= 7 && elapsedSinceLastChange >= 18000) {
        if (this.settings.tier === 'low') {
          this.setTier('medium', true);
        } else if (this.settings.tier === 'medium') {
          this.setTier('high', true);
        }
        this.highFpsStreak = 0;
        this.lastTierChangeTime = now;
      }
    } else {
      this.lowFpsStreak = 0;
      this.highFpsStreak = 0;
    }
  }

  /**
   * Generates a statistically accurate snapshot of frame time distribution
   */
  public getPerformanceSnapshot(gameId: string = 'global'): PerformanceSnapshot {
    const count = this.frameBufferCount;
    if (count === 0) {
      return {
        gameId,
        fps: this.currentFps,
        frameTimeAvg: 16.67,
        frameTimeP50: 16.67,
        frameTimeP95: 16.67,
        frameTimeP99: 16.67,
        droppedFrames: this.droppedFramesCounter,
        jankCount: this.jankFramesCounter,
        devicePixelRatio: this.getAdaptiveDPR(),
        performanceTier: this.settings.tier,
        timestamp: Date.now()
      };
    }

    const samples: number[] = new Array(count);
    let sum = 0;
    for (let i = 0; i < count; i++) {
      const val = this.frameTimesBuffer[i];
      samples[i] = val;
      sum += val;
    }
    samples.sort((a, b) => a - b);

    const getPercentile = (p: number): number => {
      const index = Math.min(count - 1, Math.floor((p / 100) * count));
      return Number(samples[index].toFixed(2));
    };

    const avg = Number((sum / count).toFixed(2));

    return {
      gameId,
      fps: this.currentFps,
      frameTimeAvg: avg,
      frameTimeP50: getPercentile(50),
      frameTimeP95: getPercentile(95),
      frameTimeP99: getPercentile(99),
      droppedFrames: this.droppedFramesCounter,
      jankCount: this.jankFramesCounter,
      devicePixelRatio: this.getAdaptiveDPR(),
      performanceTier: this.settings.tier,
      timestamp: Date.now()
    };
  }

  public registerRafStart(): void {
    this.activeRafCount++;
  }

  public registerRafEnd(): void {
    this.activeRafCount = Math.max(0, this.activeRafCount - 1);
  }

  public setEntityCount(count: number): void {
    this.activeEntityCount = count;
  }

  public getDebugMetrics() {
    const snapshot = this.getPerformanceSnapshot();
    return {
      fps: this.currentFps,
      frameTimeAvg: snapshot.frameTimeAvg,
      frameTimeP95: snapshot.frameTimeP95,
      tier: this.settings.tier,
      dprCap: this.settings.dprCap,
      activeRafCount: this.activeRafCount,
      activeEntityCount: this.activeEntityCount,
      droppedFrames: this.droppedFramesCounter,
      jankCount: this.jankFramesCounter,
      batterySaver: this.settings.batterySaver,
    };
  }

  private setupVisibilityListener(): void {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      this.isTabVisible = !document.hidden;
      if (document.hidden) {
        document.documentElement.classList.add('app-is-hidden');
      } else {
        document.documentElement.classList.remove('app-is-hidden');
      }
    });
  }

  private detectHardwareTier(): PerformanceTier {
    if (typeof window === 'undefined') return 'medium';

    try {
      const concurrency = navigator.hardwareConcurrency || 4;
      const deviceMemory = (navigator as any).deviceMemory || 4;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (concurrency <= 2 || deviceMemory <= 2) {
        return 'low';
      }

      if (isMobile) {
        return concurrency >= 8 && deviceMemory >= 6 ? 'high' : 'medium';
      }

      if (concurrency >= 6 && deviceMemory >= 8) {
        return 'high';
      }

      return 'medium';
    } catch {
      return 'medium';
    }
  }

  private loadOrDetect(): PerformanceSettings {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}

    const detectedTier = this.detectHardwareTier();
    return {
      tier: detectedTier,
      autoDetect: true,
      ...TIER_PRESETS[detectedTier]
    };
  }

  public getSettings(): PerformanceSettings {
    return { ...this.settings };
  }

  public setTier(tier: PerformanceTier, autoDetect: boolean = false): void {
    this.settings = {
      ...this.settings,
      tier,
      autoDetect,
      ...TIER_PRESETS[tier]
    };
    this.saveAndNotify();
  }

  public toggleBatterySaver(): boolean {
    const nextState = !this.settings.batterySaver;
    if (nextState) {
      this.settings = {
        ...this.settings,
        batterySaver: true,
        targetFps: 30,
        particlesMultiplier: 0.25,
        enableGlow: false,
        enableBlur: false,
        enableShadows: false,
        dprCap: 1.0
      };
    } else {
      const preset = TIER_PRESETS[this.settings.tier];
      this.settings = {
        ...this.settings,
        batterySaver: false,
        ...preset
      };
    }
    this.saveAndNotify();
    return this.settings.batterySaver;
  }

  public updateCustomSetting(updates: Partial<PerformanceSettings>): void {
    this.settings = {
      ...this.settings,
      ...updates,
      autoDetect: false
    };
    this.saveAndNotify();
  }

  public subscribe(listener: (settings: PerformanceSettings) => void): () => void {
    this.listeners.push(listener);
    listener(this.getSettings());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private applyToDOM() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (this.settings.batterySaver || !this.settings.enableBlur) {
      root.classList.add('disable-expensive-blur');
    } else {
      root.classList.remove('disable-expensive-blur');
    }

    if (!this.settings.enableGlow) {
      root.classList.add('disable-glow');
    } else {
      root.classList.remove('disable-glow');
    }

    if (!this.settings.enableShadows) {
      root.classList.add('disable-heavy-shadows');
    } else {
      root.classList.remove('disable-heavy-shadows');
    }
  }

  private saveAndNotify() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {}
    this.applyToDOM();
    const copy = this.getSettings();
    this.listeners.forEach((l) => l(copy));
  }
}

export const performanceService = new PerformanceService();
