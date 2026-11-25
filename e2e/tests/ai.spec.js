// 工作包 3：揪問 AI。浮動按鈕（真人形象）→ 對話頁，依資料回答；流程頁、通知頁、技師不顯示
const { test } = require('playwright/test');
const { fresh, expect } = require('./helpers');
const app = (page, f) => page.evaluate(new Function('return (' + f + ')(window.JJJAPP)'));

test('家庭：揪居家主頁有浮動按鈕；問長輩狀況、價格，回答來自資料；答不了轉生活顧問', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/app.html');
  await page.click('[data-demo="li@example.com"]'); await page.waitForTimeout(1500);
  await app(page, "A=>{A.S.stack=['home','m2'];A.render()}");
  await expect(page.locator('.aifab img')).toHaveAttribute('src', /staff/);
  await expect(page.locator('.aifab')).toContainText('揪問 AI');
  await page.click('[data-aigo]');
  await page.click('[data-aiq="媽媽昨晚還好嗎？"]');
  await expect(page.locator('.aim').last()).toContainText('長輩確認');
  await page.click('[data-aiq="揪全家多少錢？"]');
  await expect(page.locator('.aim').last()).toContainText('699');
  await page.fill('#aiQ', '可以幫我修水管嗎'); await page.press('#aiQ', 'Enter');
  await expect(page.locator('.aim').last().locator('[data-aireq]')).toBeVisible();
  // 流程頁不顯示
  await app(page, "A=>{A.go('b1')}");
  await expect(page.locator('.aifab')).toHaveCount(0);
  // 收起後，回到揪居家主頁才再出現
  await app(page, "A=>{A.S.stack=['home','m2','hf'];A.render()}");
  await page.click('[data-aihide]');
  await expect(page.locator('.aifab')).toHaveCount(0);
  await app(page, "A=>{A.go('gl')}");
  await expect(page.locator('.aifab')).toHaveCount(0);
  await app(page, "A=>{A.S.stack=['home','m2'];A.render()}");
  await expect(page.locator('.aifab')).toHaveCount(1);
  expect(errs).toEqual([]);
});

test('生活顧問可以問案件進度；技師沒有揪問 AI', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/app.html');
  await page.click('[data-demo="advisor@example.com"]'); await page.waitForTimeout(1500);
  await page.click('[data-aigo]');
  await page.click('[data-aiq="黃先生家進度"]');
  await expect(page.locator('.aim').last()).toContainText('待問診');
  await page.evaluate(async () => { await fetch('/api/auth/logout', { method: 'POST', headers: { 'X-JJJ': '1' } }); });
  await page.goto('/jiujujia/app.html'); await page.click('[data-demo="tech@example.com"]'); await page.waitForTimeout(1500);
  await expect(page.locator('.aifab')).toHaveCount(0);
  expect(errs).toEqual([]);
});
