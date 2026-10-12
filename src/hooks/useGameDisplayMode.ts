import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../utils/logger';

export function useGameDisplayMode() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isBossMode, setIsBossMode] = useState(false);
  const [isCrtFilter, setIsCrtFilter] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut listener ('B' for Boss Mode, 'F' for Focus Mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'b' || e.key === 'B') {
        setIsBossMode(prev => !prev);
      }
      if (e.key === 'f' || e.key === 'F') {
        setIsFocusMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => {
        logger.warn("Fullscreen request failed:", { error: err });
      });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(err => {
        logger.warn("Exit fullscreen failed:", { error: err });
      });
    }
  }, []);

  return {
    isFullscreen,
    setIsFullscreen,
    isFocusMode,
    setIsFocusMode,
    isBossMode,
    setIsBossMode,
    isCrtFilter,
    setIsCrtFilter,
    containerRef,
    toggleFullscreen
  };
}
