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

// 「瀏覽器展示版」標籤固定在右下角：不可蓋住導覽面板按鈕、「開啟導覽」按鈕、App 底部選單
const rect = (page, sel) => page.evaluate(s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; }, sel);
const hit = (a, b) => !!(a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b);
for (const [name, url] of [['企業管理端', '/jiujujia/admin.html'], ['消費者端', '/consumer.html']]) {
  test(`${name}：展示版標籤不遮擋導覽按鈕、「開啟導覽」與底部選單`, async ({ page }) => {
    await page.goto('/index.html'); await page.evaluate(() => localStorage.clear());
    await page.goto(url);
    const login = page.locator('#jg [data-t="login"]'); await expect(login).toBeVisible({ timeout: 10_000 });
    await login.click(); await expect(page.locator('#jg [data-t="next"]')).toBeEnabled({ timeout: 15_000 });
    await page.waitForTimeout(800);
    const demo = await rect(page, '#webDemo');
    expect(hit(demo, await rect(page, '#jg .ft')), '導覽面板按鈕').toBe(false);
    await page.click('#jg [data-t="stop"]'); await page.waitForTimeout(800);
    const demo2 = await rect(page, '#webDemo'), open = await rect(page, '#jgOpen');
    expect(open, '「開啟導覽」按鈕要看得到').not.toBeNull();
    expect(hit(demo2, open), '「開啟導覽」按鈕').toBe(false);
    const nav = await page.evaluate(() => { const v = document.getElementById('view'); if (!v || !v.closest('#app')) return null; const vb = v.getBoundingClientRect().bottom; const n = [...v.querySelectorAll('nav.nav')].find(x => { const r = x.getBoundingClientRect(); return r.height && Math.abs(r.bottom - vb) < 4; }); if (!n) return null; const r = n.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
    expect(hit(demo2, nav), 'App 底部選單').toBe(false);
    expect(hit(open, nav), '「開啟導覽」與 App 底部選單').toBe(false);
  });
}
