// 決選對齊：企業管理端「投資效益」財務模擬與 App 階段路線
const { test } = require('@playwright/test');
const { fresh, expect } = require('./helpers');

test('投資效益：基準情境與計畫書一致（194 戶、第 11 月轉正、第 27 月回本），拖動參數會重算', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/admin.html');
  await page.click('#gate [data-demo="manager@example.com"]'); await page.waitForTimeout(2500);
  await page.evaluate(() => window.JJJA.go('vc')); await page.waitForTimeout(500);
  const v = page.locator('#view');
  await expect(v).toContainText('194 戶（加顧問後 310 戶）');
  await expect(v).toContainText('第 11 月');
  await expect(v).toContainText('第 27 月');
  await expect(v).toContainText('−22.4 萬');
  await page.locator('#fm-n').fill('30'); await page.waitForTimeout(300);
  await expect(v).toContainText('第 17 月');
  await page.click('[data-a="fmReset"]');
  await expect(v).toContainText('第 27 月');
  expect(errs).toEqual([]);
});

test('預約門市：後端門市清單含三民中華店', async ({ page }) => {
  const errs = await fresh(page);
  await page.goto('/jiujujia/app.html');
  const js = await page.evaluate(() => fetch('/jiujujia/backend.js').then(r => r.text()));
  const esc = t => [...t].map(c => c.charCodeAt(0) < 128 ? c : '\\u' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join('');
  expect(js).toContain(esc('Digital City 高雄三民中華店'));
  expect(errs).toEqual([]);
});
