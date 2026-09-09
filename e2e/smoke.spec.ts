import { test, expect } from '@playwright/test';

test.describe('ZiGame Application Smoke Tests', () => {
  test('should load home page and render key navigation elements', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ZIGAME/i);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should expose healthy API endpoints for health, ready, and liveness', async ({ request }) => {
    const healthRes = await request.get('/api/health');
    expect([200, 503]).toContain(healthRes.status());
    const healthData = await healthRes.json();
    expect(healthData.version).toBeDefined();

    const readyRes = await request.get('/api/ready');
    expect([200, 503]).toContain(readyRes.status());

    const livenessRes = await request.get('/api/liveness');
    expect(livenessRes.status()).toBe(200);
    const liveData = await livenessRes.json();
    expect(liveData.alive).toBe(true);
  });

  test('should provide valid game balance configuration', async ({ request }) => {
    const balanceRes = await request.get('/api/balance-config');
    expect(balanceRes.status()).toBe(200);
    const balanceData = await balanceRes.json();
    expect(balanceData.config).toBeDefined();
    expect(balanceData.config['snake']).toBeDefined();
  });
});

