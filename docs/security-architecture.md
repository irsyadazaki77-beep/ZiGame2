# ZiGame 2.0 Security Architecture & Server Authority

## 1. Core Trust Boundaries
* **Client (Browser / WebView):** Completely UNTRUSTED. Client-sent metrics (durations, economy calculations, prices, or item values) are rejected or verified server-side. LocalStorage is NOT a security boundary; it stores non-sensitive UI preferences and guest state only.
* **Server (Node.js / Express):** AUTHORITATIVE. Enforces all identity verifications, game session rules, anti-cheat heuristics, RNG generation, transaction debits/credits, and admin authorizations.
* **Firestore (Persistence):** PERSISTENT AUTHORITY. Protected by strict Firestore Security Rules. Direct client mutations to economy, sessions, rate limits, or leaderboards are denied.

---

## 2. Unified Identity & Authentication Architecture
* **Canonical Authenticated Identity:**
  - `Firebase Auth UID` is the single canonical source of truth for authenticated user identity across the application.
  - All protected server resources, database documents, and sessions strictly bind to `req.user.uid`.
* **Profile vs Auth Separation:**
  - `Auth Identity`: `uid`, `email`, `emailVerified`, `providerData`, and custom claims (roles).
  - `Game Profile`: `displayName`, `avatar`, `colorTheme`, `XP`, `level`, and cosmetic unlocks.
  - Display names and usernames are cosmetic labels; they are NEVER used as ownership keys or security boundaries.
* **Guest Mode Policy & Boundaries:**
  - Guests can play casual games locally with local preferences and temporary progression.
  - Guests are STRICTLY FORBIDDEN from accessing:
    - Ranked matchmaking and ranked score submission (`/api/competitive/*`).
    - Server-authoritative economy mutations (`/api/buy-item`, `/api/spin`, `/api/economy/gamble`, `/api/economy/gacha`, `/api/economy/claim`).
    - Server-authoritative cloud saves and profile sync.
    - Administrator endpoints (`/api/admin/*`).
* **LocalStorage Boundary:**
  - **Safe Data (Retained):** UI theme (`zigame_theme`), audio preferences, active guest profile name, offline mutation queue, device ID.
  - **Sensitive Data (Forbidden):** Plaintext passwords, authoritative coin balances, ranked rating, verified token claims, admin privileges, or server session authority.

---

## 3. Token Handling & Identity Spoofing Protection
* **Bearer Token Validation:**
  - All protected endpoints require `Authorization: Bearer <Firebase_ID_Token>`.
  - Token verified cryptographically via `firebase-admin/auth`.
  - Expired tokens return `401 TOKEN_EXPIRED`.
  - Invalid or forged tokens return `401 INVALID_TOKEN`.
* **Anti-Spoofing Enforcer (`enforceUserOwnership`):**
  - If a client supplies `userId` in `req.body` or query params that does not match `req.user.uid`, the request is immediately rejected with `403 FORBIDDEN_USER_MISMATCH`.
  - Client-submitted `isAdmin` or `role` fields in requests are automatically stripped and ignored.
* **Session Ownership Invariants:**
  - Every game session (`POST /api/session/start`) and ranked session (`POST /api/competitive/session/start`) binds immutably to `session.userId = req.user.uid`.
  - Submission transactions verify `session.userId === req.user.uid`; cross-user session consumption is rejected with `422 SESSION_USER_MISMATCH`.

---

## 4. Admin Privilege & Authority
* **Primary Authority:**
  - Firebase Custom Claims (`token.admin === true` or `token.role === 'admin'`).
* **Firestore Parity:**
  - `firestore.rules` checks `request.auth.token.admin == true || request.auth.token.role == 'admin' || exists(/databases/$(database)/documents/admins/$(request.auth.uid))`.
* **Break-Glass Emergency Override:**
  - The `ADMIN_UIDS` environment variable allows server administrators to designate emergency recovery accounts on the server without modifying client bundles or database rules.
* **Client Admin Gate (`AdminRoute.tsx`):**
  - Acts solely as a visual UI gate.
  - Validates authentication via `useAuth()` and actively verifies with server `/api/admin/verify`.
  - Server endpoints enforce `requireAdmin`, preventing any client bypass.

---

## 5. Verified Game Session Lifecycle
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

## 6. Anti-Cheat & Competitive Integrity Architecture
Scores undergo multi-stage validation against game-specific configurations (`src/config/balanceConfig.ts`) and competitive rules (`src/config/competitiveConfig.ts`):
1. **Hard Ceiling Check**: Rejects any score higher than `maxScoreCeiling` (`SCORE_CEILING_EXCEEDED`). Triggers immediate session invalidation and logs anomaly with `CRITICAL` severity.
2. **Minimum Duration Check**: Rejects scores earned in unrealistically short times (`INSUFFICIENT_DURATION`). Burns session and logs with `HIGH` severity.
3. **Score Velocity & Duration Spoofing Check**:
   - Calculates server-verified velocity: `scoreVelocity = score / (verifiedDurationMs / 1000)`.
   - Also enforces client round duration velocity when provided, preventing attackers from keeping an idle session open and then submitting a cheated burst score.
   - Detects timing drift and clock manipulation when client claims duration exceeds verified session age.
4. **Session Burning on Cheat Attempt**: When an anti-cheat rule is breached, the session ticket is authoritatively burned (`consumed: true, invalidatedReason: '...'`), preventing replay or trial-and-error probing attacks.
5. **Cross-Mode Session Barrier**: Casual sessions cannot be submitted to ranked endpoints, and ranked sessions cannot be submitted to casual endpoints (`INVALID_SESSION`).
6. **Ranked Competitive Integrity**:
   - Strictly enforced allowlist (`RANKED_GAME_ALLOWLIST`).
   - Seasonal binding and version locking (`gameVersion: 2.0.0`, `balanceVersion: 2.5.0`, `rulesetVersion: 1.0.0`).
   - Performance ratio rating delta clamped between `[-25, +50]` with placement match loss-halving protection and minimum rating floor of 100.
7. **Multi-Tier Anomaly Auditing (`suspiciousScores`)**:
   - `CRITICAL`: Hard ceiling breach, extreme velocity (>2x).
   - `HIGH`: Velocity violations, duration violations, clock spoofing.
   - `MEDIUM`: Timing drift, uncataloged attempt.
   - `LOW`: Statistical outlier (e.g. 5x jump over historical PB), flagged for admin review without blocking legitimate high scores.
   - Dedicated admin audit query endpoint (`GET /api/admin/suspicious-scores`) with filtering by game, user, severity, and real-time dashboard breakdown.

---

## 7. Server-Authoritative Economy & Immutable Ledger
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

## 8. Rate Limiting Policy
* Sliding window counters per user/IP:
  - `/api/session/start`: 30 req / min
  - `/api/submit-score`: 20 req / min
  - `/api/buy-item`: 20 req / min
  - `/api/spin`: 10 req / min
  - `/api/economy` & `/api/leaderboard`: 60 req / min
  - `/api/telemetry`: 100 req / min
* Returns HTTP 429 with standard headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

---

## 9. Standardized API Error Contract
All API responses and errors adhere to a uniform JSON contract:
```json
{
  "success": false,
  "code": "INVALID_GAME_ID",
  "message": "ID Game tidak valid atau tidak terdaftar.",
  "requestId": "req_1788573515964_9b742ad3edce"
}
```
Client never receives internal stack traces, Firebase internal exceptions, or unformatted HTML error pages in production.
