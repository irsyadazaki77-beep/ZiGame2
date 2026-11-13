import { describe, it, expect } from 'vitest';
import { getGameBalanceConfig, PROGRESSION_CONFIG, ECONOMY_BALANCE_CONFIG } from '../../config/balanceConfig';
import { GAME_COMPETITIVE_CONFIGS, getTierForRating, isRankedEligibleGame } from '../../config/competitiveConfig';
import { toCanonicalGameId, isValidGameId, CANONICAL_GAME_IDS } from '../../config/canonicalGames';

describe('Unit Tests — Pure Logic, Algorithms, Calculations & Edge Cases', () => {
  describe('Canonical Game ID Resolution & Validation', () => {
    it('validates canonical IDs and maps aliases strictly', () => {
      expect(isValidGameId('snake')).toBe(true);
      expect(isValidGameId('cyber-tetris')).toBe(true);
      expect(isValidGameId('non_existent_game')).toBe(false);

      expect(toCanonicalGameId('snake')).toBe('snake');
      expect(toCanonicalGameId('tetris')).toBe('cyber-tetris');
      expect(toCanonicalGameId('flappy')).toBe('flappy-pixel');
      expect(toCanonicalGameId('unknown_fallback')).toBe('snake'); // safe UI fallback
    });

    it('ensures all 40 canonical games have positive balance multipliers and valid ceilings', () => {
      expect(CANONICAL_GAME_IDS.length).toBe(40);
      for (const id of CANONICAL_GAME_IDS) {
        const config = getGameBalanceConfig(id);
        expect(config.baseCoinMultiplier).toBeGreaterThan(0);
        expect(config.baseXpMultiplier).toBeGreaterThan(0);
        expect(config.maxScoreCeiling).toBeGreaterThan(0);
        expect(config.maxScorePerSec).toBeGreaterThan(0);
        expect(config.minDurationMs).toBeGreaterThan(0);
      }
    });
  });

  describe('Rating & Competitive Tier Calculations', () => {
    it('resolves correct tiers from ratings', () => {
      expect(getTierForRating(500)).toBe('Bronze');
      expect(getTierForRating(800)).toBe('Bronze');
      expect(getTierForRating(900)).toBe('Silver');
      expect(getTierForRating(1100)).toBe('Gold');
      expect(getTierForRating(1300)).toBe('Platinum');
      expect(getTierForRating(1500)).toBe('Diamond');
      expect(getTierForRating(1700)).toBe('Cyber Master');
      expect(getTierForRating(2500)).toBe('Cyber Master');
    });

    it('identifies ranked-eligible games correctly', () => {
      expect(isRankedEligibleGame('snake')).toBe(true);
      expect(isRankedEligibleGame('cyber-tetris')).toBe(true);
      expect(isRankedEligibleGame('cyber-clicker')).toBe(false);
      expect(isRankedEligibleGame('invalid_game')).toBe(false);
    });
  });

  describe('Progression & Level Formulae', () => {
    it('calculates mastery level correctly', () => {
      // Level formula: level = floor(sqrt(xp / 100)) + 1
      const calculateMasteryLevel = (xp: number) => {
        if (!Number.isFinite(xp) || xp <= 0) return 1;
        const raw = Math.floor(Math.sqrt(xp / 100)) + 1;
        return Math.min(raw, PROGRESSION_CONFIG.masteryMaxLevel);
      };

      expect(calculateMasteryLevel(0)).toBe(1);
      expect(calculateMasteryLevel(99)).toBe(1);
      expect(calculateMasteryLevel(100)).toBe(2);
      expect(calculateMasteryLevel(400)).toBe(3);
      expect(calculateMasteryLevel(900)).toBe(4);
      expect(calculateMasteryLevel(1000000)).toBe(30); // Max capped
    });

    it('calculates player XP level required curve', () => {
      const getXpRequiredForLevel = (level: number) => {
        if (level <= 1) return 0;
        return Math.floor(PROGRESSION_CONFIG.playerLevelBaseXp * Math.pow(level - 1, PROGRESSION_CONFIG.playerLevelGrowth));
      };

      expect(getXpRequiredForLevel(1)).toBe(0);
      expect(getXpRequiredForLevel(2)).toBe(250);
      expect(getXpRequiredForLevel(3)).toBeGreaterThan(250);
    });

    it('handles numerical edge cases in XP calculations', () => {
      const calculateCoins = (score: number, multiplier: number) => {
        if (!Number.isFinite(score) || score <= 0) return 0;
        if (!Number.isFinite(multiplier) || multiplier <= 0) return 0;
        const raw = Math.floor(score * multiplier);
        return Math.min(raw, ECONOMY_BALANCE_CONFIG.caps.maxSingleGameRewardCoins);
      };

      expect(calculateCoins(0, 0.1)).toBe(0);
      expect(calculateCoins(-100, 0.1)).toBe(0);
      expect(calculateCoins(NaN, 0.1)).toBe(0);
      expect(calculateCoins(Infinity, 0.1)).toBe(0);
      expect(calculateCoins(10000, 0.1)).toBe(250); // Clamped to max cap
      expect(calculateCoins(100.5, 0.1)).toBe(10);
    });
  });

  describe('Gamble & Economy Rules Logic', () => {
    it('validates allowed bet sizes and balance boundaries', () => {
      const isValidBet = (bet: number, userBalance: number) => {
        if (!Number.isInteger(bet)) return false;
        if (bet < ECONOMY_BALANCE_CONFIG.gamble.minBet || bet > ECONOMY_BALANCE_CONFIG.gamble.maxBet) return false;
        if (!ECONOMY_BALANCE_CONFIG.gamble.validBets.includes(bet)) return false;
        return userBalance >= bet;
      };

      expect(isValidBet(10, 100)).toBe(true);
      expect(isValidBet(50, 100)).toBe(true);
      expect(isValidBet(500, 100)).toBe(false); // Insufficient balance
      expect(isValidBet(15, 100)).toBe(false); // Not in validBets array
      expect(isValidBet(-10, 100)).toBe(false);
      expect(isValidBet(0, 100)).toBe(false);
      expect(isValidBet(10.5, 100)).toBe(false);
      expect(isValidBet(NaN, 100)).toBe(false);
    });
  });

  describe('Season Fallback & Friend Challenge Anti-Tampering Guards', () => {
    it('always creates a dynamically active fallback season in the future', async () => {
      const { getDefaultFallbackSeason, isSeasonActive } = await import('../../server/persistence/seasons');
      const now = Date.now();
      const season = getDefaultFallbackSeason(now);
      expect(season.startAt).toBeLessThanOrEqual(now);
      expect(season.endAt).toBeGreaterThan(now);
      expect(isSeasonActive(season, now)).toBe(true);
    });

    it('secures friend challenge URLs against bounty manipulation and invalid games', async () => {
      const { friendChallengeService } = await import('../../services/friendChallengeService');
      const challenge = friendChallengeService.createChallenge({
        gameId: 'snake',
        gameTitle: 'Snake Neo',
        challengerName: 'Zaki',
        targetScore: 250,
        bountyCoins: 999999 // Attempted excessive bounty
      });

      expect(challenge.bountyCoins).toBe(500); // Hard-clamped to 500
      const shareUrl = friendChallengeService.generateShareUrl(challenge);
      const urlObj = new URL(shareUrl, 'http://localhost:3000');
      const parsed = friendChallengeService.parseChallengeFromUrl(urlObj.searchParams);
      expect(parsed).not.toBeNull();
      expect(parsed?.bountyCoins).toBe(500);
      expect(parsed?.targetScore).toBe(250);

      // Tamper with sig parameter
      urlObj.searchParams.set('sig', 'forged_sig_123');
      expect(friendChallengeService.parseChallengeFromUrl(urlObj.searchParams)).toBeNull();

      // Tamper with unsigned raw payload (excessive coins & invalid game)
      const forgedUnsigned = btoa(JSON.stringify({ g: 'snake', n: 'Hacker', s: 10, c: 999999 }));
      const decodedUnsigned = friendChallengeService.decodeChallenge(forgedUnsigned);
      expect(decodedUnsigned?.bountyCoins).toBe(500);

      const invalidGamePayload = btoa(JSON.stringify({ g: 'hacked-game-id', n: 'Hacker', s: 10, c: 100 }));
      expect(friendChallengeService.decodeChallenge(invalidGamePayload)).toBeNull();
    });
  });
});

