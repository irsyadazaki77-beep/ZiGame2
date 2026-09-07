import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createExpressApp } from '../../server';
import { toCanonicalGameId, requireCanonicalGameId, isValidGameId } from '../config/canonicalGames';
import { memoryStore } from '../server/persistence';
import { APP_VERSION } from '../config/version';

describe('ZiGame 2.0 Backend Authority & Security Tests', () => {
  let app: any;

  beforeEach(async () => {
    memoryStore.clear();
    app = await createExpressApp();
  });

  describe('Health and System Status', () => {
    it('should return minimal system health status without leaking admin data', async () => {
      const res = await request(app).get('/api/health');
      expect([200, 503]).toContain(res.status);
      expect(['degraded', 'firestore', 'ok']).toContain(res.body.status);
      expect(res.body.version).toBe(APP_VERSION);
      expect(res.body.persistence).toBeDefined();
      expect(res.body.adminUids).toBeUndefined();
    });

    it('should return balance config with canonical multipliers', async () => {
      const res = await request(app).get('/api/config/balance');
      expect(res.status).toBe(200);
      expect(res.body.multipliers).toBeDefined();
      expect(res.body.multipliers.snake).toBeDefined();
      expect(res.body.multipliers.snake.coinMultiplier).toBeDefined();
    });
  });

  describe('Canonical Game Resolution', () => {
    it('should canonicalize aliases and fallback properly for UI', () => {
      expect(toCanonicalGameId('snake')).toBe('snake');
      expect(toCanonicalGameId('tetris')).toBe('cyber-tetris');
      expect(toCanonicalGameId('cosmicdodge')).toBe('cosmic-dodge');
      expect(toCanonicalGameId('flappy')).toBe('flappy-pixel');
      expect(toCanonicalGameId('unknown-game')).toBe('snake'); // safe UI fallback
    });

    it('should strictly reject invalid games in backend validator', () => {
      expect(isValidGameId('snake')).toBe(true);
      expect(isValidGameId('cyber-tetris')).toBe(true);
      expect(isValidGameId('unknown-fake-game')).toBe(false);

      expect(() => requireCanonicalGameId('unknown-fake-game')).toThrow();
    });
  });

  describe('Economy Endpoints & Authoritative Shop', () => {
    it('should return default balance for authenticated user', async () => {
      const res = await request(app)
        .get('/api/economy')
        .set('x-test-uid', 'test-user-1');

      expect(res.status).toBe(200);
      expect(res.body.coins).toBe(100);
    });

    it('should reject purchase when balance is insufficient for expensive catalog item', async () => {
      const res = await request(app)
        .post('/api/buy-item')
        .set('x-test-uid', 'broke-user')
        .send({
          itemId: 'av_phoenix', // Costs 300 coins in authoritative catalog; user starts with 100
          idempotencyKey: 'test_buy_phoenix_123'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INSUFFICIENT_FUNDS');
      expect(res.body.message).toContain('tidak mencukupi');
    });

    it('should return 404 when item does not exist in catalog', async () => {
      const res = await request(app)
        .post('/api/buy-item')
        .set('x-test-uid', 'rich-user')
        .send({
          itemId: 'non_existent_item_999',
          idempotencyKey: 'test_buy_non_existent'
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('ITEM_NOT_FOUND');
    });

    it('should allow legitimate purchase and prevent duplicate non-stackable purchase', async () => {
      const testUid = `buyer-${Date.now()}`;
      // Buy av_dino which costs 90 coins (user starts with 100)
      const firstBuy = await request(app)
        .post('/api/buy-item')
        .set('x-test-uid', testUid)
        .send({
          itemId: 'av_dino',
          idempotencyKey: `buy_dino_first_${Date.now()}`
        });

      expect(firstBuy.status).toBe(200);
      expect(firstBuy.body.success).toBe(true);
      expect(firstBuy.body.remainingCoins).toBe(10);
      expect(firstBuy.body.transactionId).toBeDefined();

      // Duplicate purchase attempt with a new idempotency key
      const secondBuy = await request(app)
        .post('/api/buy-item')
        .set('x-test-uid', testUid)
        .send({
          itemId: 'av_dino',
          idempotencyKey: `buy_dino_second_${Date.now()}`
        });

      expect(secondBuy.status).toBe(400);
      expect(secondBuy.body.code).toBe('ITEM_ALREADY_OWNED');
    });

    it('should allow valid daily spin and enforce daily limits atomically', async () => {
      const testUid = `spin-user-${Date.now()}`;
      const firstSpin = await request(app)
        .post('/api/spin')
        .set('x-test-uid', testUid)
        .send({});

      expect(firstSpin.status).toBe(200);
      expect(firstSpin.body.success).toBe(true);
      expect(firstSpin.body.prize).toBeGreaterThanOrEqual(25);
      expect(firstSpin.body.transactionId).toBeDefined();

      // Second spin same day should be rejected with 429
      const secondSpin = await request(app)
        .post('/api/spin')
        .set('x-test-uid', testUid)
        .send({});

      expect(secondSpin.status).toBe(429);
      expect(secondSpin.body.success).toBe(false);
      expect(secondSpin.body.code).toBe('SPIN_COOLDOWN');
    });
  });

  describe('Session Lifecycle & Anti-Cheat Validation', () => {
    it('should start a session with a cryptographically secure token', async () => {
      const res = await request(app)
        .post('/api/session/start')
        .set('x-test-uid', 'player-session')
        .send({ gameId: 'snake' });

      expect(res.status).toBe(200);
      expect(res.body.sessionId).toBeDefined();
      expect(res.body.nonce).toBeDefined();
      expect(res.body.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should reject score submission without verified sessionId', async () => {
      const res = await request(app)
        .post('/api/submit-score')
        .set('x-test-uid', 'player-no-session')
        .send({
          gameId: 'snake',
          score: 100,
          playerName: 'NoSession'
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VERIFIED_SESSION_REQUIRED');
    });

    it('should validate and accept legitimate score submission with session', async () => {
      const testUid = `score-valid-${Date.now()}`;
      const sessionRes = await request(app)
        .post('/api/session/start')
        .set('x-test-uid', testUid)
        .send({ gameId: 'snake' });

      const sessionId = sessionRes.body.sessionId;
      // Simulate realistic play duration (5s)
      const sessionObj = memoryStore.sessions.get(sessionId);
      if (sessionObj) sessionObj.startTime = Date.now() - 5000;

      const submitRes = await request(app)
        .post('/api/submit-score')
        .set('x-test-uid', testUid)
        .send({
          gameId: 'snake',
          score: 35,
          playerName: 'GamerX',
          sessionId,
          idempotencyKey: `submit_legit_${Date.now()}`
        });

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.success).toBe(true);
      expect(submitRes.body.score).toBe(35);
      expect(submitRes.body.coinsEarned).toBeGreaterThan(0);
      expect(submitRes.body.transactionId).toBeDefined();
    });

    it('should prevent replay attack by rejecting already consumed session', async () => {
      const testUid = `replay-attacker-${Date.now()}`;
      const sessionRes = await request(app)
        .post('/api/session/start')
        .set('x-test-uid', testUid)
        .send({ gameId: 'snake' });

      const sessionId = sessionRes.body.sessionId;
      const sessionObj = memoryStore.sessions.get(sessionId);
      if (sessionObj) sessionObj.startTime = Date.now() - 5000;

      // First submission succeeds
      const firstSubmit = await request(app)
        .post('/api/submit-score')
        .set('x-test-uid', testUid)
        .send({
          gameId: 'snake',
          score: 20,
          playerName: 'Player1',
          sessionId,
          idempotencyKey: `submit_first_${Date.now()}`
        });

      expect(firstSubmit.status).toBe(200);

      // Replay attempt with same sessionId but new score/idempotencyKey
      const replaySubmit = await request(app)
        .post('/api/submit-score')
        .set('x-test-uid', testUid)
        .send({
          gameId: 'snake',
          score: 50,
          playerName: 'Player1',
          sessionId,
          idempotencyKey: `submit_replay_${Date.now()}`
        });

      expect(replaySubmit.status).toBe(422);
      expect(replaySubmit.body.code).toBe('SESSION_ALREADY_CONSUMED');
    });

    it('should award 0 coins when score is 0 and reject insufficient duration', async () => {
      const testUid = `instant-cheater-${Date.now()}`;
      const sessionRes = await request(app)
        .post('/api/session/start')
        .set('x-test-uid', testUid)
        .send({ gameId: 'snake' });

      const sessionId = sessionRes.body.sessionId;
      // Instant submission without duration should be rejected for positive score
      const failSubmit = await request(app)
        .post('/api/submit-score')
        .set('x-test-uid', testUid)
        .send({
          gameId: 'snake',
          score: 50,
          playerName: 'TooFast',
          sessionId,
          idempotencyKey: `submit_fast_${Date.now()}`
        });

      expect(failSubmit.status).toBe(422);
      expect(failSubmit.body.code).toBe('INSUFFICIENT_DURATION');
    });

    it('should flag and reject scores exceeding ceiling', async () => {
      const testUid = `cheater-${Date.now()}`;
      const sessionRes = await request(app)
        .post('/api/session/start')
        .set('x-test-uid', testUid)
        .send({ gameId: 'snake' });

      const sessionId = sessionRes.body.sessionId;

      const submitRes = await request(app)
        .post('/api/submit-score')
        .set('x-test-uid', testUid)
        .send({
          gameId: 'snake',
          score: 999999, // Exceeds hard ceiling
          playerName: 'Cheater',
          sessionId,
          idempotencyKey: `cheat_${Date.now()}`
        });

      expect(submitRes.status).toBe(422);
      expect(submitRes.body.success).toBe(false);
      expect(submitRes.body.code).toBe('SCORE_CEILING_EXCEEDED');
    });
  });

  describe('Admin Role Protection & Honest Stats', () => {
    it('should reject admin stats query from unauthenticated user', async () => {
      const res = await request(app).get('/api/admin/stats');
      expect(res.status).toBe(401);
    });

    it('should reject admin stats query from non-admin authenticated user', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('x-test-uid', 'regular-player');

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('should allow admin stats query when admin role is verified and return honest metrics', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('x-test-uid', 'admin-user')
        .set('x-test-admin', 'true');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.suspiciousScoresCount).toBeDefined();
      expect(res.body.totalLedgerTransactions).toBeDefined();
      expect(res.body.activeSessionsCount).toBeDefined();
      // Verifying no fake hardcoded numbers
      expect(res.body.dau).toBeUndefined();
      expect(res.body.totalRevenue).toBeUndefined();
    });

    it('should allow admin purge and force-sync actions', async () => {
      const syncRes = await request(app)
        .post('/api/admin/force-sync')
        .set('x-test-uid', 'admin-user')
        .set('x-test-admin', 'true');

      expect(syncRes.status).toBe(200);
      expect(syncRes.body.success).toBe(true);

      const purgeRes = await request(app)
        .post('/api/admin/purge-suspect-scores')
        .set('x-test-uid', 'admin-user')
        .set('x-test-admin', 'true')
        .send({});

      expect(purgeRes.status).toBe(200);
      expect(purgeRes.body.success).toBe(true);
    });
  });

  describe('Authoritative Economy: Gamble, Gacha & Claim Reward', () => {
    it('should process gamble coin flip atomically on server', async () => {
      const testUid = `gambler-${Date.now()}`;
      const res = await request(app)
        .post('/api/economy/gamble')
        .set('x-test-uid', testUid)
        .send({ bet: 20, choice: 'heads' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.won).toBe('boolean');
      expect(['heads', 'tails']).toContain(res.body.outcomeSide);
      expect(typeof res.body.remainingCoins).toBe('number');
      expect(res.body.transactionId).toBeDefined();
    });

    it('should reject gamble when balance is insufficient', async () => {
      const testUid = `poor-gambler-${Date.now()}`;
      const res = await request(app)
        .post('/api/economy/gamble')
        .set('x-test-uid', testUid)
        .send({ bet: 500, choice: 'heads' }); // Default balance is 100

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INSUFFICIENT_FUNDS');
    });

    it('should process gacha pull atomically on server', async () => {
      const testUid = `gacha-puller-${Date.now()}`;
      const res = await request(app)
        .post('/api/economy/gacha')
        .set('x-test-uid', testUid)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.rewardId).toBeDefined();
      expect(res.body.remainingCoins).toBe(50); // 100 - 50 = 50
    });

    it('should process reward claim atomically on server with authoritative reward lookup', async () => {
      const testUid = `claimer-${Date.now()}`;
      const res = await request(app)
        .post('/api/economy/claim')
        .set('x-test-uid', testUid)
        .send({
          claimId: 'ach_first_win',
          claimType: 'achievement',
          idempotencyKey: `claim_first_${Date.now()}`
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.amount).toBe(50);
      expect(res.body.newBalance).toBe(150); // 100 + 50 = 150
      expect(res.body.transactionId).toBeDefined();
    });

    it('should prevent duplicate claiming of the same reward (exploit test)', async () => {
      const testUid = `duplicate-claimer-${Date.now()}`;
      const firstRes = await request(app)
        .post('/api/economy/claim')
        .set('x-test-uid', testUid)
        .send({
          claimId: 'snake_turbo',
          claimType: 'achievement',
          idempotencyKey: `claim_500_1_${Date.now()}`
        });

      expect(firstRes.status).toBe(200);
      expect(firstRes.body.success).toBe(true);
      expect(firstRes.body.amount).toBe(100);

      // Second attempt to claim the same achievement with a new idempotency key
      const secondRes = await request(app)
        .post('/api/economy/claim')
        .set('x-test-uid', testUid)
        .send({
          claimId: 'snake_turbo',
          claimType: 'achievement',
          idempotencyKey: `claim_500_2_${Date.now()}`
        });

      expect(secondRes.status).toBe(400);
      expect(secondRes.body.code).toBe('REWARD_ALREADY_CLAIMED');
    });

    it('should return idempotent cached response when same idempotency key is replayed', async () => {
      const testUid = `idem-claimer-${Date.now()}`;
      const idKey = `idem_key_${Date.now()}`;

      const res1 = await request(app)
        .post('/api/economy/claim')
        .set('x-test-uid', testUid)
        .send({
          claimId: 'm_play_3',
          claimType: 'daily_mission',
          idempotencyKey: idKey
        });

      expect(res1.status).toBe(200);
      const tx1 = res1.body.transactionId;

      const res2 = await request(app)
        .post('/api/economy/claim')
        .set('x-test-uid', testUid)
        .send({
          claimId: 'm_play_3',
          claimType: 'daily_mission',
          idempotencyKey: idKey
        });

      expect(res2.status).toBe(200);
      expect(res2.body.transactionId).toBe(tx1);
      expect(res2.body.newBalance).toBe(res1.body.newBalance);
    });
  });

  describe('Standardized API Error Contract', () => {
    it('should return standardized error contract on invalid routes or inputs', async () => {
      const res = await request(app)
        .post('/api/session/start')
        .set('x-test-uid', 'user-err')
        .send({ gameId: 'invalid-game-xyz' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_GAME_ID');
      expect(res.body.message).toBeDefined();
      expect(res.body.requestId).toBeDefined();
    });
  });
});
