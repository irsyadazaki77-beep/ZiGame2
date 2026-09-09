import { PerformanceSettings, PerformanceTier } from '../types';

const STORAGE_KEY = 'zigame_performance_settings_v1';

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
  private lowFpsStreak = 0;
  private highFpsStreak = 0;
  private lastDowngradeTime = 0;
  private activeRafCount = 0;
  private currentFps = 60;
  private activeEntityCount = 0;

  constructor() {
    this.settings = this.loadOrDetect();
    this.applyToDOM();
    this.setupVisibilityListener();
  }

  public getAdaptiveDPR(): number {
    if (typeof window === 'undefined') return 1;
    const rawDpr = window.devicePixelRatio || 1;
    return Math.min(rawDpr, this.settings.dprCap || 1.0);
  }

  public recordFramePerformance(fps: number): void {
    this.currentFps = Math.round(fps);
    if (!this.settings.autoDetect) return;

    const now = Date.now();
    // Cooldown 10s between tier changes
    if (now - this.lastDowngradeTime < 10000) return;

    if (fps < 32) {
      this.lowFpsStreak++;
      this.highFpsStreak = 0;
      // If FPS is below 32 for ~3 seconds (at ~1 check/sec)
      if (this.lowFpsStreak >= 3) {
        if (this.settings.tier === 'high') {
          this.setTier('medium', true);
        } else if (this.settings.tier === 'medium') {
          this.setTier('low', true);
        }
        this.lowFpsStreak = 0;
        this.lastDowngradeTime = now;
      }
    } else if (fps > 55) {
      this.highFpsStreak++;
      this.lowFpsStreak = 0;
    } else {
      this.lowFpsStreak = 0;
      this.highFpsStreak = 0;
    }
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
    return {
      fps: this.currentFps,
      tier: this.settings.tier,
      dprCap: this.settings.dprCap,
      activeRafCount: this.activeRafCount,
      activeEntityCount: this.activeEntityCount,
      batterySaver: this.settings.batterySaver,
    };
  }

  private setupVisibilityListener(): void {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Tab hidden - reduce DOM overhead
        document.documentElement.classList.add('app-is-hidden');
      } else {
        document.documentElement.classList.remove('app-is-hidden');
      }
    });
  }

  private detectHardwareTier(): PerformanceTier {
    if (typeof window === 'undefined') return 'medium';

    try {
      // Check for low memory or hardware concurrency
      const concurrency = navigator.hardwareConcurrency || 4;
      const deviceMemory = (navigator as any).deviceMemory || 4;

      // Mobile or low core count device
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
