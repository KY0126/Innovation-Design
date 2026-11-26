// L8 效能：本機與 CI 的粗略預算（正式數字用 Lighthouse 手機版另測，見測試規範 L8）
const { test, expect, fresh, login, app } = require('../../_pw.cjs');

test('App 開啟到出現登入按鈕 ≦ 4 秒', async ({ page }) => {
  await fresh(page);
  const t0 = Date.now(); await page.goto('/jiujujia/app.html');
  await page.locator('[data-demo]').first().waitFor();
  const ms = Date.now() - t0; console.log('App 首屏', ms, 'ms');
  expect(ms).toBeLessThan(4000);
});

test('拼出來切到 3D，第一次算圖 ≦ 6 秒（軟體算圖）', async ({ page }) => {
  await fresh(page); await login(page, 'li@example.com');
  await app(page, "A=>{A.S.stack=['home','m2'];A.render()}");
  await page.click('[data-wcreate]'); await page.fill('[data-wst="hope"]', '效能測試'); await page.click('[data-wnext="1"]');
  const t0 = Date.now(); await page.click('[data-wview="3d"]');
  await page.locator('.w3d canvas, .w3d .muted').first().waitFor();
  const ms = Date.now() - t0; console.log('3D 首次算圖', ms, 'ms');
  expect(ms).toBeLessThan(6000);
});
