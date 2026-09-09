// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APP_VERSION } from '../config/version';
import { toCanonicalGameId, isValidGameId, CANONICAL_GAME_IDS } from '../config/canonicalGames';
import { formatNumber } from '../utils/format';
import { GAME_BALANCE_CONFIG } from '../config/balanceConfig';
import { CANONICAL_GAME_REGISTRY, GAME_REGISTRY, getGameRegistryItem } from '../config/gameRegistry';
import { CANONICAL_GAME_LAYOUTS, getGameLayout } from '../config/gameLayouts';
import { getTutorialForGame } from '../config/gameTutorials';
import { INITIAL_GAMES } from '../data/games';
import { storageService } from '../services/storageService';
import { inputManager } from '../services/inputService';

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
    it('should have exactly 37 canonical games declared', () => {
      expect(CANONICAL_GAME_IDS.length).toBe(37);
      expect(INITIAL_GAMES.length).toBe(37);
    });

    it('should validate all 37 games for canonical ID, registry, component, layout, and balance', () => {
      for (const id of CANONICAL_GAME_IDS) {
        expect(isValidGameId(id)).toBe(true);
        expect(toCanonicalGameId(id)).toBe(id);

        // Registry check
        const registryItem = CANONICAL_GAME_REGISTRY[id];
        expect(registryItem, `Missing registry item for ${id}`).toBeDefined();
        expect(registryItem.id).toBe(id);
        expect(registryItem.title).toBeTruthy();
        expect(registryItem.component).toBeDefined();
        expect(typeof registryItem.component).toBe('object');

        // Lookup helper check
        const retrieved = getGameRegistryItem(id);
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(id);

        // Balance check
        const config = GAME_BALANCE_CONFIG[id];
        expect(config, `Missing balance config for ${id}`).toBeDefined();
        expect(config.baseCoinMultiplier).toBeGreaterThan(0);
        expect(config.maxScoreCeiling).toBeGreaterThan(0);

        // Layout check
        const layout = CANONICAL_GAME_LAYOUTS[id] || getGameLayout(id);
        expect(layout, `Missing layout for ${id}`).toBeDefined();
        expect(layout.aspectRatio).toBeDefined();

        // Tutorial check
        const tutorial = getTutorialForGame(id, registryItem.title, registryItem.description);
        expect(tutorial, `Missing tutorial for ${id}`).toBeDefined();
        expect(tutorial.title).toBeTruthy();
      }
    });

    it('should resolve legacy aliases cleanly to their canonical counterparts in registry and helpers', () => {
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

      // Check aliased lookup in GAME_REGISTRY
      expect(GAME_REGISTRY['brick'].id).toBe('brick-breaker');
      expect(GAME_REGISTRY['flappy'].id).toBe('flappy-pixel');
      expect(getGameRegistryItem('brick')?.id).toBe('brick-breaker');
    });
  });

  describe('Input Service & Double-Dispatch Prevention', () => {
    it('should filter synthetic untrusted events from driving gameplay input', () => {
      const subscriber = {
        onActionDown: vi.fn(),
        onActionUp: vi.fn(),
        onRawKey: vi.fn()
      };

      const unsubscribe = inputManager.subscribe(subscriber);

      // Untrusted event (e.isTrusted is false in synthetic JS dispatch)
      const fakeEvent = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        code: 'ArrowUp',
        bubbles: true,
        cancelable: true
      });

      window.dispatchEvent(fakeEvent);

      // Should not trigger subscriber for untrusted synthetic events
      expect(subscriber.onActionDown).not.toHaveBeenCalled();

      unsubscribe();
    });
  });
});
