const { test } = require('playwright/test');
const { fresh, expect } = require('./helpers');
const overflowX = page => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);

test('電腦版：標準手機框 393×852 等比縮放，導覽面板在手機右側不重疊', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('/index.html'); await page.evaluate(() => localStorage.clear());
  await page.goto('/consumer.html');
  const shell = page.locator('.shell'); await expect(shell).toBeVisible();
  await expect(page.locator('#jg')).toBeVisible({ timeout: 10_000 });
  const s = await shell.boundingBox(), g = await page.locator('#jg').boundingBox();
  const view = page.viewportSize();
  // 外框含邊框 417×876，比例 0.476；螢幕區 393×852
  expect(Math.abs(s.width / s.height - 417 / 876)).toBeLessThan(0.01);
  expect(s.y + s.height).toBeLessThanOrEqual(view.height);
  expect(g.x, '導覽面板在手機右側').toBeGreaterThanOrEqual(s.x + s.width);
  expect(g.x + g.width).toBeLessThanOrEqual(view.width);
  await expect(page.locator('#ends')).toBeVisible();
  expect(await overflowX(page)).toBeLessThanOrEqual(1);
});

for (const [name, url, demo] of [
  ['消費者端', '/jiujujia/app.html?end=family', '[data-demo="chen@example.com"]'],
  ['技師端', '/jiujujia/app.html?end=tech', '[data-demo="tech@example.com"]'],
  ['生活顧問端', '/jiujujia/consultant.html', '#cLogin [data-demo]'],
  ['企業管理端', '/jiujujia/admin.html', '#gate [data-demo="manager@example.com"]'],
]) {
  test(`${name}：登入頁與首頁沒有左右溢出`, async ({ page }) => {
    const errs = await fresh(page);
    await page.goto(url);
    await expect(page.locator(demo)).toBeVisible();
    expect(await overflowX(page), '登入頁').toBeLessThanOrEqual(1);
    await page.click(demo); await page.waitForTimeout(2500);
    expect(await overflowX(page), '登入後首頁').toBeLessThanOrEqual(1);
    expect(errs).toEqual([]);
  });
}

test('手機版：導覽抽屜不蓋住第 1 個編號框', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile');
  await page.goto('/index.html'); await page.evaluate(() => localStorage.clear());
  await page.goto('/consumer.html');
  const sheet = page.locator('#jg.sheet'); await expect(sheet).toBeVisible({ timeout: 10_000 });
  const box = page.locator('.jgb').first(); await expect(box).toBeVisible();
  const sb = await sheet.boundingBox(), bb = await box.boundingBox();
  expect(sb.height, '抽屜不超過畫面一半').toBeLessThanOrEqual(page.viewportSize().height * 0.5);
  expect(bb.y + bb.height, '編號框在抽屜上方').toBeLessThanOrEqual(sb.y + 2);
});
