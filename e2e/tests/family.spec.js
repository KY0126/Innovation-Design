// 工作包 4：擴展期家庭。全部服務 → 加購與訂閱 4 步 → 訂單存資料庫 → 生活顧問確認
const { test } = require('playwright/test');
const { fresh, expect } = require('./helpers');
const J = (page, path, o) => page.evaluate(async ([p, o]) => { const r = await fetch('/api' + p, Object.assign({ headers: { 'Content-Type': 'application/json', 'X-JJJ': '1' } }, o || {})); return Object.assign({ _s: r.status }, await r.json()); }, [path, o ? Object.assign({}, o, { body: o.body ? JSON.stringify(o.body) : undefined }) : o]);
const app = (page, f) => page.evaluate(new Function('return (' + f + ')(window.JJJAPP)'));

test('全家場域方案 → 加購與訂閱 4 步 → 全部訂單；生活顧問確認後家庭看到「已確認」', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/app.html');
  await page.click('[data-demo="li@example.com"]'); await page.waitForTimeout(1500);
  await app(page, "A=>{A.S.stack=['home','m2'];A.go('x0')}");
  await expect(page.locator('#view')).toContainText('全部服務');
  await page.click('.svc[data-go="x24"]');
  await page.click('[data-x24="food"]'); await page.click('[data-x24="wash"]');
  await page.click('[data-co="fields"]');
  await expect(page.locator('.stpr li.on')).toContainText('選方案');
  await page.click('[data-co-next="1"]');
  await expect(page.locator('[data-co-next="2"]')).toBeDisabled();
  await page.click('[data-co-agree]'); await page.click('[data-co-next="2"]');
  await page.locator('[data-copay]').first().click(); await page.click('[data-co-next="3"]');
  await expect(page.locator('#view')).toContainText('已送出');
  await page.click('[data-co-done="ords"]');
  await expect(page.locator('#view')).toContainText('待生活顧問確認');
  const o = (await J(page, '/home/orders')).orders[0];
  expect(o.monthly).toBe(300);
  expect(o.items.map(i => i.id).sort()).toEqual(['food', 'wash']);
  await J(page, '/auth/logout', { method: 'POST' });
  await page.goto('/jiujujia/app.html'); await page.click('[data-demo="advisor@example.com"]'); await page.waitForTimeout(1500);
  const ao = (await J(page, '/advisor/orders')).orders.find(x => x.code === o.code);
  expect(ao.household).toBe('李先生家');
  expect((await J(page, '/advisor/orders/' + ao.id + '/confirm', { method: 'POST' }))._s).toBe(200);
  await J(page, '/auth/logout', { method: 'POST' });
  await page.goto('/jiujujia/app.html'); await page.click('[data-demo="li@example.com"]'); await page.waitForTimeout(1500);
  expect((await J(page, '/home/orders')).orders[0].status).toBe('已確認');
  expect(errs).toEqual([]);
});

test('進階影像版：沒有長輩本人同意不能訂；同意紀錄存資料庫', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/app.html');
  await page.click('[data-demo="li@example.com"]'); await page.waitForTimeout(1500);
  const r = await J(page, '/home/orders', { method: 'POST', body: { items: ['cam'], pay: '門市付款' } });
  expect(r._s).toBe(400);
  await app(page, "A=>{A.S.stack=['home','m2'];A.go('x31')}");
  for (const k of ['a', 'b', 'c', 'd']) await page.click(`[data-x31="${k}"]`);
  await page.click('[data-go="x31e"]');
  await expect(page.locator('#view')).toContainText('要在門口裝一台攝影機嗎');
  await page.click('[data-x31e="1"]');
  await expect(page.locator('#view')).toContainText('您同意');
  const c = (await J(page, '/home/consents')).consents[0];
  expect(c.agreed).toBe(1);
  expect((await J(page, '/home/orders', { method: 'POST', body: { items: ['cam'], pay: '門市付款' } }))._s).toBe(200);
  expect(errs).toEqual([]);
});

test('家電詳情分段：健康卡、保養、換新建議、以租代買、異業加購', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/app.html');
  await page.click('[data-demo="li@example.com"]'); await page.waitForTimeout(1500);
  await app(page, "A=>{A.S.stack=['home','m2'];A.go('x0')}");
  await page.click('.svc[data-hcseg]');
  await expect(page.locator('[data-hcs]')).toHaveCount(5);
  await expect(page.locator('#view')).toContainText('建議換新');
  await page.click('[data-hcs="3"]');
  await expect(page.locator('#view')).toContainText('NT$ 890');
  await page.click('[data-rent="60"]');
  await expect(page.locator('#view')).toContainText('NT$ 590');
  expect(errs).toEqual([]);
});
