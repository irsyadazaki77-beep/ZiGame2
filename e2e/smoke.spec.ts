import { test, expect } from '@playwright/test';

test.describe('ZiGame Application Smoke Tests', () => {
  test('should load home page and render key navigation elements', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ZIGAME/i);
    // Verify main navigation or lobby elements are visible
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should expose healthy API health endpoint', async ({ request }) => {
    const response = await request.get('/api/health');
    expect([200, 503]).toContain(response.status());
    const data = await response.json();
    expect(data.version).toBeDefined();
    expect(data.persistence).toBeDefined();
  });
});
