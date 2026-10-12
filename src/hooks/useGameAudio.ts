import { useState, useEffect, useCallback } from 'react';
import { audio } from '../utils/audio';

export function useGameAudio(isBossMode: boolean) {
  const [isMuted, setIsMuted] = useState(() => audio.getMuteState());
  const [isBgmOn, setIsBgmOn] = useState(true);

  // Background audio sync
  useEffect(() => {
    if (isBgmOn && !isMuted && !isBossMode) {
      audio.startBgm();
    } else {
      audio.stopBgm();
    }
    return () => {
      audio.stopBgm();
    };
  }, [isBgmOn, isMuted, isBossMode]);

  const handleToggleMute = useCallback(() => {
    const newMuteState = audio.toggleMute();
    setIsMuted(newMuteState);
  }, []);

  return {
    isMuted,
    setIsMuted,
    isBgmOn,
    setIsBgmOn,
    handleToggleMute
  };
}
