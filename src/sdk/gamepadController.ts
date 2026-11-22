import { InputAction } from '../types';
import { inputManager } from '../services/inputService';

export type GamepadBrand = 'playstation' | 'xbox' | 'nintendo' | 'generic';

export interface GamepadHardwareSnapshot {
  connected: boolean;
  id: string;
  brand: GamepadBrand;
  brandLabel: string;
  index: number;
  pressedButtons: number[];
  leftStick: { x: number; y: number };
  rightStick: { x: number; y: number };
  supportsVibration: boolean;
}

export function detectGamepadBrand(gamepadId: string): GamepadBrand {
  const id = (gamepadId || '').toLowerCase();
  if (
    id.includes('dualsense') ||
    id.includes('dualshock') ||
    id.includes('playstation') ||
    id.includes('054c') ||
    id.includes('wireless controller')
  ) {
    return 'playstation';
  }
  if (
    id.includes('xbox') ||
    id.includes('xinput') ||
    id.includes('045e') ||
    id.includes('microsoft')
  ) {
    return 'xbox';
  }
  if (
    id.includes('nintendo') ||
    id.includes('switch') ||
    id.includes('pro controller') ||
    id.includes('joy-con') ||
    id.includes('057e')
  ) {
    return 'nintendo';
  }
  return 'generic';
}

export function getBrandDisplayName(brand: GamepadBrand): string {
  switch (brand) {
    case 'playstation':
      return 'DualSense / PlayStation';
    case 'xbox':
      return 'Xbox Wireless Controller';
    case 'nintendo':
      return 'Switch Pro Controller';
    default:
      return 'USB / Bluetooth Gamepad';
  }
}

export function getGamepadButtonPrompt(action: InputAction, brand: GamepadBrand = 'xbox'): string {
  switch (action) {
    case 'PRIMARY':
    case 'ACTION_PRIMARY':
      if (brand === 'playstation') return '[✕ Cross]';
      if (brand === 'nintendo') return '[B]';
      return '[A]';
    case 'SECONDARY':
    case 'ACTION_SECONDARY':
      if (brand === 'playstation') return '[○ Circle]';
      if (brand === 'nintendo') return '[A]';
      return '[B]';
    case 'PAUSE':
      if (brand === 'playstation') return '[OPTIONS]';
      if (brand === 'nintendo') return '[+ Plus]';
      return '[START / Menu]';
    case 'RESTART':
      if (brand === 'playstation') return '[CREATE / L1]';
      if (brand === 'nintendo') return '[- Minus]';
      return '[VIEW / Back]';
    case 'UP':
      return 'D-Pad ↑ / L-Stick ↑';
    case 'DOWN':
      return 'D-Pad ↓ / L-Stick ↓';
    case 'LEFT':
      return 'D-Pad ← / L-Stick ←';
    case 'RIGHT':
      return 'D-Pad → / L-Stick →';
  }
}

export class GamepadController {
  public getSnapshot(): GamepadHardwareSnapshot {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return {
        connected: false,
        id: '',
        brand: 'generic',
        brandLabel: getBrandDisplayName('generic'),
        index: -1,
        pressedButtons: [],
        leftStick: { x: 0, y: 0 },
        rightStick: { x: 0, y: 0 },
        supportsVibration: false,
      };
    }

    const pads = navigator.getGamepads();
    const gp = pads ? Array.from(pads).find((p) => p && p.connected) : null;
    if (!gp) {
      return {
        connected: false,
        id: '',
        brand: 'generic',
        brandLabel: getBrandDisplayName('generic'),
        index: -1,
        pressedButtons: [],
        leftStick: { x: 0, y: 0 },
        rightStick: { x: 0, y: 0 },
        supportsVibration: false,
      };
    }

    const brand = detectGamepadBrand(gp.id);
    const pressedButtons: number[] = [];
    gp.buttons.forEach((btn, idx) => {
      if (btn && btn.pressed) pressedButtons.push(idx);
    });

    const supportsVibration = Boolean((gp as any).vibrationActuator);

    return {
      connected: true,
      id: gp.id,
      brand,
      brandLabel: getBrandDisplayName(brand),
      index: gp.index,
      pressedButtons,
      leftStick: {
        x: Number((gp.axes[0] || 0).toFixed(2)),
        y: Number((gp.axes[1] || 0).toFixed(2)),
      },
      rightStick: {
        x: Number((gp.axes[2] || 0).toFixed(2)),
        y: Number((gp.axes[3] || 0).toFixed(2)),
      },
      supportsVibration,
    };
  }

  public triggerHapticPulse(preset: 'light' | 'heavy' | 'victory' = 'light'): void {
    if (preset === 'victory') {
      inputManager.vibrateGamepad(220, 0.85);
    } else if (preset === 'heavy') {
      inputManager.vibrateGamepad(140, 0.7);
    } else {
      inputManager.vibrateGamepad(65, 0.35);
    }
  }

  public getFormattedControlHints(brand?: GamepadBrand): string {
    const activeBrand = brand || this.getSnapshot().brand;
    return `Gerak: D-Pad / L-Stick · Aksi: ${getGamepadButtonPrompt('PRIMARY', activeBrand)} · Sekunder: ${getGamepadButtonPrompt('SECONDARY', activeBrand)} · Pause: ${getGamepadButtonPrompt('PAUSE', activeBrand)}`;
  }
}

export const gamepadController = new GamepadController();
