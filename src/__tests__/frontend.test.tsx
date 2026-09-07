// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { APP_VERSION } from '../config/version';
import { toCanonicalGameId, isValidGameId } from '../config/canonicalGames';
import { formatNumber } from '../utils/format';
import { GAME_BALANCE_CONFIG } from '../config/balanceConfig';
import { storageService } from '../services/storageService';

describe('Frontend Utilities & Configuration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Version Consistency', () => {
    it('should have a valid semver APP_VERSION', () => {
      expect(APP_VERSION).toBeDefined();
      expect(typeof APP_VERSION).toBe('string');
      expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('Number Formatting Utils', () => {
    it('should format numbers according to id-ID locale correctly', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(1500)).toBe('1.500');
      expect(formatNumber(1000000)).toBe('1.000.000');
    });
  });

  describe('Storage Service & Autolock State', () => {
    it('should return default autolock setting when none is stored', () => {
      expect(storageService.getSessionAutolock()).toBe('off');
    });

    it('should persist and retrieve custom autolock duration', () => {
      storageService.setSessionAutolock('15');
      expect(storageService.getSessionAutolock()).toBe('15');
    });

    it('should manage active user session cleanly', () => {
      expect(storageService.getActiveUser()).toBeNull();
      storageService.setActiveUser('user-abc-123');
      expect(storageService.getActiveUser()).toBe('user-abc-123');
      storageService.clearActiveUser();
      expect(storageService.getActiveUser()).toBeNull();
    });
  });

  describe('Game Balance Multipliers', () => {
    it('should have valid balance config for canonical games', () => {
      const canonicalIds = ['snake', 'cyber-tetris', 'cosmic-dodge', 'flappy-pixel', 'neon-2048', 'cyber-mines', 'brick-breaker'];
      for (const id of canonicalIds) {
        expect(isValidGameId(id)).toBe(true);
        expect(toCanonicalGameId(id)).toBe(id);
        const config = GAME_BALANCE_CONFIG[id as keyof typeof GAME_BALANCE_CONFIG];
        expect(config).toBeDefined();
        expect(config.baseCoinMultiplier).toBeGreaterThan(0);
        expect(config.maxScoreCeiling).toBeGreaterThan(0);
      }
    });
  });
});
