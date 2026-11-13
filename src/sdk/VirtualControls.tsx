import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { IInputController } from '../types/gameSdk';

export type VirtualControlMode = 'dpad' | 'joystick';

export interface VirtualControlsProps {
  mode?: VirtualControlMode;
  /** Optional SDK InputController instance to dispatch directional/action events */
  inputController?: IInputController;
  /** Callback when directional vector changes: dx, dy in [-1, 1] */
  onDirectionChange?: (dx: number, dy: number) => void;
  /** Callback when action button A or B is pressed or released */
  onAction?: (key: 'A' | 'B', isDown: boolean) => void;
  /** Number of action buttons to render: 1 (A) or 2 (A & B) */
  actionButtons?: 1 | 2;
  labelA?: string;
  labelB?: string;
  /** Explicitly force visibility (true/false). When omitted, auto-detects touch/small viewport. */
  visible?: boolean;
  /** Joystick outer diameter in pixels */
  joystickSize?: number;
  className?: string;
}

type CardinalDirection = 'up' | 'down' | 'left' | 'right';

function detectTouchOrSmallViewport(): boolean {
  if (typeof window === 'undefined') return false;
  const hasTouch =
    'ontouchstart' in window ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
  const smallViewport = window.innerWidth < 1024;
  return hasTouch || smallViewport;
}

export const VirtualControls: React.FC<VirtualControlsProps> = ({
  mode = 'dpad',
  inputController,
  onDirectionChange,
  onAction,
  actionButtons = 2,
  labelA = 'A',
  labelB = 'B',
  visible,
  joystickSize = 112,
  className = ''
}) => {
  const [autoVisible, setAutoVisible] = useState<boolean>(() => detectTouchOrSmallViewport());
  const isVisible = visible !== undefined ? visible : autoVisible;

  // D-Pad active directional state
  const dpadStateRef = useRef<Record<CardinalDirection, boolean>>({
    up: false,
    down: false,
    left: false,
    right: false
  });
  const [dpadPressed, setDpadPressed] = useState<Record<CardinalDirection, boolean>>({
    up: false,
    down: false,
    left: false,
    right: false
  });

  // Analog Joystick state
  const stickContainerRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingStick, setIsDraggingStick] = useState(false);
  const stickCardinalsRef = useRef<Record<CardinalDirection, boolean>>({
    up: false,
    down: false,
    left: false,
    right: false
  });

  useEffect(() => {
    if (visible !== undefined || typeof window === 'undefined') return;
    const update = () => setAutoVisible(detectTouchOrSmallViewport());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [visible]);

  const emitCardinalMove = useCallback(
    (dir: CardinalDirection, isDown: boolean) => {
      if (!inputController) return;
      inputController.dispatch({
        type: 'move',
        direction: dir,
        isDown,
        source: 'touch'
      });
      inputController.dispatch({
        type: 'action',
        action: dir,
        isDown,
        source: 'touch'
      });
    },
    [inputController]
  );

  const handleDpadPress = useCallback(
    (dir: CardinalDirection, isDown: boolean, e?: React.SyntheticEvent) => {
      if (e && 'cancelable' in e && e.cancelable) {
        e.preventDefault();
      }
      if (dpadStateRef.current[dir] === isDown) return;

      dpadStateRef.current[dir] = isDown;
      setDpadPressed({ ...dpadStateRef.current });

      const dx = (dpadStateRef.current.right ? 1 : 0) - (dpadStateRef.current.left ? 1 : 0);
      const dy = (dpadStateRef.current.down ? 1 : 0) - (dpadStateRef.current.up ? 1 : 0);
      onDirectionChange?.(dx, dy);
      emitCardinalMove(dir, isDown);
    },
    [emitCardinalMove, onDirectionChange]
  );

  const maxKnobRadius = joystickSize / 2 - 18;
  const deadzoneRatio = 0.2;

  const updateJoystickFromClient = useCallback(
    (clientX: number, clientY: number, phase: 'start' | 'move') => {
      const container = stickContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const rawDx = clientX - centerX;
      const rawDy = clientY - centerY;
      const dist = Math.hypot(rawDx, rawDy);

      let clampedX = rawDx;
      let clampedY = rawDy;
      if (dist > maxKnobRadius && dist > 0) {
        const ratio = maxKnobRadius / dist;
        clampedX = rawDx * ratio;
        clampedY = rawDy * ratio;
      }

      setKnobOffset({ x: clampedX, y: clampedY });

      const normX = maxKnobRadius > 0 ? clampedX / maxKnobRadius : 0;
      const normY = maxKnobRadius > 0 ? clampedY / maxKnobRadius : 0;
      const mag = Math.hypot(normX, normY);

      const dx = mag < deadzoneRatio ? 0 : Number(normX.toFixed(3));
      const dy = mag < deadzoneRatio ? 0 : Number(normY.toFixed(3));
      onDirectionChange?.(dx, dy);

      if (inputController) {
        inputController.dispatch({
          type: 'touch',
          x: dx,
          y: dy,
          dx,
          dy,
          phase
        });

        const nextCardinals: Record<CardinalDirection, boolean> = {
          left: dx <= -0.35,
          right: dx >= 0.35,
          up: dy <= -0.35,
          down: dy >= 0.35
        };
        (['up', 'down', 'left', 'right'] as const).forEach((dir) => {
          if (nextCardinals[dir] !== stickCardinalsRef.current[dir]) {
            stickCardinalsRef.current[dir] = nextCardinals[dir];
            emitCardinalMove(dir, nextCardinals[dir]);
          }
        });
      }
    },
    [emitCardinalMove, inputController, maxKnobRadius, onDirectionChange]
  );

  const releaseJoystick = useCallback(() => {
    activePointerIdRef.current = null;
    setIsDraggingStick(false);
    setKnobOffset({ x: 0, y: 0 });
    onDirectionChange?.(0, 0);

    if (inputController) {
      inputController.dispatch({
        type: 'touch',
        x: 0,
        y: 0,
        dx: 0,
        dy: 0,
        phase: 'end'
      });
      (['up', 'down', 'left', 'right'] as const).forEach((dir) => {
        if (stickCardinalsRef.current[dir]) {
          stickCardinalsRef.current[dir] = false;
          emitCardinalMove(dir, false);
        }
      });
    }
  }, [emitCardinalMove, inputController, onDirectionChange]);

  const handleActionButton = useCallback(
    (key: 'A' | 'B', isDown: boolean, e?: React.SyntheticEvent) => {
      if (e && 'cancelable' in e && e.cancelable) {
        e.preventDefault();
      }
      onAction?.(key, isDown);
      if (inputController) {
        inputController.dispatch({
          type: 'action',
          action: key === 'A' ? 'primary' : 'secondary',
          isDown,
          source: 'touch'
        });
      }
    },
    [inputController, onAction]
  );

  if (!isVisible) return null;

  return (
    <div
      data-testid="sdk-virtual-controls"
      className={`pointer-events-none fixed inset-x-0 bottom-4 z-40 flex items-end justify-between px-4 sm:px-6 select-none touch-none ${className}`}
    >
      {/* Left Directional Pad or Analog Joystick */}
      <div className="pointer-events-auto">
        {mode === 'joystick' ? (
          <div
            ref={stickContainerRef}
            role="slider"
            aria-label="Virtual Analog Joystick"
            aria-valuetext={`${knobOffset.x.toFixed(0)}, ${knobOffset.y.toFixed(0)}`}
            onPointerDown={(e) => {
              if (e.cancelable) e.preventDefault();
              activePointerIdRef.current = e.pointerId;
              e.currentTarget.setPointerCapture?.(e.pointerId);
              setIsDraggingStick(true);
              updateJoystickFromClient(e.clientX, e.clientY, 'start');
            }}
            onPointerMove={(e) => {
              if (!isDraggingStick || activePointerIdRef.current !== e.pointerId) return;
              updateJoystickFromClient(e.clientX, e.clientY, 'move');
            }}
            onPointerUp={(e) => {
              if (activePointerIdRef.current !== e.pointerId) return;
              releaseJoystick();
            }}
            onPointerCancel={(e) => {
              if (activePointerIdRef.current !== e.pointerId) return;
              releaseJoystick();
            }}
            style={{ width: `${joystickSize}px`, height: `${joystickSize}px` }}
            className="relative rounded-full bg-zinc-950/75 border border-white/10 backdrop-blur-md flex items-center justify-center shadow-xl touch-none"
          >
            <div className="w-12 h-12 rounded-full border border-white/10 pointer-events-none" />
            <div
              style={{
                transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
                transition: isDraggingStick ? 'none' : 'transform 120ms ease-out'
              }}
              className="absolute w-11 h-11 rounded-full bg-indigo-500/90 border border-indigo-300/50 shadow-lg pointer-events-none"
            />
          </div>
        ) : (
          <div
            role="group"
            aria-label="Virtual D-Pad"
            className="relative w-32 h-32 rounded-full bg-zinc-950/75 border border-white/10 backdrop-blur-md shadow-xl flex items-center justify-center touch-none"
          >
            <button
              type="button"
              aria-label="Up"
              onPointerDown={(e) => handleDpadPress('up', true, e)}
              onPointerUp={(e) => handleDpadPress('up', false, e)}
              onPointerCancel={(e) => handleDpadPress('up', false, e)}
              onPointerLeave={(e) => handleDpadPress('up', false, e)}
              className={`absolute top-1 left-1/2 -translate-x-1/2 w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center transition-colors ${
                dpadPressed.up ? 'bg-indigo-600 text-white' : 'bg-zinc-900/90 text-zinc-300'
              }`}
            >
              <ArrowUp size={16} />
            </button>
            <button
              type="button"
              aria-label="Left"
              onPointerDown={(e) => handleDpadPress('left', true, e)}
              onPointerUp={(e) => handleDpadPress('left', false, e)}
              onPointerCancel={(e) => handleDpadPress('left', false, e)}
              onPointerLeave={(e) => handleDpadPress('left', false, e)}
              className={`absolute left-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center transition-colors ${
                dpadPressed.left ? 'bg-indigo-600 text-white' : 'bg-zinc-900/90 text-zinc-300'
              }`}
            >
              <ArrowLeft size={16} />
            </button>
            <button
              type="button"
              aria-label="Right"
              onPointerDown={(e) => handleDpadPress('right', true, e)}
              onPointerUp={(e) => handleDpadPress('right', false, e)}
              onPointerCancel={(e) => handleDpadPress('right', false, e)}
              onPointerLeave={(e) => handleDpadPress('right', false, e)}
              className={`absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center transition-colors ${
                dpadPressed.right ? 'bg-indigo-600 text-white' : 'bg-zinc-900/90 text-zinc-300'
              }`}
            >
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              aria-label="Down"
              onPointerDown={(e) => handleDpadPress('down', true, e)}
              onPointerUp={(e) => handleDpadPress('down', false, e)}
              onPointerCancel={(e) => handleDpadPress('down', false, e)}
              onPointerLeave={(e) => handleDpadPress('down', false, e)}
              className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center transition-colors ${
                dpadPressed.down ? 'bg-indigo-600 text-white' : 'bg-zinc-900/90 text-zinc-300'
              }`}
            >
              <ArrowDown size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Right Action Buttons (A / B) */}
      <div className="pointer-events-auto flex items-end gap-3">
        {actionButtons === 2 && (
          <button
            type="button"
            aria-label={`Action ${labelB}`}
            onPointerDown={(e) => handleActionButton('B', true, e)}
            onPointerUp={(e) => handleActionButton('B', false, e)}
            onPointerCancel={(e) => handleActionButton('B', false, e)}
            onPointerLeave={(e) => handleActionButton('B', false, e)}
            className="w-13 h-13 rounded-full bg-zinc-900/85 active:bg-amber-500 active:text-slate-950 text-zinc-100 font-mono font-bold text-sm border border-white/15 backdrop-blur-md shadow-xl flex items-center justify-center active:scale-95 transition-all touch-none"
          >
            {labelB}
          </button>
        )}
        <button
          type="button"
          aria-label={`Action ${labelA}`}
          onPointerDown={(e) => handleActionButton('A', true, e)}
          onPointerUp={(e) => handleActionButton('A', false, e)}
          onPointerCancel={(e) => handleActionButton('A', false, e)}
          onPointerLeave={(e) => handleActionButton('A', false, e)}
          className="w-16 h-16 rounded-full bg-indigo-600/90 active:bg-indigo-400 text-white font-mono font-bold text-base border border-indigo-400/40 backdrop-blur-md shadow-xl flex items-center justify-center active:scale-95 transition-all touch-none"
        >
          {labelA}
        </button>
      </div>
    </div>
  );
};
