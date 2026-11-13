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
      const canvasOrStage = viewport.locator('canvas, button:has-text("Mulai")').first();
      await expect(canvasOrStage).toBeVisible({ timeout: 15000 });

      // Verify neither AppErrorBoundary nor GameErrorBoundary nor GameNotFound rendered
      await expect(
        page.getByText(/SYSTEM ANOMALY DETECTED|MENGALAMI TROUBLE|Game Tidak Ditemukan/i)
      ).toHaveCount(0);

      expect(pageErrors, `Uncaught pageerror(s) on /game/${gameId}`).toEqual([]);
    });
  }
});
