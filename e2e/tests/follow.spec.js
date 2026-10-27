const { test } = require('playwright/test');
const { expect } = require('./helpers');
// 導覽跟著畫面走：A 自己點也算完成／B 畫面對得上就跟上／C 沒涵蓋的畫面給提示／D 返回不自動倒退
const h2 = page => page.locator('#jg h2').first();
const note = page => page.locator('#jg .jgn').first();
async function startFamily(page) {
  await page.goto('/consumer.html'); await page.evaluate(() => localStorage.clear()); await page.goto('/consumer.html');
  await expect(page.locator('#jg [data-t="login"]')).toBeVisible({ timeout: 10_000 });
  await page.click('#jg [data-t="login"]');
  await expect(h2(page)).toHaveText('首頁就有 AI 顧問阿國', { timeout: 15_000 });
  await expect(page.locator('#jg [data-t="next"]')).toBeEnabled();
}
test('A 自己點了「幫我點」要點的按鈕 → 自動前往下一步', async ({ page }) => {
  await startFamily(page);
  const sel = await page.evaluate(() => JJJGUIDE.steps[0].act.click);
  await page.locator(sel).filter({ visible: true }).first().click();
  await expect(h2(page)).toHaveText('由家人代填', { timeout: 10_000 });
  await expect(note(page)).toContainText('已完成第 1 步，自動前往第 2 步');
});
test('B 直接走到某一步專屬的畫面 → 卡片跟上', async ({ page }) => {
  await startFamily(page);
  await page.evaluate(() => JJJ.go('ar'));
  await expect(h2(page)).toHaveText('AR 掃描（場勘）', { timeout: 10_000 });
  await expect(note(page)).toContainText('第 1 步 → 第 3 步');
  await expect(note(page)).toContainText('目錄');
});
test('C 走到導覽沒介紹的畫面 → 提示，不跳；按「帶我回」回到原畫面', async ({ page }) => {
  await startFamily(page);
  await page.evaluate(() => JJJ.go('fam'));
  await expect(page.locator('#jg')).toContainText('這個畫面不在導覽裡', { timeout: 10_000 });
  await expect(page.locator('#jg')).toContainText('你目前在：家庭成員');
  await expect(page.locator('#jg .hd b')).toHaveText(/^導覽 1／\d+$/);
  await page.click('#jg [data-t="back"]');
  await expect(page.locator('#jg')).not.toContainText('這個畫面不在導覽裡');
  expect(await page.evaluate(() => JJJ.S.stack.at(-1))).toBe('home');
  await expect(h2(page)).toHaveText('首頁就有 AI 顧問阿國');
});
test('C 「先收合導覽」→ 面板收起，按「繼續導覽」接著同一步', async ({ page }) => {
  await startFamily(page);
  await page.evaluate(() => JJJ.go('fam'));
  await expect(page.locator('#jg [data-t="fold"]')).toBeVisible({ timeout: 10_000 });
  await page.click('#jg [data-t="fold"]');
  await expect(page.locator('#jg')).toBeHidden();
  await expect(page.locator('#jgOpen')).toHaveText('繼續導覽');
  await page.evaluate(() => JJJ.go('home'));
  await page.click('#jgOpen');
  await expect(h2(page)).toHaveText('首頁就有 AI 顧問阿國');
});
test('D 按返回回到前一步的畫面 → 卡片不倒退，提示按「上一步」', async ({ page }) => {
  await startFamily(page);
  await page.click('#jg [data-t="next"]');
  await expect(h2(page)).toHaveText('由家人代填', { timeout: 10_000 });
  await expect(page.locator('#jg [data-t="next"]')).toBeEnabled();
  await page.locator('#view [data-a="back"]').filter({ visible: true }).first().click();
  await expect(page.locator('#jg')).toContainText('你回到上一個畫面', { timeout: 10_000 });
  await expect(h2(page)).toHaveText('由家人代填');
  await expect(page.locator('#jg')).toHaveClass(/nd/);
});
test('企業管理端：點側欄跳到後面的分頁 → 卡片跟上；點導覽沒介紹的分頁 → 提示', async ({ page }) => {
  await page.goto('/jiujujia/admin.html'); await page.evaluate(() => localStorage.clear()); await page.goto('/jiujujia/admin.html');
  await expect(page.locator('#jg [data-t="login"]')).toBeVisible({ timeout: 10_000 });
  await page.click('#jg [data-t="login"]');
  await expect(h2(page)).toHaveText('企業管理端｜即時總覽', { timeout: 15_000 });
  await expect(page.locator('#jg [data-t="next"]')).toBeEnabled();
  await page.click('#nav [data-tab="wo"]');
  await expect(h2(page)).toHaveText('工單', { timeout: 10_000 });
  const live = await page.evaluate(() => JJJGUIDE.steps.findIndex(s => s.end === 'admin' && s.nav && s.nav.tab === 'live') + 1), wo = await page.evaluate(() => JJJGUIDE.steps.findIndex(s => s.end === 'admin' && s.nav && s.nav.tab === 'wo') + 1);
  await expect(note(page)).toContainText(`第 ${live} 步 → 第 ${wo} 步`);
  await expect(page.locator('#jg [data-t="next"]')).toBeEnabled();
  const other = await page.evaluate(() => { const used = new Set(JJJGUIDE.steps.filter(s => s.end === 'admin' && s.nav).map(s => s.nav.tab)); return [...document.querySelectorAll('#nav [data-tab]')].map(b => b.dataset.tab).find(t => !used.has(t)); });
  await page.click(`#nav [data-tab="${other}"]`);
  await expect(page.locator('#jg')).toContainText('這個畫面不在導覽裡', { timeout: 10_000 });
});
