// 工作包 5：延伸期新身分。校園大使（任務／成果／帳號）、商用客戶（揪夥伴商用版）都存資料庫，總部同步
const { test } = require('playwright/test');
const { fresh, expect } = require('./helpers');
const logout = page => page.evaluate(async () => { await fetch('/api/auth/logout', { method: 'POST', headers: { 'X-JJJ': '1' } }); });

test('校園大使：登入看到自己的導覽列；陪同居家觀察送出 → 總部確認 → 成果加 50 點', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/app.html');
  await page.click('[data-demo="amb@example.com"]'); await page.waitForTimeout(1500);
  await expect(page.locator('nav.snav button')).toHaveText(['任務', '成果', '帳號']);
  await page.click('[data-go="uvisit"]');
  await page.fill('#uvF', '林媽媽家'); await page.fill('#uvN', '走道晚上很暗');
  for (const k of ['a', 'b', 'c']) await page.click(`[data-uvck="${k}"]`);
  await page.click('[data-uvsend]');
  await expect(page.locator('#view')).toContainText('待門市確認');
  await logout(page);
  await page.goto('/jiujujia/admin.html');
  await page.click('#gate [data-demo="manager@example.com"]'); await page.waitForTimeout(2500);
  await page.evaluate(() => window.JJJA.go('amb')); await page.waitForTimeout(800);
  await page.locator('[data-avok]').first().click(); await page.waitForTimeout(600);
  await logout(page);
  await page.goto('/jiujujia/app.html'); await page.click('[data-demo="amb@example.com"]'); await page.waitForTimeout(1500);
  await page.click('[data-snav="u1"]');
  await expect(page.locator('#view')).toContainText('已確認');
  await expect(page.locator('#view .card').first()).toContainText('50');
  expect(errs).toEqual([]);
});

test('商用客戶：一鍵報修存資料庫 → 總部派工 → 客戶端看到「已派工」', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/app.html');
  await page.click('[data-demo="biz@example.com"]');
  await page.waitForURL(/business\.html/); await page.waitForTimeout(1500);
  await expect(page.locator('#ban')).toContainText('實際資料');
  await page.locator('#mob [data-bz="one"][data-k="報修"]').click(); await page.waitForTimeout(600);
  await expect(page.locator('#desk')).toContainText('待派工');
  await logout(page);
  await page.goto('/jiujujia/admin.html');
  await page.click('#gate [data-demo="manager@example.com"]'); await page.waitForTimeout(2500);
  await page.evaluate(() => window.JJJA.go('partner')); await page.waitForTimeout(800);
  await expect(page.locator('#view')).toContainText('高雄樂齡日照中心');
  await page.locator('[data-bzr][data-st="已派工"]').first().click(); await page.waitForTimeout(600);
  await logout(page);
  await page.goto('/jiujujia/business.html'); await page.waitForTimeout(1500);
  await page.click('[data-bz="login"]'); await page.waitForTimeout(1200);
  await expect(page.locator('#desk')).toContainText('已派工');
  expect(errs).toEqual([]);
});

test('育兒與寵物模式：延伸期可走加購與訂閱下單', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/app.html');
  await page.click('[data-demo="li@example.com"]'); await page.waitForTimeout(1500);
  await page.evaluate(() => { JJJAPP.S.stack = ['home', 'm2']; JJJAPP.go('x34'); }); await page.waitForTimeout(400);
  await page.click('[data-co="baby"]');
  await expect(page.locator('#view')).toContainText('育兒模式');
  await page.click('[data-co-next="1"]'); await page.click('[data-co-agree]'); await page.click('[data-co-next="2"]');
  await page.locator('[data-copay]').first().click(); await page.click('[data-co-next="3"]');
  await expect(page.locator('#view')).toContainText('已送出');
  expect(errs).toEqual([]);
});
