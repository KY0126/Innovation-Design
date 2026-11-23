// 點擊數基準（自動腳本版）：同一組任務，用「目前介面的最短路徑」實際點擊，記錄點擊數與落地頁可點選項目數。
// 用法：node e2e/clicks/measure.js <before|after> [port]  → 輸出 e2e/clicks/result_<label>.json
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
const label = process.argv[2] || 'run', port = process.argv[3] || '8790', B = `http://127.0.0.1:${port}`;
const P = require('./paths.js')[label];
async function login(p, page, who) {
  await p.goto(B + '/index.html'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('jjj_g_off', '1'); });
  await p.goto(B + '/jiujujia/' + page); await p.click(`[data-demo="${who}"]`); await p.waitForTimeout(2500); await p.addStyleTag({ content: '#webDemo,#jgOpen,#jDemo{display:none!important}' });
}
async function clickable(p) {
  return p.evaluate(() => [...document.querySelectorAll('button,a,[data-go],[data-tab],[data-v],select,input')]
    .filter(e => e.offsetParent && e.getBoundingClientRect().width > 0 && !e.closest('#webDemo,#jgOpen,.jg,.jdemo') && !e.closest('nav.bnav,.bnav,.homeNav'))
    .length);
}
(async () => {
  const b = await chromium.launch(); const out = { label, date: new Date().toISOString(), tasks: [], landing: [] };
  for (const T of P.tasks) {
    const mobile = T.page !== 'admin.html' && T.page !== 'consultant.html';
    const p = await b.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await login(p, T.page, T.who); let clicks = 0;
    for (const s of T.steps) {
      if (s.fill) { await p.fill(s.fill, s.text); continue; }
      if (s.select) { await p.selectOption(s.select, s.value); clicks++; await p.waitForTimeout(400); continue; }
      await p.locator(s).locator('visible=true').first().click({timeout:8000}); clicks++; await p.waitForTimeout(700);
    }
    let ok = false; for (const d of [].concat(T.done)) { if (await p.locator(d).locator('visible=true').count()) { ok = true; break; } }
    out.tasks.push({ id: T.id, name: T.name, who: T.whoName, clicks, ok, errs });
    await p.close();
  }
  for (const L of P.landing) {
    const mobile = L.page !== 'admin.html' && L.page !== 'consultant.html';
    const p = await b.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
    await login(p, L.page, L.who);
    for (const s of (L.steps || [])) { await p.locator(s).locator('visible=true').first().click({timeout:8000}); await p.waitForTimeout(700); }
    const n = await clickable(p);
    const h = await p.evaluate(() => { const sc = [document.scrollingElement,...document.querySelectorAll('.scroll,#view,main,.main,.content')].filter(e => e===document.scrollingElement||e.offsetParent).sort((a, b) => b.scrollHeight - a.scrollHeight)[0]; return sc ? Math.round(sc.scrollHeight / sc.clientHeight * 10) / 10 : 1; });
    out.landing.push({ id: L.id, name: L.name, clickable: n, screens: h });
    await p.close();
  }
  await b.close();
  require('fs').writeFileSync(path.join(__dirname, `result_${label}.json`), JSON.stringify(out, null, 1));
  console.table(out.tasks.map(t => ({ id: t.id, name: t.name, clicks: t.clicks, ok: t.ok, errs: t.errs.length })));
  console.table(out.landing);
})();
