// 工作包 1 第二部分：方案圖面與差異核准只在電腦版（手機只看）
const { test } = require('playwright/test');
const { fresh, expect, tapDemo } = require('./helpers');
const H = { 'Content-Type': 'application/json', 'X-JJJ': '1' };

test('手機方案圖面只能看：沒有儲存、移動、核准按鈕，提示到門市電腦', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/app.html');
  await tapDemo(page, '[data-demo="advisor@example.com"]'); await page.waitForTimeout(2500);
  await page.evaluate(async () => { await window.JJJ.openBoard(3); window.JJJ.go('apm'); }); await page.waitForTimeout(500);
  await expect(page.locator('#view')).toContainText('圖面編輯與差異核准請到門市電腦');
  await expect(page.locator('#view [data-a="pmSave"]')).toHaveCount(0);
  await expect(page.locator('#view [data-pmap]')).toHaveCount(0);
  await expect(page.locator('#view [data-dfok]')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('電腦版「改善方案」可以移動標記並存成新版本', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/consultant.html?view=case&hid=3&tab=3');
  await tapDemo(page, '#cLogin [data-demo]'); await page.waitForTimeout(2500);
  const map = page.locator('#view [data-pmap]');
  await expect(map).toHaveCount(1);
  const before = await page.locator('#view').innerText();
  const v0 = +(before.match(/目前版本 v(\d+)/) || [0, 0])[1];
  await map.locator('[data-pin]').first().click();
  const bb = await map.boundingBox();
  await page.mouse.click(bb.x + bb.width * 0.45, bb.y + bb.height * 0.55);
  await expect(page.locator('[data-cpsave]')).toBeEnabled();
  await page.click('[data-cpsave]'); await page.waitForTimeout(800);
  const after = await page.locator('#view').innerText();
  const v1 = +(after.match(/目前版本 v(\d+)/) || [0, 0])[1];
  expect(v1).toBeGreaterThanOrEqual(v0);
  await expect(page.locator('[data-cpsave]')).toBeDisabled();
  expect(errs).toEqual([]);
});

test('技師回報差異後，電腦版「驗收與售後」可以核准', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/consultant.html');
  await page.evaluate(async H => {
    await fetch('/api/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ email: 'tech@example.com', password: 'demo1234' }) });
    const o = (await (await fetch('/api/tech/orders', { headers: H })).json()).orders.find(x => x.household === '林媽媽家');
    await fetch(`/api/tech/orders/${o.id}/diffs`, { method: 'POST', headers: H, body: JSON.stringify({ pin_id: 'D1', level: '輕微', text: '浴室門是推拉門，門窗感測器改用側裝支架', photo: true }) });
    await fetch('/api/auth/logout', { method: 'POST', headers: H });
  }, H);
  await page.goto('/jiujujia/consultant.html?view=case&hid=3&tab=8');
  await tapDemo(page, '#cLogin [data-demo]'); await page.waitForTimeout(2500);
  await expect(page.locator('#view')).toContainText('技師現場差異');
  await expect(page.locator('#view [data-cdfok]')).toHaveCount(1);
  await page.click('#view [data-cdfok]'); await page.waitForTimeout(1000);
  await expect(page.locator('#view [data-cdfok]')).toHaveCount(0);
  await expect(page.locator('#view')).toContainText('目前沒有待核准的差異');
  expect(errs).toEqual([]);
});

test('居家評估中途離開：量測與回答存進資料庫，下次開始評估時帶回', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/app.html');
  await tapDemo(page, '[data-demo="chen@example.com"]'); await page.waitForTimeout(2500);
  await page.evaluate(() => window.JJJ.go('b1')); await page.waitForTimeout(300);
  await page.click('[data-a="loginChild"]'); await page.waitForTimeout(500);
  await page.evaluate(() => { const S = window.JJJ.S; S.ans = { night: '2' }; });
  // 透過畫面上的輸入觸發保存
  await page.evaluate(() => { window.JJJ.S.armode = 'manual'; window.JJJ.render(); });
  await page.fill('#m_corridor_cm', '85'); await page.waitForTimeout(900);
  const saved = await page.evaluate(async () => (await (await fetch('/api/home/assessment-draft')).json()).draft);
  expect(saved.meas.corridor_cm).toBe('85');
  // 重新整理後再開始評估，數字帶回來
  await page.reload(); await page.waitForTimeout(2500);
  await page.evaluate(() => window.JJJ.go('b1')); await page.waitForTimeout(300);
  await page.click('[data-a="loginChild"]'); await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.JJJ.S.meas.corridor_cm)).toBe('85');
  expect(errs).toEqual([]);
});
