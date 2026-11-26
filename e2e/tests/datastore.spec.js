// 工作包 1：原本存在瀏覽器 localStorage 的業務資料，改存資料庫並經 /api 讀寫
const { test } = require('playwright/test');
const { fresh, expect, tapDemo } = require('./helpers');
const BIZ = ['jjj_phase', 'jjj_v5_quotes', 'jjj_v5_csel', 'jjj_v5_subsidy', 'jjj_v5_handoff', 'jjj_v5_opt', 'jjj_v5_opt2', 'jjj_adv_drafts', 'jjj_fp'];
const bizKeys = page => page.evaluate(B => Object.keys(localStorage).filter(k => B.includes(k)), BIZ);

test('舊版存在瀏覽器的資料，第一次載入時搬進資料庫並刪掉', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await fresh(page);
  await page.evaluate(() => {
    localStorage.setItem('jjj_phase', '擴展期');
    localStorage.setItem('jjj_v5_quotes', JSON.stringify({ 3: [{ v: 1, at: '10/26', total: 9100, items: ['示範'] }] }));
    localStorage.setItem('jjj_v5_handoff', JSON.stringify([{ at: '2026-10-26 10:00', items: [{ space: '走道' }] }]));
  });
  await page.goto('/jiujujia/app.html'); await page.waitForTimeout(2000);
  expect(await bizKeys(page)).toEqual([]);
  expect(await page.evaluate(async () => { await window.JJJPHASE_READY; return window.JJJPHASE(); })).toBe(1);
  await tapDemo(page, '[data-demo="advisor@example.com"]'); await page.waitForTimeout(2000);
  const q = await page.evaluate(async () => (await (await fetch('/api/advisor/quotes/3')).json()).quotes);
  expect(q.map(x => x.v)).toEqual([1]);
  const h = await page.evaluate(async () => (await (await fetch('/api/advisor/handoffs')).json()).handoffs);
  expect(h.length).toBe(1);
});

test('電腦版送出正式報價：存進資料庫，家庭端「專屬居家方案」看到同一個版本；瀏覽器沒有業務資料', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  const con = await context.newPage(); con.on('pageerror', e => errs.push(e.message));
  await con.goto('/jiujujia/consultant.html?view=case&hid=3&tab=5');
  await tapDemo(con, '#cLogin [data-demo]'); await con.waitForTimeout(2500);
  await con.locator('[data-q="send"]').first().click(); await con.waitForTimeout(800);
  await expect(con.locator('#view')).toContainText('v1');
  // 案件 3 是 zhang@example.com 的林媽媽家（已到報價階段）；同一個瀏覽器共用登入狀態，改用這個家庭帳號登入
  await page.goto('/jiujujia/app.html'); await page.waitForTimeout(1500);
  await page.evaluate(async () => {
    const h = { 'Content-Type': 'application/json', 'X-JJJ': '1' };
    await fetch('/api/auth/logout', { method: 'POST', headers: h });
    await fetch('/api/auth/login', { method: 'POST', headers: h, body: JSON.stringify({ email: 'zhang@example.com', password: 'demo1234' }) });
  });
  await page.reload(); await page.waitForTimeout(2500);
  await page.evaluate(() => window.JJJ.go('pl')); await page.waitForTimeout(800);
  await expect(page.locator('#view')).toContainText('正式報價 v1');
  expect(await bizKeys(page)).toEqual([]);
  expect(errs).toEqual([]);
});

test('營運階段：企業管理端切換後存進資料庫，另一個分頁的 App 跟著更新', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/app.html'); await page.waitForTimeout(1500);
  expect(await page.evaluate(async () => { await window.JJJPHASE_READY; return window.JJJPHASE(); })).toBe(2);
  const adm = await context.newPage(); adm.on('pageerror', e => errs.push(e.message));
  await adm.goto('/jiujujia/admin.html');
  await tapDemo(adm, '#gate [data-demo="manager@example.com"]'); await adm.waitForTimeout(2500);
  await adm.evaluate(() => window.JJJA.go('phase')); await adm.waitForTimeout(300);
  await adm.click('[data-ph="試點期"]'); await adm.waitForTimeout(800);
  await expect.poll(() => page.evaluate(() => window.JJJPHASE()), { timeout: 5000 }).toBe(0);
  expect(await bizKeys(page)).toEqual([]);
  expect(errs).toEqual([]);
});
