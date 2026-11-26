const { test } = require('playwright/test');
const { expect, tapDemo } = require('./helpers');
// 分身分導覽：登入哪個身分就跑哪一套，每套 6～8 步；每步的編號框都要找得到
async function panel(page) {
  return page.evaluate(() => {
    const g = document.getElementById('jg'); if (!g || g.hidden) return null;
    const h = g.querySelector('h2'), n = g.querySelector('.hd b');
    return { busy: [...g.querySelectorAll('.ft button')].some(b => b.disabled), n: n && n.textContent, h: h && h.textContent, btns: [...g.querySelectorAll('.ft button')].map(b => b.dataset.t), next: (g.querySelector('.ft [data-t="next"]') || {}).textContent, miss: [...g.querySelectorAll('.li')].filter(l => l.classList.contains('miss')).map(l => l.textContent.trim()) };
  });
}
for (const [role, url, demo, first] of [
  ['家庭', '/jiujujia/app.html', 'chen@example.com', '首頁就有揪居家入口'],
  ['技師', '/jiujujia/app.html', 'tech@example.com', '技師｜今日工單'],
  ['生活顧問', '/jiujujia/consultant.html', null, '生活顧問（電腦版）｜今天'],
  ['總部', '/jiujujia/admin.html', null, '企業管理端｜即時總覽'],
]) {
  test(`${role}導覽：6～8 步走完，每步編號框都找得到`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    test.setTimeout(240_000);
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.goto(url);
    if (demo) { await tapDemo(page, `[data-demo="${demo}"]`); await page.waitForTimeout(2500); await page.evaluate(() => JJJGUIDE.start()); }
    else { await expect(page.locator('#jg [data-t="login"]')).toBeVisible({ timeout: 10_000 }); await page.click('#jg [data-t="login"]'); }
    await expect(page.locator('#jg h2')).toHaveText(first, { timeout: 20_000 });
    const seen = [];
    for (let k = 0; k < 14; k++) {
      let st; for (let w = 0; w < 20; w++) { await page.waitForTimeout(500); st = await panel(page); if (st && !st.busy && !st.miss.length) break; }
      if (!st) { await page.waitForTimeout(4000); st = await panel(page); if (!st) break; }
      if (st.btns.includes('login')) { await page.click('#jg [data-t="login"]'); await page.waitForTimeout(4000); continue; }
      if (st.btns.includes('goend')) { await page.click('#jg [data-t="goend"]'); await page.waitForTimeout(5000); continue; }
      expect.soft(st.miss, `${role} ${st.n} ${st.h}`).toEqual([]);
      if (!seen.includes(st.h)) seen.push(st.h);
      if (st.btns.includes('act')) {
        await page.click('#jg [data-t="act"]');
        await expect.poll(async () => { const s = await panel(page); return !s || (!s.busy && (s.h !== st.h || !s.btns.includes('act'))); }, { timeout: 30_000 }).toBeTruthy();
        const s2 = await panel(page); if (!s2 || s2.h !== st.h) continue;
      }
      const last = /完成.*導覽/.test(st.next || '');
      await page.click('#jg [data-t="next"]');
      if (last) break;
    }
    console.log(role, seen.length, seen.join(' → '));
    expect(seen.length).toBeGreaterThanOrEqual(6);
    expect(seen.length).toBeLessThanOrEqual(8);
    await expect(page.locator('#jg')).toBeHidden();
    expect(errs).toEqual([]);
  });
}
