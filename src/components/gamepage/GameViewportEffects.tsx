import React, { useState, useEffect } from 'react';
import { screenShake, ShakeIntensity } from '../../utils/screenShake';
import { gameFx, ImpactFlashKind } from '../../utils/gameFx';

interface GameViewportEffectsProps {
  isCrtFilter: boolean;
  children: React.ReactNode;
}

export const GameViewportEffects: React.FC<GameViewportEffectsProps> = ({
  isCrtFilter,
  children
}) => {
  const [shakeClass, setShakeClass] = useState<string>('');
  const [impactFlash, setImpactFlash] = useState<{ kind: ImpactFlashKind; key: number } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

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

  useEffect(() => {
    let flashTimer: ReturnType<typeof setTimeout>;
    const unsubFx = gameFx.subscribe((kind) => {
      setImpactFlash({ kind, key: Date.now() + Math.random() });
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        setImpactFlash(null);
      }, 360);
    });
    return () => {
      unsubFx();
      clearTimeout(flashTimer);
    };
  }, []);

  return (
    <div className={`relative w-full h-full min-h-0 min-w-0 flex items-center justify-center ${shakeClass}`}>
      {/* Underlying Game Canvas Container */}
      <div className={`relative w-full h-full min-h-0 min-w-0 flex items-center justify-center ${isCrtFilter ? 'crt-bloom' : ''}`}>
        {children}
      </div>

      {/* Transient Chromatic Impact Edge Vignette */}
      {impactFlash && (
        <div
          key={impactFlash.key}
          className={`absolute inset-0 pointer-events-none z-25 rounded-xl sm:rounded-2xl md:rounded-3xl impact-vignette impact-${impactFlash.kind}`}
          aria-hidden="true"
        />
      )}

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
