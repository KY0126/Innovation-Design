const { test } = require('playwright/test');
const { fresh, expect } = require('./helpers');
// 1. 四個入口各自落在自己的登入頁
const ENTRIES = [
  ['consumer.html', /app\.html\?end=family/, '#loginForm', '家庭登入｜揪居家'],
  ['technician.html', /app\.html\?end=tech/, '#loginForm', '技師登入'],
  ['consultant.html', /consultant\.html/, '#cLogin', '生活顧問登入'],
  ['admin.html', /admin\.html/, '#gForm', '企業管理端登入'],
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
