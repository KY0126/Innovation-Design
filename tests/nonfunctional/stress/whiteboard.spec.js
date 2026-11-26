// L7 壓力（前端部分）：白板放 200 個零件，畫面仍在 3 秒內畫好、零件都在
// 後端壓力（k6 打 Edge Function／實用版 Supabase）只在測試環境手動跑，不打 GitHub Pages 與 LINE API
const { test, expect, fresh, login, app } = require('../../_pw.cjs');

test('白板放 200 個零件仍可在 3 秒內畫完', async ({ page }) => {
  await fresh(page); await login(page, 'li@example.com');
  await app(page, "A=>{A.S.stack=['home','m2'];A.render()}");
  await page.click('[data-wcreate]'); await page.fill('[data-wst="hope"]', '壓力測試'); await page.click('[data-wnext="1"]');
  const t0 = Date.now();
  await app(page, "A=>{const b=[];for(let i=0;i<200;i++)b.push({slot:i%6,part:i%2?'light':'mat',x:300+(i%20)*280,y:300+Math.floor(i/20)*400});A.S.wn.build=b;A.render()}");
  await expect(page.locator('[data-wpin]')).toHaveCount(200);
  const ms = Date.now() - t0; console.log('200 個零件繪製', ms, 'ms');
  expect(ms).toBeLessThan(3000);
});
