/**
 * Event-driven Screen Shake (Kinetic Trauma) Dispatcher
 * Allows any game or HUD action to trigger screen shake with duration & intensity.
 */

export type ShakeIntensity = 'subtle' | 'medium' | 'heavy' | 'light';

type ShakeListener = (intensity: ShakeIntensity) => void;

class ScreenShakeManager {
  private listeners: Set<ShakeListener> = new Set();
  private isEnabled: boolean = true;

  constructor() {
    try {
      const val = localStorage.getItem('zigame_screen_shake_enabled');
      if (val !== null) {
        this.isEnabled = val === 'true';
      }
    } catch {}
  }

  public subscribe(listener: ShakeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public trigger(intensity: ShakeIntensity = 'medium'): void {
    if (!this.isEnabled) return;
    this.listeners.forEach(fn => {
      try {
        fn(intensity);
      } catch {}
    });
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    try {
      localStorage.setItem('zigame_screen_shake_enabled', String(enabled));
    } catch {}
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }
}

export const screenShake = new ScreenShakeManager();
