import { useEffect, useState, useRef } from 'react';
import { inputManager, ActionSubscriber } from '../services/inputService';
import { InputAction, InputSource } from '../types';

export interface UseUnifiedInputOptions {
  onActionDown?: (action: InputAction) => void;
  onActionUp?: (action: InputAction) => void;
  onRawKey?: (key: string, isDown: boolean) => void;
  enabled?: boolean;
}

export function useUnifiedInput({
  onActionDown,
  onActionUp,
  onRawKey,
  enabled = true
}: UseUnifiedInputOptions = {}) {
  const [activeSource, setActiveSource] = useState<InputSource>(() => inputManager.getActiveSource());
  const [isGamepadConnected, setIsGamepadConnected] = useState<boolean>(() => inputManager.isGamepadConnected());

  const callbacksRef = useRef({ onActionDown, onActionUp, onRawKey });
  useEffect(() => {
    callbacksRef.current = { onActionDown, onActionUp, onRawKey };
  }, [onActionDown, onActionUp, onRawKey]);

  useEffect(() => {
    const unsubSource = inputManager.subscribeSource((source) => {
      setActiveSource(source);
      setIsGamepadConnected(inputManager.isGamepadConnected());
    });

    if (!enabled) {
      return () => {
        unsubSource();
      };
    }

    const subscriber: ActionSubscriber = {
      onActionDown: (action) => callbacksRef.current.onActionDown?.(action),
      onActionUp: (action) => callbacksRef.current.onActionUp?.(action),
      onRawKey: (key, isDown) => callbacksRef.current.onRawKey?.(key, isDown)
    };

    const unsubInput = inputManager.subscribe(subscriber);

    return () => {
      unsubSource();
      unsubInput();
    };
  }, [enabled]);

  return {
    activeSource,
    isGamepadConnected,
    getActionHint: (action: InputAction) => inputManager.getActionHint(action),
    setManualSource: (source: InputSource) => inputManager.setActiveSource(source)
  };
}
