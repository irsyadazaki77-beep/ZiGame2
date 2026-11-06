# ZiGame 2.0 - Next-Gen Retro & Modern Web Arcade Platform

ZiGame 2.0 is a full-stack, production-grade web arcade platform featuring 39 high-fidelity 2D and 3D mini-games built with React 19, Three.js, Vite, Express, and Firebase. The platform enforces a server-authoritative, zero-trust security architecture designed to prevent score tampering, ensure idempotent currency/inventory transactions, and provide global competitive matchmaking (Elo/MMR).

---

## 🚀 Fitur Utama & Arsitektur Keamanan

1. **Server-Authoritative Anti-Cheat**:
   - Every game session requires initialization via `/api/session/start`, returning a signed cryptographic nonce and timestamp.
   - Scores submitted via `/api/submit-score` are validated against session state, duration checks, maximum theoretical score bounds, and cryptographic signature verification.
2. **Centralized Economy & Idempotent Transactions**:
   - Double-entry ledger for game coins and reward redemptions.
   - All economy mutating endpoints require unique idempotency tokens (`X-Idempotency-Key`) to prevent double-spending and race conditions.
3. **Competitive Leaderboards & Elo System**:
   - Real-time global and weekly leaderboard tracking powered by Cloud Firestore.
   - Matchmaking and MMR calculation for player-vs-player challenges.
4. **Standardized Game Engine Lifecycle**:
   - Unified `useGameEngine` custom hook (`src/hooks/useGameEngine.ts`) managing fixed timestep loops (60 FPS), pause/resume, high-score persistence, audio synthesis, and responsive canvas sizing.
5. **PWA & Offline First Capability**:
   - Progressive Web App with offline service worker caching, install prompts, and offline score queueing.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, Three.js (`@react-three/fiber` / `three`), Lucide Icons, Motion.
- **Backend**: Node.js 24, Express 4, Firebase Admin SDK 14.
- **Database & Security**: Cloud Firestore, Firebase Authentication, Strict Firestore Security Rules (`firestore.rules`).
- **Testing & Quality Assurance**: Vitest (Unit & Integration tests), Playwright (E2E testing), ESLint 10, TypeScript (`tsc --noEmit`).

---

## 📁 Struktur Direktori

```text
ZiGame2/
├── docs/                        # Dokumentasi teknis & keamanan internal
│   ├── NEW_GAME_CONTRACT.md     # Spesifikasi pembuatan & pendaftaran game baru
│   ├── RUNBOOK.md               # Panduan operasional & pemeliharaan server
│   └── security-architecture.md # Arsitektur keamanan zero-trust & anti-cheat
├── e2e/                         # Suite pengujian E2E Playwright
├── public/                      # Aset statis & manifest PWA
├── scripts/                     # Skrip utilitas & otomatisasi
│   ├── audit-games.cjs          # Audit status migrasi game engine & registri
│   ├── economy-simulator.ts     # Simulator keseimbangan ekonomi & drop rate
│   ├── generate-pwa-icons.cjs   # Generator ikon PWA
│   └── seed-catalog.ts          # Seeding katalog reward & tantangan
├── src/
│   ├── components/
│   │   ├── games/               # 39 Komponen game 2D & 3D (.tsx)
│   │   ├── layout/              # Navigation, TopBar, Sidebar, Shell
│   │   ├── profile/             # Profile, achievements, mastery UI
│   │   ├── shop/                # Gacha machine, shop, gamble widgets
│   │   └── ui/                  # System UI components (Button, Card, Modal, etc.)
│   ├── config/                  # Konfigurasi platform, registry, catalog, & balance
│   ├── contexts/                # React Contexts (AuthContext, GameContext)
│   ├── hooks/                   # Custom Hooks (useGameEngine, usePlayerProfile, etc.)
│   ├── pages/                   # Halaman utama SPA (Home, Games, Leaderboard, Shop, Admin)
│   ├── sdk/                     # ZiGame Core Game SDK & lifecycle coordinators
│   ├── server/                  # Middleware, API router, rate limiter, & persistence layers
│   ├── services/                # Layer integrasi API Client, Firebase, & telemetry
│   └── types/                   # Definisi tipe TypeScript
├── CHANGELOG.md                 # Catatan rilis per versi
├── RELEASE_CHECKLIST.md         # Checklist rilis produksi & kepatuhan
├── server.ts                    # Entry point Express backend server
└── vite.config.ts               # Konfigurasi bundler Vite
```

---

## 💻 Menjalankan Secara Lokal (Getting Started)

### Prasyarat
- **Node.js**: v24.x (ditetapkan pada `.nvmrc`)
- **npm**: v10.x atau lebih baru

### Langkah Instalasi

1. **Clone & Install Dependencies**:
   ```bash
   npm install
   ```

2. **Konfigurasi Environment Variables**:
   Salin `.env.example` ke `.env`:
   ```bash
   cp .env.example .env
   ```

3. **Menjalankan Dev Server**:
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di `http://localhost:3000`.

4. **Audit Katalog Game**:
   ```bash
   npm run audit:games
   ```

---

## 📜 Skrip NPM (`package.json`)

| Skrip | Perintah | Deskripsi |
| :--- | :--- | :--- |
| `dev` | `tsx server.ts` | Menjalankan Express dev server dengan Vite HMR middleware di port 3000. |
| `build` | `vite build && esbuild ...` | Membangun aset client ke `dist/` dan mem-bundle `server.ts` ke `dist/server.cjs`. |
| `start` | `node dist/server.cjs` | Menjalankan server Express produksi dari hasil build `dist/`. |
| `typecheck` | `tsc --noEmit` | Memeriksa validasi tipe TypeScript di seluruh codebase. |
| `lint` | `eslint .` | Menjalankan linter ESLint untuk mengecek standar kualitas kode. |
| `test` | `NODE_ENV=test vitest run` | Menjalankan seluruh unit & integration tests dengan Vitest. |
| `audit:games` | `node scripts/audit-games.cjs` | Melakukan audit migrasi `useGameEngine` dan cross-check katalog `gameRegistry.ts`. |

---

## 📚 Referensi Dokumentasi Internal

- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) — Checklist Rilis Produksi ZiGame 2.0
- [CHANGELOG.md](./CHANGELOG.md) — Riwayat Perubahan Proyek
- [Security Architecture](./docs/security-architecture.md) — Dokumentasi Spesifikasi Keamanan & Anti-Cheat
- [Operational Runbook](./docs/RUNBOOK.md) — Panduan Operasional Server & Maintenance
- [New Game Contract](./docs/NEW_GAME_CONTRACT.md) — Spesifikasi & Kontrak Pengembang Game Baru
