const { test } = require('playwright/test');
const { fresh, expect } = require('./helpers');
// 1. 入口：手機都進揪居家 App 的統一登入頁；電腦進企業管理端（總部）或生活顧問（門市電腦）
const ENTRIES = [
  ['app.html', /jiujujia\/app\.html/, '#loginForm', '登入揪居家'],
  ['consumer.html', /jiujujia\/app\.html/, '#loginForm', '登入揪居家'],
  ['technician.html', /jiujujia\/app\.html/, '#loginForm', '登入揪居家'],
  ['admin.html', /admin\.html/, '#gForm', '企業管理端（電腦版）'],
  ['consultant.html', /consultant\.html/, '#cLogin', '生活顧問登入'],
];
for (const [entry, url, form, title] of ENTRIES) {
  test(`入口 ${entry} → ${title}`, async ({ page }) => {
    const errs = await fresh(page);
    await page.goto('/' + entry);
    await expect(page).toHaveURL(url);
    await expect(page.locator(form)).toBeVisible();
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible();
    expect(errs).toEqual([]);
  });
}
test('首頁連結都能開啟', async ({ page, request }) => {
  await page.goto('/index.html');
  const hrefs = await page.$$eval('a[href]', as => [...new Set(as.map(a => a.getAttribute('href')))].filter(h => h && !/^(https?:|mailto:|#)/.test(h)));
  expect(hrefs.length).toBeGreaterThan(3);
  const bad = [];
  for (const h of hrefs) {
    let p = h.split('#')[0].split('?')[0]; if (!p) continue;
    if (!/\.\w+$/.test(p)) p = p.endsWith('/') ? p + 'index.html' : p + '.html';
    const r = await request.get('/' + p.replace(/^\.?\//, ''));
    if (r.status() !== 200) bad.push(`${h} → ${r.status()}`);
  }
  expect(bad).toEqual([]);
});
