// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectGamepadBrand,
  getBrandDisplayName,
  getGamepadButtonPrompt,
  gamepadController,
} from '../../sdk/gamepadController';
import {
  BGM_TRACKS,
  computeStepDurationSeconds,
} from '../../sdk/synthBgmController';
import { audioController } from '../../sdk/audioController';
import {
  BATTLE_PASS_TIERS,
  computeBattlePassProgress,
  getClaimedBattlePassRewardIds,
  isCyberPassPremiumUnlocked,
  markBattlePassRewardClaimed,
  unlockCyberPassPremium,
} from '../../config/battlePassConfig';
import { ugcLevelService, UgcTileType } from '../../services/ugcLevelService';
import { multiplayerService } from '../../services/multiplayerService';
import { STUDIO_ATMOSPHERES_3D, StudioAtmosphere3D } from '../../utils/threeStage';

describe('ZiGame v2.1 / v2.2 Roadmap Features — 5 Pillars Unit Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Pilar 1: Real-Time 1v1 Multiplayer & Bot Matchmaking', () => {
    it('creates an instant 1v1 bot duel room and syncs live score progression', async () => {
      const room = multiplayerService.createBotMatch('neon-pong', 'CyberAce', '👾');
      expect(room.code).toMatch(/^BOT-\d{3}$/);
      expect(room.status).toBe('active');
      expect(room.guest?.name).toBe('NEON-AI v2');

      const synced = await multiplayerService.syncScore(room.code, 'host', 120, false);
      expect(synced).not.toBeNull();
      expect(synced?.host.score).toBe(120);
      expect(synced?.guest?.score).toBeGreaterThan(0);

      const finished = await multiplayerService.syncScore(room.code, 'host', 250, true);
      expect(finished?.status).toBe('finished');
      expect(finished?.host.finished).toBe(true);
    });
  });

  describe('Pilar 2: Hardware Gamepad Support (W3C Gamepad API)', () => {
    it('detects PlayStation, Xbox, Nintendo, and generic controller brands accurately', () => {
      expect(detectGamepadBrand('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toBe('playstation');
      expect(detectGamepadBrand('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('xbox');
      expect(detectGamepadBrand('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)')).toBe('nintendo');
      expect(detectGamepadBrand('8BitDo Bluetooth Pad')).toBe('generic');

      expect(getBrandDisplayName('playstation')).toContain('PlayStation');
      expect(getGamepadButtonPrompt('PRIMARY', 'playstation')).toBe('[✕ Cross]');
      expect(getGamepadButtonPrompt('PRIMARY', 'xbox')).toBe('[A]');
      expect(getGamepadButtonPrompt('PRIMARY', 'nintendo')).toBe('[B]');
    });

    it('provides a safe hardware snapshot when no physical controller is attached', () => {
      const snap = gamepadController.getSnapshot();
      expect(snap.connected).toBe(false);
      expect(gamepadController.getFormattedControlHints('playstation')).toContain('[✕ Cross]');
    });
  });

  describe('Pilar 3: Season 2 Cyber Pass (50-Tier Progression)', () => {
    it('defines 50 tiers with deterministic XP thresholds and milestone cosmetics', () => {
      expect(BATTLE_PASS_TIERS).toHaveLength(50);
      expect(BATTLE_PASS_TIERS[0].tier).toBe(1);
      expect(BATTLE_PASS_TIERS[49].tier).toBe(50);
      expect(BATTLE_PASS_TIERS[49].cyberReward.rarity).toBe('legendary');
    });

    it('computes tier progress and persists reward claims & premium status', () => {
      const p0 = computeBattlePassProgress(0);
      expect(p0.currentTier).toBe(0);

      const p10 = computeBattlePassProgress(1260); // 10 * 120 + 60
      expect(p10.currentTier).toBe(10);
      expect(p10.progressPercent).toBe(50);

      expect(isCyberPassPremiumUnlocked()).toBe(false);
      unlockCyberPassPremium();
      expect(isCyberPassPremiumUnlocked()).toBe(true);

      const claimed = markBattlePassRewardClaimed('bp_free_1');
      expect(claimed).toContain('bp_free_1');
      expect(getClaimedBattlePassRewardIds()).toContain('bp_free_1');
    });
  });

  describe('Pilar 4: Procedural Chiptune Audio Synthesizer 2.0', () => {
    it('supports 4 synthwave/chiptune tracks and scales step tempo by intensity', () => {
      expect(Object.keys(BGM_TRACKS)).toEqual([
        'cyberpunk',
        'boss-battle',
        'cosmic-chill',
        'retro-overdrive',
      ]);

      const normalStep = computeStepDurationSeconds('cyberpunk', 'normal');
      const criticalStep = computeStepDurationSeconds('cyberpunk', 'critical');
      expect(criticalStep).toBeLessThan(normalStep);

      audioController.setBgmTrack('boss-battle');
      expect(audioController.getBgmTrack()).toBe('boss-battle');

      audioController.setBgmIntensity('high');
      expect(audioController.getBgmIntensity()).toBe('high');
    });
  });

  describe('Pilar 5: Custom Level Editor / Sandbox UGC', () => {
    it('encodes and decodes 8x8 custom grid level codes losslessly', () => {
      const tiles: UgcTileType[] = Array.from({ length: 64 }, (_, i) => (i % 5) as UgcTileType);
      const code = ugcLevelService.encodeLevelCode({
        title: 'Neon Fortress',
        author: 'Zakii',
        gameId: 'maze-runner',
        gridSize: 8,
        tiles,
      });

      expect(code.startsWith('ZGLVL-')).toBe(true);

      const decoded = ugcLevelService.decodeLevelCode(code);
      expect(decoded).not.toBeNull();
      expect(decoded?.title).toBe('Neon Fortress');
      expect(decoded?.author).toBe('Zakii');
      expect(decoded?.gameId).toBe('maze-runner');
      expect(decoded?.tiles).toEqual(tiles);

      expect(ugcLevelService.decodeLevelCode('INVALID-CODE')).toBeNull();
    });
  });

  describe('Pilar 6: Global 3D WebGL Engine Studio Atmospheres & Shockwave System', () => {
    it('defines 5 studio lighting & bloom atmospheres for all 40 3D games', () => {
      const keys = Object.keys(STUDIO_ATMOSPHERES_3D) as StudioAtmosphere3D[];
      expect(keys).toEqual([
        'cyber-neon',
        'synthwave-sunset',
        'emerald-matrix',
        'solar-flare',
        'abyssal-void',
      ]);
      for (const k of keys) {
        const cfg = STUDIO_ATMOSPHERES_3D[k];
        expect(cfg.exposure).toBeGreaterThan(1.0);
        expect(cfg.bloomStrength).toBeGreaterThan(0.4);
      }
    });
  });
});
