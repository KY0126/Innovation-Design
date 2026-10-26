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
module.exports = { fresh, expect };
