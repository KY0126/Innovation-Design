// 工作包 2：通知與關懷。事件模擬器寫進 care_events／notifications，家庭、門市看到同一份
const { test } = require('playwright/test');
const { fresh, expect, tapDemo } = require('./helpers');
const J = (page, path, o) => page.evaluate(async ([p, o]) => (await (await fetch('/api' + p, Object.assign({ headers: { 'Content-Type': 'application/json', 'X-JJJ': '1' } }, o || {}))).json()), [path, o]);
const app = (page, fn, arg) => page.evaluate(([f, a]) => new Function('A', 'a', f)(window.JJJAPP, a), [fn, arg]);

test('演練：長輩未回應 → 家人確認平安；事件、通知、每月摘要、門市待辦都是同一份資料', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/app.html');
  await tapDemo(page, '[data-demo="li@example.com"]'); await page.waitForTimeout(1500);
  const before = (await J(page, '/home/summary')).asked;
  await app(page, "A.S.stack=['home','m2'];A.render();A.go('n0')");
  await page.click('[data-sc="night"]');
  await expect(page.locator('#view')).toContainText('需要幫忙嗎');
  await page.click('[data-a="ntNoResp"]');
  // E2：通知直達頁（版型 C）：頂欄下方標示從 LINE 來
  await expect(page.locator('.csrc')).toContainText('來自 LINE 通知');
  await expect(page.locator('nav.nav')).toHaveCount(1);
  await page.click('[data-a="ntOk"]');
  await expect(page.locator('#view')).toContainText('已確認平安');
  await page.waitForTimeout(600);
  const home = await J(page, '/home');
  expect(home.care[0].outcome).toBe('家人確認');
  const N = await J(page, '/home/notifications');
  expect(N.unread).toBeGreaterThan(0);
  expect(N.notifications.every(n => ['owner', 'second', 'family'].includes(n.audience))).toBe(true);
  const sum = await J(page, '/home/summary');
  expect(sum.asked).toBe(before + 1);
  expect(sum.fam).toBeGreaterThan(0);
  // 通知清單 → LINE 直達的事件頁：誰收到了通知
  await app(page, "A.S.stack=['home','m2'];A.go('inbox')");
  await expect(page.locator('.ibx.new').first()).toBeVisible();
  await page.locator('.ibx[data-ev]:not([data-ev=""])').first().click();
  await expect(page.locator('#view')).toContainText('誰收到了通知');
  await expect(page.locator('#view')).toContainText('長輩');
  // 每月摘要（版型 C）數字來自資料
  await app(page, "A.go('msum')");
  await expect(page.locator('#view')).toContainText('平安的天數');
  // 生活顧問：門市待辦與案件看到同一筆
  await J(page, '/auth/logout', { method: 'POST' });
  const adv = page; await adv.goto('/jiujujia/app.html'); await tapDemo(adv, '[data-demo="advisor@example.com"]'); await adv.waitForTimeout(1500);
  const td = await J(adv, '/advisor/todos');
  expect(td.care.some(c => c.household === '李先生家')).toBe(true);
  await adv.click('[data-snav="acases"]');
  await expect(adv.locator('#view')).toContainText('售後');
  await expect(adv.locator('#view')).toContainText('李先生家');
  await adv.locator('[data-acase]', { hasText: '李先生家' }).click();
  await expect(adv.locator('#view')).toContainText('待關心');
  expect(errs).toEqual([]);
});

test('設備離線：只通知主要聯絡人與門市，不打擾長輩', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/app.html');
  await tapDemo(page, '[data-demo="li@example.com"]'); await page.waitForTimeout(1500);
  await app(page, "A.S.stack=['home','m2'];A.render();A.go('n0')");
  await page.click('[data-sc="offline"]'); await page.waitForTimeout(800);
  const e = (await J(page, '/home')).care[0];
  expect(e.kind).toBe('dev');
  const ev = await J(page, '/care/events/' + e.id);
  expect(ev.notifications.map(n => n.audience).sort()).toEqual(['owner', 'store']);
  expect(errs).toEqual([]);
});

test('生活顧問電腦版「案件」：與手機同一份資料，可依進度篩選', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/consultant.html');
  await tapDemo(page, '#cLogin [data-demo]'); await page.waitForTimeout(2500);
  await page.click('#nav [data-v="cases"]');
  await expect(page.locator('.actbl tbody tr').first()).toBeVisible();
  const all = await page.locator('.actbl tbody tr').count();
  await page.click('[data-acf="待問診"]');
  const n = await page.locator('.actbl tbody tr').count();
  expect(n).toBeLessThanOrEqual(all);
  await expect(page.locator('.actbl tbody')).toContainText('待問診');
  expect(errs).toEqual([]);
});
