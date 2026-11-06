/**
 * Haptic Vibration Feedback Utility for Mobile Gamepad & Touch Interactions
 * Supports Web Vibration API with safe fallback and persistent user preferences.
 */

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

export const haptics = {
  isEnabled(): boolean {
    try {
      const val = localStorage.getItem('zigame_haptics_enabled');
      return val !== null ? val === 'true' : true;
    } catch {
      return true;
    }
  },

  setEnabled(enabled: boolean): void {
    try {
      localStorage.setItem('zigame_haptics_enabled', String(enabled));
    } catch {
      // Safe fallback
    }
  },

  trigger(style: HapticStyle = 'light'): void {
    if (!this.isEnabled()) return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;

    try {
      switch (style) {
        case 'selection':
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(22);
          break;
        case 'heavy':
          navigator.vibrate(40);
          break;
        case 'success':
          navigator.vibrate([15, 40, 25]);
          break;
        case 'warning':
          navigator.vibrate([25, 30, 25]);
          break;
        case 'error':
          navigator.vibrate([50, 40, 70]);
          break;
      }
    } catch {
      // Browser or device blocked vibration
    }
  }
};
