import { useState, useEffect } from 'react';
import { PlayerProfile } from '../types';
import { storageService } from '../services/storageService';

export const usePlayerProfile = () => {
  const [profile, setProfile] = useState<PlayerProfile>({
    name: 'ARKADE_X',
    avatar: '👾',
    colorTheme: '#6366f1',
    coins: 0,
  });

  // Load from storage on mount
  useEffect(() => {
    const savedProfile = storageService.getProfile();
    if (savedProfile) {
      if (!savedProfile.colorTheme) {
        savedProfile.colorTheme = '#6366f1';
      }
      setProfile(savedProfile);
    }
  }, []);

  const handleUpdateProfile = (updates: Partial<PlayerProfile> | ((prev: PlayerProfile) => PlayerProfile)) => {
    setProfile(prev => {
      const next = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };
      storageService.saveProfile(next);
      return next;
    });
  };

  return {
    profile,
    setProfile,
    handleUpdateProfile,
  };
};
export default usePlayerProfile;
