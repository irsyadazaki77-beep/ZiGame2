import React, { useEffect, useState } from 'react';
import { Gamepad2, Vibrate } from 'lucide-react';
import { gamepadController, GamepadHardwareSnapshot } from '../../sdk/gamepadController';
import { inputManager } from '../../services/inputService';
import { audioController } from '../../sdk/audioController';

interface GamepadIndicatorProps {
  compact?: boolean;
}

export const GamepadIndicator: React.FC<GamepadIndicatorProps> = ({ compact = true }) => {
  const [snapshot, setSnapshot] = useState<GamepadHardwareSnapshot>(() => gamepadController.getSnapshot());
  const [activeSource, setActiveSource] = useState(() => inputManager.getActiveSource());

  useEffect(() => {
    const unsubSource = inputManager.subscribeSource((src) => {
      setActiveSource(src);
      setSnapshot(gamepadController.getSnapshot());
    });

    const interval = setInterval(() => {
      const next = gamepadController.getSnapshot();
      setSnapshot((prev) =>
        prev.connected === next.connected &&
        prev.id === next.id &&
        prev.pressedButtons.length === next.pressedButtons.length
          ? prev
          : next
      );
    }, 600);

    return () => {
      unsubSource();
      clearInterval(interval);
    };
  }, []);

  if (compact) {
    if (!snapshot.connected && activeSource !== 'gamepad') return null;

    return (
      <div
        className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-indigo-500/15 border border-indigo-500/35 text-indigo-300 rounded-lg text-[9px] xs:text-[10px] sm:text-xs font-mono font-bold select-none shrink-0"
        title={`Controller Aktif: ${snapshot.brandLabel}`}
        data-testid="gamepad-hud-indicator"
      >
        <Gamepad2 size={11} className="text-indigo-400 shrink-0" />
        <span className="uppercase">{snapshot.brand === 'generic' ? 'PAD' : snapshot.brand.toUpperCase()}</span>
      </div>
    );
  }

  return (
    <div
      className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-2"
      data-testid="gamepad-diagnostics-card"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gamepad2 size={15} className={snapshot.connected ? 'text-emerald-400' : 'text-zinc-500'} />
          <span className="text-xs font-medium text-zinc-200">Hardware Gamepad (W3C API)</span>
        </div>
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
            snapshot.connected
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          {snapshot.connected ? snapshot.brandLabel : 'Standby'}
        </span>
      </div>

      <p className="text-[10px] font-mono text-zinc-400 leading-relaxed">
        {snapshot.connected
          ? gamepadController.getFormattedControlHints(snapshot.brand)
          : 'Sambungkan controller PS5 DualSense, Xbox Wireless, atau Switch Pro via USB/Bluetooth lalu tekan tombol apa saja.'}
      </p>

      {snapshot.connected && (
        <button
          onClick={() => {
            audioController.playCoin();
            gamepadController.triggerHapticPulse('victory');
          }}
          className="w-full py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <Vibrate size={12} /> Uji Getaran Dual-Rumble
        </button>
      )}
    </div>
  );
};
