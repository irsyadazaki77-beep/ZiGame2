import { useState, useEffect, useCallback } from 'react';
import { audioController } from '../sdk/audioController';

export function useGameAudio(isBossMode: boolean) {
  const [isMuted, setIsMuted] = useState(() => audioController.isMuted());
  const [isBgmOn, setIsBgmOn] = useState(true);

  useEffect(() => {
    return audioController.subscribe(() => {
      setIsMuted(audioController.isMuted());
    });
  }, []);

  // Background audio sync
  useEffect(() => {
    if (isBgmOn && !isMuted && !isBossMode) {
      audioController.startBgm();
    } else {
      audioController.stopBgm();
    }
    return () => {
      audioController.stopBgm();
    };
  }, [isBgmOn, isMuted, isBossMode]);

  const handleToggleMute = useCallback(() => {
    const newMuteState = audioController.toggleMute();
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
