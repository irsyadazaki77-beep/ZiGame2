# ZIGAME 2.0 PRODUCTION RELEASE & GO-LIVE CHECKLIST

> Canonical Production Verification Document — **Release Candidate v2.0.0-RC1**

---

## 1. Feature Freeze & Scope Integrity
- [x] **Strict 37-Game Catalog**: No experimental, phantom, or duplicate games introduced.
- [x] **Canonical Game Registry**: All 37 games registered in `src/config/gamesRegistry.ts` with bidirectional alias resolution.
- [x] **No Ghost References**: UI components render strictly canonical game IDs.

---

## 2. Server Authority & Anti-Cheat Validation
- [x] **Session Nonce Verification**: High-entropy crypto nonces (`crypto.randomUUID()`) issued on session start.
- [x] **Score Velocity Guard**: Rejects submissions where `score / duration` exceeds maximum game speed.
- [x] **Score Ceiling Enforcement**: Hard caps defined in `GAME_BALANCE_CONFIG` strictly checked on backend.
- [x] **Session Replay Immunity**: Sessions consumed atomically upon first score submission.
- [x] **Zero-Score Award Rule**: Submissions with score = 0 award strictly 0 coins.

---

## 3. Economy & Ledger Reliability
- [x] **Server-Authoritative Transactions**: Coins, daily spins, gacha pulls, and gambles calculated on server.
- [x] **Idempotency Protection**: Inflight and duplicate transactions guarded by cryptographic idempotency keys.
- [x] **Atomic Ledger Logging**: Every balance change recorded with timestamp, reason, and balance delta.
- [x] **Ledger Reconciliation**: Automatic and manual audit tools (`/api/admin/reconcile-economy`) verify `initialBalance + credits - debits == currentBalance`.
- [x] **Inventory Deduplication**: Non-stackable shop purchases prevent double ownership.

---

## 4. Competitive Integrity & Seasons
- [x] **Dynamic Elo/MMR Rating**: Server-side calculation with adaptive K-factor (K=40 provisional, K=24 standard, K=16 veteran).
- [x] **Competitive Profile Verification**: Total matches tracked consistently across games (`validateCompetitiveIntegrity`).
- [x] **Seasonal Windows**: Server-controlled season status and automated tier qualification.

---

## 5. Security & Access Control
- [x] **Firebase Firestore Rules**: Schema validation, owner-scoped reads, server-only writes deployed.
- [x] **Role-Based Access Control**: `requireAdmin` middleware checks verified admin tokens or claims.
- [x] **Structured Redacting Logger**: Sensitive headers, PII, and credentials automatically sanitized in logs.
- [x] **HTTP Security Headers**: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, `HSTS`.

---

## 6. Resilience & Incident Response
- [x] **Runtime Kill Switches**: Live toggles for `ranked`, `economy`, and `seasons` in Admin Console.
- [x] **Health & Readiness Probes**: `/api/health`, `/api/ready`, and `/api/liveness` for automated orchestration.
- [x] **Graceful Fallbacks**: Distributed Firestore rate limiting paired with in-memory fallback.
- [x] **Storage Migrations**: Client-side storage versioning (v1 -> v4) with seamless payload upgrades.

---

## 7. Operational Runbook & Documentation
- [x] **Runbook**: Emergency incident playbooks for economy exploits, ranked exploits, database degradation, and rollbacks (`/docs/RUNBOOK.md`).
- [x] **New Game Contract**: Standardized contract for adding future games with audio, scoring, and telemetry (`/docs/NEW_GAME_CONTRACT.md`).
- [x] **Changelog**: Release history from v1.0.0 through v2.0.0-RC1 (`CHANGELOG.md`).
- [x] **Automated Tests**: Backend test suite passing 100% with 30 backend tests and 7 frontend migration tests.
