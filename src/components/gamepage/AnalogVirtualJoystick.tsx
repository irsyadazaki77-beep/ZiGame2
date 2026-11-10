import React, { useState, useRef, useEffect, useCallback } from 'react';
import { inputManager } from '../../services/inputService';
import { InputAction } from '../../types';
import { haptics } from '../../utils/haptics';

interface AnalogVirtualJoystickProps {
  onDirectionChange?: (action: InputAction | null) => void;
  size?: number;
  deadzone?: number;
}

export const AnalogVirtualJoystick: React.FC<AnalogVirtualJoystickProps> = ({
  onDirectionChange,
  size = 110,
  deadzone = 12
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const activeActionRef = useRef<InputAction | null>(null);
  const touchIdRef = useRef<number | null>(null);

  const radius = size / 2;
  const maxDistance = radius - 16;

  const resolveAction = (dx: number, dy: number, distance: number): InputAction | null => {
    if (distance < deadzone) return null;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI); // -180 to 180

    if (angle >= -45 && angle <= 45) {
      return 'RIGHT';
    } else if (angle > 45 && angle < 135) {
      return 'DOWN';
    } else if (angle >= 135 || angle <= -135) {
      return 'LEFT';
    } else {
      return 'UP';
    }
  };

  const updatePosition = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const rawDx = clientX - centerX;
    const rawDy = clientY - centerY;
    const distance = Math.sqrt(rawDx * rawDx + rawDy * rawDy);

    let x = rawDx;
    let y = rawDy;

    if (distance > maxDistance) {
      const angle = Math.atan2(rawDy, rawDx);
      x = Math.cos(angle) * maxDistance;
      y = Math.sin(angle) * maxDistance;
    }

    setKnobPos({ x, y });

    const newAction = resolveAction(rawDx, rawDy, distance);
    if (newAction !== activeActionRef.current) {
      // Release previous action
      if (activeActionRef.current) {
        inputManager.dispatchAction(activeActionRef.current, false, 'touch');
      }
      // Press new action
      if (newAction) {
        inputManager.dispatchAction(newAction, true, 'touch');
        haptics.trigger('selection');
      }
      activeActionRef.current = newAction;
      onDirectionChange?.(newAction);
    }
  }, [maxDistance, deadzone, onDirectionChange]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    const touch = e.changedTouches[0];
    if (!touch) return;
    touchIdRef.current = touch.identifier;
    setIsDragging(true);
    updatePosition(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    if (!isDragging || touchIdRef.current === null) return;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === touchIdRef.current) {
        updatePosition(e.touches[i].clientX, e.touches[i].clientY);
        break;
      }
    }
  };

  const resetJoystick = useCallback(() => {
    setIsDragging(false);
    touchIdRef.current = null;
    setKnobPos({ x: 0, y: 0 });
    if (activeActionRef.current) {
      inputManager.dispatchAction(activeActionRef.current, false, 'touch');
      activeActionRef.current = null;
      onDirectionChange?.(null);
    }
  }, [onDirectionChange]);

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    if (touchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        resetJoystick();
        break;
      }
    }
  };

  // Mouse fallback for responsive preview testing
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updatePosition(e.clientX, e.clientY);
  };

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (isDragging) updatePosition(e.clientX, e.clientY);
    };
    const handleWindowMouseUp = () => {
      if (isDragging) resetJoystick();
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDragging, updatePosition, resetJoystick]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
      style={{ width: `${size}px`, height: `${size}px` }}
      className="relative rounded-full bg-zinc-950/90 border border-indigo-500/30 backdrop-blur-md shadow-[0_0_20px_rgba(99,102,241,0.15)] flex items-center justify-center select-none touch-none cursor-pointer"
      aria-label="Analog Virtual Joystick"
    >
      {/* 4 Cardinal Direction Glow Accents */}
      <div className={`absolute top-1.5 left-1/2 -translate-x-1/2 w-3 h-1 rounded-full transition-colors ${activeActionRef.current === 'UP' ? 'bg-indigo-400 shadow-[0_0_8px_#818cf8]' : 'bg-zinc-700/60'}`} />
      <div className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-1 rounded-full transition-colors ${activeActionRef.current === 'DOWN' ? 'bg-indigo-400 shadow-[0_0_8px_#818cf8]' : 'bg-zinc-700/60'}`} />
      <div className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full transition-colors ${activeActionRef.current === 'LEFT' ? 'bg-indigo-400 shadow-[0_0_8px_#818cf8]' : 'bg-zinc-700/60'}`} />
      <div className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full transition-colors ${activeActionRef.current === 'RIGHT' ? 'bg-indigo-400 shadow-[0_0_8px_#818cf8]' : 'bg-zinc-700/60'}`} />

      {/* Inner Boundary Guide Ring */}
      <div className="w-16 h-16 rounded-full border border-white/[0.08] pointer-events-none" />

      {/* Floating Analog Stick Knob */}
      <div
        style={{
          transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
          transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className={`w-12 h-12 rounded-full border border-indigo-400/40 flex items-center justify-center shadow-lg pointer-events-none transition-colors ${
          isDragging
            ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-[0_0_15px_rgba(99,102,241,0.6)]'
            : 'bg-zinc-800/90 shadow-md'
        }`}
      >
        <div className="w-4 h-4 rounded-full bg-white/20 border border-white/40" />
      </div>
    </div>
  );
};
