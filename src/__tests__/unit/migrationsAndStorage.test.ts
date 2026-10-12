// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { migrationPipeline, CURRENT_SCHEMA_VERSION } from '../../data/migrations';
import { storageService } from '../../services/storageService';

describe('Unit Tests — Schema Migrations & Safe Local Storage Resilience', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Migration Pipeline Transitions', () => {
    it('runs initial v1 to v4 migration cleanly when no version is set', () => {
      const result = migrationPipeline.runMigrations();
      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe(1);
      expect(result.toVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(localStorage.getItem('zigame_schema_version')).toBe(String(CURRENT_SCHEMA_VERSION));
      expect(localStorage.getItem('zigame_offline_mutation_queue')).toBe('[]');
    });

    it('is idempotent when run multiple times on already updated schema', () => {
      migrationPipeline.runMigrations();
      const secondRun = migrationPipeline.runMigrations();
      expect(secondRun.success).toBe(true);
      expect(secondRun.migratedKeys.length).toBe(0);
    });

    it('migrates legacy v1 player profile to v2 structure without overwriting data', () => {
      const legacyProfile = {
        name: 'OldGamer',
        avatar: '🎮',
        colorTheme: 'indigo',
        coins: 150
      };
      localStorage.setItem('arcade_player_profile', JSON.stringify(legacyProfile));
      localStorage.setItem('zigame_schema_version', '1');

      const result = migrationPipeline.runMigrations();
      expect(result.success).toBe(true);
      expect(result.migratedKeys).toContain('arcade_player_profile');

      const updated = JSON.parse(localStorage.getItem('arcade_player_profile') || '{}');
      expect(updated.name).toBe('OldGamer');
      expect(updated.unlockedAvatars).toBeDefined();
      expect(updated.unlockedThemes).toBeDefined();
    });

    it('migrates legacy v2 achievements to clean v3 structure', () => {
      const legacyAchievements = [
        { id: 'ach_1', progress: -5, unlocked: 1 },
        { id: 'ach_2', progress: 10, unlocked: 0 }
      ];
      localStorage.setItem('arcade_achievements', JSON.stringify(legacyAchievements));
      localStorage.setItem('zigame_schema_version', '2');

      const result = migrationPipeline.runMigrations();
      expect(result.success).toBe(true);
      expect(result.migratedKeys).toContain('arcade_achievements');

      const updated = JSON.parse(localStorage.getItem('arcade_achievements') || '[]');
      expect(updated[0].progress).toBe(0); // Cleaned negative progress
      expect(updated[0].unlocked).toBe(true);
      expect(updated[1].unlocked).toBe(false);
    });
  });

  describe('Storage Service Resilience to Corrupted Data', () => {
    it('handles malformed JSON in profile storage gracefully by returning null', () => {
      localStorage.setItem('arcade_player_profile', 'invalid_json_{{');
      const profile = storageService.getProfile();
      expect(profile).toBeNull(); // Safely returns null on JSON parse error
    });

    it('handles malformed autolock values safely', () => {
      localStorage.setItem('zigame_session_autolock', 'not_a_number');
      expect(storageService.getSessionAutolock()).toBe('not_a_number');
    });

    it('returns schema version cleanly via storageService', () => {
      expect(storageService.getSchemaVersion()).toBe(CURRENT_SCHEMA_VERSION);
    });
  });
});
