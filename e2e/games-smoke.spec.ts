import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

function readCanonicalGameIdsFromRegistry(): string[] {
  const registryPath = path.resolve(process.cwd(), 'src', 'config', 'gameRegistry.ts');
  const content = fs.readFileSync(registryPath, 'utf8');
  const registryBlockMatch = content.match(
    /export const CANONICAL_GAME_REGISTRY[\s\S]*?=\s*\{([\s\S]*?)\n\};/
  );
  const block = registryBlockMatch ? registryBlockMatch[1] : content;
  const ids: string[] = [];
  const keyRegex = /^\s*'([a-z0-9-]+)'\s*:\s*\{/gm;
  let match: RegExpExecArray | null;
  while ((match = keyRegex.exec(block)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

const GAME_IDS = readCanonicalGameIdsFromRegistry();

test.describe('ZiGame Automated Game Registry Smoke Loop', () => {
  test('should discover all canonical games from gameRegistry.ts', () => {
    expect(GAME_IDS.length).toBeGreaterThanOrEqual(40);
  });

  for (const gameId of GAME_IDS) {
    test(`should render /game/${gameId} without pageerror or Error Boundary crash`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => {
        pageErrors.push(err.message || String(err));
      });

      await page.goto(`/game/${gameId}`, { waitUntil: 'domcontentloaded' });

      const root = page.locator('#arcade-gamepage-root');
      await expect(root).toBeVisible({ timeout: 15000 });

      const viewport = page.locator('#center-game-viewport');
      await expect(viewport).toBeVisible({ timeout: 15000 });

      // Wait for either a game <canvas> or the game ready/root container to finish mounting
      const canvasOrStage = viewport
        .locator('canvas, button:has-text("Mulai"), button:has-text("Reset"), button:has-text("Ulang")')
        .first();
      await expect(canvasOrStage).toBeVisible({ timeout: 15000 });

      // Verify neither AppErrorBoundary nor GameErrorBoundary nor GameNotFound rendered
      await expect(
        page.getByText(/SYSTEM ANOMALY DETECTED|MENGALAMI TROUBLE|Game Tidak Ditemukan/i)
      ).toHaveCount(0);

      expect(pageErrors, `Uncaught pageerror(s) on /game/${gameId}`).toEqual([]);
    });
  }
});

test.describe('ZiGame Mobile Portrait (390x844, hasTouch) UX & Audio Guard Smoke', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('should render Home & Games catalog with Featured / Top Picks and zero horizontal overflow on mobile', async ({ page }) => {
    const pageErrors: string[] = [];
    const audioWarnings: string[] = [];

    page.on('pageerror', (err) => pageErrors.push(err.message || String(err)));
    page.on('console', (msg) => {
      if (msg.text().includes('AudioContext was not allowed to start')) {
        audioWarnings.push(msg.text());
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Pilihan Unggulan/i).first()).toBeVisible({ timeout: 15000 });

    const homeOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    );
    expect(homeOverflow).toBe(true);

    await page.goto('/games', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Featured \/ Top Picks/i).first()).toBeVisible({ timeout: 15000 });

    const catalogOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    );
    expect(catalogOverflow).toBe(true);

    expect(pageErrors).toEqual([]);
    expect(audioWarnings).toEqual([]);
  });

  const mobileRepresentativeGames = [
    'wizard-chess',
    'desk-racer',
    'world-box',
    'cyber-tetris',
    'neon-2048',
  ];

  for (const gameId of mobileRepresentativeGames) {
    test(`should render and start /game/${gameId} on mobile 390x844 without overflow or audio autoplay warning`, async ({ page }) => {
      const pageErrors: string[] = [];
      const audioWarnings: string[] = [];

      page.on('pageerror', (err) => pageErrors.push(err.message || String(err)));
      page.on('console', (msg) => {
        if (msg.text().includes('AudioContext was not allowed to start')) {
          audioWarnings.push(msg.text());
        }
      });

      await page.goto(`/game/${gameId}`, { waitUntil: 'domcontentloaded' });
      const viewport = page.locator('#center-game-viewport');
      await expect(viewport).toBeVisible({ timeout: 15000 });

      const canvasOrStage = viewport
        .locator('canvas, button:has-text("Mulai"), button:has-text("Reset"), button:has-text("Ulang")')
        .first();
      await expect(canvasOrStage).toBeVisible({ timeout: 15000 });

      const startBtn = viewport.locator('button:has-text("Mulai")').first();
      if (await startBtn.isVisible()) {
        await startBtn.tap();
      }

      const noOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1
      );
      expect(noOverflow, `Horizontal overflow detected on mobile /game/${gameId}`).toBe(true);
      expect(pageErrors, `Uncaught pageerror(s) on mobile /game/${gameId}`).toEqual([]);
      expect(audioWarnings, `AudioContext autoplay warning on /game/${gameId}`).toEqual([]);
    });
  }
});

