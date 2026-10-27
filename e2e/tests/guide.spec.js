const { test } = require('playwright/test');
const { expect } = require('./helpers');
// 以另一個角色查詢資料：開第二個分頁（同一個瀏覽器，資料共用），查完把登入換回原本的人
async function peek(page, email, path) {
  const ctx = page.context();
  await ctx.route('**/jiujujia/__peek.html', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><script src="backend.js"></script>' }));
  const p2 = await ctx.newPage();
  await p2.goto('/jiujujia/__peek.html');
  const j = await p2.evaluate(async ([email, path]) => {
    const K = 'jjj_web_sid_v7', keep = localStorage.getItem(K);
    const h = { 'Content-Type': 'application/json', 'X-JJJ': '1' };
    await fetch('/api/auth/login', { method: 'POST', headers: h, body: JSON.stringify({ email, password: 'demo1234' }) });
    const r = await fetch(path, { headers: h }); const out = await r.json();
    if (keep) localStorage.setItem(K, keep); else localStorage.removeItem(K);
    return out;
  }, [email, path]);
  await p2.close();
  return j;
}
module.exports.peek = peek;

async function panel(page) {
  return page.evaluate(() => {
    const g = document.getElementById('jg'); if (!g || g.hidden) return null;
    const h = g.querySelector('h2'), n = g.querySelector('.hd b');
    return { busy: [...g.querySelectorAll('.ft button')].some(b => b.disabled), n: n && n.textContent, h: h && h.textContent, btns: [...g.querySelectorAll('.ft button')].map(b => b.dataset.t), miss: [...g.querySelectorAll('.li')].filter(l => l.classList.contains('miss')).map(l => l.textContent.trim()), boxes: [...document.querySelectorAll('.jgb')].filter(x => x.style.display === 'block').length, url: location.pathname + location.search };
  });
}
const snap = async page => ({
  adv: await peek(page, 'advisor@example.com', '/api/advisor/home'),
  wo: await peek(page, 'manager@example.com', '/api/admin/workorders'),
  bk: await peek(page, 'manager@example.com', '/api/admin/bookings'),
  ov: await peek(page, 'manager@example.com', '/api/admin/overview'),
});

test('導覽全部步驟跨 App 與企業管理端走完：每步編號框都找得到、沒有錯誤或對話框，資料即時串接', async ({ page }, info) => {
  test.setTimeout(420_000);
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('dialog', d => { errs.push('dialog: ' + d.message()); d.dismiss(); });
  await page.goto('/consumer.html');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/consumer.html');
  await expect(page.locator('#jg')).toBeVisible({ timeout: 10_000 });
  const seen = new Set(), log = [], S = {}, ui = {};
  S.start = await snap(page);
  for (let guard = 0; guard < 90; guard++) {
    // 等畫面穩定：編號框都找到，最多 6 秒
    let st;
    for (let k = 0; k < 20; k++) { await page.waitForTimeout(500); st = await panel(page).catch(() => null); if (st && !st.busy && st.miss.length === 0) break; }
    if (!st) break;
    if (process.env.WALKLOG) console.log('STEP', JSON.stringify(st)); log.push(`${st.n}｜${st.h}｜框 ${st.boxes}${st.miss.length ? '｜找不到：' + st.miss.join('／') : ''}`);
    expect.soft(st.miss, `${st.n} ${st.h} 的編號項目要找得到`).toEqual([]);
    seen.add(st.n);
    if (st.h === '生活顧問（電腦版）｜今天') ui.kpiQuote = await page.locator('.kpis > *', { hasText: '待整合報價' }).first().innerText();
    if (st.h === '整合成一張報價') ui.handoffNote = await page.getByText('家庭交付').count();
    if (st.h === '技師｜今日工單') ui.techCard = await page.locator('.card.focus').first().innerText();
    const has = t => st.btns.includes(t);
    if (has('goend')) { await Promise.all([page.waitForNavigation(), page.click('#jg [data-t="goend"]')]); await expect(page.locator('#jg')).toBeVisible({ timeout: 10_000 }); continue; }
    if (has('login')) { await page.click('#jg [data-t="login"]'); await expect.poll(async () => { const p = await panel(page).catch(() => null); return !!p && !p.busy && !p.btns.includes('login'); }, { timeout: 20_000 }).toBeTruthy(); continue; }
    if (has('act')) {
      await page.click('#jg [data-t="act"]');
      await expect.poll(async () => { const s = await panel(page); return !s || (!s.busy && (s.h !== st.h || !s.btns.includes('act'))); }, { timeout: 20_000 }).toBeTruthy();
      if (st.h === '請生活顧問報價') S.handoff = await page.evaluate(() => JSON.parse(localStorage.getItem('jjj_v5_handoff') || '[]'));
      if (st.h.includes('現場不符就回報')) S.diff = await snap(page);
      if (st.h === '長輩逐區驗收') S.accept = await snap(page);
      if (st.h.includes('後關心｜揪居家')) S.book = await snap(page);
      const s2 = await panel(page); if (!s2 || s2.h !== st.h) continue;
    }
    const nx = page.locator('#jg [data-t="next"]');
    const lab = await nx.textContent();
    await nx.click();
    if (lab.includes('完成')) break;
  }
  await info.attach('walk.txt', { body: log.join('\n'), contentType: 'text/plain' });
  console.log(log.join('\n'));
  expect(seen.size, '導覽每一步都有走到').toBe(require('fs').readFileSync(require('path').join(__dirname, '../../jiujujia/guide.js'), 'utf8').match(/^\s+[A-Z]\(\{ ch:/gm).length);
  // ---- 資料串接 ----
  // 工單編號含日期（W-年月日-序號），改用家庭＋類型找，避免跨日或時區不同對不到
  const W = s => s.wo.orders.find(o => o.household === '林女士家' && o.kind === '到府安裝' && /^W-\d{8}-06$/.test(o.code));
  // ① 消費者端送出 → 生活顧問端「待整合報價」收到
  expect(S.handoff.length, '消費者端送出的改善選擇有存下來').toBeGreaterThan(0);
  expect(S.handoff[0].items.map(i => i.space).join('、'), '交付內容含走道與浴室').toMatch(/走道.*浴室|浴室.*走道/);
  expect(ui.kpiQuote, '生活顧問端「今天」看得到待整合報價').toMatch(/待整合報價\s*[1-9]/);
  expect(ui.handoffNote, '生活顧問端報價頁顯示家庭交付內容').toBeGreaterThan(0);
  // ② 企業管理端派的工單 → 技師端今日工單
  expect(ui.techCard, '吳技師今日工單是林女士家').toContain('林女士');
  // ③ 技師回報差異 → 生活顧問端待審差異 +1、工單多一筆差異
  expect(S.diff.adv.kpi.review - S.start.adv.kpi.review, '生活顧問待審差異 +1').toBe(1);
  expect((W(S.diff).diffs || []).length - (W(S.start).diffs || []).length, '工單差異紀錄 +1').toBe(1);
  // ④ 長輩驗收 → 工單完成、企業管理端關懷中家庭 +1
  expect(W(S.start).status).toBe('已指派');
  expect(W(S.accept).status, '驗收後工單變成已完成').toBe('已完成');
  expect(S.accept.ov.kpi.caring - S.start.ov.kpi.caring, '關懷中家庭 +1').toBe(1);
  // ⑤ 李小姐一鍵預約維護 → 企業管理端多一張待確認的維護工單
  const before = new Set(S.accept.wo.orders.map(o => o.code));
  const added = S.book.wo.orders.filter(o => !before.has(o.code));
  expect(added.map(o => `${o.kind}｜${o.status}｜${o.household}`), '企業管理端收到新的維護工單').toEqual([expect.stringMatching(/設備維護｜待確認｜李先生家/)]);
  await info.attach('sync.json', { body: JSON.stringify({ ui, handoff: S.handoff, review: [S.start.adv.kpi.review, S.diff.adv.kpi.review], W06: [W(S.start).status, W(S.accept).status], added }, null, 1), contentType: 'application/json' });
  expect(errs).toEqual([]);
});
