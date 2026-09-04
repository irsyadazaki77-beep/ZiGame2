import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createExpressApp } from '../../server';
import { toCanonicalGameId } from '../config/canonicalGames';

describe('ZiGame 2.0 Backend Authority & Security Tests', () => {
  let app: any;

  beforeEach(async () => {
    app = await createExpressApp();
  });

  describe('Health and System Status', () => {
    it('should return system health status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('should return balance config', async () => {
      const res = await request(app).get('/api/config/balance');
      expect(res.status).toBe(200);
      expect(res.body.multipliers).toBeDefined();
      expect(res.body.multipliers.snake).toBeDefined();
    });
  });

  describe('Canonical Game Resolution', () => {
    it('should canonicalize aliases and fallback properly', () => {
      expect(toCanonicalGameId('snake')).toBe('snake');
      expect(toCanonicalGameId('tetris')).toBe('cyber-tetris');
      expect(toCanonicalGameId('cosmicdodge')).toBe('cosmic-dodge');
      expect(toCanonicalGameId('flappy')).toBe('flappy-pixel');
      expect(toCanonicalGameId('unknown-game')).toBe('snake'); // safe fallback
    });
  });

  describe('Economy Endpoints & Authority', () => {
    it('should return default balance for authenticated user', async () => {
      const res = await request(app)
        .get('/api/economy')
        .set('x-test-uid', 'test-user-1');

      expect(res.status).toBe(200);
      expect(res.body.coins).toBeGreaterThanOrEqual(0);
    });

    it('should reject purchase when balance is insufficient', async () => {
      const res = await request(app)
        .post('/api/buy-item')
        .set('x-test-uid', 'broke-user')
        .send({
          itemId: 'expensive_item',
          cost: 999999,
          idempotencyKey: 'test_buy_expensive'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Koin tidak mencukupi');
    });

    it('should allow valid daily spin and enforce daily limits', async () => {
      const testUid = `spin-user-${Date.now()}`;
      const firstSpin = await request(app)
        .post('/api/spin')
        .set('x-test-uid', testUid)
        .send({});

      expect(firstSpin.status).toBe(200);
      expect(firstSpin.body.success).toBe(true);
      expect(firstSpin.body.prize).toBeGreaterThanOrEqual(10);

      // Second spin same day should be rejected with 429
      const secondSpin = await request(app)
        .post('/api/spin')
        .set('x-test-uid', testUid)
        .send({});

      expect(secondSpin.status).toBe(429);
      expect(secondSpin.body.success).toBe(false);
      expect(secondSpin.body.message).toContain('sudah melakukan spin harian');
    });
  });

  describe('Session Lifecycle & Anti-Cheat Validation', () => {
    it('should start a session with a valid nonce', async () => {
      const res = await request(app)
        .post('/api/session/start')
        .set('x-test-uid', 'player-session')
        .send({ gameId: 'snake' });

      expect(res.status).toBe(200);
      expect(res.body.sessionId).toBeDefined();
      expect(res.body.nonce).toBeDefined();
    });

    it('should validate and accept legitimate score submission', async () => {
      const testUid = `score-valid-${Date.now()}`;
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
          score: 35,
          playerName: 'GamerX',
          sessionId,
          durationMs: 5000,
          idempotencyKey: `submit_${Date.now()}`
        });

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.success).toBe(true);
      expect(submitRes.body.score).toBe(35);
      expect(submitRes.body.coinsEarned).toBeGreaterThan(0);
    });

    it('should flag and reject anomalous velocity scores', async () => {
      const testUid = `cheater-${Date.now()}`;
      const submitRes = await request(app)
        .post('/api/submit-score')
        .set('x-test-uid', testUid)
        .send({
          gameId: 'snake',
          score: 999999, // Impossible score
          playerName: 'Cheater',
          durationMs: 1000, // 1 second
          idempotencyKey: `cheat_${Date.now()}`
        });

      expect(submitRes.status).toBe(422);
      expect(submitRes.body.success).toBe(false);
      expect(submitRes.body.message).toContain('melebihi batas');
    });
  });

  describe('Admin Role Protection & Anti-Tampering', () => {
    it('should reject admin stats query from unauthenticated user', async () => {
      const res = await request(app).get('/api/admin/stats');
      expect(res.status).toBe(401);
    });

    it('should allow admin stats query when admin role is present', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('x-test-uid', 'admin-user')
        .set('x-test-admin', 'true');

      expect(res.status).toBe(200);
      expect(res.body.dau).toBeDefined();
      expect(res.body.totalGamesPlayed).toBeDefined();
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
});
