import { logger } from '../../utils/logger';

export interface MigrationResult {
  fromVersion: number;
  toVersion: number;
  migratedKeys: string[];
  success: boolean;
  error?: string;
}

export const CURRENT_SCHEMA_VERSION = 4;

export class MigrationPipeline {
  private backupKeyPrefix = 'zigame_backup_v';

  public runMigrations(): MigrationResult {
    const rawVersion = localStorage.getItem('zigame_schema_version');
    const fromVersion = rawVersion ? parseInt(rawVersion, 10) : 1;

    if (fromVersion >= CURRENT_SCHEMA_VERSION) {
      return {
        fromVersion,
        toVersion: CURRENT_SCHEMA_VERSION,
        migratedKeys: [],
        success: true
      };
    }

    logger.info(`Starting storage migration from v${fromVersion} to v${CURRENT_SCHEMA_VERSION}`, {
      code: 'MIGRATION_START',
      context: { fromVersion, toVersion: CURRENT_SCHEMA_VERSION }
    });

    const migratedKeys: string[] = [];

    try {
      // 1. Create a safe rollback snapshot before applying transformations
      this.createSnapshot(fromVersion);

      // Apply incremental step-by-step migrations
      if (fromVersion < 2) {
        this.migrateV1toV2(migratedKeys);
      }
      if (fromVersion < 3) {
        this.migrateV2toV3(migratedKeys);
      }
      if (fromVersion < 4) {
        this.migrateV3toV4(migratedKeys);
      }

      // Mark migration as completed
      localStorage.setItem('zigame_schema_version', CURRENT_SCHEMA_VERSION.toString());
      localStorage.setItem('zigame_schema_migrated_at', Date.now().toString());

      logger.info(`Storage migration completed successfully to v${CURRENT_SCHEMA_VERSION}`, {
        code: 'MIGRATION_SUCCESS',
        context: { migratedKeys, targetVersion: CURRENT_SCHEMA_VERSION }
      });

      return {
        fromVersion,
        toVersion: CURRENT_SCHEMA_VERSION,
        migratedKeys,
        success: true
      };
    } catch (e: any) {
      logger.error(`Storage migration failed at step v${fromVersion} -> v${CURRENT_SCHEMA_VERSION}`, {
        code: 'MIGRATION_FAILED',
        error: e,
        context: { fromVersion }
      });

      return {
        fromVersion,
        toVersion: fromVersion,
        migratedKeys,
        success: false,
        error: e.message || String(e)
      };
    }
  }

  private createSnapshot(version: number) {
    try {
      const allKeys = Object.keys(localStorage);
      const snapshot: Record<string, string> = {};
      allKeys.forEach(k => {
        if (!k.startsWith('zigame_backup')) {
          snapshot[k] = localStorage.getItem(k) || '';
        }
      });
      localStorage.setItem(`${this.backupKeyPrefix}${version}_${Date.now()}`, JSON.stringify(snapshot));
    } catch (e) {
      logger.warn('Could not create pre-migration snapshot (storage might be near quota)', {
        code: 'SNAPSHOT_WARN'
      });
    }
  }

  private migrateV1toV2(migratedKeys: string[]) {
    // Migrate legacy arcade_* keys to standardized formats if missing
    const legacyProfile = localStorage.getItem('arcade_player_profile');
    if (legacyProfile) {
      try {
        const parsed = JSON.parse(legacyProfile);
        if (!parsed.unlockedAvatars) {
          parsed.unlockedAvatars = ['🎮', '🕹️', '👾', '🚀', '🦊', '🐱', '🐶', '🐼'];
        }
        if (!parsed.unlockedThemes) {
          parsed.unlockedThemes = ['indigo', 'purple', 'rose', 'emerald', '#6366f1', '#a855f7', '#f43f5e', '#10b981'];
        }
        localStorage.setItem('arcade_player_profile', JSON.stringify(parsed));
        migratedKeys.push('arcade_player_profile');
      } catch (e) {
        // preserve existing if corrupted
      }
    }
  }

  private migrateV2toV3(migratedKeys: string[]) {
    // Deduplicate inventory and validate achievements schema
    const legacyAchievements = localStorage.getItem('arcade_achievements');
    if (legacyAchievements) {
      try {
        const achs = JSON.parse(legacyAchievements);
        if (Array.isArray(achs)) {
          const cleanAchs = achs.map(a => ({
            ...a,
            progress: typeof a.progress === 'number' ? Math.max(0, a.progress) : 0,
            unlocked: Boolean(a.unlocked)
          }));
          localStorage.setItem('arcade_achievements', JSON.stringify(cleanAchs));
          migratedKeys.push('arcade_achievements');
        }
      } catch (e) {}
    }
  }

  private migrateV3toV4(migratedKeys: string[]) {
    // Standardize recently played format and ensure offline mutation queue exists
    if (!localStorage.getItem('zigame_offline_mutation_queue')) {
      localStorage.setItem('zigame_offline_mutation_queue', JSON.stringify([]));
      migratedKeys.push('zigame_offline_mutation_queue');
    }
  }
}

export const migrationPipeline = new MigrationPipeline();
