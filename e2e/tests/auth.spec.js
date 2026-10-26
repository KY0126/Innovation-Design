const { test } = require('playwright/test');
const { fresh, expect } = require('./helpers');
const PW = 'demo1234';
async function appLogin(page, end, email) {
  await page.goto(`/jiujujia/app.html?end=${end}`);
  await page.fill('#lgEmail', email); await page.fill('#lgPw', PW); await page.click('#lgBtn');
}
// 2. 帳號放錯入口：擋下並提示正確入口
test.describe('放錯入口會被擋下', () => {
  test('家庭登入頁拒絕技師帳號', async ({ page }) => {
    await fresh(page); await appLogin(page, 'family', 'tech@example.com');
    await expect(page.locator('#loginForm .err')).toContainText('技師帳號');
    await expect(page.locator('#loginForm')).toBeVisible();
  });
  test('技師端拒絕家庭帳號', async ({ page }) => {
    await fresh(page); await appLogin(page, 'tech', 'chen@example.com');
    await expect(page.locator('#loginForm .err')).toContainText('家庭帳號');
  });
  test('家庭登入頁拒絕生活顧問帳號', async ({ page }) => {
    await fresh(page); await appLogin(page, 'family', 'advisor@example.com');
    await expect(page.locator('#loginForm .err')).toContainText('生活顧問帳號');
  });
  test('生活顧問端拒絕總部帳號', async ({ page }) => {
    await fresh(page); await page.goto('/jiujujia/consultant.html');
    await page.fill('#cLogin [name=email]', 'manager@example.com'); await page.fill('#cLogin [name=password]', PW);
    await page.click('#cLogin button[type=submit]');
    await expect(page.locator('#cLogin .er')).toContainText('總部帳號');
    await expect(page.locator('#cGate')).toBeVisible();
  });
  test('企業管理端拒絕家庭帳號', async ({ page }) => {
    await fresh(page); await page.goto('/jiujujia/admin.html');
    await page.fill('#gEmail', 'chen@example.com'); await page.fill('#gPw', PW); await page.click('#gBtn');
    await expect(page.locator('#gate .gerr')).not.toBeEmpty();
    await expect(page.locator('#gate')).toBeVisible();
  });
  test('密碼錯誤顯示錯誤訊息', async ({ page }) => {
    await fresh(page); await page.goto('/jiujujia/app.html?end=family');
    await page.fill('#lgEmail', 'chen@example.com'); await page.fill('#lgPw', 'wrong'); await page.click('#lgBtn');
    await expect(page.locator('#loginForm .err')).not.toBeEmpty();
  });
});
// 3. 一鍵登入：四端各自進到自己的首頁
test.describe('一鍵示範登入', () => {
  test('消費者端｜陳小姐', async ({ page }) => {
    const errs = await fresh(page); await page.goto('/jiujujia/app.html?end=family');
    await page.click('[data-demo="chen@example.com"]');
    await expect(page.locator('#view')).toContainText('AI 顧問阿國');
    expect(errs).toEqual([]);
  });
  test('技師端｜吳技師', async ({ page }) => {
    const errs = await fresh(page); await page.goto('/jiujujia/app.html?end=tech');
    await page.click('[data-demo="tech@example.com"]');
    await expect(page.locator('#view')).toContainText('我的工單');
    await expect(page.locator('#view')).toContainText('吳技師');
    expect(errs).toEqual([]);
  });
  test('生活顧問端｜王小明', async ({ page }) => {
    const errs = await fresh(page); await page.goto('/jiujujia/consultant.html');
    await page.click('#cLogin [data-demo]');
    await expect(page.locator('#cGate')).toBeHidden();
    await expect(page.locator('.panel', { hasText: '新進案件與 AI 分析' })).toBeVisible();
    await expect(page.locator('#who')).toHaveText('王小明');
    expect(errs).toEqual([]);
  });
  test('企業管理端｜張經理', async ({ page }) => {
    const errs = await fresh(page); await page.goto('/jiujujia/admin.html');
    await page.click('#gate [data-demo="manager@example.com"]');
    await expect(page.locator('#gate')).toBeHidden();
    await expect(page.locator('#title')).toHaveText('即時總覽');
    expect(errs).toEqual([]);
  });
  test('換到另一端時，前一端的登入不會被沿用', async ({ page }) => {
    await fresh(page); await page.goto('/jiujujia/app.html?end=family');
    await page.click('[data-demo="chen@example.com"]');
    await expect(page.locator('#view')).toContainText('AI 顧問阿國');
    await page.goto('/jiujujia/app.html?end=tech');
    await expect(page.locator('#loginForm')).toBeVisible();
    await expect(page.getByText('技師登入')).toBeVisible();
  });
});
