// 實用版第二階段：LINE 登入、建立長輩家、居家評估燈號、分享 S1、後台送出正式報價（P1）、我很好回覆頁、揪心願公開頁
// Supabase 與 LINE 都用 live-mock.js 模擬；真實連線在第 6 步設定好後用手機實測
const { test } = require('playwright/test');
const { fresh, expect } = require('./helpers');
const { createMock } = require('./live-mock');
const { familyDB } = require('./live-db');

const desktopOnly = (info) => test.skip(info.project.name !== 'desktop');

function familyMock() {
  return createMock({
    functions: { 'line-login': (b) => (b.code === 'test-code' ? { data: { token_hash: 'th-1', first: true } } : { status: 401, data: { error: 'x' } }) },
    rpc: {
      create_household: (b, st) => { const id = st.nextId++; st.db.households.push({ id, elder_name: b.p_elder_name, elder_note: b.p_elder_note, store: b.p_store, stage: 0, created_at: new Date().toISOString() }); st.db.members.push({ household_id: id, user_id: st.me.id, relation: 'child' }); return id; },
      create_invite: () => 'ABC123',
      household_members: () => [{ user_id: 'u-family', display_name: '陳測試', relation: 'child', is_me: true }],
      wish_count: () => 0,
    },
  });
}

test('實用版：未登入點揪居家，確認後用 LINE 登入；沒有長輩家先建立，建立後直接進 Demo 同一套畫面（資料接 Supabase）', async ({ page }, info) => {
  desktopOnly(info);
  const errs = await fresh(page, false);
  const M = familyDB({ withHH: false });
  await M.install(page);
  await page.goto('/live/app/');
  await expect(page.locator('.lv-ban')).toContainText('註冊就送免費居家評估');
  await page.click('.hg1');
  await page.click('[data-lv="ok"]');
  // LINE 登入：帶 Channel ID、加好友選項、回到實用版入口
  await expect(page.locator('[data-lv-page="jjj"]')).toBeVisible({ timeout: 15000 });
  expect(M.st.authorize.client_id).toBe('TEST-CHANNEL');
  expect(M.st.authorize.bot_prompt).toBe('normal');
  expect(M.st.authorize.redirect_uri).toMatch(/\/live\/app\/$/);
  expect(M.st.calls.find((c) => c.name === 'line-login').body.code).toBe('test-code');
  await expect(page).not.toHaveURL(/code=/);
  await expect(page.locator('#view')).toContainText('先建立長輩家');

  // 建立長輩家：建好就進 Demo 畫面（首頁、揪居家都是同一套）
  await page.click('[data-lv="newhh"]');
  await page.fill('#lvHH [name="elder"]', '媽媽');
  await page.click('#lvHH button[type="submit"]');
  await page.waitForFunction(() => window.JJJLIVEAPI.active() && window.JJJAPP.S.me && window.JJJAPP.S.hh);
  expect(await page.evaluate(() => [window.JJJAPP.S.me.role, window.JJJAPP.S.hh.household.name, window.JJJAPP.S.cfg.demo])).toEqual(['family', '媽媽家', false]);
  await expect(page.locator('.lv-tag')).toContainText('實用版');
  await page.click('.hg1');
  await expect(page.locator('#view')).toContainText('先幫長輩家做評估');
  await expect(page.locator('#view')).toContainText('媽媽');
  // 重新整理：已登入又有長輩家，直接進 App 畫面
  await page.reload();
  await page.waitForFunction(() => window.JJJLIVEAPI && window.JJJLIVEAPI.active() && window.JJJAPP.S.hh, null, { timeout: 15000 });
  expect(errs).toEqual([]);
});

test('實用版：燈號規則（門檻 0.5／3 cm、走道 80 cm、偏暗加門檻）', async ({ page }, info) => {
  desktopOnly(info);
  await fresh(page, false);
  const M = familyMock(); await M.install(page);
  await page.goto('/live/app/');
  await expect.poll(() => page.evaluate(() => !!window.JJJLIVE_RULES)).toBe(true);
  const r = await page.evaluate(() => {
    const f = window.JJJLIVE_RULES.lights, c = (d) => f(d).map((x) => x.c).join('');
    return {
      ok: c({ corridor_cm: 90, threshold_cm: 0.5, dark: false }),
      mid: c({ corridor_cm: 90, threshold_cm: 2, dark: false }),
      high: c({ corridor_cm: 90, threshold_cm: 3.5, dark: false }),
      narrow: c({ corridor_cm: 79, threshold_cm: 0, dark: false }),
      darkFlat: c({ corridor_cm: 90, threshold_cm: 0, dark: true }),
      darkStep: c({ corridor_cm: 90, threshold_cm: 1, dark: true }),
    };
  });
  expect(r).toEqual({ ok: 'ggg', mid: 'ygg', high: 'rgg', narrow: 'grg', darkFlat: 'ggy', darkStep: 'rgr' });
});

test('實用版：LINE 登入設定還沒填 Channel ID 時，確認後提示設定尚未完成', async ({ page }, info) => {
  desktopOnly(info);
  await fresh(page, false);
  const M = familyMock(); await M.install(page, { channel: '' });
  await page.goto('/live/app/');
  await page.click('.hg1');
  await page.click('[data-lv="ok"]');
  await expect(page.locator('.lv-toast')).toContainText('LINE 登入設定尚未完成');
});

test('實用版後台：生活顧問登入、看到本門市家庭、送出正式報價並通知家人（P1）', async ({ page }, info) => {
  desktopOnly(info);
  const errs = await fresh(page, false);
  const M = createMock({
    staff: [{ id: 'u-adv', email: 'advisor@store.example', password: 'pass12345' }],
    db: {
      profiles: [{ id: 'u-adv', display_name: '王顧問', role: 'advisor', store: 'Digital City 高雄民族店' }],
      households: [{ id: 7, elder_name: '林媽媽', store: 'Digital City 高雄民族店', stage: 0, created_at: new Date().toISOString() }],
      members: [{ household_id: 7, user_id: 'a' }, { household_id: 7, user_id: 'b' }],
      assessments: [{ household_id: 7, result: { lights: [{ c: 'r' }, { c: 'y' }, { c: 'g' }] }, created_at: new Date().toISOString() }],
    },
    functions: { 'line-push': (b) => ({ data: { ok: true, total: 2, sent: 0, line: false } }) },
  });
  await M.install(page);
  await page.goto('/live/admin/');
  await page.fill('#gEmail', 'advisor@store.example');
  await page.fill('#gPw', 'pass12345');
  await page.click('#gBtn');
  await expect(page.locator('#lvAdm')).toContainText('本門市家庭');
  await expect(page.locator('#lvAdm')).toContainText('林媽媽家');
  await expect(page.locator('#lvAdm')).toContainText('1 紅 1 黃');
  await page.click('[data-la="quote"]');
  await page.fill('#lvQF textarea', '感應小夜燈｜床邊,690\n浴室止滑條,450');
  await page.click('#lvQF button[type="submit"]');
  await expect(page.locator('.lv-toast')).toContainText('第 1 版正式報價已送出');
  await expect(page.locator('.lv-toast')).toContainText('已通知 2 人');
  const q = M.st.db.quotes[0];
  expect(q).toMatchObject({ household_id: 7, version: 1, total: 1140, is_formal: true, advisor_id: 'u-adv' });
  const call = M.st.calls.find((c) => c.name === 'line-push');
  expect(call.body).toMatchObject({ action: 'quote', quote_id: q.id });
  expect(call.auth).toMatch(/^Bearer /);
  expect(errs).toEqual([]);
});

test('實用版後台：家庭帳號不能進後台', async ({ page }, info) => {
  desktopOnly(info);
  await fresh(page, false);
  const M = createMock({ staff: [{ id: 'u-f', email: 'f@example.com', password: 'pass12345' }], db: { profiles: [{ id: 'u-f', role: 'family' }] } });
  await M.install(page);
  await page.goto('/live/admin/');
  await page.fill('#gEmail', 'f@example.com'); await page.fill('#gPw', 'pass12345'); await page.click('#gBtn');
  await expect(page.locator('#gate .gerr')).toContainText('不是員工帳號');
  await expect(page.locator('#lvAdm')).toHaveCount(0);
});

test('我很好回覆頁：不用登入，先確認再送出；連結用過就不能再用', async ({ page }, info) => {
  desktopOnly(info);
  await fresh(page, false);
  let used = false;
  const M = createMock({ functions: { 'line-push': (b) => { if (b.action !== 'reply' || b.t !== 'tok1' || used) return { status: 410, data: { error: '這個連結已經用過或過期了' } }; used = true; return { data: { ok: true, reply: b.a } }; } } });
  await M.install(page);
  await page.goto('/live/ok/?t=tok1&a=ok');
  await expect(page.locator('h1')).toHaveText('昨晚還好嗎？');
  await page.click('button[data-a="ok"]');
  await expect(page.locator('h1')).toHaveText('已告訴家人：您很好');
  expect(M.st.calls[0].body).toEqual({ action: 'reply', t: 'tok1', a: 'ok' });
  await page.goto('/live/ok/?t=tok1&a=ok');
  await page.click('button[data-a="ok"]');
  await expect(page.locator('h1')).toHaveText('這個連結已經用過了');
  await expect(page.locator('body')).not.toContainText('全國電子');
});

test('揪心願公開頁：不登入可以看作品與人數，按「我也需要」到實用版登入', async ({ page }, info) => {
  desktopOnly(info);
  await fresh(page, false);
  const M = createMock({ db: { wish_works: [{ id: 5, title: '浴室夜燈扶手組', scene: '臥室到浴室' }] }, rpc: { wish_count: () => 7 } });
  await M.install(page);
  await page.goto('/live/wish/?id=5');
  await expect(page.locator('h1')).toHaveText('浴室夜燈扶手組');
  await expect(page.locator('main')).toContainText('7 人也需要｜還差 13 人到下一個門檻');
  await expect(page.locator('a.btn')).toHaveAttribute('href', /\/live\/app\/\?wish=5$/);
});
