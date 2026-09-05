# ZiGame 2.0 Security Architecture & Server Authority

## 1. Core Trust Boundaries
* **Client (Browser / WebView):** Completely UNTRUSTED. Any client-sent metrics (durations, economy calculations, prices, or item values) are rejected or verified server-side.
* **Server (Node.js / Express):** AUTHORITATIVE. Enforces all game rules, anti-cheat heuristics, RNG generation, transaction debits/credits, and role authorizations.
* **Firestore (Persistence):** PERSISTENT AUTHORITY. Protected by strict Firestore Security Rules. Direct client mutations to economy, sessions, rate limits, or leaderboards are denied.

---

## 2. Verified Game Session Lifecycle
To prevent score forgery and replay attacks, all competitive scores, coin distributions, XP, and leaderboards require a cryptographically verified game session ticket:

1. **Session Issuance (`POST /api/session/start`)**:
   - Client requests a ticket for a `gameId`.
   - Server verifies `gameId` against canonical game registry (`requireCanonicalGameId`).
   - Server generates a unique `sessionId` (`ses_<timestamp>_<16_random_bytes_hex>`) and `nonce`.
   - Session stored with `startTime: Date.now()`, `expiresAt: Date.now() + 1 hour`, and `consumed: false`.
2. **Gameplay & Completion**:
   - Game plays locally on client canvas/DOM.
3. **Atomic Verification & Consumption (`POST /api/submit-score`)**:
   - Client sends `{ sessionId, gameId, score, playerName, playerAvatar, idempotencyKey }`.
   - Server transaction checks:
     - Session exists.
     - `session.userId === req.user.uid` (prevents cross-user session theft).
     - `session.gameId === canonicalGameId` (prevents game-swapping).
     - `!session.consumed` (atomic mark `consumed: true` to prevent replay).
     - `Date.now() <= session.expiresAt` (prevents stale ticket replay).
   - Server calculates true elapsed time: `verifiedDurationMs = Date.now() - session.startTime`.

---

## 3. Anti-Cheat Heuristics
Scores undergo multi-stage validation against game-specific configurations (`src/config/balanceConfig.ts`):
1. **Hard Ceiling Check**: Rejects any score higher than `maxScoreCeiling` (`SCORE_CEILING_EXCEEDED`).
2. **Minimum Duration Check**: Rejects scores earned in unrealistically short times (`ANOMALOUS_DURATION`).
3. **Score Velocity Check**: Computes `scoreVelocity = score / (verifiedDurationMs / 1000)`. If velocity exceeds `maxScorePerSec`, rejected (`ANOMALOUS_VELOCITY`).
4. **Audit Logging**: Any anomaly is automatically recorded to `suspiciousScores` collection with IP and correlation tracking.

---

## 4. Server-Authoritative Economy & Immutable Ledger
* **Authoritative Catalog (`src/config/shopCatalog.ts`)**:
  - The client only submits `{ itemId, idempotencyKey }`.
  - Item cost, type, value, and stackability are determined exclusively by the server catalog.
* **Atomic Purchases (`POST /api/buy-item`)**:
  - Single atomic transaction:
    1. Verifies item existence and active status in catalog.
    2. Checks if item is non-stackable and user already owns it.
    3. Checks user balance in `userEconomy`.
    4. Debits user balance and grants item in `userInventory`.
    5. Appends record to immutable `economyTransactions` ledger.
    6. Caches idempotency record.
* **Daily Wheel Spin (`POST /api/spin`)**:
  - Cryptographic secure RNG: `crypto.randomInt(0, totalWeight)` (Node.js cryptographic entropy).
  - Enforces daily cooldown in atomic transaction.
  - Credits coins and writes ledger entry.
* **Ledger Invariants**:
  - Every coin movement (game reward, purchase, spin, admin adjustment) generates an immutable ledger document containing `transactionId`, `userId`, `type`, `amount`, `balanceBefore`, `balanceAfter`, `reason`, `referenceId`, and `createdAt`.

---

## 5. Rate Limiting Policy
* Abstraction via `RateLimiter` interface with distributed `FirestoreRateLimiter` and fallback `MemoryRateLimiter`.
* Sliding window counters per user/IP:
  - `/api/session/start`: 30 req / min
  - `/api/submit-score`: 20 req / min
  - `/api/buy-item`: 20 req / min
  - `/api/spin`: 10 req / min
  - `/api/economy` & `/api/leaderboard`: 60 req / min
  - `/api/telemetry`: 100 req / min
* Returns HTTP 429 with standard headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

---

## 6. Authentication & Admin Authorization
* **Authentication**: Verified Firebase ID Tokens (`Bearer <token>`) via `firebase-admin/auth`.
* **Admin Privilege**: Strictly derived from Firebase Custom Claims (`token.admin === true`).
* **Emergency Override**: Controlled exclusively via `ADMIN_UIDS` environment variable. NO hardcoded privileged emails or default admin accounts.
* **Test Bypass**: Test headers (`x-test-uid`) are strictly isolated to `NODE_ENV === 'test'`.

---

## 7. Standardized API Error Contract
All API responses and errors adhere to a uniform JSON contract:
```json
{
  "success": false,
  "code": "INVALID_GAME_ID",
  "message": "ID Game tidak valid atau tidak terdaftar.",
  "requestId": "req_1788573515964_9b742ad3edce"
}
```
Client never receives stack traces or generic HTML errors in production.
