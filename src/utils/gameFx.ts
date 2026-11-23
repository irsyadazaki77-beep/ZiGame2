/**
 * Global Chromatic Impact Vignette & Gameplay FX Dispatcher
 * Allows any game or engine hook to trigger brief radial edge flashes
 * (damage, combo, milestone, powerup) in GameViewportEffects.
 */

export type ImpactFlashKind = 'damage' | 'combo' | 'milestone' | 'powerup';

type ImpactListener = (kind: ImpactFlashKind) => void;

class GameFxManager {
  private listeners: Set<ImpactListener> = new Set();

  public subscribe(listener: ImpactListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public triggerImpact(kind: ImpactFlashKind): void {
    this.listeners.forEach((fn) => {
      try {
        fn(kind);
      } catch {}
    });
  }
}

export const gameFx = new GameFxManager();
