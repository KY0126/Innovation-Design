// tests/ 底下各層共用：沿用 ../e2e 安裝的 Playwright（同一個實例），以及示範資料的小工具
const path = require('node:path');
const pw = require(require.resolve('playwright/test', { paths: [path.join(__dirname, '../e2e')] }));
const { fresh } = require('../e2e/tests/helpers');
// 呼叫模擬後端 /api（和 e2e/tests/v2.spec.js 同一寫法）
const J = (page, p, o) => page.evaluate(async ([p, o]) => { const r = await fetch('/api' + p, Object.assign({ headers: { 'Content-Type': 'application/json', 'X-JJJ': '1' } }, o || {})); let j = {}; try { j = await r.json(); } catch (e) {} return Object.assign({ _s: r.status }, j); }, [p, o ? Object.assign({}, o, { body: o.body ? JSON.stringify(o.body) : undefined }) : o]);
const login = async (page, email) => { await page.goto('/jiujujia/app.html'); await page.locator(`[data-demo="${email}"]`).waitFor({ state: "attached" }); await page.$eval(`[data-demo="${email}"]`, (e) => e.click()); await page.waitForTimeout(1500); };
const app = (page, f) => page.evaluate(new Function('return (' + f + ')(window.JJJAPP)'));
module.exports = { test: pw.test, expect: pw.expect, fresh, J, login, app };
