import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createExpressApp } from '../../../server';
import { memoryStore } from '../../server/persistence';

describe('Integration Tests — Competitive Ranked Sessions & Leaderboards', () => {
  let app: any;

  beforeEach(async () => {
    memoryStore.clear();
    app = await createExpressApp();
  });

  describe('Ranked Competitive Sessions & Rating Transitions', () => {
    it('creates a ranked session and processes score submission with rating update', async () => {
      const uid = `comp-player-${Date.now()}`;

      // 1. Fetch initial competitive profile
      const profRes = await request(app)
        .get('/api/competitive/profile')
        .set('x-test-uid', uid);

      expect(profRes.status).toBe(200);
      expect(profRes.body.profile.globalRating).toBe(1000);
      expect(profRes.body.profile.globalTier).toBe('Silver');

      // 2. Start ranked session for snake
      const startRes = await request(app)
        .post('/api/competitive/session/start')
        .set('x-test-uid', uid)
        .send({ gameId: 'snake' });

      expect(startRes.status).toBe(200);
      const { sessionId } = startRes.body;
      expect(sessionId).toBeDefined();

      const sessionObj = memoryStore.sessions.get(sessionId);
      if (sessionObj) sessionObj.startTime = Date.now() - 5000;

      // 3. Submit ranked score
      const submitRes = await request(app)
        .post('/api/competitive/submit')
        .set('x-test-uid', uid)
        .send({
          sessionId,
          gameId: 'snake',
          score: 300,
          idempotencyKey: `idem_rnk_sub_${Date.now()}`
        });

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.success).toBe(true);
      expect(submitRes.body.newRating).toBeGreaterThan(1000);
      expect(submitRes.body.ratingChange).toBeGreaterThan(0);
      expect(submitRes.body.xpEarned).toBeGreaterThan(0);
    });

    it('rejects ranked session creation for non-ranked eligible games', async () => {
      const uid = `clicker-player-${Date.now()}`;

      const res = await request(app)
        .post('/api/competitive/session/start')
        .set('x-test-uid', uid)
        .send({ gameId: 'cyber-clicker' }); // Clicker is not eligible for ranked play

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('GAME_NOT_RANKED_ELIGIBLE');
    });

    it('rejected score submission alters ZERO rating and ZERO match stats', async () => {
      const uid = `failed-comp-${Date.now()}`;

      // Start ranked session
      const startRes = await request(app)
        .post('/api/competitive/session/start')
        .set('x-test-uid', uid)
        .send({ gameId: 'snake' });

      const { sessionId } = startRes.body;
      const sessionObj = memoryStore.sessions.get(sessionId);
      if (sessionObj) sessionObj.startTime = Date.now() - 5000;

      // Submit impossible cheat score (> ceiling)
      const submitRes = await request(app)
        .post('/api/competitive/submit')
        .set('x-test-uid', uid)
        .send({
          sessionId,
          gameId: 'snake',
          score: 999999, // Exceeds ceiling
          idempotencyKey: `idem_cheat_comp_${Date.now()}`
        });

      expect(submitRes.status).toBe(422);

      // Verify competitive profile remained at initial rating 1000 and 0 matches
      const profRes = await request(app)
        .get('/api/competitive/profile')
        .set('x-test-uid', uid);

      expect(profRes.body.profile.globalRating).toBe(1000);
      expect(profRes.body.profile.rankedGames).toBe(0);
    });
  });

  describe('Leaderboard Ordering, Pagination & Context', () => {
    it('returns empty leaderboard list safely when no scores exist', async () => {
      const res = await request(app).get('/api/leaderboard/snake?limit=10');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.entries)).toBe(true);
      expect(res.body.entries.length).toBe(0);
    });

    it('orders scores descending and provides user rank context', async () => {
      const users = ['user_alpha', 'user_beta', 'user_gamma'];
      const scores = [100, 300, 200];

      for (let i = 0; i < users.length; i++) {
        const uid = users[i];
        const startRes = await request(app)
          .post('/api/session/start')
          .set('x-test-uid', uid)
          .send({ gameId: 'snake' });

        const sessionId = startRes.body.sessionId;
        const sessionObj = memoryStore.sessions.get(sessionId);
        if (sessionObj) sessionObj.startTime = Date.now() - 5000;

        await request(app)
          .post('/api/submit-score')
          .set('x-test-uid', uid)
          .send({
            sessionId,
            gameId: 'snake',
            score: scores[i],
            playerName: uid,
            idempotencyKey: `idem_lead_${uid}_${Date.now()}`
          });
      }

      const leadRes = await request(app).get('/api/leaderboard/snake?limit=10');
      expect(leadRes.status).toBe(200);
      const list = leadRes.body.entries;
      expect(list.length).toBe(3);
      // Descending score order
      expect(list[0].score).toBe(300); // user_beta
      expect(list[1].score).toBe(200); // user_gamma
      expect(list[2].score).toBe(100); // user_alpha
    });

    it('rejects direct client modification of leaderboard (read-only query route)', async () => {
      const res = await request(app)
        .post('/api/leaderboard/snake')
        .send({ score: 999 });

      expect(res.status).toBe(404); // POST /api/leaderboard/:gameId does not exist
    });
  });
});
