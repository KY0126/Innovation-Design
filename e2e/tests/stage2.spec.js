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

test('營運階段開關：企業管理端切到擴展期後，App 揪全家可選、全家場域可加購；商用版依階段顯示', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/admin.html');
  await page.click('#gate [data-demo="manager@example.com"]'); await page.waitForTimeout(2500);
  await page.evaluate(() => window.JJJA.go('phase')); await page.waitForTimeout(400);
  const v = page.locator('#view');
  await expect(v).toContainText('營運階段開關');
  await page.click('[data-ph="擴展期"]');
  await expect(page.locator('[data-ph="擴展期"]')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.JJJA.go('biz')); await page.waitForTimeout(400);
  await expect(v).toContainText('產險公司');
  await expect(v.locator('tr', { hasText: '產險公司' })).toContainText('合作中');
  await expect(v.locator('tr', { hasText: '建商' })).toContainText('洽談中');

  const app = await context.newPage(); const aerr = []; app.on('pageerror', e => aerr.push(e.message));
  await app.goto('/jiujujia/app.html');
  await app.click('[data-demo="chen@example.com"]'); await app.waitForTimeout(3000);
  for (const x of ['x0', 'x24', 'x25', 'x26', 'x27', 'x28', 'x29', 'x30', 'x31', 'x32', 'x33', 'x34']) {
    await app.evaluate(x => window.JJJ.go(x), x); await app.waitForTimeout(150);
    await expect(app.locator('#view h1').last()).not.toBeEmpty();
  }
  await app.evaluate(() => window.JJJ.go('x24')); await app.waitForTimeout(200);
  await expect(app.locator('#view')).toContainText('擴展期已開放');
  for (const k of ['food', 'tv', 'wash']) await app.click(`[data-x24="${k}"]`);
  await expect(app.locator('#view')).toContainText('每月可省 200 元');
  await app.evaluate(() => window.JJJ.go('x33')); await app.waitForTimeout(200);
  await expect(app.locator('#view')).toContainText('延伸期開放');

  const biz = await context.newPage(); const berr = []; biz.on('pageerror', e => berr.push(e.message));
  await biz.goto('/jiujujia/business.html');
  await expect(biz.locator('#ban')).toContainText('示範預覽');
  await biz.click('[data-k="care"]');
  await expect(biz.locator('#who')).toContainText('護理之家');
  await expect(biz.locator('#desk')).toContainText('洗衣間');
  await page.evaluate(() => window.JJJA.go('phase')); await page.waitForTimeout(300);
  await page.click('[data-ph="延伸期"]');
  await biz.reload();
  await expect(biz.locator('#ban')).toContainText('延伸期已開放');
  await page.click('[data-ph="試點期"]');
  expect([...errs, ...aerr, ...berr]).toEqual([]);
});
