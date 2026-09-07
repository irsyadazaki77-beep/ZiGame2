import React, { useEffect, useRef } from 'react';
import { storageService } from '../../services/storageService';

interface SessionAutolockProps {
  onLockTriggered: () => void;
}

export const SessionAutolock: React.FC<SessionAutolockProps> = ({ onLockTriggered }) => {
  const lastActivityRef = useRef<number>(Date.now());
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkAndSchedule = () => {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }

      const autolockSetting = storageService.getSessionAutolock();
      const activeUser = storageService.getActiveUser();

      if (!activeUser || autolockSetting === 'off') {
        return;
      }

      const timeoutMinutes = parseInt(autolockSetting, 10);
      if (isNaN(timeoutMinutes) || timeoutMinutes <= 0) {
        return;
      }

      const timeoutMs = timeoutMinutes * 60 * 1000;
      const elapsed = Date.now() - lastActivityRef.current;
      const remaining = Math.max(0, timeoutMs - elapsed);

      idleTimeoutRef.current = setTimeout(() => {
        onLockTriggered();
        storageService.clearActiveUser();
        setTimeout(() => {
          window.location.reload();
        }, 2500);
      }, remaining);
    };

    // Throttled activity listener (ignores events fired within 5 seconds of the last one)
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current > 5000) {
        lastActivityRef.current = now;
        checkAndSchedule();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        lastActivityRef.current = Date.now();
        checkAndSchedule();
      }
    };

    const targetEvents: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'touchstart'];

    targetEvents.forEach((evt) => {
      document.addEventListener(evt, handleUserActivity, { passive: true, capture: true });
    });
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });

    // Initial check
    checkAndSchedule();

    return () => {
      targetEvents.forEach((evt) => {
        document.removeEventListener(evt, handleUserActivity, true);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
    };
  }, [onLockTriggered]);

  return null;
};
