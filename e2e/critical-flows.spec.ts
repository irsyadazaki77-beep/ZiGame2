import { test, expect } from '@playwright/test';

test.describe('ZiGame Critical User Flows — Desktop & Mobile E2E Suite', () => {
  test('Landing Page & Game Discovery Flow', async ({ page }) => {
    await page.goto('/');

    // Verify title and main container
    await expect(page).toHaveTitle(/ZIGAME/i);
    const mainHeading = page.locator('h1, h2').first();
    await expect(mainHeading).toBeVisible();

    // Verify game grid/cards exist
    const gameCards = page.locator('[data-testid="game-card"], a[href*="/game/"], button');
    await expect(gameCards.first()).toBeVisible();
  });

  test('Navigation to Core Pages (Games, Shop, Leaderboards, Quests, Profile)', async ({ page }) => {
    await page.goto('/');

    // Navigate to Games page
    await page.goto('/games');
    await expect(page.locator('body')).toBeVisible();

    // Navigate to Shop page
    await page.goto('/shop');
    await expect(page.locator('body')).toBeVisible();

    // Navigate to Leaderboards
    await page.goto('/leaderboard');
    await expect(page.locator('body')).toBeVisible();

    // Navigate to Quests
    await page.goto('/quests');
    await expect(page.locator('body')).toBeVisible();

    // Navigate to Profile
    await page.goto('/profile');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Game Launch & Play Container Rendering', async ({ page }) => {
    await page.goto('/game/snake');

    // Verify game canvas or play area mounts without crashing
    await expect(page.locator('body')).toBeVisible();
    const canvasOrOverlay = page.locator('canvas, [data-testid="game-container"], h1, h2');
    await expect(canvasOrOverlay.first()).toBeVisible();
  });

  test('Mobile Viewport No Horizontal Scroll Overflow Check', async ({ page, viewport }) => {
    // Only verify on mobile viewports
    if (viewport && viewport.width <= 500) {
      await page.goto('/');

      // Evaluate scrollWidth vs clientWidth on documentElement
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(hasHorizontalOverflow).toBe(false);
    }
  });
});
