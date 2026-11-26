// 工作包 6：總部真資料。指標由資料表計算；模擬區塊另外標示；規則改了家庭端同步
const { test } = require('playwright/test');
const { fresh, expect, tapDemo } = require('./helpers');

test('試點分析：上方即時指標由資料庫計算並標明來源，下方模擬另外標示', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/admin.html');
  await tapDemo(page, '#gate [data-demo="manager@example.com"]'); await page.waitForTimeout(2500);
  const m = await page.evaluate(async () => (await (await fetch('/api/admin/metrics')).json()));
  const diag = m.groups.flatMap(g => g.items).find(x => x.k === 'diag');
  const real = await page.evaluate(() => __DBW.prepare('SELECT COUNT(DISTINCT household_id) AS n FROM assessments').get().n);
  expect(diag.v).toBe(real);
  await page.evaluate(() => window.JJJA.go('kpi')); await page.waitForTimeout(800);
  await expect(page.locator('#view')).toContainText('試點實績');
  await expect(page.locator('#view')).toContainText('來源：assessments');
  await expect(page.locator('#view .simh').first()).toContainText('模擬');
  await page.evaluate(() => window.JJJA.go('wish')); await page.waitForTimeout(800);
  await expect(page.locator('#view')).toContainText('心願總數');
  await page.evaluate(() => window.JJJA.go('partner')); await page.waitForTimeout(800);
  await expect(page.locator('#view')).toContainText('吳技師');
  expect(errs).toEqual([]);
});

test('設定：總部改關懷判斷規則，家庭 App 通知設定顯示同一份；情境模板在設定底下', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/admin.html');
  await tapDemo(page, '#gate [data-demo="manager@example.com"]'); await page.waitForTimeout(2500);
  await page.evaluate(() => window.JJJA.go('sys')); await page.waitForTimeout(800);
  await expect(page.locator('#view [data-tab="kb"]').first()).toBeVisible();
  await page.fill('#rB', '40'); await page.click('[data-la="rulesSave"]'); await page.waitForTimeout(600);
  await page.evaluate(async () => { await fetch('/api/auth/logout', { method: 'POST', headers: { 'X-JJJ': '1' } }); });
  await page.goto('/jiujujia/app.html'); await tapDemo(page, '[data-demo="li@example.com"]'); await page.waitForTimeout(1500);
  await page.evaluate(() => { JJJAPP.S.stack = ['home', 'm2']; JJJAPP.go('nset'); }); await page.waitForTimeout(600);
  await expect(page.locator('#view')).toContainText('40 分鐘');
  expect(errs).toEqual([]);
});
