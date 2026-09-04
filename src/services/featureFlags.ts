import { FeatureFlags } from '../types';

const STORAGE_KEY = 'zigame_feature_flags_v1';

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  gamepadSupport: true,
  ghostMode: true,
  saveState: true,
  batterySaver: true,
  competitiveRating: true,
  telemetry: true,
  theaterMode: true,
  publicProfiles: true,
  soundNormalization: true,
  newDiscovery: true,
  onboardingWizard: true,
};

class FeatureFlagService {
  private flags: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };
  private listeners: Array<(flags: FeatureFlags) => void> = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.flags = { ...DEFAULT_FEATURE_FLAGS, ...JSON.parse(saved) };
      }
    } catch {
      this.flags = { ...DEFAULT_FEATURE_FLAGS };
    }
  }

  public getFlags(): FeatureFlags {
    return { ...this.flags };
  }

  public isEnabled(flag: keyof FeatureFlags): boolean {
    return !!this.flags[flag];
  }

  public setFlag(flag: keyof FeatureFlags, enabled: boolean): void {
    this.flags[flag] = enabled;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.flags));
    } catch {}
    this.notify();
  }

  public resetToDefaults(): void {
    this.flags = { ...DEFAULT_FEATURE_FLAGS };
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    this.notify();
  }

  public subscribe(listener: (flags: FeatureFlags) => void): () => void {
    this.listeners.push(listener);
    listener(this.getFlags());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    const copy = this.getFlags();
    this.listeners.forEach((l) => l(copy));
  }
}

export const featureFlagService = new FeatureFlagService();
