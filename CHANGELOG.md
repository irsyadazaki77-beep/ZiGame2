# Changelog

All notable changes to the **ZiGame** project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0-RC1] - 2026-09-09

### Added
- **Incident Kill Switches**: Added instant emergency toggles for `ranked`, `economy`, and `seasons` in `/api/admin/kill-switches` and `AdminDashboard`.
- **System Readiness Probes**: Added `/api/ready` and `/api/liveness` alongside `/api/health` for container traffic gating.
- **Ledger Reconciliation Engine**: Added automatic balance reconciliation (`/api/admin/reconcile-economy` and `/api/user/reconcile-economy`) to detect accounting discrepancies.
- **Competitive Integrity Checker**: Added consistency audits for Elo ratings, tiers, and total ranked matches played.
- **Documentation**: Added `RUNBOOK.md`, `NEW_GAME_CONTRACT.md`, and comprehensive `RELEASE_CHECKLIST.md`.

### Security & Hardening
- **Strict HTTP Headers**: Configured `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and `HSTS`.
- **Redacting Structured Logger**: Built-in PII and secret sanitization across server logs.
- **Session Replay Immunity**: Atomic consumption of cryptographic nonces prevents duplicate score exploits.
- **Idempotency Layer**: Guaranteed exactly-once execution for shop purchases, gambles, daily spins, and gacha pulls.

### Fixed
- **Canonical Game IDs**: Fixed alias mapping across `neon-2048` and legacy game identifiers in achievement target verifiers.
- **Admin Authentication**: Enforced strict role and token claim verification across all administrative endpoints.

---

## [1.5.0] - 2026-08-15

### Added
- Competitive Ranked matchmaking and seasonal rating calculation.
- Daily mission generation with deterministic daily seed.
- Inventory cosmetics system and avatar frames in shop.

---

## [1.0.0] - 2026-06-01

### Initial Release
- Core 37 HTML5 games catalog with canvas rendering.
- User profiles, achievements, high scores, and leaderboards.
- Audio synthesis engine for retro sound effects.
