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

  constructor() {
    this.settings = this.loadOrDetect();
    this.applyToDOM();
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
