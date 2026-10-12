import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createExpressApp } from '../../../server';
import { memoryStore } from '../../server/persistence';

describe('Integration Tests — Authorization, IDOR & Authentication Matrix', () => {
  let app: any;

  beforeEach(async () => {
    memoryStore.clear();
    app = await createExpressApp();
  });

  describe('Authentication Matrix (Guest vs User vs Admin)', () => {
    it('Guest (unauthenticated) receives 401 UNAUTHORIZED on all protected routes', async () => {
      const routes = [
        { method: 'get', path: '/api/economy' },
        { method: 'post', path: '/api/buy-item', body: { itemId: 'av_phoenix', idempotencyKey: 'k1' } },
        { method: 'post', path: '/api/spin', body: {} },
        { method: 'post', path: '/api/economy/gacha', body: { idempotencyKey: 'k2' } },
        { method: 'post', path: '/api/economy/gamble', body: { bet: 10, choice: 'heads', idempotencyKey: 'k3' } },
        { method: 'post', path: '/api/economy/claim', body: { claimId: 'c1', claimType: 'starter_pack', idempotencyKey: 'k4' } },
        { method: 'post', path: '/api/session/start', body: { gameId: 'snake' } },
        { method: 'post', path: '/api/submit-score', body: { gameId: 'snake', score: 10, sessionId: 's1' } },
        { method: 'post', path: '/api/competitive/session/start', body: { gameId: 'snake' } },
        { method: 'post', path: '/api/competitive/submit', body: { gameId: 'snake', score: 10, sessionId: 'cs1' } },
        { method: 'get', path: '/api/admin/stats' },
        { method: 'get', path: '/api/admin/verify' },
        { method: 'get', path: '/api/admin/kill-switches' },
      ];

      for (const route of routes) {
        let req;
        if (route.method === 'get') {
          req = request(app).get(route.path);
        } else {
          req = request(app).post(route.path).send(route.body);
        }

        const res = await req;
        expect(res.status, `Route ${route.method.toUpperCase()} ${route.path} should return 401`).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('UNAUTHORIZED');
        expect(res.body.requestId).toBeDefined();
      }
    });

    it('Non-admin authenticated user receives 403 FORBIDDEN on all admin routes', async () => {
      const normalUserUid = `player-${Date.now()}`;
      const adminRoutes = [
        { method: 'get', path: '/api/admin/stats' },
        { method: 'get', path: '/api/admin/verify' },
        { method: 'get', path: '/api/admin/kill-switches' },
        { method: 'post', path: '/api/admin/kill-switches', body: { feature: 'ranked', active: true } },
        { method: 'post', path: '/api/admin/purge-suspect-scores', body: {} },
        { method: 'post', path: '/api/admin/force-sync', body: {} },
        { method: 'post', path: '/api/admin/reconcile-economy', body: { userId: normalUserUid } },
        { method: 'post', path: '/api/admin/reconcile-competitive', body: { userId: normalUserUid } },
      ];

      for (const route of adminRoutes) {
        let req;
        if (route.method === 'get') {
          req = request(app).get(route.path).set('x-test-uid', normalUserUid);
        } else {
          req = request(app).post(route.path).set('x-test-uid', normalUserUid).send(route.body);
        }

        const res = await req;
        expect(res.status, `Admin route ${route.path} should reject non-admin with 403`).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('FORBIDDEN');
      }
    });
  });

  describe('IDOR & Cross-User Security Matrix', () => {
    it('User A cannot spoof User B ID in body payload (FORBIDDEN_USER_MISMATCH)', async () => {
      const userA = `user-a-${Date.now()}`;
      const userB = `user-b-${Date.now()}`;

      // 1. Spoofed buy-item
      const buyRes = await request(app)
        .post('/api/buy-item')
        .set('x-test-uid', userA)
        .send({
          userId: userB,
          itemId: 'av_phoenix',
          idempotencyKey: `idem_spoof_buy_${Date.now()}`
        });

      expect(buyRes.status).toBe(403);
      expect(buyRes.body.code).toBe('FORBIDDEN_USER_MISMATCH');

      // 2. Spoofed submit-score
      const scoreRes = await request(app)
        .post('/api/submit-score')
        .set('x-test-uid', userA)
        .send({
          userId: userB,
          gameId: 'snake',
          score: 100,
          sessionId: 'some_session'
        });

      expect(scoreRes.status).toBe(403);
      expect(scoreRes.body.code).toBe('FORBIDDEN_USER_MISMATCH');

      // 3. Spoofed claim reward
      const claimRes = await request(app)
        .post('/api/economy/claim')
        .set('x-test-uid', userA)
        .send({
          userId: userB,
          claimId: 'starter_pack',
          claimType: 'starter_pack',
          idempotencyKey: `idem_spoof_claim_${Date.now()}`
        });

      expect(claimRes.status).toBe(403);
      expect(claimRes.body.code).toBe('FORBIDDEN_USER_MISMATCH');
    });

    it('User B cannot consume or submit User A session ticket (SESSION_USER_MISMATCH)', async () => {
      const userA = `owner-a-${Date.now()}`;
      const userB = `thief-b-${Date.now()}`;

      // User A starts casual session
      const startRes = await request(app)
        .post('/api/session/start')
        .set('x-test-uid', userA)
        .send({ gameId: 'snake' });

      expect(startRes.status).toBe(200);
      const { sessionId } = startRes.body;

      const sessionObj = memoryStore.sessions.get(sessionId);
      if (sessionObj) sessionObj.startTime = Date.now() - 5000;

      // User B attempts submission
      const submitRes = await request(app)
        .post('/api/submit-score')
        .set('x-test-uid', userB)
        .send({
          sessionId,
          gameId: 'snake',
          score: 100,
          idempotencyKey: `idem_cross_sub_${Date.now()}`
        });

      expect(submitRes.status).toBe(422);
      expect(submitRes.body.code).toBe('SESSION_USER_MISMATCH');
    });

    it('Client body isAdmin flag cannot grant admin status to regular user', async () => {
      const regularUid = `attacker-${Date.now()}`;

      const res = await request(app)
        .get('/api/admin/verify')
        .set('x-test-uid', regularUid)
        .send({ isAdmin: true, role: 'superadmin' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  describe('Standardized API Contract Verification', () => {
    it('returns consistent JSON error contract across all error responses', async () => {
      const res = await request(app)
        .post('/api/buy-item')
        .set('x-test-uid', 'user-123')
        .send({ itemId: 'non_existent_item', idempotencyKey: `idem_err_${Date.now()}` });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(typeof res.body.code).toBe('string');
      expect(typeof res.body.message).toBe('string');
      expect(typeof res.body.requestId).toBe('string');
    });
  });
});
