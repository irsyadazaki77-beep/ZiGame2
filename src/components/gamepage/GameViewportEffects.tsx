import React, { useState, useEffect } from 'react';
import { screenShake, ShakeIntensity } from '../../utils/screenShake';

interface GameViewportEffectsProps {
  isCrtFilter: boolean;
  children: React.ReactNode;
}

export const GameViewportEffects: React.FC<GameViewportEffectsProps> = ({
  isCrtFilter,
  children
}) => {
  const [shakeClass, setShakeClass] = useState<string>('');

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const unsubscribe = screenShake.subscribe((intensity: ShakeIntensity) => {
      // Re-trigger animation cleanly
      setShakeClass('');
      requestAnimationFrame(() => {
        setShakeClass(`shake-${intensity}`);
      });

      clearTimeout(timer);
      const duration = intensity === 'heavy' ? 450 : intensity === 'medium' ? 350 : 250;
      timer = setTimeout(() => {
        setShakeClass('');
      }, duration);
    });

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className={`relative w-full h-full flex items-center justify-center ${shakeClass}`}>
      {/* Underlying Game Canvas Container */}
      <div className={`relative w-full h-full flex items-center justify-center ${isCrtFilter ? 'crt-bloom' : ''}`}>
        {children}
      </div>

      {/* CRT Scanline & Curved Glass Shaders (Hardware-accelerated CSS) */}
      {isCrtFilter && (
        <>
          <div className="absolute inset-0 crt-scanlines pointer-events-none z-30 opacity-70" />
          <div className="absolute inset-0 crt-vignette pointer-events-none z-30 opacity-80" />
        </>
      )}
    </div>
  );
};
