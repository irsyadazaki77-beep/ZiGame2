import { InputAction, InputMappingConfig, InputSource, GamepadState } from '../types';

export interface ActionSubscriber {
  onActionDown?: (action: InputAction) => void;
  onActionUp?: (action: InputAction) => void;
  onRawKey?: (key: string, isDown: boolean) => void;
}

const DEFAULT_MAPPING: InputMappingConfig = {
  keys: {
    up: ['ArrowUp', 'KeyW', 'w', 'W'],
    down: ['ArrowDown', 'KeyS', 's', 'S'],
    left: ['ArrowLeft', 'KeyA', 'a', 'A'],
    right: ['ArrowRight', 'KeyD', 'd', 'D'],
    primary: ['Space', ' ', 'Enter'],
    secondary: ['ShiftLeft', 'ShiftRight', 'KeyZ', 'z', 'Z'],
    pause: ['Escape', 'KeyP', 'p', 'P'],
    restart: ['KeyR', 'r', 'R']
  },
  gamepad: {
    primaryButton: 0, // A button (Xbox) / Cross (PS)
    secondaryButton: 1, // B button / Circle
    pauseButton: 9, // Start / Options
    restartButton: 8 // Select / Share
  },
  supportsTouch: true,
  supportsGamepad: true,
  supportsMouse: true
};

class InputManager {
  private activeSource: InputSource = 'keyboard';
  private sourceListeners: Array<(source: InputSource) => void> = [];
  private gamepadState: GamepadState = {
    connected: false,
    id: '',
    index: -1,
    buttons: {},
    axes: { leftStickX: 0, leftStickY: 0, rightStickX: 0, rightStickY: 0 }
  };
  private gamepadRaf: number | null = null;
  private prevGamepadButtons: Record<number, boolean> = {};
  private prevGamepadAxes: { x: number; y: number } = { x: 0, y: 0 };
  private activeSubscribers = new Set<ActionSubscriber>();
  private activeKeys = new Set<string>();

  constructor() {
    if (typeof window !== 'undefined') {
      this.initListeners();
    }
  }

  private initListeners() {
    // Keyboard events
    window.addEventListener('keydown', this.handleKeyDown, { passive: false });
    window.addEventListener('keyup', this.handleKeyUp, { passive: false });

    // Touch & Pointer events
    window.addEventListener('touchstart', () => this.setActiveSource('touch'), { passive: true });
    window.addEventListener('mousedown', () => {
      if (this.activeSource !== 'touch') {
        this.setActiveSource('mouse');
      }
    }, { passive: true });

    // Gamepad API
    window.addEventListener('gamepadconnected', this.handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected);

    // Initial gamepad check
    this.pollGamepads();
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // Suppress scroll/browser navigation on arcade keys inside game context
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
      }
    }

    if (this.activeKeys.has(e.code) || this.activeKeys.has(e.key)) return;
    this.activeKeys.add(e.code);
    this.activeKeys.add(e.key);

    // If the event is synthetic (untrusted), do not update active source to keyboard
    // and do not double-dispatch to subscribers.
    if (!e.isTrusted) return;

    this.setActiveSource('keyboard');

    const action = this.mapKeyToAction(e.code, e.key);
    this.activeSubscribers.forEach((sub) => {
      if (action && sub.onActionDown) sub.onActionDown(action);
      if (sub.onRawKey) sub.onRawKey(e.key, true);
    });
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.activeKeys.delete(e.code);
    this.activeKeys.delete(e.key);

    if (!e.isTrusted) return;

    const action = this.mapKeyToAction(e.code, e.key);
    this.activeSubscribers.forEach((sub) => {
      if (action && sub.onActionUp) sub.onActionUp(action);
      if (sub.onRawKey) sub.onRawKey(e.key, false);
    });
  };

  private mapKeyToAction(code: string, key: string, mapping: InputMappingConfig = DEFAULT_MAPPING): InputAction | null {
    const k = mapping.keys;
    if (k.up?.includes(code) || k.up?.includes(key)) return 'UP';
    if (k.down?.includes(code) || k.down?.includes(key)) return 'DOWN';
    if (k.left?.includes(code) || k.left?.includes(key)) return 'LEFT';
    if (k.right?.includes(code) || k.right?.includes(key)) return 'RIGHT';
    if (k.primary?.includes(code) || k.primary?.includes(key)) return 'PRIMARY';
    if (k.secondary?.includes(code) || k.secondary?.includes(key)) return 'SECONDARY';
    if (k.pause?.includes(code) || k.pause?.includes(key)) return 'PAUSE';
    if (k.restart?.includes(code) || k.restart?.includes(key)) return 'RESTART';
    return null;
  }

  private handleGamepadConnected = (e: GamepadEvent) => {
    this.gamepadState = {
      connected: true,
      id: e.gamepad.id,
      index: e.gamepad.index,
      buttons: {},
      axes: { leftStickX: 0, leftStickY: 0, rightStickX: 0, rightStickY: 0 }
    };
    this.setActiveSource('gamepad');
    this.startGamepadLoop();
  };

  private handleGamepadDisconnected = (e: GamepadEvent) => {
    if (this.gamepadState.index === e.gamepad.index) {
      this.gamepadState.connected = false;
      this.setActiveSource('keyboard');
      this.stopGamepadLoop();
    }
  };

  private startGamepadLoop() {
    if (this.gamepadRaf !== null) return;

    const loop = () => {
      this.pollGamepads();
      this.gamepadRaf = requestAnimationFrame(loop);
    };
    this.gamepadRaf = requestAnimationFrame(loop);
  }

  private stopGamepadLoop() {
    if (this.gamepadRaf !== null) {
      cancelAnimationFrame(this.gamepadRaf);
      this.gamepadRaf = null;
    }
  }

  private pollGamepads() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    const gp = gamepads ? Array.from(gamepads).find((g) => g && g.connected) : null;

    if (!gp) {
      if (this.gamepadState.connected) {
        this.gamepadState.connected = false;
        this.stopGamepadLoop();
      }
      return;
    }

    if (!this.gamepadState.connected) {
      this.gamepadState.connected = true;
      this.gamepadState.id = gp.id;
      this.gamepadState.index = gp.index;
      this.startGamepadLoop();
    }

    // Process D-Pad and standard Buttons
    // 12: D-Pad Up, 13: D-Pad Down, 14: D-Pad Left, 15: D-Pad Right
    // 0: A/Cross, 1: B/Circle, 9: Start/Options, 8: Select/Back
    const buttonActions: Record<number, InputAction> = {
      12: 'UP',
      13: 'DOWN',
      14: 'LEFT',
      15: 'RIGHT',
      0: 'PRIMARY',
      1: 'SECONDARY',
      9: 'PAUSE',
      8: 'RESTART'
    };

    let anyInput = false;

    // Check button presses
    gp.buttons.forEach((btn, idx) => {
      const isDown = btn.pressed;
      const wasDown = !!this.prevGamepadButtons[idx];

      if (isDown !== wasDown) {
        anyInput = true;
        this.prevGamepadButtons[idx] = isDown;
        const action = buttonActions[idx];
        if (action) {
          this.dispatchSyntheticKeyEvent(action, isDown);
          this.activeSubscribers.forEach((sub) => {
            if (isDown && sub.onActionDown) sub.onActionDown(action);
            if (!isDown && sub.onActionUp) sub.onActionUp(action);
          });
        }
      }
    });

    // Check analog stick axes with deadzone
    const DEADZONE = 0.35;
    const stickX = gp.axes[0] || 0;
    const stickY = gp.axes[1] || 0;

    const leftDown = stickX < -DEADZONE;
    const rightDown = stickX > DEADZONE;
    const upDown = stickY < -DEADZONE;
    const downDown = stickY > DEADZONE;

    const wasLeft = this.prevGamepadAxes.x < -DEADZONE;
    const wasRight = this.prevGamepadAxes.x > DEADZONE;
    const wasUp = this.prevGamepadAxes.y < -DEADZONE;
    const wasDown = this.prevGamepadAxes.y > DEADZONE;

    if (leftDown !== wasLeft) {
      anyInput = true;
      this.triggerStickAction('LEFT', leftDown);
    }
    if (rightDown !== wasRight) {
      anyInput = true;
      this.triggerStickAction('RIGHT', rightDown);
    }
    if (upDown !== wasUp) {
      anyInput = true;
      this.triggerStickAction('UP', upDown);
    }
    if (downDown !== wasDown) {
      anyInput = true;
      this.triggerStickAction('DOWN', downDown);
    }

    this.prevGamepadAxes = { x: stickX, y: stickY };

    if (anyInput) {
      this.setActiveSource('gamepad');
    }
  }

  public dispatchAction(action: InputAction, isDown: boolean, source: InputSource = 'touch') {
    this.setActiveSource(source);
    
    // 1. Direct dispatch to subscribers (preferred)
    this.activeSubscribers.forEach((sub) => {
      if (isDown && sub.onActionDown) sub.onActionDown(action);
      if (!isDown && sub.onActionUp) sub.onActionUp(action);
    });

    // 2. Compatibility bridge: Dispatch synthetic keyboard event for legacy games
    // that still use window.addEventListener('keydown') instead of inputManager.subscribe
    this.dispatchSyntheticKeyEvent(action, isDown);
  }

  private dispatchSyntheticKeyEvent(action: InputAction, isDown: boolean) {
    if (typeof window === 'undefined') return;
    const actionKeyMap: Record<InputAction, { key: string; code: string }> = {
      UP: { key: 'ArrowUp', code: 'ArrowUp' },
      DOWN: { key: 'ArrowDown', code: 'ArrowDown' },
      LEFT: { key: 'ArrowLeft', code: 'ArrowLeft' },
      RIGHT: { key: 'ArrowRight', code: 'ArrowRight' },
      PRIMARY: { key: ' ', code: 'Space' },
      SECONDARY: { key: 'Shift', code: 'ShiftLeft' },
      PAUSE: { key: 'Escape', code: 'Escape' },
      RESTART: { key: 'r', code: 'KeyR' }
    };

    const target = actionKeyMap[action];
    if (target) {
      try {
        const event = new KeyboardEvent(isDown ? 'keydown' : 'keyup', {
          key: target.key,
          code: target.code,
          bubbles: true,
          cancelable: true
        });
        window.dispatchEvent(event);
      } catch {}
    }
  }

  private triggerStickAction(action: InputAction, isDown: boolean) {
    this.dispatchSyntheticKeyEvent(action, isDown);
    this.activeSubscribers.forEach((sub) => {
      if (isDown && sub.onActionDown) sub.onActionDown(action);
      if (!isDown && sub.onActionUp) sub.onActionUp(action);
    });
  }

  public vibrateGamepad(duration = 100, intensity = 0.5) {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    const gp = gamepads ? Array.from(gamepads).find((g) => g && g.connected) : null;
    if (!gp) return;

    try {
      const actuator = (gp as any).vibrationActuator;
      if (actuator && typeof actuator.playEffect === 'function') {
        actuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration,
          weakMagnitude: intensity,
          strongMagnitude: intensity
        });
      }
    } catch {}
  }

  public setActiveSource(source: InputSource) {
    if (this.activeSource !== source) {
      this.activeSource = source;
      this.sourceListeners.forEach((l) => l(source));
    }
  }

  public getActiveSource(): InputSource {
    return this.activeSource;
  }

  public subscribeSource(listener: (source: InputSource) => void): () => void {
    this.sourceListeners.push(listener);
    listener(this.activeSource);
    return () => {
      this.sourceListeners = this.sourceListeners.filter((l) => l !== listener);
    };
  }

  public subscribe(subscriber: ActionSubscriber): () => void {
    this.activeSubscribers.add(subscriber);
    return () => {
      this.activeSubscribers.delete(subscriber);
    };
  }

  public isGamepadConnected(): boolean {
    return this.gamepadState.connected;
  }

  public isActionActive(action: InputAction): boolean {
    // 1. Keyboard check using mapped keys
    const mapping = DEFAULT_MAPPING.keys;
    const actionKeys = (() => {
      switch (action) {
        case 'UP': return mapping.up;
        case 'DOWN': return mapping.down;
        case 'LEFT': return mapping.left;
        case 'RIGHT': return mapping.right;
        case 'PRIMARY': return mapping.primary;
        case 'SECONDARY': return mapping.secondary;
        case 'PAUSE': return mapping.pause;
        case 'RESTART': return mapping.restart;
        default: return [];
      }
    })();
    const isKeyActive = actionKeys?.some(k => this.activeKeys.has(k)) ?? false;
    if (isKeyActive) return true;

    // 2. Gamepad check
    if (this.gamepadState.connected) {
      const buttonActions: Record<number, InputAction> = {
        12: 'UP',
        13: 'DOWN',
        14: 'LEFT',
        15: 'RIGHT',
        0: 'PRIMARY',
        1: 'SECONDARY',
        9: 'PAUSE',
        8: 'RESTART'
      };
      const isButtonActive = Object.entries(buttonActions).some(([btnIdx, act]) => {
        return act === action && this.prevGamepadButtons[Number(btnIdx)];
      });
      if (isButtonActive) return true;

      const DEADZONE = 0.35;
      if (action === 'LEFT' && this.prevGamepadAxes.x < -DEADZONE) return true;
      if (action === 'RIGHT' && this.prevGamepadAxes.x > DEADZONE) return true;
      if (action === 'UP' && this.prevGamepadAxes.y < -DEADZONE) return true;
      if (action === 'DOWN' && this.prevGamepadAxes.y > DEADZONE) return true;
    }

    return false;
  }

  public getActionHint(action: InputAction): { keyboard: string; gamepad: string; touch: string } {
    switch (action) {
      case 'UP':
        return { keyboard: '↑ / W', gamepad: 'D-Pad ↑ / Stick ↑', touch: 'Geser Atas / Tombol ↑' };
      case 'DOWN':
        return { keyboard: '↓ / S', gamepad: 'D-Pad ↓ / Stick ↓', touch: 'Geser Bawah / Tombol ↓' };
      case 'LEFT':
        return { keyboard: '← / A', gamepad: 'D-Pad ← / Stick ←', touch: 'Geser Kiri / Tombol ←' };
      case 'RIGHT':
        return { keyboard: '→ / D', gamepad: 'D-Pad → / Stick →', touch: 'Geser Kanan / Tombol →' };
      case 'PRIMARY':
        return { keyboard: 'SPASI / Enter', gamepad: 'Tombol (A) / (X)', touch: 'Ketuk Layar / Tombol Aksi' };
      case 'SECONDARY':
        return { keyboard: 'SHIFT / Z', gamepad: 'Tombol (B) / (O)', touch: 'Ketuk Ganda' };
      case 'PAUSE':
        return { keyboard: 'ESC / P', gamepad: 'Tombol START', touch: 'Ikon Pause' };
      case 'RESTART':
        return { keyboard: 'R', gamepad: 'Tombol SELECT', touch: 'Tombol Restart' };
    }
  }
}

export const inputManager = new InputManager();
