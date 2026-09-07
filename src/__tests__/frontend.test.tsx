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

    describe('Canonical Game Registry & 37 Games Integrity', () => {
    it('should have valid canonical ID and balance config for all 37 games', () => {
      const all37Games = [
        'snake', 'brick-breaker', 'flappy-pixel', 'space-defender', 'memory-grid',
        'cyber-runner', 'neon-pong', 'neon-stacker', 'vaporwave-racer', 'lock-breaker',
        'sine-rider', 'cosmic-dodge', 'laser-grid', 'cyber-simon', 'plinko-neo',
        'cosmic-asteroid', 'cyber-slasher', 'cyber-clicker', 'block-match', 'cyber-typer',
        'maze-runner', 'memory-path', 'rhythm-tap', 'pixel-golf', 'pixel-dino',
        'cyber-tetris', 'archery-neo', 'cyber-mines', 'neon-2048', 'whack-a-drone',
        'jump-rope', 'neon-drift',
        'neon-heist', 'void-survivor', 'orbital-defense', 'gravity-shift', 'hex-dominion'
      ];

      expect(all37Games.length).toBe(37);

      for (const id of all37Games) {
        expect(isValidGameId(id)).toBe(true);
        expect(toCanonicalGameId(id)).toBe(id);
        const config = GAME_BALANCE_CONFIG[id as keyof typeof GAME_BALANCE_CONFIG];
        expect(config).toBeDefined();
        expect(config.baseCoinMultiplier).toBeGreaterThan(0);
        expect(config.maxScoreCeiling).toBeGreaterThan(0);
      }
    });

    it('should resolve legacy aliases cleanly to their canonical counterparts', () => {
      expect(toCanonicalGameId('brick')).toBe('brick-breaker');
      expect(toCanonicalGameId('flappy')).toBe('flappy-pixel');
      expect(toCanonicalGameId('2048')).toBe('neon-2048');
      expect(toCanonicalGameId('mines')).toBe('cyber-mines');
      expect(toCanonicalGameId('jumprope')).toBe('jump-rope');
      expect(toCanonicalGameId('neondrift')).toBe('neon-drift');
      expect(toCanonicalGameId('racer')).toBe('vaporwave-racer');
      expect(toCanonicalGameId('dinorun')).toBe('pixel-dino');
      expect(toCanonicalGameId('typer')).toBe('cyber-typer');
      expect(toCanonicalGameId('heist')).toBe('neon-heist');
      expect(toCanonicalGameId('survivor')).toBe('void-survivor');
    });
  });
});
