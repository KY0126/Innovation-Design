// L5 回復：重設資料、本機資料壞掉、3D 載不出來時，畫面都要能回到可用狀態
const { test, expect, fresh, login } = require('../../_pw.cjs');

test('本機資料被改壞後重新開啟，仍能看到登入頁、不白屏', async ({ page }) => {
  const errs = await fresh(page); await login(page, 'li@example.com');
  const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('jjj')));
  await page.evaluate(ks => ks.forEach(k => { if (k !== 'jjj_g_off') localStorage.setItem(k, '{壞掉的資料'); }), keys);
  await page.goto('/jiujujia/app.html'); await page.waitForTimeout(2500);
  await expect(page.locator('#loginForm')).toBeVisible();
  expect(errs).toEqual([]);
});

test('按「重設資料」回到示範狀態，示範作品還在', async ({ page }) => {
  await fresh(page); await login(page, 'li@example.com');
  await page.evaluate(() => window.JJJWEB && window.JJJWEB.reset());
  await page.waitForTimeout(2500);
  await page.goto('/jiujujia/app.html'); await page.locator('[data-demo="li@example.com"]').waitFor({ state: 'attached' }); await page.$eval('[data-demo="li@example.com"]', (e) => e.click()); await page.waitForTimeout(1500);
  const n = await page.evaluate(async () => (await (await fetch('/api/wish/works?tab=all', { headers: { 'X-JJJ': '1' } })).json()).works.length);
  expect(n).toBeGreaterThan(0);
});

test('3D 套件載入失敗時，作品頁顯示文字提示而不是空白', async ({ page }) => {
  await fresh(page);
  await page.route('**/cad3d.js*', r => r.abort());
  await login(page, 'li@example.com');
  const id = await page.evaluate(async () => { const r = await fetch('/api/wish/works', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-JJJ': '1' }, body: JSON.stringify({ title: '回復測試', field: '臥室到浴室', story: { who: '長輩', when: '', stuck: '', hope: '回復測試' }, build: [{ slot: 0, part: 'light', x: 2800, y: 700 }], cparts: [], terms: { rules: true, license: true } }) }); return (await r.json()).id; });
  await page.evaluate(id => window.JJJWISH.openWk(id), id);
  await page.click('[data-wkv="3d"]');
  await expect(page.locator('[data-w3d]')).toContainText('無法顯示 3D');
});
