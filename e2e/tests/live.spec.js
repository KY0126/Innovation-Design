// 實用版骨架（S01 第三版）：/live/app/ 不設登入頁、整個揪居家要登入；/live/admin/ 打開先登入；Demo 版不受影響
// 對應 docs/prd/PRD.md US-14、docs/context/領域鐵律.md R15
const { test } = require('playwright/test');
const { fresh, expect } = require('./helpers');
const { createMock } = require('./live-mock');

test('實用版 App：打開就是首頁，標實用版，沒有示範帳號、導覽、揪問 AI，會員欄是註冊誘因', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page, false);
  await page.goto('/live/app/');
  await expect(page).toHaveURL(/jiujujia\/app\.html\?.*mode=live/);
  await expect(page.locator('.lv-tag')).toHaveText('實用版');
  await expect(page.locator('#loginForm')).toHaveCount(0);
  await expect(page.locator('[data-demo]')).toHaveCount(0);
  await expect(page.locator('.aifab')).toHaveCount(0);
  await expect(page.locator('#jgOpen, .jg-bar, #webDemo:visible, #envBadge:visible')).toHaveCount(0);
  await expect(page.locator('.lv-ban')).toContainText('註冊就送免費居家評估');
  await expect(page.locator('.lv-ban')).toContainText('邀家人一起加入，再送一份小禮');
  // 示範資料不出現在實用版畫面（R15）
  const txt = await page.locator('#view').innerText();
  for (const w of ['陳小姐', '林媽媽', '示範']) expect(txt).not.toContain(w);
  expect(errs).toEqual([]);
});

test('實用版 App：點揪居家、免費診斷、會員欄、會員中心都跳登入提示；返回關閉；登入設定未完成時確認後提示', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page, false);
  await page.goto('/live/app/');
  await expect(page.locator('.lv-tag')).toBeVisible();
  for (const sel of ['.hg1', '[data-hb="0"]', '.lv-ban', '[data-nav="m1"]', '[data-go="inbox"]']) {
    await page.click(sel);
    const dlg = page.locator('.lv-dlg');
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText('請先登入會員，即可使用更多 APP');
    await expect(dlg).toContainText('登入即享免費居家評估');
    await page.click('[data-lv="no"]');
    await expect(dlg).toHaveCount(0);
    // 沒有被帶進揪居家
    expect(await page.evaluate(() => window.JJJAPP.S.stack.join(','))).toBe('home');
  }
  // 大字不用登入
  await page.click('[data-a="big"]');
  await expect(page.locator('.lv-dlg')).toHaveCount(0);
  await page.click('.hg1');
  await page.click('[data-lv="ok"]');
  await expect(page.locator('.lv-toast')).toContainText('LINE 登入設定尚未完成');
  expect(errs).toEqual([]);
});

test('實用版後台：打開先登入，沒有示範帳號與導覽，帳號錯誤不能進入', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page, false);
  await createMock().install(page);
  await page.goto('/live/admin/');
  await expect(page).toHaveURL(/jiujujia\/admin\.html\?.*mode=live/);
  await expect(page.locator('#gate')).toBeVisible();
  await expect(page.locator('#gate .lv-adm')).toHaveText('實用版');
  await expect(page.locator('#gate [data-demo]')).toHaveCount(0);
  await expect(page.locator('#jgOpen')).toHaveCount(0);
  await page.fill('#gEmail', 'someone@example.com');
  await page.fill('#gPw', 'password123');
  await page.click('#gBtn');
  await expect(page.locator('#gate .gerr')).not.toBeEmpty();
  await expect(page.locator('#gate')).toBeVisible();
  expect(errs).toEqual([]);
});

test('Demo 版不受影響：/app 仍是登入頁與示範帳號，沒有實用版標示', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await fresh(page);
  await page.goto('/jiujujia/app.html');
  await expect(page.locator('#loginForm')).toBeVisible();
  await expect(page.locator('[data-demo]').first()).toBeVisible();
  await expect(page.locator('.lv-tag, .lv-ban')).toHaveCount(0);
  expect(await page.evaluate(() => window.JJJ_LIVE)).toBe(false);
});
