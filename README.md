# ZiGame 2.0 — Next-Gen WebGL & Retro Arcade Platform

ZiGame 2.0 is a full-stack, production-hardened web arcade platform featuring **40 curated 2D and 3D mini-games** built with **React 19**, **Three.js**, **Vite 6**, **Express**, and **Cloud Firestore**. The platform pairs a unified WebGL/Canvas SDK (`src/sdk/`) with a server-authoritative, zero-trust security architecture for verified leaderboards, atomic coin transactions, and competitive Elo/MMR matchmaking.

---

## Visual Showcase & Flagship Titles

| Flagship Title | Genre & Engine Highlights | Preview |
| :--- | :--- | :---: |
| **World Box Sandbox 3D** | Voxel god-simulator with cellular terrain simulation, weather & biome tools, and real-time 3D WebGL stage (`WorldBoxGame`). | ![World Box Sandbox 3D](./public/images/thumb_world_box_1794533027215.jpg) |
| **Wizard Chess 3D** | Tactical chess AI + local 2-player mode set on an interactive PBR stone board with arcane spells, OrbitControls, and shatter debris (`WizardChess3DGame`). | ![Wizard Chess 3D](./public/images/thumb_wizard_chess_3d_1793880932928.jpg) |
| **Desk Racer 3D** | Miniature formula coaster circuit across an RGB workspace desk with ghost lap replays, spline physics, and power-ups (`DeskRacerGame`). | ![Desk Racer 3D](./public/images/thumb_desk_racer_3d_1793880933767.jpg) |

---

## Architecture Overview

### 1. Unified Game Engine & SDK (`src/sdk/`)
All 40 canonical games are registered in `src/config/gameRegistry.ts` and run through the unified SDK barrel (`src/sdk/index.ts`):
- **`useGameEngine` & `LoopController` (`src/sdk/loopController.ts`)**: Clamped `1–50ms` timestep loop scheduling, automatic `visibilitychange` pause/resume, frame-time distribution sampling, and zero raw `requestAnimationFrame` leaks.
- **3D WebGL PBR Stage (`src/utils/threeStage.ts` & `src/utils/threeCleanup.ts`)**: Studio `RoomEnvironment` PMREM reflections, adaptive DPR scaling, WebGL context-loss handling, `ResizeObserver` sizing, and deterministic scene/geometry/texture disposal.
- **Worker Physics, Object Pooling & Touch Controls**: `physicsWorkerController.ts`, `objectPool.ts`, `inputController.ts`, `VirtualControls.tsx`, and `performanceController.ts`.

### 2. Server-Authoritative Backend & Atomic Economy (`server.ts`, `src/server/`)
- **Production Fail-Fast Persistence Guard**: On startup in `NODE_ENV=production`, `server.ts` probes Firebase Admin / Firestore availability (`probeFirestoreAvailability`) and exits non-zero if unreachable. Mutating APIs assert live Firestore availability and return `503 Service Unavailable` rather than silently falling back to ephemeral RAM (`memoryStore` is strictly restricted to `test`/`development`).
- **Atomic Double-Entry Ledger (`src/server/persistence/`)**: All wallet mutations, shop purchases, daily spins, gacha pulls, gambles, reward claims, and ranked score rewards execute inside `db.runTransaction(...)` with in-transaction idempotency checks (`X-Idempotency-Key`) and double-entry ledger records.
- **Distributed Rate Limiting & Zod Validation (`src/server/rateLimiter.ts`, `src/server/schemaValidator.ts`)**: Every mutating endpoint enforces `requireAuth`, `enforceUserOwnership`, `requireNotBanned`, `validateBody(...)`, and rate limiting (Firestore-backed `rateLimits` collection by default, with a `setSharedRateLimitStore` adapter hook for Redis/external stores).

### 3. Security & Cloud Isolation (`firestore.rules`, `security_spec.md`)
- **Custom Claims Admin RBAC**: Admin access is verified strictly via Firebase Auth Custom Claims (`request.auth.token.admin == true || request.auth.token.role == 'admin'`) with zero hardcoded personal emails in `firestore.rules`. Use `scripts/set-admin-claim.ts` to grant or revoke claims server-side.
- **Zero-Trust Anti-Cheat Sessions**: Ranked/verified runs initialize via `/api/session/start` with server nonces and HMAC verification on score submission.
- **Strict Guest vs. Cloud Separation (`AuthContext`, `GameContext`, `sync.ts`)**: Offline Guest Mode stores temporary local session state in `localStorage` with explicit UI badges indicating ranked leaderboards and cloud wallet sync require sign-in. Upon authentication, Firestore & `/api/economy` act as the strict single source of truth—offline guest coins, inventory, or ranked scores never inflate or overwrite cloud balances.

---

## Tech Stack

- **Frontend**: React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, Three.js 0.187, React Router 7, Lucide Icons, Motion
- **Backend**: Node.js (>=22), Express 4, Firebase Admin SDK 14, Zod / Schema Validation
- **Database & Rules**: Cloud Firestore, Firebase Authentication (Custom Claims), `firestore.rules`
- **Testing & QA**: Vitest 5 (Unit & Integration), Supertest, Playwright (E2E Smoke & Critical Flows), ESLint 10, `scripts/audit-games.cjs`

---

## Local Setup & Configuration

### Prerequisites
- **Node.js** v22+ (`.nvmrc`)
- **npm** v10+

### Steps

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env` and fill in your server & client configuration:
   ```bash
   cp .env.example .env
   ```
   - Client Firebase config uses `VITE_FIREBASE_*` environment variables (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIRESTORE_DATABASE_ID`).
   - For local development only, you may also copy `firebase-applet-config.example.json` to `firebase-applet-config.json` (git-ignored):
     ```bash
     cp firebase-applet-config.example.json firebase-applet-config.json
     ```
   - Backend credentials use `FIREBASE_SERVICE_ACCOUNT` (JSON string) or `GOOGLE_APPLICATION_CREDENTIALS` (file path).

3. **Grant Admin Custom Claims (Optional, Server CLI)**:
   ```bash
   npx tsx scripts/set-admin-claim.ts --uid <FIREBASE_UID>
   # or by email / revoke:
   npx tsx scripts/set-admin-claim.ts --email admin@example.com
   npx tsx scripts/set-admin-claim.ts --uid <FIREBASE_UID> --revoke
   ```

4. **Start the development server** (Port `3000`):
   ```bash
   npm run dev
   ```

5. **Run full verification suite**:
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   npm run test:integration
   npm run audit:games
   npm run build
   ```

---

## NPM Scripts (`package.json`)

| Script | Command | Description |
| :--- | :--- | :--- |
| `dev` | `tsx server.ts` | Starts the Express backend + Vite middleware dev server on port `3000`. |
| `build` | `vite build && esbuild ...` | Builds the client bundle to `dist/` and bundles `server.ts` to `dist/server.cjs`. |
| `start` | `node dist/server.cjs` | Runs the production server (requires reachable Firestore / Firebase Admin credentials). |
| `typecheck` | `tsc --noEmit` | Runs full TypeScript static type checking. |
| `lint` | `eslint .` | Lints TypeScript/TSX sources with ESLint 10. |
| `test` | `NODE_ENV=test vitest run` | Runs all unit & integration tests under Vitest. |
| `test:integration` | `NODE_ENV=test vitest run src/__tests__` | Runs backend integration, economy ledger, and IDOR/auth matrix tests. |
| `test:e2e` | `playwright test` | Runs Playwright E2E smoke & critical-flow suites across all 40 games. |
| `audit:games` | `node scripts/audit-games.cjs` | Verifies all 40 games use `useGameEngine`, zero raw `requestAnimationFrame`, and clean Three.js/listener disposal. |
| `seed:catalog` | `tsx scripts/seed-catalog.ts` | Seeds reward catalog & challenge definitions into Firestore. |

---

## Internal Documentation

- [Security Spec](./security_spec.md) — Data Invariants & Dirty Dozen Payloads
- [Security Architecture](./docs/security-architecture.md) — Zero-Trust & Anti-Cheat Architecture
- [New Game Contract](./docs/NEW_GAME_CONTRACT.md) — SDK Integration & Registration Contract
- [Operational Runbook](./docs/RUNBOOK.md) — Production Deployment & Operations
- [Release Checklist](./RELEASE_CHECKLIST.md) & [CHANGELOG.md](./CHANGELOG.md)
