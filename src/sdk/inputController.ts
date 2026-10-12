import { IInputController, GameInputEvent } from '../types/gameSdk';
import { InputAction, InputSource } from '../types';
import { inputManager } from '../services/inputService';

export class InputController implements IInputController {
  private subscribers: Set<(event: GameInputEvent) => void> = new Set();
  private unsubscribeManager?: () => void;
  private isDestroyed: boolean = false;

  constructor() {
    this.initGlobalBridge();
  }

  private initGlobalBridge(): void {
    this.unsubscribeManager = inputManager.subscribe({
      onActionDown: (action: InputAction) => {
        if (this.isDestroyed) return;
        this.dispatch({
          type: 'action',
          action: action.toLowerCase(),
          isDown: true,
          source: inputManager.getActiveSource()
        });
        if (action === 'UP' || action === 'DOWN' || action === 'LEFT' || action === 'RIGHT') {
          this.dispatch({
            type: 'move',
            direction: action.toLowerCase() as 'up' | 'down' | 'left' | 'right',
            isDown: true,
            source: inputManager.getActiveSource()
          });
        }
      },
      onActionUp: (action: InputAction) => {
        if (this.isDestroyed) return;
        this.dispatch({
          type: 'action',
          action: action.toLowerCase(),
          isDown: false,
          source: inputManager.getActiveSource()
        });
        if (action === 'UP' || action === 'DOWN' || action === 'LEFT' || action === 'RIGHT') {
          this.dispatch({
            type: 'move',
            direction: action.toLowerCase() as 'up' | 'down' | 'left' | 'right',
            isDown: false,
            source: inputManager.getActiveSource()
          });
        }
      },
      onRawKey: (key: string, isDown: boolean) => {
        if (this.isDestroyed) return;
        this.dispatch({
          type: 'key',
          key,
          code: key,
          isDown
        });
      }
    });
  }

  public subscribe(handler: (event: GameInputEvent) => void): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  public dispatch(event: GameInputEvent): void {
    if (this.isDestroyed) return;
    this.subscribers.forEach((handler) => {
      try {
        handler(event);
      } catch {}
    });
  }

  public isActionActive(action: InputAction): boolean {
    return inputManager.isActionActive(action);
  }

  public getActiveSource(): InputSource {
    return inputManager.getActiveSource();
  }

  public vibrate(durationMs: number = 100, intensity: number = 0.5): void {
    inputManager.vibrateGamepad(durationMs, intensity);
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.unsubscribeManager) {
      this.unsubscribeManager();
      this.unsubscribeManager = undefined;
    }
    this.subscribers.clear();
  }
}
