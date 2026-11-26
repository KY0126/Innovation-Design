const { expect } = require('playwright/test');
// 每個測試前：清空示範資料、關閉自動導覽，收集頁面錯誤與對話框
async function fresh(page, guideOff = true) {
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('dialog', d => { errs.push('dialog: ' + d.message()); d.dismiss(); });
  await page.goto('/index.html');
  await page.evaluate(off => { localStorage.clear(); if (off) localStorage.setItem('jjj_g_off', '1'); }, guideOff);
  return errs;
}
// 示範帳號收在「展示用」抽屜裡（S11）：測試直接觸發按鈕，不必先展開
async function tapDemo(page, sel) {
  await page.locator(sel).first().waitFor({ state: 'attached' });
  await page.$eval(sel, (e) => e.click());
}
module.exports = { fresh, expect, tapDemo };
