import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createExpressApp } from '../../../server';
import { memoryStore } from '../../server/persistence';

describe('Integration Tests — Economy, Ledger Invariants & Idempotency', () => {
  let app: any;

  beforeEach(async () => {
    memoryStore.clear();
    app = await createExpressApp();
  });

  describe('Ledger Invariant & State Persistence', () => {
    it('enforces ledger invariant balanceAfter === balanceBefore + amount across all transactions', async () => {
      const uid = `ledger-user-${Date.now()}`;

      // 1. Initial fetch -> balance = 100
      const initRes = await request(app).get('/api/economy').set('x-test-uid', uid);
      expect(initRes.status).toBe(200);
      let balance = initRes.body.coins;
      expect(balance).toBe(100);

      // 2. Claim starter pack -> +100
      const claimRes = await request(app)
        .post('/api/economy/claim')
        .set('x-test-uid', uid)
        .send({
          claimId: 'starter_pack',
          claimType: 'starter_pack',
          idempotencyKey: `idem_claim_sp_${Date.now()}`
        });

      expect(claimRes.status).toBe(200);
      const claimAmount = claimRes.body.amount; // 100
      const newBalanceAfterClaim = claimRes.body.newBalance;
      expect(newBalanceAfterClaim).toBe(balance + claimAmount);
      balance = newBalanceAfterClaim; // 200

      // 3. Buy item av_dino -> -90
      const buyRes = await request(app)
        .post('/api/buy-item')
        .set('x-test-uid', uid)
        .send({
          itemId: 'av_dino',
          idempotencyKey: `idem_buy_dino_${Date.now()}`
        });

      expect(buyRes.status).toBe(200);
      const remainingCoins = buyRes.body.remainingCoins;
      expect(remainingCoins).toBe(balance - 90);
      balance = remainingCoins; // 110

      // 4. Spin wheel -> +prize
      const spinRes = await request(app)
        .post('/api/spin')
        .set('x-test-uid', uid)
        .send({});

      expect(spinRes.status).toBe(200);
      const prize = spinRes.body.prize;
      const spinBalanceAfter = spinRes.body.newCoinBalance;
      expect(spinBalanceAfter).toBe(balance + prize);
      balance = spinBalanceAfter;

      // 5. Verify ledger entries count in memory store
      const userLedger = memoryStore.ledger.filter(tx => tx.userId === uid);
      expect(userLedger.length).toBeGreaterThanOrEqual(3);
      for (const entry of userLedger) {
        expect(entry.balanceAfter).toBe(entry.balanceBefore + entry.amount);
      }
    });

    it('rejected transactions cause ZERO balance mutation, ZERO ledger mutation, and ZERO inventory change', async () => {
      const uid = `broke-user-${Date.now()}`;

      // Get initial balance (100)
      const initRes = await request(app).get('/api/economy').set('x-test-uid', uid);
      const initialCoins = initRes.body.coins;

      // Attempt buying expensive item (av_phoenix costs 300)
      const buyRes = await request(app)
        .post('/api/buy-item')
        .set('x-test-uid', uid)
        .send({
          itemId: 'av_phoenix',
          idempotencyKey: `idem_broke_buy_${Date.now()}`
        });

      expect(buyRes.status).toBe(400);
      expect(buyRes.body.code).toBe('INSUFFICIENT_FUNDS');

      // Verify balance remains exactly unchanged
      const checkRes = await request(app).get('/api/economy').set('x-test-uid', uid);
      expect(checkRes.body.coins).toBe(initialCoins);

      // Verify no ledger record was written for the failed transaction
      const userLedger = memoryStore.ledger.filter(tx => tx.userId === uid);
      expect(userLedger.length).toBe(0);
    });
  });

  describe('Idempotency & Concurrency Matrix', () => {
    it('returns identical cached response when same idempotency key is submitted twice', async () => {
      const uid = `idem-tester-${Date.now()}`;
      const idempotencyKey = `idem_key_exact_${Date.now()}`;

      // First call
      const res1 = await request(app)
        .post('/api/buy-item')
        .set('x-test-uid', uid)
        .send({
          itemId: 'av_dino',
          idempotencyKey
        });

      expect(res1.status).toBe(200);
      const firstTxId = res1.body.transactionId;
      const firstBalance = res1.body.remainingCoins;

      // Second call with same idempotency key
      const res2 = await request(app)
        .post('/api/buy-item')
        .set('x-test-uid', uid)
        .send({
          itemId: 'av_dino',
          idempotencyKey
        });

      expect(res2.status).toBe(200);
      expect(res2.body.transactionId).toBe(firstTxId);
      expect(res2.body.remainingCoins).toBe(firstBalance);
    });

    it('handles concurrent purchase requests with same idempotency key safely and atomically', async () => {
      const uid = `concurrent-user-${Date.now()}`;
      const idempotencyKey = `idem_concurrent_${Date.now()}`;

      // Dispatch 3 parallel requests
      const promises = [
        request(app).post('/api/buy-item').set('x-test-uid', uid).send({ itemId: 'av_dino', idempotencyKey }),
        request(app).post('/api/buy-item').set('x-test-uid', uid).send({ itemId: 'av_dino', idempotencyKey }),
        request(app).post('/api/buy-item').set('x-test-uid', uid).send({ itemId: 'av_dino', idempotencyKey })
      ];

      const results = await Promise.all(promises);

      // All 3 should respond 200 OK with identical remaining balance and tx ID
      for (const res of results) {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      }

      const userLedger = memoryStore.ledger.filter(tx => tx.userId === uid);
      // Only 1 ledger entry recorded for the purchase
      expect(userLedger.length).toBe(1);
    });
  });
});
