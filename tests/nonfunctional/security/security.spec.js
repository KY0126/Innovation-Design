// L6 安全：輸入跳脫、角色權限（R1 相關的「誰能看什麼」）；金鑰與套件漏洞掃描在 GitHub Actions
const { test, expect, fresh, J, login } = require('../../_pw.cjs');

test('心願標題寫進 HTML 也只當文字顯示，不會被執行', async ({ page }) => {
  const errs = await fresh(page); await login(page, 'li@example.com');
  const evil = '<img src=x onerror="window.__xss=1">夜燈';
  const r = await J(page, '/wish/works', { method: 'POST', body: { title: evil, field: '臥室到浴室', story: { who: '長輩', when: '', stuck: '', hope: evil }, build: [{ slot: 0, part: 'light', x: 2800, y: 700 }], cparts: [], terms: { rules: true, license: true } } });
  expect(r.id).toBeTruthy();
  await page.evaluate(id => window.JJJWISH.openWk(id), r.id);
  await expect(page.locator('#view')).toContainText('<img src=x');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(errs).toEqual([]);
});

test('家庭帳號呼叫企業管理端的 API 會被拒絕', async ({ page }) => {
  await fresh(page); await login(page, 'li@example.com');
  for (const p of ['/admin/wish/board', '/admin/faq', '/admin/support']) {
    const r = await J(page, p);
    expect([401, 403], p).toContain(r._s);
  }
});

test('沒登入不能讀家庭資料：私人資料回 401，「我的作品」是空的', async ({ page }) => {
  await fresh(page); await page.goto('/jiujujia/app.html'); await page.waitForTimeout(1500);
  expect([401, 403]).toContain((await J(page, '/care/events/1'))._s);
  const mine = await J(page, '/wish/works?tab=mine');
  expect((mine.works || []).length).toBe(0);
});
